"""Precise, offline message-body edits; called inside Editor's backup transaction.

The public helpers do not write until apply_edit.  Text is never executed, and
rollout ordinals/turn identities are not rewritten to make an uncertain match fit.
"""
from __future__ import annotations

import copy
import hashlib
import json
import re
from collections import defaultdict


def _fail(message):
    from editor_core import EditorError
    raise EditorError(message)


def _key(turn_id, role, text):
    return hashlib.sha256(json.dumps([turn_id, role, text], ensure_ascii=False,
                                     separators=(',', ':')).encode('utf-8')).hexdigest()


def _body(item):
    """Return exact displayed text and the existing JSON text slots, without clipping."""
    name = 'content' if 'content' in item else 'text'
    value = item.get(name)
    if isinstance(value, str):
        return value, [(name,)]
    if isinstance(value, list):
        parts, slots = [], []
        for i, part in enumerate(value):
            if not isinstance(part, dict):
                continue
            if 'text' in part and part['text'] is not None:
                if not isinstance(part['text'], str):
                    return None, []
                parts.append(part['text'])
                slots.append((name, i, 'text'))
        return ('\n'.join(parts), slots) if parts else (None, [])
    return None, []


def _replace(item, slots, text):
    # Multiple text blocks have semantic boundaries we cannot infer from a textarea.
    if len(slots) != 1:
        _fail('此消息包含多个文本块，无法从合并预览安全确定修改位置。')
    target = item
    for part in slots[0][:-1]:
        target = target[part]
    target[slots[0][-1]] = text


def _role(item):
    typ = str(item.get('type', '')).lower()
    if typ == 'usermessage':
        return 'user'
    if typ == 'agentmessage':
        return 'assistant'
    if typ == 'message' and item.get('role') in ('user', 'assistant'):
        return item['role']
    return None


def _boundaries(lines):
    result = [0]
    for line in lines:
        result.append(result[-1] + len(line))
    return result


def _serialize(record, original):
    ending = b'\r\n' if original.endswith(b'\r\n') else b'\n' if original.endswith(b'\n') else b''
    bom = b'\xef\xbb\xbf' if original.startswith(b'\xef\xbb\xbf') else b''
    return bom + json.dumps(record, ensure_ascii=False, separators=(',', ':')).encode('utf-8') + ending


def _snapshot(editor, row):
    from editor_core import connect, tables
    files, occurrences, unsafe_turns, compaction_ordinals = [], [], set(), []
    for path in editor._rollouts(row):
        lines, records = editor._parse(path)
        if not records or records[0].get('type') != 'session_meta':
            _fail('JSONL 缺少会话身份，不能编辑正文。')
        if records[0].get('payload', {}).get('id') != row['id']:
            _fail('JSONL 会话身份不匹配。')
        explicit = ['ordinal' in d for d in records]
        if any(explicit) and not all(explicit):
            _fail('JSONL ordinal 信息不完整，不能安全重映射字节偏移。')
        ordinals = [d.get('ordinal', i) for i, d in enumerate(records)]
        if any(type(x) is not int or x < 0 for x in ordinals) or any(b != a + 1 for a, b in zip(ordinals, ordinals[1:])):
            _fail('JSONL ordinal 不连续，不能安全编辑正文。')
        identities = re.findall(r'[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}', path.name, re.I)
        f = {'path': path, 'lines': lines, 'records': records, 'ordinals': ordinals,
             'offsets': _boundaries(lines), 'identity': identities[-1].lower() if identities else None,
             'current': None, 'closed': set(), 'turns': set()}
        files.append(f)
        current = None
        for i, record in enumerate(records):
            payload = record.get('payload', {})
            if not isinstance(payload, dict):
                _fail('未知 JSONL payload，已禁止正文修改。')
            kind = record.get('type')
            if kind == 'compacted' or payload.get('replacement_history'):
                # Only a prefix is replaced. Later, independent completed turns
                # are editable without rewriting the opaque compaction snapshot.
                unsafe_turns.update(f['turns'])
                if current:
                    unsafe_turns.add(current)
                if all(explicit):
                    compaction_ordinals.append(ordinals[i])
                continue
            if kind == 'session_meta':
                if payload.get('id') != row['id']:
                    _fail('包含外部继承历史，当前版本不能安全编辑正文。')
                continue
            is_start = kind == 'event_msg' and payload.get('type') == 'task_started'
            if is_start or kind in ('turn_context', 'item_completed'):
                incoming = payload.get('turn_id')
                if incoming:
                    if (is_start or kind == 'turn_context') and current and current not in f['closed'] and incoming != current:
                        _fail('JSONL 轮次重叠，已禁止编辑正文。')
                    current = incoming
                    f['turns'].add(current)
            if not current:
                continue
            if kind == 'event_msg' and payload.get('type') in ('task_complete', 'turn_aborted'):
                if payload.get('turn_id') and payload['turn_id'] != current:
                    _fail('轮次结束标识不匹配。')
                f['closed'].add(current)
            item, route, role, text, slots = None, None, None, None, []
            if kind == 'response_item' and _role(payload):
                item, route = payload, ('payload',)
                role = _role(item)
                text, slots = _body(item)
            elif kind == 'item_completed' and isinstance(payload.get('item'), dict) and _role(payload['item']):
                item, route = payload['item'], ('payload', 'item')
                role = _role(item)
                text, slots = _body(item)
            elif kind == 'event_msg':
                event_type = payload.get('type')
                field = 'last_agent_message' if event_type == 'task_complete' else 'message'
                if event_type in ('user_message', 'agent_message', 'task_complete') and isinstance(payload.get(field), str):
                    role = 'user' if event_type == 'user_message' else 'assistant'
                    text, slots, item, route = payload[field], [(field,)], payload, ('payload',)
            if role and text is not None:
                occurrences.append({'source': 'file', 'file': f, 'line': i, 'turn_id': current,
                                    'role': role, 'text': text, 'slots': slots, 'route': route,
                                    'kind': kind + ':' + str(payload.get('type', '')),
                                    'item_id': item.get('id'), 'ordinal': ordinals[i]})
    if not files:
        _fail('没有可验证的 JSONL 源文件，不能只修改数据库缓存。')
    db_turns, projection = [], []
    if editor.history:
        with connect(editor.history) as c:
            present = tables(c)
            if 'thread_turns' in present:
                db_turns = [dict(r) for r in c.execute('SELECT * FROM thread_turns WHERE thread_id=?', (row['id'],))]
            if 'thread_history_projection_state' in present:
                projection = [dict(r) for r in c.execute('SELECT * FROM thread_history_projection_state WHERE thread_id=?', (row['id'],))]
            if 'thread_items' in present:
                for r in c.execute('SELECT * FROM thread_items WHERE thread_id=?', (row['id'],)):
                    r = dict(r)
                    try:
                        item = json.loads(r['item_json'])
                    except (ValueError, TypeError):
                        _fail('历史数据库 item_json 损坏，已禁止正文编辑。')
                    if not isinstance(item, dict):
                        _fail('历史数据库 item_json 不是对象。')
                    role = _role(item)
                    if role:
                        text, slots = _body(item)
                        if text is not None:
                            occurrences.append({'source': 'db', 'turn_id': r['turn_id'], 'role': role,
                                                'text': text, 'slots': slots, 'item_id': r['item_id'],
                                                'row': r, 'item': item, 'ordinal': r.get('rollout_ordinal')})
    keyed = defaultdict(list)
    for occurrence in occurrences:
        keyed[(occurrence['turn_id'], _key(occurrence['turn_id'], occurrence['role'], occurrence['text']))].append(occurrence)
    snapshot = {'files': files, 'occurrences': occurrences, 'keyed': keyed,
                'turns': db_turns, 'projection': projection, 'unsafe_turns': unsafe_turns,
                'compaction_ordinal': max(compaction_ordinals) if compaction_ordinals else None}
    _resolve_bases(snapshot, row)
    return snapshot


def _resolve_bases(snapshot, row):
    """A history_base targets a writer identity, not merely the visible thread id."""
    files = snapshot['files']
    for f in files:
        f['bases'] = []
        for i, record in enumerate(f['records']):
            payload = record.get('payload', {})
            base = payload.get('history_base')
            if not base:
                continue
            if record.get('type') != 'session_meta' or not isinstance(base, dict):
                _fail('无法识别 history_base 结构。')
            identity = base.get('thread_id')
            ordinal, offset = base.get('end_ordinal_exclusive'), base.get('end_byte_offset')
            if type(ordinal) is not int or type(offset) is not int:
                _fail('history_base 缺少可验证的 ordinal/字节偏移。')
            candidates = []
            for source in files:
                if source is f or source['identity'] != identity:
                    continue
                boundary = _boundary_index(source, ordinal)
                if boundary is not None and source['offsets'][boundary] == offset:
                    candidates.append((source, boundary))
            if len(candidates) != 1:
                _fail('history_base 外部来源、缺失来源或身份歧义，不能安全编辑正文。')
            source, boundary = candidates[0]
            if ordinal > f['ordinals'][0] or source['ordinals'][0] >= f['ordinals'][0]:
                _fail('history_base 顺序或依赖环无法验证。')
            f['bases'].append((i, source, boundary))


def _boundary_index(f, ordinal):
    if type(ordinal) is not int or not f['ordinals']:
        return None
    index = ordinal - f['ordinals'][0]
    return index if 0 <= index <= len(f['lines']) else None


def _selection(snapshot, turn_id, message_key):
    selected = snapshot['keyed'].get((turn_id, message_key), [])
    if not selected:
        _fail('消息标识已过期、预览被截断或正文无法定位，请刷新后重试。')
    cutoff = snapshot['compaction_ordinal']
    if turn_id in snapshot['unsafe_turns'] or (cutoff is not None and any(
            o['source'] == 'file' and o['ordinal'] <= cutoff for o in selected)):
        _fail('此轮位于压缩/替换历史之前或之中，不能保证快照副本一致；仅支持之后的完整轮次。')
    old, role = selected[0]['text'], selected[0]['role']
    if len(old) > 120000 or not old:
        _fail('此消息正文为空或超过预览上限，不能从截断预览编辑。')
    if any(len(o['slots']) != 1 for o in selected):
        _fail('此消息含多个文本块；当前编辑器只支持可独立定位的单文本块消息。')
    db = [o for o in selected if o['source'] == 'db']
    if len(db) > 1:
        _fail('同轮存在多条同角色同正文消息，无法唯一确定编辑目标。')
    file_occ = [o for o in selected if o['source'] == 'file']
    primary = [o for o in file_occ if o['kind'].startswith(('response_item:', 'item_completed:'))]
    if not primary:
        _fail('只找到缓存/事件摘要，缺少原始消息，已禁止编辑。')
    groups = defaultdict(list)
    for o in file_occ:
        groups[(str(o['file']['path']), o['kind'])].append(o)
        if turn_id not in o['file']['closed']:
            _fail('选定轮次尚未结束或记录不完整，关闭 Codex 后再刷新重试。')
    if any(len(v) > 1 for v in groups.values()):
        _fail('同一文件中目标正文重复出现，无法无歧义地编辑。')
    native = [o for o in selected if o['source'] == 'db' or o.get('kind', '').startswith('item_completed:')]
    native_ids = {o['item_id'] for o in native if o.get('item_id')}
    if len(native_ids) > 1:
        _fail('数据库与完成事件的消息 ID 不一致，已禁止编辑。')
    # An identified mirror with different contents must not silently remain stale.
    for o in snapshot['occurrences']:
        if o['turn_id'] == turn_id and o['role'] == role and o.get('item_id') in native_ids and o['text'] != old:
            _fail('同一消息 ID 的正文副本不一致，请先修复历史数据。')
    for f in snapshot['files']:
        related = [o for o in snapshot['occurrences'] if o['source'] == 'file' and o['file'] is f and
                   o['turn_id'] == turn_id and o['role'] == role]
        main = [o for o in related if o['kind'].startswith('response_item:')]
        if not main:
            main = [o for o in related if o['kind'].startswith('item_completed:')]
        chosen = [o for o in main if o['text'] == old]
        if not chosen:
            continue
        for mirror in related:
            if mirror['kind'] == 'event_msg:task_complete' and chosen[-1] is main[-1] and mirror['text'] != old:
                _fail('最终助手消息与 task_complete 摘要不一致，不能安全编辑。')
            if len(main) == 1 and mirror['kind'] in ('event_msg:user_message', 'event_msg:agent_message') and mirror['text'] != old:
                _fail('消息与其事件正文副本不一致，不能安全编辑。')
    db_same_role = [o for o in snapshot['occurrences'] if o['source'] == 'db' and o['turn_id'] == turn_id and o['role'] == role]
    if not db and db_same_role and any(o['text'] != old for o in db_same_role):
        # Different items may be legitimate (e.g. streamed commentary), but without
        # a shared message identity this old projected body cannot be safely paired.
        source_ids = {o.get('item_id') for o in primary if o.get('item_id')}
        if not source_ids or any(o['item_id'] in source_ids for o in db_same_role):
            _fail('数据库缓存与 JSONL 正文无法建立唯一对应，已禁止编辑。')
    for t in snapshot['turns']:
        if t['turn_id'] == turn_id and str(t.get('status', '')).lower() in ('inprogress', 'in_progress', 'running'):
            _fail('数据库标记此轮仍在进行，不能编辑。')
    return selected, old, role


def enrich_messages(editor, row, turns):
    """Attach stable keys; all gating is repeated by prepare_edit at preview time."""
    reason, snapshot = '', None
    try:
        snapshot = _snapshot(editor, row)
    except ValueError as error:
        reason = str(error)
    for turn in turns:
        for message in turn.get('messages', []):
            message['message_key'] = _key(turn['id'], message['role'], message['text'])
            message['editable'], message['edit_reason'] = False, reason
            if snapshot is not None:
                try:
                    _selection(snapshot, turn['id'], message['message_key'])
                    message['editable'], message['edit_reason'] = True, ''
                except ValueError as error:
                    message['edit_reason'] = str(error)


def _map_offset(snapshot, ordinal, offset, end=False):
    if offset is None:
        return None
    if type(offset) is not int or type(ordinal) is not int:
        _fail('历史缓存缺少可靠的 ordinal/字节偏移。')
    expected = ordinal + (1 if end else 0)
    candidates = []
    for f in snapshot['files']:
        index = _boundary_index(f, expected)
        if index is not None and f['offsets'][index] == offset:
            candidates.append(f['new_offsets'][index])
    if not candidates or len(set(candidates)) != 1:
        _fail('历史数据库字节偏移不能唯一映射到 JSONL，已禁止编辑。')
    return candidates[0]


def _check_dependencies(editor, row, snapshot, replacements):
    """A materialized fork is independent; a referenced byte prefix is not.

    The dependency guard is repeated at commit, because a new fork can appear
    without changing any of this thread's files/revision.
    """
    own = {f['path'] for f in snapshot['files']}
    identities = {row['id']} | {f['identity'] for f in snapshot['files'] if f['identity']}
    for path, metadata in editor._inventory():
        if path in own or not isinstance(metadata, dict):
            continue
        base = metadata.get('history_base')
        if not isinstance(base, dict) or base.get('thread_id') not in identities:
            # forked_from_id alone describes provenance of a standalone rollout.
            continue
        ordinal, offset = base.get('end_ordinal_exclusive'), base.get('end_byte_offset')
        if type(ordinal) is not int or type(offset) is not int:
            _fail('其他对话引用此历史，但缺少可靠的引用前缀边界；已禁止正文修改。')
        candidates = []
        for source in snapshot['files']:
            if source['identity'] != base['thread_id']:
                continue
            boundary = _boundary_index(source, ordinal)
            if boundary is not None and source['offsets'][boundary] == offset:
                candidates.append(source)
        if len(candidates) != 1:
            _fail('其他对话引用的历史来源或字节边界有歧义；已禁止正文修改。')
        source = candidates[0]
        original = b''.join(source['lines'])
        modified = replacements.get(str(source['path']), original)
        if original[:offset] != modified[:offset]:
            _fail('此正文属于其他对话依赖的共享历史前缀；为保留其他对话，已禁止修改。')


def prepare_edit(editor, row, data):
    text = data.get('text')
    if not isinstance(text, str) or not text.strip():
        _fail('正文需为非空文本。')
    try:
        byte_length = len(text.encode('utf-8'))
    except UnicodeError:
        _fail('正文包含无效 Unicode 字符。')
    if len(text) > 120000 or byte_length > 512 * 1024:
        _fail('正文最多 120,000 字符且 UTF-8 不超过 512 KiB。')
    turn_id, message_key = data.get('turn_id'), data.get('message_key')
    if not isinstance(turn_id, str) or not isinstance(message_key, str):
        _fail('缺少消息或轮次标识。')
    snapshot = _snapshot(editor, row)
    selected, old, role = _selection(snapshot, turn_id, message_key)
    if old == text:
        _fail('正文未发生变化。')
    for f in snapshot['files']:
        f['updated'] = {}
        f['new_lines'] = list(f['lines'])
    db_updates = []
    for o in selected:
        if o['source'] == 'db':
            item = copy.deepcopy(o['item'])
            _replace(item, o['slots'], text)
            db_updates.append({'turn_id': turn_id, 'item_id': o['item_id'], 'before': o['row']['item_json'],
                               'after': json.dumps(item, ensure_ascii=False, separators=(',', ':'))})
        else:
            f, line = o['file'], o['line']
            record = f['updated'].setdefault(line, copy.deepcopy(f['records'][line]))
            item = record
            for part in o['route']:
                item = item[part]
            _replace(item, o['slots'], text)
    # Parent references are always earlier writer segments; this is a verified DAG.
    for f in sorted(snapshot['files'], key=lambda value: value['ordinals'][0]):
        for line, source, boundary in f['bases']:
            record = f['updated'].setdefault(line, copy.deepcopy(f['records'][line]))
            new_offset = source['new_offsets'][boundary]
            if record['payload']['history_base']['end_byte_offset'] != new_offset:
                record['payload']['history_base']['end_byte_offset'] = new_offset
            elif record == f['records'][line]:
                f['updated'].pop(line)
        for line, record in f['updated'].items():
            f['new_lines'][line] = _serialize(record, f['lines'][line])
        f['new_offsets'] = _boundaries(f['new_lines'])
    turn_updates = []
    for turn in snapshot['turns']:
        changes, before = {}, {}
        for field, ordinal_name, end in (('rollout_byte_offset', 'rollout_ordinal', False),
                                          ('rollout_end_byte_offset', 'rollout_end_ordinal', True)):
            if field not in turn or turn[field] is None:
                continue
            mapped = _map_offset(snapshot, turn.get(ordinal_name), turn[field], end)
            if mapped != turn[field]:
                before[field], changes[field] = turn[field], mapped
        if changes:
            turn_updates.append({'turn_id': turn['turn_id'], 'before': before, 'after': changes})
    projection_updates = []
    for projection in snapshot['projection']:
        mapped = _map_offset(snapshot, projection.get('next_rollout_ordinal'), projection.get('next_rollout_byte_offset'))
        if mapped != projection.get('next_rollout_byte_offset'):
            projection_updates.append({'before': projection['next_rollout_byte_offset'], 'after': mapped,
                                       'ordinal': projection['next_rollout_ordinal']})
    file_updates = []
    for f in snapshot['files']:
        if f['new_lines'] != f['lines']:
            before, after = b''.join(f['lines']), b''.join(f['new_lines'])
            file_updates.append({'path': str(f['path']), 'before_sha256': hashlib.sha256(before).hexdigest(),
                                 'after_utf8': after.decode('utf-8')})
    _check_dependencies(editor, row, snapshot,
                        {mutation['path']: mutation['after_utf8'].encode('utf-8') for mutation in file_updates})
    first_users = sorted((o for o in snapshot['occurrences'] if o['role'] == 'user' and o['source'] == 'file'),
                         key=lambda o: (o['ordinal'], str(o['file']['path'])))
    state_fields = {}
    if 'preview' in row and row['preview']:
        # A summary may combine multiple bodies; dropping it is safer than textual
        # substitution and lets the app regenerate it from the preserved messages.
        state_fields['preview'] = {'before': row['preview'], 'after': ''}
    if ('first_user_message' in row and role == 'user' and first_users and
            first_users[0]['turn_id'] == turn_id and first_users[0]['text'] == old and
            (not snapshot['unsafe_turns'] and snapshot['compaction_ordinal'] is None or
             row['first_user_message'] and old.startswith(row['first_user_message']))):
        state_fields['first_user_message'] = {'before': row['first_user_message'], 'after': text}
    counts = {'jsonl_messages': sum(o['source'] == 'file' for o in selected), 'database_messages': len(db_updates),
              'jsonl_files': len(file_updates), 'turn_offsets': len(turn_updates),
              'projection_offsets': len(projection_updates), 'state_fields': len(state_fields)}
    return {'edit_summary': f'修改选定的{"用户" if role == "user" else "助手"}消息正文；同步 {counts["jsonl_messages"]} 处 JSONL 与 {len(db_updates)} 条历史缓存，保留其他轮次、标题、排队任务和目标。',
            'edit_counts': counts, 'edit_role': role,
            'edit_mutations': {'files': file_updates, 'db_items': db_updates, 'turn_offsets': turn_updates,
                               'projection': projection_updates, 'state_fields': state_fields}}


def apply_edit(editor, row, plan):
    """Apply only previously previewed mutations. Caller handles backup and rollback."""
    from editor_core import atomic_write, connect, digest
    mutations = plan.get('edit_mutations')
    if not isinstance(mutations, dict) or not mutations.get('files'):
        _fail('编辑计划缺失，请重新预览。')
    own = set(editor._rollouts(row))
    for mutation in mutations['files']:
        path = editor._safe(mutation['path'])
        if path not in own or digest(path) != mutation['before_sha256']:
            _fail('JSONL 在预览后发生变化，已取消正文修改。')
    _check_dependencies(editor, row, _snapshot(editor, row),
                        {mutation['path']: mutation['after_utf8'].encode('utf-8') for mutation in mutations['files']})
    if editor.history:
        with connect(editor.history, True) as c:
            for mutation in mutations['db_items']:
                cursor = c.execute('UPDATE thread_items SET item_json=? WHERE thread_id=? AND turn_id=? AND item_id=? AND item_json=?',
                                   (mutation['after'], row['id'], mutation['turn_id'], mutation['item_id'], mutation['before']))
                if cursor.rowcount != 1:
                    _fail('历史消息在预览后发生变化。')
            for mutation in mutations['turn_offsets']:
                fields = sorted(mutation['after'])
                sql = 'UPDATE thread_turns SET ' + ','.join(f'"{x}"=?' for x in fields)
                sql += ' WHERE thread_id=? AND turn_id=? AND ' + ' AND '.join(f'"{x}"=?' for x in fields)
                args = [mutation['after'][x] for x in fields] + [row['id'], mutation['turn_id']] + [mutation['before'][x] for x in fields]
                if c.execute(sql, args).rowcount != 1:
                    _fail('轮次偏移在预览后发生变化。')
            for mutation in mutations['projection']:
                if c.execute('UPDATE thread_history_projection_state SET next_rollout_byte_offset=? WHERE thread_id=? AND next_rollout_byte_offset=? AND next_rollout_ordinal=?',
                             (mutation['after'], row['id'], mutation['before'], mutation['ordinal'])).rowcount != 1:
                    _fail('历史投影状态在预览后发生变化。')
    elif mutations['db_items'] or mutations['turn_offsets'] or mutations['projection']:
        _fail('编辑计划需要的历史数据库缺失。')
    if mutations['state_fields']:
        with connect(editor.state, True) as c:
            for field, mutation in mutations['state_fields'].items():
                if field not in ('first_user_message', 'preview'):
                    _fail('非法正文摘要字段。')
                if c.execute(f'UPDATE threads SET "{field}"=? WHERE id=? AND "{field}"=?',
                             (mutation['after'], row['id'], mutation['before'])).rowcount != 1:
                    _fail('对话摘要在预览后发生变化。')
    for mutation in mutations['files']:
        atomic_write(editor._safe(mutation['path']), mutation['after_utf8'].encode('utf-8'))
