"""Explicit, identity-scoped edits of incomplete/projected Codex messages.

Unlike the strict editor, a missing completion or opaque projection is a warning,
not a global veto. Unknown copies are never rewritten using a global text replace.
"""
from __future__ import annotations

import copy
import hashlib
import json
import re
from collections import defaultdict

from message_edit import _boundaries, _fail, _key, _role, _serialize


def _body(item):
    name = 'content' if 'content' in item else 'text'
    value = item.get(name)
    if isinstance(value, str):
        return value, [(name,)]
    if not isinstance(value, list):
        return None, []
    parts, slots = [], []
    for index, part in enumerate(value):
        if isinstance(part, dict) and isinstance(part.get('text'), str):
            slots.append((name, index, 'text'))
            if part['text']:
                parts.append(part['text'])
    return ('\n'.join(parts), slots) if slots else (None, [])


def _ref(thread_id, occurrence):
    locator = (['db', occurrence['turn_id'], occurrence['item_id']] if occurrence['source'] == 'db'
               else ['file', str(occurrence['file']['path']), occurrence['line'], occurrence['route']])
    return hashlib.sha256(json.dumps([thread_id, locator, occurrence['role'], occurrence['text']],
                                    ensure_ascii=False, separators=(',', ':')).encode('utf-8')).hexdigest()


def _collect(editor, row):
    from editor_core import connect, tables
    files, occurrences, warnings, turns, projection = [], [], [], [], []
    for path in editor._rollouts(row):
        try:
            lines, records = editor._parse(path)
        except ValueError as error:
            warnings.append(path.name + ' 未同步：' + str(error))
            continue
        if not records or records[0].get('payload', {}).get('id') != row['id']:
            _fail('JSONL 身份不匹配，不能强制跨对话修改。')
        explicit = any('ordinal' in record for record in records)
        ordinals = [r.get('ordinal') if explicit else i for i, r in enumerate(records)]
        ids = re.findall(r'[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}', path.name, re.I)
        f = {'path': path, 'lines': lines, 'records': records, 'offsets': _boundaries(lines),
             'ordinals': ordinals, 'identity': ids[-1].lower() if ids else None, 'updated': {}}
        files.append(f)
        current, foreign = None, False
        for i, record in enumerate(records):
            p, kind = record.get('payload', {}), record.get('type')
            if not isinstance(p, dict):
                continue
            if kind == 'session_meta':
                foreign = p.get('id') != row['id']
                if foreign:
                    warnings.append(path.name + ' 含外部身份记录，未修改该部分。')
            if foreign:
                continue
            if kind in ('turn_context', 'item_completed') or (kind == 'event_msg' and p.get('type') == 'task_started'):
                current = p.get('turn_id') or current
            turn_id = p.get('turn_id') or current
            candidates = []
            if kind == 'response_item' and _role(p):
                candidates.append((p, ('payload',), False))
            elif kind == 'item_completed' and isinstance(p.get('item'), dict):
                candidates.append((p['item'], ('payload', 'item'), False))
            elif kind == 'event_msg' and p.get('type') in ('user_message', 'agent_message', 'task_complete'):
                field = 'last_agent_message' if p['type'] == 'task_complete' else 'message'
                if isinstance(p.get(field), str):
                    occurrences.append({'source': 'file', 'file': f, 'line': i, 'route': ('payload',),
                                        'turn_id': turn_id, 'role': 'user' if p['type'] == 'user_message' else 'assistant',
                                        'text': p[field], 'slots': [(field,)], 'item_id': p.get('item_id'),
                                        'kind': kind + ':' + p['type'], 'snapshot': False})
            history = p.get('replacement_history')
            if kind == 'compacted' or isinstance(history, list):
                warnings.append('此对话含压缩历史；只同步唯一可定位的快照正文，摘要和未知快照保持原样。')
            if isinstance(history, list):
                for index, item in enumerate(history):
                    if isinstance(item, dict):
                        candidates.append((item, ('payload', 'replacement_history', index), True))
            for item, route, snapshot in candidates:
                role = _role(item)
                text, slots = _body(item)
                if role and text is not None:
                    occurrences.append({'source': 'file', 'file': f, 'line': i, 'route': route,
                                        'turn_id': item.get('turn_id') or (None if snapshot else turn_id),
                                        'role': role, 'text': text, 'slots': slots, 'item_id': item.get('id'),
                                        'kind': 'snapshot' if snapshot else kind + ':' + str(p.get('type', '')),
                                        'snapshot': snapshot})
    if editor.history:
        with connect(editor.history) as c:
            present = tables(c)
            if 'thread_turns' in present:
                turns = [dict(r) for r in c.execute('SELECT * FROM thread_turns WHERE thread_id=?', (row['id'],))]
            if 'thread_history_projection_state' in present:
                projection = [dict(r) for r in c.execute('SELECT * FROM thread_history_projection_state WHERE thread_id=?', (row['id'],))]
            if 'thread_items' in present:
                for result in c.execute('SELECT * FROM thread_items WHERE thread_id=?', (row['id'],)):
                    r = dict(result)
                    try:
                        item = json.loads(r['item_json'])
                    except (ValueError, TypeError):
                        warnings.append('一条损坏的数据库消息未同步。')
                        continue
                    if not isinstance(item, dict) or not _role(item):
                        continue
                    text, slots = _body(item)
                    if text is not None:
                        occurrences.append({'source': 'db', 'turn_id': r['turn_id'], 'role': _role(item),
                                            'text': text, 'slots': slots, 'item_id': r['item_id'],
                                            'row': r, 'item': item, 'kind': 'db', 'snapshot': False})
    for occurrence in occurrences:
        occurrence['ref'] = _ref(row['id'], occurrence)
    return {'files': files, 'occurrences': occurrences, 'warnings': warnings, 'turns': turns, 'projection': projection}


def enrich_force(editor, row, turns):
    try:
        snapshot = _collect(editor, row)
        reason = ''
    except (ValueError, OSError) as error:
        snapshot, reason = {'occurrences': []}, str(error)
    for turn in turns:
        used = set()
        for message in turn.get('messages', []):
            message.update(force_editable=False, force_ref=None, force_reason=reason)
            candidates = [o for o in snapshot['occurrences'] if not o['snapshot'] and
                          o['turn_id'] == turn['id'] and o['role'] == message['role'] and
                          o['text'][:120000] == message['text'] and o['ref'] not in used]
            if message.get('item_id'):
                candidates = [o for o in candidates if o['item_id'] == message['item_id']]
            candidates.sort(key=lambda o: o['source'] != 'db')
            if candidates:
                chosen = candidates[0]
                used.add(chosen['ref'])
                message.update(force_editable=True, force_ref=chosen['ref'], force_text=chosen['text'],
                               force_reason='按精确记录位置编辑；不要求完整轮次或单文本块。')
            elif not reason:
                message['force_reason'] = '没有可定位的原始文本记录；不能通过全局替换猜测目标。'


def _replace(item, slots, text):
    for index, slot in enumerate(slots):
        target = item
        for part in slot[:-1]:
            target = target[part]
        target[slot[-1]] = text if index == 0 else ''


def _select(snapshot, anchor):
    same = [o for o in snapshot['occurrences'] if not o['snapshot'] and
            o['turn_id'] == anchor['turn_id'] and o['role'] == anchor['role'] and o['text'] == anchor['text']]
    db_ids = {o['item_id'] for o in same if o['source'] == 'db'}
    groups = defaultdict(list)
    for o in same:
        groups[(o['source'], str(o['file']['path']) if o['source'] == 'file' else '', o['kind'])].append(o)
    selected, skipped = [], 0
    anchor_native = anchor['source'] == 'db' or anchor['kind'].startswith('item_completed:')
    for o in same:
        group = groups[(o['source'], str(o['file']['path']) if o['source'] == 'file' else '', o['kind'])]
        native = o['source'] == 'db' or o['kind'].startswith('item_completed:')
        if o is anchor or (anchor['item_id'] and o['item_id'] == anchor['item_id']):
            selected.append(o)
        elif native and anchor_native and o['item_id'] and anchor['item_id'] and o['item_id'] != anchor['item_id']:
            skipped += 1
        elif len(group) == 1 and len(db_ids) <= 1:
            selected.append(o)
        else:
            skipped += 1
    known_turns = {o['turn_id'] for o in snapshot['occurrences'] if not o['snapshot'] and
                   o['role'] == anchor['role'] and o['text'] == anchor['text']}
    snapshots = [o for o in snapshot['occurrences'] if o['snapshot'] and o['role'] == anchor['role'] and o['text'] == anchor['text']]
    for o in snapshots:
        peers = [v for v in snapshots if v['file'] is o['file'] and v['line'] == o['line']]
        identity_match = bool(anchor['item_id'] and o['item_id'] == anchor['item_id'])
        unique_text = len(known_turns) == 1 and len(peers) == 1 and not o['item_id']
        if (identity_match or unique_text) and o['turn_id'] in (None, anchor['turn_id']):
            selected.append(o)
        else:
            skipped += 1
    if skipped:
        snapshot['warnings'].append(f'{skipped} 处同文消息/压缩快照缺少唯一身份，未同步；未进行全局替换。')
    if anchor['item_id'] and any(o['turn_id'] == anchor['turn_id'] and o['role'] == anchor['role'] and
                                 o['item_id'] == anchor['item_id'] and o['text'] != anchor['text']
                                 for o in snapshot['occurrences']):
        snapshot['warnings'].append('相同消息 ID 存在不同正文副本；这些正文不匹配的副本保持原样。')
    return selected


def _boundary(f, ordinal, offset):
    matches = []
    for i, value in enumerate(f['offsets']):
        logical = f['ordinals'][i] if i < len(f['ordinals']) else (
            f['ordinals'][-1] + 1 if f['ordinals'] and type(f['ordinals'][-1]) is int else None)
        if type(ordinal) is int and logical == ordinal and value == offset:
            matches.append(i)
    return matches[0] if len(matches) == 1 else None


def _render(snapshot):
    pending, done = list(snapshot['files']), set()
    references = {}
    for f in pending:
        refs = []
        for line, record in enumerate(f['records']):
            p = record.get('payload', {})
            base = p.get('history_base') if isinstance(p, dict) else None
            if not isinstance(base, dict):
                continue
            candidates = []
            for source in snapshot['files']:
                if source is f or source['identity'] != base.get('thread_id'):
                    continue
                boundary = _boundary(source, base.get('end_ordinal_exclusive'), base.get('end_byte_offset'))
                if boundary is not None:
                    candidates.append((source, boundary))
            if len(candidates) == 1 and record.get('type') == 'session_meta':
                refs.append((line, *candidates[0]))
            else:
                snapshot['warnings'].append(f['path'].name + ' 的 history_base 无法精确定位，保留原引用。')
        references[str(f['path'])] = refs
    while pending:
        ready = next((f for f in pending if all(str(source['path']) in done for _, source, _ in references[str(f['path'])])), None)
        if ready is None:
            ready = pending[0]
            references[str(ready['path'])] = []
            snapshot['warnings'].append('history_base 存在环或未解析依赖；保留无法确认的引用。')
        f = ready
        for line, source, boundary in references[str(f['path'])]:
            record = f['updated'].setdefault(line, copy.deepcopy(f['records'][line]))
            record['payload']['history_base']['end_byte_offset'] = source['new_offsets'][boundary]
        f['new_lines'] = list(f['lines'])
        for line, record in f['updated'].items():
            if record != f['records'][line]:
                f['new_lines'][line] = _serialize(record, f['lines'][line])
        f['new_offsets'] = _boundaries(f['new_lines'])
        done.add(str(f['path']))
        pending.remove(f)


def _map_offset(snapshot, ordinal, offset, end=False):
    if offset is None:
        return offset
    candidates = []
    for f in snapshot['files']:
        index = _boundary(f, ordinal + int(end) if type(ordinal) is int else None, offset)
        if index is not None:
            candidates.append(f['new_offsets'][index])
    if candidates and len(set(candidates)) == 1:
        return candidates[0]
    snapshot['warnings'].append('无法验证的历史字节偏移保持原值；分页缓存可能需要应用重新投影。')
    return offset


def prepare_force(editor, row, data):
    text = data.get('text')
    if not isinstance(text, str):
        _fail('正文必须为文本。')
    try:
        length = len(text.encode('utf-8'))
    except UnicodeError:
        _fail('正文包含无效 Unicode。')
    if length > 2 * 1024 * 1024:
        _fail('正文 UTF-8 不得超过 2 MiB。')
    snapshot = _collect(editor, row)
    anchor = next((o for o in snapshot['occurrences'] if o['ref'] == data.get('force_ref') and
                   not o['snapshot'] and o['turn_id'] == data.get('turn_id')), None)
    if anchor is None or data.get('message_key') not in (_key(anchor['turn_id'], anchor['role'], anchor['text']),
                                                      _key(anchor['turn_id'], anchor['role'], anchor['text'][:120000])):
        _fail('强制编辑定位已过期，请刷新后重新选择消息。')
    if text == anchor['text']:
        _fail('正文未发生变化。')
    selected = _select(snapshot, anchor)
    db_updates = []
    for o in selected:
        if o['source'] == 'db':
            item = copy.deepcopy(o['item'])
            _replace(item, o['slots'], text)
            db_updates.append({'turn_id': o['turn_id'], 'item_id': o['item_id'], 'before': o['row']['item_json'],
                               'after': json.dumps(item, ensure_ascii=False, separators=(',', ':'))})
        else:
            record = o['file']['updated'].setdefault(o['line'], copy.deepcopy(o['file']['records'][o['line']]))
            item = record
            for part in o['route']:
                item = item[part]
            _replace(item, o['slots'], text)
    _render(snapshot)
    turn_updates, projection = [], []
    for turn in snapshot['turns']:
        before, after = {}, {}
        for field, ordinal, end in (('rollout_byte_offset', 'rollout_ordinal', False), ('rollout_end_byte_offset', 'rollout_end_ordinal', True)):
            if field in turn:
                mapped = _map_offset(snapshot, turn.get(ordinal), turn[field], end)
                if mapped != turn[field]:
                    before[field], after[field] = turn[field], mapped
        if after:
            turn_updates.append({'turn_id': turn['turn_id'], 'before': before, 'after': after})
    for p in snapshot['projection']:
        mapped = _map_offset(snapshot, p.get('next_rollout_ordinal'), p.get('next_rollout_byte_offset'))
        if mapped != p.get('next_rollout_byte_offset'):
            projection.append({'before': p['next_rollout_byte_offset'], 'after': mapped, 'ordinal': p['next_rollout_ordinal']})
    files = [{'path': str(f['path']), 'before_sha256': hashlib.sha256(b''.join(f['lines'])).hexdigest(),
              'after_utf8': b''.join(f['new_lines']).decode('utf-8')} for f in snapshot['files'] if f['new_lines'] != f['lines']]
    own = {f['path'] for f in snapshot['files']}
    identities = {row['id']} | {f['identity'] for f in snapshot['files'] if f['identity']}
    incoming = []
    if files:
        for path, meta in editor._inventory():
            base = meta.get('history_base') if isinstance(meta, dict) else None
            if path not in own and isinstance(base, dict) and base.get('thread_id') in identities:
                incoming.append(str(path))
    if incoming:
        snapshot['warnings'].append(f'警告：{len(incoming)} 个其他对话引用此共享历史，可能显示旧内容或偏移失效；不修改其他对话：' + '；'.join(incoming))
    if not any(o['source'] == 'file' and not o['snapshot'] for o in selected):
        snapshot['warnings'].append('仅修改数据库缓存：没有可唯一对应的 JSONL 正文；应用重新投影时可能恢复旧内容。')
    states = {}
    if row.get('preview'):
        states['preview'] = {'before': row['preview'], 'after': ''}
    if anchor['role'] == 'user' and row.get('first_user_message') and anchor['text'].startswith(row['first_user_message']):
        user_turns = [o['turn_id'] for o in snapshot['occurrences'] if o['role'] == 'user' and not o['snapshot']]
        if user_turns and user_turns[0] == anchor['turn_id']:
            states['first_user_message'] = {'before': row['first_user_message'], 'after': text}
    counts = {'database_messages': len(db_updates), 'jsonl_messages': sum(o['source'] == 'file' for o in selected),
              'jsonl_files': len(files), 'turn_offsets': len(turn_updates), 'projection_offsets': len(projection)}
    warning = '强制模式：仅改可精确定位的本地记录，不保证运行窗口、继承历史或未知快照立即一致；不创建备份。'
    warning += ' '.join(dict.fromkeys(snapshot['warnings']))
    return {'force_summary': f'强制修改选定正文：{len(db_updates)} 条数据库消息、{counts["jsonl_messages"]} 处 JSONL，涉及 {len(files)} 个会话文件。',
            'force_warning': warning, 'force_counts': counts,
            'force_mutations': {'files': files, 'db_items': db_updates, 'turn_offsets': turn_updates,
                                'projection': projection, 'state_fields': states}}


def apply_force(editor, row, plan):
    from editor_core import atomic_write, connect, digest
    m = plan.get('force_mutations')
    if not isinstance(m, dict) or not (m.get('files') or m.get('db_items')):
        _fail('强制编辑计划缺失。')
    own = set(editor._rollouts(row))
    for mutation in m['files']:
        path = editor._safe(mutation['path'])
        if path not in own or digest(path) != mutation['before_sha256']:
            _fail('源文件已变化或越界，请重新预览。')
    if editor.history:
        with connect(editor.history, True) as c:
            for v in m['db_items']:
                if c.execute('UPDATE thread_items SET item_json=? WHERE thread_id=? AND turn_id=? AND item_id=? AND item_json=?',
                             (v['after'], row['id'], v['turn_id'], v['item_id'], v['before'])).rowcount != 1:
                    _fail('数据库消息已变化。')
            for v in m['turn_offsets']:
                fields = sorted(v['after'])
                if not set(fields) <= {'rollout_byte_offset', 'rollout_end_byte_offset'}:
                    _fail('非法偏移字段。')
                sql = 'UPDATE thread_turns SET ' + ','.join(f'"{f}"=?' for f in fields)
                sql += ' WHERE thread_id=? AND turn_id=? AND ' + ' AND '.join(f'"{f}"=?' for f in fields)
                args = [v['after'][f] for f in fields] + [row['id'], v['turn_id']] + [v['before'][f] for f in fields]
                if c.execute(sql, args).rowcount != 1:
                    _fail('数据库偏移已变化。')
            for v in m['projection']:
                if c.execute('UPDATE thread_history_projection_state SET next_rollout_byte_offset=? WHERE thread_id=? AND next_rollout_byte_offset=? AND next_rollout_ordinal=?',
                             (v['after'], row['id'], v['before'], v['ordinal'])).rowcount != 1:
                    _fail('数据库投影已变化。')
    elif m['db_items']:
        _fail('历史数据库缺失。')
    if m['state_fields']:
        with connect(editor.state, True) as c:
            for field, v in m['state_fields'].items():
                if field not in ('first_user_message', 'preview'):
                    _fail('非法摘要字段。')
                if c.execute(f'UPDATE threads SET "{field}"=? WHERE id=? AND "{field}"=?',
                             (v['after'], row['id'], v['before'])).rowcount != 1:
                    _fail('摘要已变化。')
    for mutation in m['files']:
        atomic_write(editor._safe(mutation['path']), mutation['after_utf8'].encode('utf-8'))
