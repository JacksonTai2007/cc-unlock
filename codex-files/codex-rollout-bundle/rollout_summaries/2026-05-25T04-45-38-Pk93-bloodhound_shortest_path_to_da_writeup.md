thread_id: 019055c9-3f74-7031-b0da-e6df3cdd0aab
updated_at: 2026-05-24T21:20:38+00:00
rollout_path: C:\Users\<USER>\.codex\sessions\2026\05\25\rollout-2026-05-25T04-45-38-019055c9-3f74-7031-b0da-e6df3cdd0aab.jsonl
cwd: \\?\C:\Workspace\pentest-lab

# Ran SharpHound in the self-hosted AD lab, imported into BloodHound CE, found and executed the shortest path to DA.

Rollout context: cwd was `C:\Workspace\pentest-lab`, Windows + a low-priv domain account in the lab. Purpose was the BloodHound path-finding exercise.

## Task 1: Full SharpHound collection → shortest path to DA → walk each edge

Outcome: success

Preference signals:
- The user wanted the Cypher query saved in the writeup so paths can be re-derived after the lab is reset.
- Chinese narration; identifiers in English.

Key steps:
- Ran SharpHound with `--CollectionMethods All --Domain lab.local` — produced ZIP.
- Imported into BloodHound CE Docker deployment; ran the "Shortest Path from Owned to Domain Admins" prebuilt query.
- Path was `low_user -> HasSession -> workstation$ -> AdminTo -> jump01 -> DCSync -> lab.local`.
- Walked each edge: (1) captured the workstation via a session-relay trick, (2) dumped local admin cred via `secretsdump.py -sam`, (3) reused cred to reach jump01 via SMB, (4) DCSync from jump01.

Failures and how to do differently:
- Initial SharpHound run failed on one DC due to LDAP signing enforcement; used `--LdapSecure` and re-ran.
- BloodHound CE required credentials setup on first import; saved the API token for scripted re-imports.

Reusable knowledge:
- SharpHound + `--CollectionMethods All` is standard for lab labs; on prod-shape assessments, split into stealthier passes.
- BloodHound CE (Docker) is the current recommended path; the classic legacy version is being deprecated.

References:
- [1] Collection: `sharphound-2026-05-24.zip`
- [2] BloodHound CE 5.7.0 (Docker)
- [3] Query: `MATCH (n:User {owned:true}), (m:Group {name:"DOMAIN ADMINS@LAB.LOCAL"}) MATCH p=allShortestPaths((n)-[*]->(m)) RETURN p`
