---
name: ad-cloud-track-record
description: AD域渗透和云安全评估学习路径：Kerberos/NTLM/ADCS/BloodHound/AWS/Azure/GCP/K8s | AD domain pentest + cloud security assessment learning track
metadata:
  type: project
---

Active Directory 域渗透与云安全评估学习方向。

**Why:** 企业环境渗透核心能力，域渗透是内网核心攻击面，云安全是现代基础设施必修。

**How to apply:** 域渗透按枚举→立足→横向→提权→域控链路，云按 IAM→配置→逃逸→横向。

## 技术栈

### AD 域渗透
- 枚举: BloodHound/SharpHound, LDAP, PowerView, ADModule
- Kerberos: Kerberoasting, AS-REP roasting, 委派滥用, Silver/Golden/Diamond Ticket
- NTLM: ntlmrelayx, Responder, PetitPotam, DFSCoerce, PrinterBug
- ADCS: certipy ESC1-15
- 横向: PsExec, WMI, WinRM, DCOM, RDP, pass-the-hash/ticket
- 提权: DCSync, DCShadow, LAPS, GPO abuse, DACL exploitation

### 云安全
- AWS: pacu, ScoutSuite, Prowler, IAM privesc, S3 misconfiguration, IMDS
- Azure: ROADtools, AADInternals, Entra ID, Device Code Phishing, OAuth abuse
- GCP: Workload Identity, IAM, GKE
- K8s: hostPath escape, pod-level attacks, RBAC misconfiguration
- 容器: container escape, Docker socket, privileged container

Related: [[server-pentest-track-record]], [[c2-evasion-track-record]]
