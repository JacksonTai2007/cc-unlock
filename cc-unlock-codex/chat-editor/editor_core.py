"""Local Codex history operations. No third-party dependencies."""
from __future__ import annotations

import hashlib
import json
import os
import re
import shutil
import sqlite3
import subprocess
import threading
import uuid
from contextlib import contextmanager
from datetime import datetime, timezone
from pathlib import Path


class EditorError(ValueError):
    pass


def digest(path):
    p = Path(path)
    if not p.exists():
        return None
    h = hashlib.sha256()
    with p.open('rb') as f:
        for block in iter(lambda: f.read(1024 * 1024), b''):
            h.update(block)
    return h.hexdigest()


def codex_processes():
    if os.name != 'nt':
        raise EditorError('真实数据库写入仅支持 Windows；无法确认 Codex 已关闭。')
    cmd = "@(Get-Process -ErrorAction SilentlyContinue | Where-Object {$_.ProcessName -like '*codex*'} | ForEach-Object {$_.ProcessName + ':' + $_.Id}) | ConvertTo-Json -Compress"
    try:
        r = subprocess.run(['powershell.exe', '-NoProfile', '-NonInteractive', '-Command', cmd],
                           capture_output=True, timeout=20, creationflags=0x08000000)
        if r.returncode:
            raise EditorError('进程检查失败，已禁止写入。')
        value = json.loads(r.stdout.decode('utf-8-sig').strip() or '[]')
        return [value] if isinstance(value, str) else value
    except (OSError, subprocess.TimeoutExpired, ValueError) as e:
        raise EditorError('无法检查 Codex 进程，已禁止写入。') from e


@contextmanager
def connect(path, write=False):
    c = sqlite3.connect(Path(path).as_uri() + ('?mode=rw' if write else '?mode=ro'), uri=True, timeout=3)
    c.row_factory = sqlite3.Row
    if not write:
        c.execute('PRAGMA query_only=ON')
    try:
        yield c
        if write:
            c.commit()
    except Exception:
        if write:
            c.rollback()
        raise
    finally:
        c.close()


def tables(c):
    return {r[0] for r in c.execute("SELECT name FROM sqlite_master WHERE type='table'")}


def columns(c, table):
    if not re.fullmatch(r'[A-Za-z_][A-Za-z_0-9]*', table):
        raise EditorError('非法表名。')
    return {r[1] for r in c.execute(f'PRAGMA table_info("{table}")')}


def atomic_write(path, data):
    p = Path(path)
    temp = p.with_name(p.name + '.editor-' + uuid.uuid4().hex + '.tmp')
    try:
        with temp.open('xb') as f:
            f.write(data)
            f.flush()
            os.fsync(f.fileno())
        os.replace(temp, p)
    finally:
        if temp.exists():
            temp.unlink()


class Editor:
    def __init__(self, home, backup_root, demo=False, backup_enabled=False):
        self.home = Path(home).resolve()
        self.backup_root = Path(backup_root).resolve()
        self.demo = bool(demo)
        self.backup_enabled = bool(backup_enabled)
        if self.demo and not (self.home / '.codex-editor-demo').is_file():
            raise EditorError('演示模式只接受带 .codex-editor-demo 标记的合成数据。')
        real_home = Path(os.environ.get('CODEX_HOME') or Path.home() / '.codex').resolve()
        if self.demo and self.home == real_home:
            raise EditorError('不能将真实 CODEX_HOME 作为演示数据。')
        if self.backup_root == self.home or self.backup_root.is_relative_to(self.home):
            raise EditorError('备份目录必须位于 CODEX_HOME 外。')
        self.state = self._latest('state_*.sqlite')
        self.history = self._latest('thread_history_*.sqlite', required=False)
        self.auxiliary = [p for p in (self._latest('queue_*.sqlite', required=False), self._latest('goals_*.sqlite', required=False)) if p]
        self.appdb = self.home / 'sqlite' / 'codex-dev.db'
        self.plans = {}
        self.lock = threading.RLock()

    def _latest(self, pattern, required=True):
        found = sorted(self.home.glob(pattern), key=lambda p: int(re.search(r'_(\d+)\.sqlite$', p.name)[1]) if re.search(r'_(\d+)\.sqlite$', p.name) else -1)
        if not found:
            if required:
                raise EditorError(f'未找到 {pattern}，请选择正确的 Codex 数据目录。')
            return None
        return self._safe(found[-1])

    def _safe(self, path):
        raw = str(path)
        # SQLite uses Win32 extended drive paths; do not accept UNC/device paths.
        if raw.startswith('\\\\?\\') and re.match(r'^[A-Za-z]:\\', raw[4:]):
            raw = raw[4:]
        p = Path(raw)
        p = p if p.is_absolute() else self.home / p
        resolved = p.resolve()
        if not resolved.is_relative_to(self.home) or resolved == self.home:
            raise EditorError('路径越界：只允许所选 Codex 数据目录中的普通文件。')
        if p.is_symlink() or p.absolute() != resolved:
            raise EditorError('不允许符号链接或目录联接。')
        return resolved

    def _id(self, value):
        try:
            normalized = str(uuid.UUID(str(value)))
        except (ValueError, TypeError, AttributeError) as e:
            raise EditorError('对话 ID 格式无效。') from e
        if normalized != str(value).lower():
            raise EditorError('对话 ID 格式无效。')
        return normalized

    def _row(self, tid):
        tid = self._id(tid)
        with connect(self.state) as c:
            row = c.execute('SELECT * FROM threads WHERE id=?', (tid,)).fetchone()
        if row is None:
            raise EditorError('对话不存在或已删除。')
        return dict(row)

    def _titles(self):
        result = {}
        index = self.home / 'session_index.jsonl'
        if index.exists():
            for line in index.read_text(encoding='utf-8-sig').splitlines():
                try:
                    d = json.loads(line)
                    if d.get('id') and d.get('thread_name'):
                        result[d['id']] = d['thread_name']
                except (ValueError, AttributeError):
                    continue
        if self.appdb.exists():
            with connect(self.appdb) as c:
                if 'local_thread_catalog' in tables(c):
                    for r in c.execute("SELECT thread_id,display_title FROM local_thread_catalog WHERE host_id='local'"):
                        if r[1]:
                            result[r[0]] = r[1]
        return result

    def status(self):
        return {'home': str(self.home), 'mode': 'demo' if self.demo else 'live',
                'write_allowed': True, 'block_reason': '', 'backup_root': str(self.backup_root),
                'backup_enabled': self.backup_enabled,
                'warning': '已移除进程检测和持久锁文件限制。运行中的 Codex 可能覆盖磁盘修改；请勿同时操作同一对话。' + ('' if self.backup_enabled else ' 自动备份已关闭，新修改不能从历史备份撤销。')}

    def _gate(self):
        # Kept for API compatibility. Process names are not evidence of file contention.
        return

    def list_threads(self, q=''):
        names = self._titles()
        with connect(self.state) as c:
            rows = c.execute('SELECT * FROM threads ORDER BY updated_at DESC').fetchall()
        result = []
        for r in rows:
            d = dict(r)
            title = names.get(d['id']) or d.get('name') or d.get('title') or '未命名对话'
            title = str(title).replace('\n', ' ')[:180]
            if q and q.casefold() not in (title + d['id']).casefold():
                continue
            result.append({'id': d['id'], 'title': title, 'updated_at': d.get('updated_at', 0), 'archived': bool(d.get('archived'))})
        return result

    def _inventory(self):
        entries = []
        for dirname in ('sessions', 'archived_sessions'):
            folder = self.home / dirname
            if not folder.exists():
                continue
            for file in folder.rglob('*.jsonl'):
                p = self._safe(file)
                with p.open('rb') as f:
                    line = f.readline(2 * 1024 * 1024)
                try:
                    d = json.loads(line.decode('utf-8-sig'))
                    meta = d.get('payload', {}) if d.get('type') == 'session_meta' else {}
                except (ValueError, UnicodeError, AttributeError):
                    meta = {}
                entries.append((p, meta))
        return entries

    def _rollouts(self, row, inventory=None):
        active = self._safe(row['rollout_path'])
        if active.suffix != '.jsonl' or active.relative_to(self.home).parts[0] not in ('sessions', 'archived_sessions'):
            raise EditorError('rollout_path 不是会话目录中的 JSONL，已阻止操作。')
        entries = inventory if inventory is not None else self._inventory()
        paths = {p for p, m in entries if m.get('id') == row['id']}
        for p, meta in entries:
            if p == active and meta.get('id') != row['id']:
                raise EditorError('当前 JSONL 身份与数据库不匹配，已阻止操作。')
            if row['id'] in p.name and not meta.get('id'):
                raise EditorError('存在身份无法验证的同名 JSONL，已阻止操作：' + p.name)
        if active.exists():
            paths.add(active)
        return sorted(paths)

    def _parse(self, path):
        if not path.exists():
            raise EditorError('当前 JSONL 不存在，不能执行局部编辑。')
        if path.stat().st_size > 64 * 1024 * 1024:
            raise EditorError('JSONL 超过 64 MiB，局部编辑未启用；仍可查看数据库及删除整段对话。')
        lines = path.read_bytes().splitlines(keepends=True)
        records = []
        for n, line in enumerate(lines):
            try:
                d = json.loads(line.decode('utf-8-sig'))
                if not isinstance(d, dict):
                    raise ValueError()
                records.append(d)
            except (ValueError, UnicodeError) as e:
                raise EditorError(f'JSONL 第 {n + 1} 行损坏；已禁止局部修改。') from e
        return lines, records

    @staticmethod
    def _text(item):
        content = item.get('content', item.get('text', ''))
        if isinstance(content, str):
            return content[:120000]
        if isinstance(content, list):
            text_parts = [x['text'] for x in content if isinstance(x, dict) and isinstance(x.get('text'), str)]
            return '\n'.join(x for x in text_parts if x)[:120000] if text_parts else '[非文本内容]'
        return '[非文本内容]'

    def _linear(self, row):
        path = self._safe(row['rollout_path'])
        lines, records = self._parse(path)
        if not records or records[0].get('type') != 'session_meta' or records[0].get('payload', {}).get('id') != row['id']:
            raise EditorError('JSONL 身份与数据库不匹配。')
        if row.get('history_mode', 'legacy') not in ('', 'legacy', None):
            raise EditorError('此对话采用分页历史，不支持按轮次截断；可编辑已验证正文、重命名或整段删除。')
        turns = []
        current = None
        seen = set()
        for i, d in enumerate(records):
            p = d.get('payload', {})
            if not isinstance(p, dict):
                raise EditorError('未知 JSONL 结构，已禁止局部编辑。')
            if d.get('type') == 'compacted' or p.get('history_base') or p.get('replacement_history'):
                raise EditorError('包含继承或压缩历史，不能安全按轮次截断；请整段删除。')
            if d.get('type') == 'event_msg' and p.get('type') == 'task_started':
                tid = p.get('turn_id')
                if not tid or tid in seen or (current and not current['_closed']):
                    raise EditorError('轮次边界不明确或存在并行写入，已禁止局部编辑。')
                seen.add(tid)
                current = {'id': tid, 'turn_id': tid, 'index': len(turns) + 1, 'timestamp': d.get('timestamp', ''), 'messages': [], '_line': i, '_closed': False}
                turns.append(current)
            if d.get('type') == 'turn_context' and p.get('turn_id') and current and p['turn_id'] != current['id']:
                raise EditorError('turn_context 轮次归属不一致，已禁止局部修改。')
            if current and d.get('type') == 'response_item' and p.get('type') == 'message' and p.get('role') in ('user', 'assistant'):
                current['messages'].append({'role': p['role'], 'text': self._text(p)})
            if current and d.get('type') == 'event_msg' and p.get('type') in ('task_complete', 'turn_aborted'):
                if p.get('turn_id') and p['turn_id'] != current['id']:
                    raise EditorError('轮次结束标识不匹配。')
                current['_closed'] = True
        if not turns:
            raise EditorError('未找到可靠的 task_started 轮次边界。')
        return lines, turns

    def _db_turns(self, tid):
        if not self.history:
            return []
        result = []
        with connect(self.history) as c:
            if not {'thread_turns', 'thread_items'}.issubset(tables(c)):
                return []
            for i, r in enumerate(c.execute('SELECT * FROM thread_turns WHERE thread_id=? ORDER BY rollout_ordinal LIMIT 2000', (tid,))):
                turn = dict(r)
                messages = []
                for item in c.execute('SELECT item_id,item_json FROM thread_items WHERE thread_id=? AND turn_id=? ORDER BY rollout_ordinal', (tid, turn['turn_id'])):
                    try:
                        d = json.loads(item[1])
                    except ValueError:
                        continue
                    typ = str(d.get('type', ''))
                    if typ in ('userMessage', 'UserMessage', 'agentMessage', 'AgentMessage'):
                        messages.append({'role': 'user' if 'user' in typ.lower() else 'assistant', 'text': self._text(d), 'item_id': item[0]})
                result.append({'id': turn['turn_id'], 'turn_id': turn['turn_id'], 'index': i + 1, 'timestamp': turn.get('started_at') or '', 'messages': messages})
        return result

    def _merged_turns(self, row):
        result = self._db_turns(row['id'])
        by_id = {t['id']: t for t in result}
        warnings = []
        for path in self._rollouts(row):
            try:
                _, records = self._parse(path)
            except EditorError as e:
                warnings.append(path.name + ': ' + str(e))
                continue
            current_id = None
            for event in records:
                p = event.get('payload', {})
                if not isinstance(p, dict):
                    continue
                if event.get('type') in ('turn_context', 'item_completed') or (event.get('type') == 'event_msg' and p.get('type') == 'task_started'):
                    current_id = p.get('turn_id') or current_id
                if not current_id:
                    continue
                if current_id not in by_id:
                    turn = {'id': current_id, 'turn_id': current_id, 'index': len(result) + 1, 'timestamp': event.get('timestamp', ''), 'messages': []}
                    by_id[current_id] = turn
                    result.append(turn)
                turn = by_id[current_id]
                role, text = None, None
                if event.get('type') == 'response_item' and p.get('type') == 'message' and p.get('role') in ('user', 'assistant'):
                    role, text = p['role'], self._text(p)
                elif event.get('type') == 'item_completed' and isinstance(p.get('item'), dict):
                    item = p['item']
                    kind = str(item.get('type', '')).lower()
                    if kind in ('usermessage', 'agentmessage'):
                        role, text = ('user' if kind == 'usermessage' else 'assistant'), self._text(item)
                if role and not any(m['role'] == role and m['text'] == text for m in turn['messages']):
                    turn['messages'].append({'role': role, 'text': text})
        for i, t in enumerate(result):
            t['index'] = i + 1
        warnings.append('已合并数据库与同身份 JSONL 的可识别正文；继承到其他 ID 的历史、工具原始事件及过长内容可能不完整。整段删除会包含所有已列出的文件，并不只删除屏幕预览。')
        return result, warnings

    def _files(self, row):
        out = set(self._rollouts(row))
        for db in (self.state, self.history, self.appdb, *self.auxiliary):
            if db and db.exists():
                for suffix in ('', '-wal', '-shm'):
                    out.add(self._safe(str(db) + suffix))
        out.add(self._safe(self.home / 'session_index.jsonl'))
        return sorted(out)

    def _revision(self, files):
        data = [(str(p.relative_to(self.home)), digest(p)) for p in files]
        return hashlib.sha256(json.dumps(data).encode()).hexdigest()

    def get_thread(self, thread_id):
        row = self._row(thread_id)
        warnings = []
        try:
            _, turns = self._linear(row)
            allowed = True
        except EditorError as e:
            warnings.append(str(e))
            turns, merged_warnings = self._merged_turns(row)
            warnings.extend(merged_warnings)
            allowed = False
        for turn in turns:
            turn.pop('_line', None)
            turn.pop('_closed', None)
            turn['can_truncate'] = allowed
            turn['reason'] = '' if allowed else warnings[0]
        from message_edit import enrich_messages
        enrich_messages(self, row, turns)
        from force_edit import enrich_force
        enrich_force(self, row, turns)
        names = self._titles()
        title = names.get(row['id']) or row.get('name') or row.get('title') or '未命名对话'
        return {'thread': {'id': row['id'], 'title': str(title)[:180], 'archived': bool(row.get('archived')),
                           'updated_at': row.get('updated_at', 0)},
                'turns': turns, 'warnings': warnings + ['正文预览每条最多 120,000 字符，分页历史最多 2,000 轮。'],
                'rollout_path': str(self._safe(row['rollout_path'])), 'revision': self._revision(self._files(row))}

    def _dependencies(self, row):
        own = self._rollouts(row)
        identities = {row['id']}
        for p in own:
            identities.update(re.findall(r'[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}', p.name, re.I))
        for p, meta in self._inventory():
            if p in own:
                continue
            base = meta.get('history_base')
            reference = base.get('thread_id') if isinstance(base, dict) else None
            if reference in identities or meta.get('forked_from_id') in identities or meta.get('forked_from') in identities:
                raise EditorError('其他对话依赖此历史，已阻止修改：' + str(meta.get('id', p.name)))

    def preview(self, data):
        with self.lock:
            row = self._row(data.get('thread_id'))
            action = data.get('action')
            if action not in ('rename', 'delete_thread', 'truncate', 'edit_message', 'force_edit_message'):
                raise EditorError('未知操作。')
            files = self._files(row)
            revision = self._revision(files)
            if data.get('revision') != revision:
                raise EditorError('记录已发生变化，请刷新并重新预览。')
            summary = ''
            plan = dict(data)
            if action == 'force_edit_message':
                from force_edit import prepare_force
                plan.update(prepare_force(self, row, data))
                summary = plan.get('force_summary', '强制写入选定消息及可识别副本。')
            elif action == 'edit_message':
                from message_edit import prepare_edit
                plan.update(prepare_edit(self, row, data))
                summary = plan.get('edit_summary', '修改所选消息正文；同步数据库和 JSONL，保留其他消息及后续轮次。')
            elif action == 'rename':
                title = str(data.get('title', '')).strip()
                if not title or len(title) > 180 or any(ord(ch) < 32 for ch in title):
                    raise EditorError('标题需为 1–180 个字符且不能包含换行/控制符。')
                plan['title'] = title
                summary = '修改此对话的显示标题；不改正文。'
            else:
                self._dependencies(row)
                if action == 'truncate':
                    lines, turns = self._linear(row)
                    match = next((t for t in turns if t['id'] == data.get('turn_id')), None)
                    if not match:
                        raise EditorError('未找到选定轮次。')
                    plan['cut_line'] = match['_line']
                    plan['kept_turn_ids'] = [t['id'] for t in turns if t['_line'] < match['_line']]
                    summary = f'保留前 {match["index"] - 1} 轮，删除第 {match["index"]} 轮及之后全部内容，并移除旧 JSONL 副本。'
                else:
                    summary = '删除整段对话：任务索引、历史数据库记录、语音时间线、关联排队任务/目标和所有已识别 JSONL 副本。'
            plan_id = uuid.uuid4().hex
            plan.update({'plan_id': plan_id, 'revision': revision, 'files': [str(p) for p in files]})
            if len(self.plans) > 100:
                self.plans.clear()
            self.plans[plan_id] = plan
            warning = ('每次写入前自动备份。' if self.backup_enabled else '自动备份已关闭；此次修改没有可供事后恢复的新备份。') + ' 不清理记忆、日志、云端或外部备份。运行中的 Codex 可能覆盖修改，请勿同时操作同一对话。'
            if action in ('edit_message', 'force_edit_message'):
                warning += ' 本操作修改历史文字，不重新生成后续回答，也不撤销已执行的工具或文件操作。'
                if action == 'force_edit_message':
                    warning += ' ' + plan.get('force_warning', '')
                warning += ' 保存不删除 writer 锁；运行中窗口需要重新读取记录，删除锁不能刷新内存上下文。'
            elif action in ('delete_thread', 'truncate'):
                warning += ' 删除/截断同时清除该对话的排队任务和目标。'
            return {'plan_id': plan_id, 'summary': summary, 'affected_files': [str(p) for p in files if p.exists()], 'warning': warning}

    def _manifest(self, directory, value):
        atomic_write(directory / 'manifest.json', json.dumps(value, ensure_ascii=False, indent=2).encode('utf-8'))

    def _snapshot(self, plan):
        self.backup_root.mkdir(parents=True, exist_ok=True)
        backup_id = datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%S') + '-' + uuid.uuid4().hex[:10]
        directory = self.backup_root / backup_id
        directory.mkdir()
        files = []
        for i, path in enumerate(plan['files']):
            p = self._safe(path)
            entry = {'path': str(p.relative_to(self.home)), 'before': digest(p), 'copy': f'{i:04d}.bin'}
            if p.exists():
                shutil.copyfile(p, directory / entry['copy'])
                if digest(directory / entry['copy']) != entry['before']:
                    raise EditorError('备份校验失败，已取消操作。')
            files.append(entry)
        manifest = {'id': backup_id, 'home': str(self.home), 'created_at': datetime.now(timezone.utc).isoformat(),
                    'action': plan['action'], 'thread_id': plan['thread_id'], 'state': 'prepared', 'files': files, 'restored': False}
        self._manifest(directory, manifest)
        return directory, manifest

    def _restore_files(self, directory, manifest):
        # Verify every backup first: never start restoring a partial/corrupt backup.
        for entry in manifest['files']:
            if entry['before'] is not None and digest(directory / entry['copy']) != entry['before']:
                raise EditorError('备份文件校验失败，未恢复。')
            self._safe(entry['path'])
        for entry in manifest['files']:
            p = self._safe(entry['path'])
            if entry['before'] is None:
                if p.exists():
                    p.unlink()
            else:
                p.parent.mkdir(parents=True, exist_ok=True)
                atomic_write(p, (directory / entry['copy']).read_bytes())
        for entry in manifest['files']:
            if digest(self._safe(entry['path'])) != entry['before']:
                raise EditorError('恢复后的文件哈希校验失败。')

    def _mutate_databases(self, plan):
        tid, action = plan['thread_id'], plan['action']
        with connect(self.state, True) as c:
            if action == 'rename':
                fields = columns(c, 'threads') & {'title', 'name'}
                c.execute('UPDATE threads SET ' + ','.join(f'"{x}"=?' for x in sorted(fields)) + ' WHERE id=?', [plan['title']] * len(fields) + [tid])
            elif action == 'delete_thread':
                for name in ('thread_dynamic_tools', 'thread_artifacts'):
                    if name in tables(c):
                        c.execute(f'DELETE FROM "{name}" WHERE thread_id=?', (tid,))
                if 'thread_spawn_edges' in tables(c):
                    c.execute('DELETE FROM thread_spawn_edges WHERE parent_thread_id=? OR child_thread_id=?', (tid, tid))
                c.execute('DELETE FROM threads WHERE id=?', (tid,))
            elif action == 'truncate':
                targets = {'preview'} | ({'first_user_message'} if not plan['kept_turn_ids'] else set())
                fields = columns(c, 'threads') & targets
                if fields:
                    c.execute('UPDATE threads SET ' + ','.join(f'"{x}"=\'\'' for x in fields) + ' WHERE id=?', (tid,))
        if self.history and action != 'rename':
            with connect(self.history, True) as c:
                for name in tables(c):
                    if name.startswith('thread_') and 'thread_id' in columns(c, name):
                        if action == 'truncate' and name in ('thread_turns', 'thread_items') and plan['kept_turn_ids']:
                            placeholders = ','.join('?' for _ in plan['kept_turn_ids'])
                            c.execute(f'DELETE FROM "{name}" WHERE thread_id=? AND turn_id NOT IN ({placeholders})', [tid] + plan['kept_turn_ids'])
                        else:
                            c.execute(f'DELETE FROM "{name}" WHERE thread_id=?', (tid,))
        if self.appdb.exists():
            with connect(self.appdb, True) as c:
                present = tables(c)
                if 'local_thread_catalog' in present:
                    if action == 'rename':
                        c.execute("UPDATE local_thread_catalog SET display_title=? WHERE thread_id=? AND host_id='local'", (plan['title'], tid))
                    elif action == 'delete_thread':
                        c.execute("DELETE FROM local_thread_catalog WHERE thread_id=? AND host_id='local'", (tid,))
                if action != 'rename':
                    for name in ('thread_timeline_ledger', 'local_thread_catalog_scan_entries'):
                        if name in present:
                            c.execute(f'DELETE FROM "{name}" WHERE thread_id=? AND host_id=\'local\'', (tid,))
        if action != 'rename':
            for db in self.auxiliary:
                with connect(db, True) as c:
                    for name in tables(c):
                        if re.fullmatch(r'[A-Za-z_][A-Za-z_0-9]*', name) and 'thread_id' in columns(c, name):
                            c.execute(f'DELETE FROM "{name}" WHERE thread_id=?', (tid,))

    def _mutate(self, row, plan):
        action = plan['action']
        if action == 'force_edit_message':
            from force_edit import apply_force
            apply_force(self, row, plan)
            self._check_databases()
            return
        if action == 'edit_message':
            from message_edit import apply_edit
            apply_edit(self, row, plan)
            self._check_databases()
            return
        index = self.home / 'session_index.jsonl'
        if index.exists():
            output = []
            for line in index.read_bytes().splitlines(keepends=True):
                try:
                    item = json.loads(line.decode('utf-8-sig'))
                except (ValueError, UnicodeError) as e:
                    raise EditorError('session_index.jsonl 损坏，已取消操作。') from e
                if item.get('id') == row['id']:
                    if action == 'delete_thread':
                        continue
                    if action == 'rename':
                        item['thread_name'] = plan['title']
                        line = (json.dumps(item, ensure_ascii=False) + '\n').encode()
                output.append(line)
            atomic_write(index, b''.join(output))
        paths = self._rollouts(row)
        if action == 'delete_thread':
            for p in paths:
                p.unlink()
        elif action == 'truncate':
            active = self._safe(row['rollout_path'])
            lines, _ = self._linear(row)
            atomic_write(active, b''.join(lines[:plan['cut_line']]))
            for p in paths:
                if p != active:
                    p.unlink()
        self._mutate_databases(plan)
        self._check_databases()

    def _check_databases(self):
        for db in (self.state, self.history, self.appdb, *self.auxiliary):
            if db and db.exists():
                with connect(db) as c:
                    if c.execute('PRAGMA quick_check').fetchone()[0] != 'ok':
                        raise EditorError('数据库完整性检查失败，正在回滚。')

    def apply(self, plan_id, confirm):
        with self.lock, self._writer_lock():
            self._gate()
            plan = self.plans.get(plan_id)
            if not plan or confirm != plan['thread_id']:
                raise EditorError('预览已过期或确认 ID 不匹配。')
            row = self._row(plan['thread_id'])
            files = self._files(row)
            if self._revision(files) != plan['revision'] or [str(p) for p in files] != plan['files']:
                raise EditorError('记录已变化，请刷新并重新预览。')
            if plan['action'] not in ('rename', 'edit_message', 'force_edit_message'):
                self._dependencies(row)
            if not self.backup_enabled:
                return self._post_save_cleanup(plan, self._apply_without_backup(row, plan, files))
            directory, manifest = self._snapshot(plan)
            self._gate()
            try:
                self._mutate(row, plan)
            except Exception:
                self._restore_files(directory, manifest)
                manifest['state'] = 'rolled_back'
                manifest['restored'] = True
                self._manifest(directory, manifest)
                raise
            for entry in manifest['files']:
                entry['after'] = digest(self._safe(entry['path']))
            manifest['state'] = 'committed'
            self._manifest(directory, manifest)
            self.plans.clear()
            return self._post_save_cleanup(plan, {'ok': True, 'backup_id': manifest['id'], 'backup_path': str(directory), 'backup_created': True})

    def _post_save_cleanup(self, plan, result):
        # Writer ownership is independent of a committed history edit. Removing
        # its file can strand a live writer and does not refresh application memory.
        if plan['action'] in ('edit_message', 'force_edit_message'):
            result['writer_lock_policy'] = {
                'action': 'preserved',
                'reason': 'message-save-does-not-remove-writer-locks',
            }
        return result

    def _apply_without_backup(self, row, plan, files):
        # Check actual SQLite contention, not unrelated Codex processes or stale files.
        for db in (self.state, self.history, self.appdb, *self.auxiliary):
            if db and db.exists():
                try:
                    with connect(db, True) as c:
                        c.execute('BEGIN IMMEDIATE')
                        c.rollback()
                except sqlite3.OperationalError as error:
                    raise EditorError('数据库当前被其他写入事务占用，请稍后重试：' + db.name) from error
        # Transient transaction recovery only: no backup directory, manifest or history.
        originals = {p: p.read_bytes() if p.exists() else None for p in files}
        if self._revision(self._files(row)) != plan['revision']:
            raise EditorError('记录已变化，请刷新并重新预览。')
        try:
            self._mutate(row, plan)
        except Exception:
            for path, original in originals.items():
                if original is None:
                    path.unlink(missing_ok=True)
                elif not path.exists() or path.read_bytes() != original:
                    atomic_write(path, original)
            raise
        self.plans.clear()
        return {'ok': True, 'backup_id': None, 'backup_path': None, 'backup_created': False}

    def list_backups(self):
        result = []
        if not self.backup_root.exists():
            return result
        for p in sorted(self.backup_root.glob('*/manifest.json'), reverse=True):
            try:
                d = json.loads(p.read_text(encoding='utf-8'))
                if d.get('home') == str(self.home):
                    result.append({k: d.get(k) for k in ('id', 'created_at', 'action', 'thread_id', 'restored', 'state')})
            except (ValueError, OSError):
                continue
        return result

    def restore(self, backup_id):
        with self.lock, self._writer_lock():
            self._gate()
            if not re.fullmatch(r'\d{8}T\d{6}-[0-9a-f]{10}', str(backup_id)):
                raise EditorError('无效备份 ID。')
            directory = self.backup_root / backup_id
            manifest = json.loads((directory / 'manifest.json').read_text(encoding='utf-8'))
            if manifest.get('home') != str(self.home) or manifest.get('state') not in ('committed', 'restoring') or manifest.get('restored'):
                raise EditorError('此备份不可自动恢复。')
            for entry in manifest['files']:
                expected = [entry['after']]
                if manifest['state'] == 'restoring':
                    expected.append(entry['before'])
                if digest(self._safe(entry['path'])) not in expected:
                    raise EditorError('备份后数据已变化，恢复会覆盖新记录，已阻止。请先保留当前数据后人工合并。')
            # Crash/retry recovery accepts only the exact before/after versions.
            for entry in manifest['files']:
                if entry['before'] is not None and digest(directory / entry['copy']) != entry['before']:
                    raise EditorError('备份文件校验失败，未恢复。')
            manifest['state'] = 'restoring'
            self._manifest(directory, manifest)
            self._restore_files(directory, manifest)
            manifest['restored'] = True
            manifest['state'] = 'committed'
            self._manifest(directory, manifest)
            self.plans.clear()
            return {'ok': True}

    @contextmanager
    def _writer_lock(self):
        # No persistent lock file and no process scan. The caller's short RLock only
        # serializes this server's own requests; SQLite enforces real DB contention.
        yield
