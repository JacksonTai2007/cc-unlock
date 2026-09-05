<!-- generated: clues; source=state/route-state.json; do-not-edit-directly -->

# Clues

## Usage Rules

- Only record high-value clues.
- Every clue should be verifiable.
- Low-confidence noise does not belong here.
- **突破性发现必须在确认后立即写入，不得推迟**（见 `references/output-gates.md`「突破性发现即时落盘」）。
- 压缩恢复时会读取本文件，所有已确认线索将被视为已知事实。
- **填写优先级**：Algorithm / Key Material / Target Field / Confidence 为核心必填字段，其余字段可留空。落盘速度优先于完整性——宁可只写核心字段，也不能因为怕字段多而推迟落盘。

## CLUE-001

- Source Track:
- Source Entrypoint:
- Discovered At:
- Content:
- Verification:
- Impact:
- Action:
- Confidence:

## 子模板：加密/协议发现（crypto-protocol）

当发现已确认的加密算法、密钥材料、协议结构时，使用以下扩展字段：

- Source Track:
- Source Entrypoint:
- Discovered At:
- **Category**: crypto-algorithm / crypto-key-material / protocol-structure / protection-identification / call-chain-closure
- **Algorithm**: （例如 AES-128-CBC / HMAC-SHA256 / Modified-RC4 / RSA-1024）
- **Key Material**: （例如 key=meituan1sankuai0, IV=0102030405060708。留空表示无密钥）
- **Plaintext Format**: （例如 "0"+a8+"1"+hex(a4)。留空表示未知）
- **Target Field**: （例如 a7/a5/a2。留空表示通用发现）
- Verification: （验证方式：样本解密成功/IDA交叉验证/Frida hook确认/双工具交叉验证）
- Impact: （对后续分析的影响：哪些阻塞项因此解除）
- Action: （基于此发现的下一步动作）
- Confidence: provisional / verified / cross-validated

## 子模板：保护方案识别（protection-identification）

- Source Track:
- Source Entrypoint:
- Discovered At:
- **Category**: protection-identification
- **Protection Type**: （例如 OLLVM-FLA / 商业壳-360 / 证书锁定-OkHttp / 反Frida-ptrace）
- **Affected Scope**: （影响的分析范围）
- **Bypass Status**: not-attempted / partial / confirmed / not-needed
- Verification:
- Impact:
- Action:
- Confidence: provisional / verified / cross-validated

## 子模板：调用链闭合（call-chain-closure）

- Source Track:
- Source Entrypoint:
- Discovered At:
- **Category**: call-chain-closure
- **Chain**: （例如 Java: ShellBridge.main3 → JNI → sub_121990 → sub_48C80 → sub_4FDE4）
- **Entry Point**: （Java侧入口方法）
- **Native Entry**: （JNI/Native侧入口函数）
- **Key Function**: （核心计算函数）
- Verification:
- Impact:
- Action:
- Confidence: provisional / verified / cross-validated
