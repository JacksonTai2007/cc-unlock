"""Run with python app.py --open; localhost only, no external services."""
from __future__ import annotations

import argparse
import hashlib
import json
import os
import secrets
import sys
import threading
import webbrowser
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlparse

from editor_core import Editor, EditorError
import message_edit  # Load the same code generation as Editor, not later disk edits.
import force_edit

ROOT = Path(__file__).resolve().parent
APP_VERSION = '1.5'
UI_ASSETS = {'editor.css': 'text/css; charset=utf-8', 'editor-api.js': 'text/javascript; charset=utf-8',
             'editor-view.js': 'text/javascript; charset=utf-8', 'editor-dialog.js': 'text/javascript; charset=utf-8',
             'editor-actions.js': 'text/javascript; charset=utf-8',
             'editor.js': 'text/javascript; charset=utf-8'}
BUILD_FILES = ('app.py', 'editor_core.py', 'message_edit.py', 'force_edit.py', 'writer_lock_cleanup.py', 'index.html', *UI_ASSETS)


def build_id():
    digest = hashlib.sha256()
    for name in BUILD_FILES:
        digest.update(name.encode('utf-8') + b'\0')
        digest.update((ROOT / name).read_bytes())
        digest.update(b'\0')
    return digest.hexdigest()


STARTUP_BUILD = build_id()


def make_server(editor, port=0):
    token = secrets.token_urlsafe(32)
    instance_id = secrets.token_hex(16)
    html_at_start = (ROOT / 'index.html').read_text(encoding='utf-8')

    def health():
        return {'app': 'codex-chat-editor', 'version': APP_VERSION, 'build_id': STARTUP_BUILD,
                'update_required': build_id() != STARTUP_BUILD, 'mode': 'demo' if editor.demo else 'live',
                'instance_id': instance_id}

    class Handler(BaseHTTPRequestHandler):
        def log_message(self, *args):
            pass  # URLs can contain private thread IDs; do not retain access logs.

        def send(self, status, body, content_type='application/json; charset=utf-8'):
            data = body if isinstance(body, bytes) else json.dumps(body, ensure_ascii=False).encode('utf-8')
            self.send_response(status)
            self.send_header('Content-Type', content_type)
            self.send_header('Content-Length', str(len(data)))
            self.send_header('Cache-Control', 'no-store')
            self.send_header('X-Content-Type-Options', 'nosniff')
            self.send_header('Referrer-Policy', 'no-referrer')
            self.send_header('Content-Security-Policy', "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'")
            self.end_headers()
            self.wfile.write(data)

        def allowed(self, api=False):
            host = f'127.0.0.1:{self.server.server_port}'
            if self.headers.get('Host') != host:
                self.send(403, {'error': 'Host 不匹配。'})
                return False
            origin = self.headers.get('Origin')
            if origin and origin != 'http://' + host:
                self.send(403, {'error': '拒绝跨站请求。'})
                return False
            if api and not secrets.compare_digest(self.headers.get('X-Editor-Token', ''), token):
                self.send(403, {'error': '本地会话令牌无效，请重新打开工具。'})
                return False
            return True

        def do_GET(self):
            parsed = urlparse(self.path)
            if not self.allowed(parsed.path.startswith('/api/')):
                return
            try:
                if parsed.path == '/':
                    html = html_at_start.replace('__TOKEN__', token)
                    self.send(200, html.encode('utf-8'), 'text/html; charset=utf-8')
                    return
                asset_name = parsed.path.removeprefix('/')
                if asset_name in UI_ASSETS:
                    self.send(200, (ROOT / asset_name).read_bytes(), UI_ASSETS[asset_name])
                    return
                q = parse_qs(parsed.query)
                if parsed.path == '/health':
                    result = health()
                elif parsed.path == '/api/status':
                    result = editor.status()
                    result.update(health())
                elif parsed.path == '/api/threads':
                    result = {'threads': editor.list_threads(q.get('q', [''])[0])}
                elif parsed.path == '/api/thread':
                    result = editor.get_thread(q.get('id', [''])[0])
                elif parsed.path == '/api/backups':
                    result = {'backups': editor.list_backups()}
                else:
                    self.send(404, {'error': '不存在的路径。'})
                    return
                self.send(200, result)
            except (EditorError, OSError, ValueError) as e:
                self.send(400, {'error': str(e)})
            except Exception as e:
                self.send(500, {'error': '读取失败：' + type(e).__name__ + '。请刷新；未执行写入。'})

        def do_POST(self):
            if not self.allowed(True):
                return
            try:
                if not self.headers.get('Content-Type', '').startswith('application/json'):
                    raise EditorError('仅接受 JSON 请求。')
                size = int(self.headers.get('Content-Length', '0'))
                if size < 2 or size > 16777216:
                    raise EditorError('请求大小无效。')
                data = json.loads(self.rfile.read(size))
                if not isinstance(data, dict):
                    raise EditorError('请求格式无效。')
                if self.path != '/api/shutdown' and build_id() != STARTUP_BUILD:
                    raise EditorError('程序文件已更新，但当前后台仍是旧版本。请重新运行启动器自动更新后台，再保存；编辑草稿请先保留。')
                if self.path == '/api/preview':
                    result = editor.preview(data)
                elif self.path == '/api/apply':
                    result = editor.apply(data.get('plan_id'), data.get('confirm'))
                elif self.path == '/api/restore':
                    if data.get('confirm') != 'RESTORE':
                        raise EditorError('恢复需要输入 RESTORE。')
                    result = editor.restore(data.get('backup_id'))
                elif self.path == '/api/shutdown':
                    with editor.lock:
                        self.send(200, {'ok': True})
                    threading.Thread(target=self.server.shutdown, daemon=True).start()
                    return
                else:
                    self.send(404, {'error': '不存在的路径。'})
                    return
                self.send(200, result)
            except (EditorError, OSError, ValueError) as e:
                self.send(400, {'error': str(e)})
            except Exception as e:
                self.send(500, {'error': '操作失败：' + type(e).__name__ + '。未确认保存成功，请保留草稿并重新读取记录。'})

    server = ThreadingHTTPServer(('127.0.0.1', port), Handler)
    server.daemon_threads = True
    server.editor_token = token
    return server


def main():
    parser = argparse.ArgumentParser(description='Codex 本地对话记录管理工具')
    parser.add_argument('--home', type=Path, default=Path(os.environ.get('CODEX_HOME') or Path.home() / '.codex'))
    parser.add_argument('--backup-root', type=Path, default=ROOT / 'backups')
    parser.add_argument('--port', type=int, default=0)
    parser.add_argument('--open', action='store_true', help='自动打开浏览器')
    parser.add_argument('--demo', action='store_true', help='仅使用合成演示数据')
    args = parser.parse_args()
    if args.demo:
        from fixtures import create_demo
        args.home = ROOT / 'demo-data'
        if not args.home.exists():
            create_demo(args.home)
        args.backup_root = ROOT / 'demo-backups'
    editor = Editor(args.home, args.backup_root, demo=args.demo)
    server = make_server(editor, args.port)
    url = f'http://127.0.0.1:{server.server_port}'
    runtime = ROOT / ('running-demo.json' if args.demo else 'running.json')
    instance_dir = ROOT / '.runtime'
    instance_dir.mkdir(exist_ok=True)
    instance = instance_dir / f'instance-{os.getpid()}.json'
    metadata = {'url': url, 'pid': os.getpid(), 'home': str(editor.home), 'mode': 'demo' if args.demo else 'live',
                'version': APP_VERSION, 'build_id': STARTUP_BUILD}
    for path in (runtime, instance):
        path.write_text(json.dumps(metadata, ensure_ascii=False), encoding='utf-8')
    if sys.stdout:
        print(url, flush=True)
    if args.open:
        webbrowser.open(url)
    try:
        server.serve_forever(poll_interval=0.5)
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()
        try:
            if json.loads(runtime.read_text(encoding='utf-8')).get('pid') == os.getpid():
                runtime.unlink()
        except (OSError, ValueError):
            pass
        instance.unlink(missing_ok=True)


if __name__ == '__main__':
    try:
        main()
    except Exception as error:
        (ROOT / 'startup-error.txt').write_text(f'{type(error).__name__}: {error}', encoding='utf-8')
        if sys.stderr:
            print(error, file=sys.stderr)
        raise SystemExit(1)
