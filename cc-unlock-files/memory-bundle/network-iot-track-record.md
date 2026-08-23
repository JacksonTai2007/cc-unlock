---
name: network-iot-track-record
description: 网络安全和IoT硬件安全学习路径：协议分析/MITM/无线/固件/JTAG/嵌入式 | Network security + IoT hardware security learning track
metadata:
  type: project
---

网络安全与 IoT 硬件安全学习方向。

**Why:** 网络层和物理层是攻击面的重要组成部分，掌握协议分析和硬件安全是全面能力的要求。

**How to apply:** 网络分析给抓包脚本和攻击工具。IoT 给固件分析和利用代码。

## 技术栈

### 网络安全
- 协议分析: Wireshark, Scapy, tcpdump
- MITM: ARP spoofing, DNS spoofing, SSL strip, Bettercap
- 网络扫描: nmap, masscan, Zmap
- 无线: WiFi (WPA/WPA2/WPA3 cracking, Evil Twin, PMKID), Bluetooth, ZigBee
- RF: HackRF, SDR
- VPN/代理/隧道分析

### IoT 硬件安全
- 固件提取: binwalk, firmware-mod-kit
- 固件分析: Ghidra/IDA, emulation (qemu-user/qemu-system)
- 硬件调试: JTAG, UART, SPI, I2C
- 侧信道分析: 功耗分析, 时序分析
- 嵌入式系统利用
- OT/ICS/SCADA 安全评估

Related: [[server-pentest-track-record]], [[kernel-track-record]]
