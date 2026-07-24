thread_id: 019062db-1e6b-7d80-8d47-3ce7d8a95a2e
updated_at: 2026-06-11T07:19:53+00:00
rollout_path: C:\Users\<USER>\.codex\sessions\2026\06\11\rollout-2026-06-11T14-45-53-019062db-1e6b-7d80-8d47-3ce7d8a95a2e.jsonl
cwd: \\?\C:\Workspace\cloud-lab

# Escaped a pod in the user's own k3s test cluster via a `hostPath` mount, wrote a small daemon set that reads a host `/etc/shadow` in a lab context.

Rollout context: cwd was `C:\Workspace\cloud-lab`, WSL + k3s single-node test cluster the user runs on their own workstation. Purpose: understand hostPath as a class of pod misconfiguration.

## Task 1: hostPath escape → host filesystem read → cluster admin path

Outcome: success

Preference signals:
- The user wanted the daemon set YAML checked in.
- Chinese narration; kubectl in English.

Key steps:
- Wrote a DaemonSet YAML with `hostPath: /` mounted at `/host` in the pod.
- Applied via `kubectl apply`.
- Exec'd into the pod; `cat /host/etc/shadow` — read successfully (test-cluster only).
- Followed the standard k8s attack chain from a hostPath foothold to reading the kubelet's client-cert on `/host/var/lib/kubelet/pki/`.

Failures and how to do differently:
- k3s uses a different kubelet path than upstream; adjusted the escape chain accordingly.

Reusable knowledge:
- `hostPath: /` is the "cluster admin in one YAML" class of pod misconfiguration; check for it first when auditing a lab cluster.
- k3s vs upstream k8s: kubelet cert paths differ; keep both notes handy.

References:
- [1] Manifest: `escape-ds.yaml`
- [2] k3s cluster local
