"""Launch or replace only an authenticated local instance of this editor."""
from __future__ import annotations

import argparse
import json
import os
import re
import subprocess
import sys
import time
import urllib.error
import urllib.request
import webbrowser
from pathlib import Path
from urllib.parse import urlsplit

from app import APP_VERSION, build_id

ROOT = Path(__file__).resolve().parent
APP_ID = 'codex-chat-editor'


class LaunchError(RuntimeError):
    pass


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        raise LaunchError('Refusing a redirect from a local editor service.')


HTTP = urllib.request.build_opener(urllib.request.ProxyHandler({}), NoRedirect())


def local_url(value):
    """Metadata is data, not permission to contact another host or endpoint."""
    parsed = urlsplit(str(value))
    try:
        port = parsed.port
    except ValueError:
        return None
    if (parsed.scheme != 'http' or parsed.hostname != '127.0.0.1'
            or not port or parsed.username or parsed.password
            or parsed.path not in ('', '/') or parsed.query or parsed.fragment):
        return None
    return f'http://127.0.0.1:{port}'


def request(url, path, token=None, payload=None):
    headers = {'Cache-Control': 'no-cache'}
    if token:
        headers['X-Editor-Token'] = token
    if payload is not None:
        headers['Content-Type'] = 'application/json'
        headers['Origin'] = url
    req = urllib.request.Request(url + path, headers=headers,
                                 data=None if payload is None else json.dumps(payload).encode())
    with HTTP.open(req, timeout=2) as response:
        raw = response.read(2 * 1024 * 1024 + 1)
        if len(raw) > 2 * 1024 * 1024:
            raise LaunchError('Local service returned an unexpectedly large response.')
        if path == '/':
            return raw.decode('utf-8')
        result = json.loads(raw)
        if not isinstance(result, dict):
            raise LaunchError('Local service returned invalid metadata.')
        return result


def same_home(left, right):
    return os.path.normcase(str(Path(left).resolve())) == os.path.normcase(str(Path(right).resolve()))


def inspect_instance(url, home, mode):
    try:
        health = request(url, '/health')
    except urllib.error.HTTPError as error:
        if error.code != 404:
            raise LaunchError(f'{url}: cannot verify editor identity (HTTP {error.code}).') from error
        health = None  # Versions before 1.4 had no public health endpoint.
    except (urllib.error.URLError, TimeoutError, ConnectionError):
        return None
    if health is not None and health.get('app') != APP_ID:
        raise LaunchError(f'{url}: port belongs to another service; nothing was stopped.')
    try:
        html = request(url, '/')
        match = re.search(r'\bconst\s+TOKEN\s*=\s*(["\'])([A-Za-z0-9_-]{20,200})\1', html)
        if 'Codex' not in html or 'X-Editor-Token' not in html or not match:
            raise LaunchError(f'{url}: not a recognized editor; nothing was stopped.')
        token = match.group(2)
        status = request(url, '/api/status', token)
        if not isinstance(status.get('home'), str) or status.get('mode') != mode or not same_home(status['home'], home):
            raise LaunchError(f'{url}: editor uses another data directory or mode; nothing was stopped.')
        return {'url': url, 'token': token, 'health': health, 'status': status}
    except (urllib.error.URLError, TimeoutError, ConnectionError, ValueError) as error:
        raise LaunchError(f'{url}: could not authenticate the editor; nothing was stopped.') from error


def is_current(instance, expected_build):
    health = instance['health'] or {}
    return (health.get('version') == APP_VERSION and health.get('build_id') == expected_build
            and health.get('update_required') is False)


def candidates(args, home, mode):
    if args.port:
        return [f'http://127.0.0.1:{args.port}']
    paths = list((ROOT / '.runtime').glob('instance-*.json'))
    legacy = ROOT / ('running-demo.json' if args.demo else 'running.json')
    if legacy.exists():
        paths.append(legacy)
    paths.sort(key=lambda p: p.stat().st_mtime, reverse=True)
    urls = []
    for path in paths:
        try:
            data = json.loads(path.read_text(encoding='utf-8'))
            if (not isinstance(data, dict) or not isinstance(data.get('pid'), int)
                    or data['pid'] <= 0 or not isinstance(data.get('home'), str)
                    or data.get('mode', mode) != mode or not same_home(data['home'], home)):
                continue
            url = local_url(data.get('url', ''))
            if url and url not in urls:
                urls.append(url)
        except (OSError, ValueError, TypeError):
            continue
    return urls


def shutdown(instance):
    url = instance['url']
    result = request(url, '/api/shutdown', instance['token'], {})
    if result.get('ok') is not True:
        raise LaunchError(f'{url}: editor did not confirm shutdown; no replacement started.')
    deadline = time.monotonic() + 10
    while time.monotonic() < deadline:
        try:
            request(url, '/')
        except (urllib.error.URLError, TimeoutError, ConnectionError):
            return
        time.sleep(0.15)
    raise LaunchError(f'{url}: old editor did not stop within 10 seconds; no process was killed.')


def start(args, port, home, mode, expected_build):
    executable = Path(sys.executable)
    if os.name == 'nt' and executable.with_name('pythonw.exe').is_file():
        executable = executable.with_name('pythonw.exe')
    command = [str(executable), str(ROOT / 'app.py'), '--port', str(port)]
    if args.demo:
        command.append('--demo')
    elif args.home:
        command += ['--home', str(home)]
    output = ROOT / 'server-launch.stdout.log'
    errors = ROOT / 'server-launch.stderr.log'
    kwargs = {'cwd': str(ROOT), 'stdin': subprocess.DEVNULL, 'close_fds': True}
    if os.name == 'nt':
        kwargs['creationflags'] = (subprocess.DETACHED_PROCESS | subprocess.CREATE_NEW_PROCESS_GROUP
                                   | subprocess.CREATE_BREAKAWAY_FROM_JOB)
    else:
        kwargs['start_new_session'] = True
    try:
        with output.open('ab') as out, errors.open('ab') as err:
            child = subprocess.Popen(command, stdout=out, stderr=err, **kwargs)
    except OSError as error:
        manual = subprocess.list2cmdline(command + ([] if args.no_open else ['--open']))
        raise LaunchError('Independent service launch failed: ' + str(error)
                          + '\nNo scheduled task or other workaround was created. '
                          + 'Open Windows Terminal independently of Codex, then run:\n' + manual) from error
    deadline = time.monotonic() + 15
    runtime = ROOT / '.runtime' / f'instance-{child.pid}.json'
    while time.monotonic() < deadline:
        if child.poll() is not None:
            raise LaunchError(f'Editor exited with status {child.returncode}; see {errors}.')
        try:
            metadata = json.loads(runtime.read_text(encoding='utf-8'))
            url = local_url(metadata.get('url', ''))
            if metadata.get('pid') == child.pid and url:
                instance = inspect_instance(url, home, mode)
                if instance and is_current(instance, expected_build):
                    return url
        except (OSError, ValueError, TypeError):
            pass
        time.sleep(0.15)
    raise LaunchError(f'Editor readiness was not confirmed within 15 seconds (PID {child.pid}); '
                      f'see {errors}. Do not launch duplicates until this instance is checked.')


def main(argv=None):
    parser = argparse.ArgumentParser(description='Start the matching current local editor, replacing an authenticated older build.')
    parser.add_argument('--no-open', action='store_true', help='Do not launch a browser')
    parser.add_argument('--demo', action='store_true')
    parser.add_argument('--home', type=Path)
    parser.add_argument('--port', type=int)
    args = parser.parse_args(argv)
    if args.port is not None and not 1 <= args.port <= 65535:
        parser.error('--port must be between 1 and 65535')
    if args.demo and args.home:
        parser.error('--demo and --home cannot be combined')
    home = (ROOT / 'demo-data' if args.demo else args.home or Path(os.environ.get('CODEX_HOME') or Path.home() / '.codex')).resolve()
    mode = 'demo' if args.demo else 'live'
    expected_build = build_id()
    old = None
    url = None
    for candidate in candidates(args, home, mode):
        try:
            instance = inspect_instance(candidate, home, mode)
        except LaunchError:
            if args.port:
                raise
            continue
        if instance and is_current(instance, expected_build):
            url = candidate
            break
        if instance and old is None:
            old = instance
    if url is None:
        port = args.port or 0
        if old:
            port = urlsplit(old['url']).port
            shutdown(old)
        url = start(args, port, home, mode, expected_build)
    if sys.stdout:
        print(url, flush=True)
    if not args.no_open:
        webbrowser.open(url)
    return url


if __name__ == '__main__':
    try:
        main()
    except Exception as error:
        message = f'{type(error).__name__}: {error}'
        (ROOT / 'startup-error.txt').write_text(message, encoding='utf-8')
        if sys.stderr:
            print(message, file=sys.stderr)
        raise SystemExit(1)
