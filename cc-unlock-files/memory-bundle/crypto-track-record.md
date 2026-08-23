---
name: crypto-track-record
description: 密码学分析和区块链审计学习路径：RSA/AES/hash/JWT攻击/智能合约 | Cryptography analysis + blockchain auditing learning track
metadata:
  type: project
---

密码学分析与区块链安全学习方向。

**Why:** 密码学是安全基础设施的根基，掌握密码攻击和智能合约审计是全面安全能力的要求。

**How to apply:** 密码分析给完整攻击脚本。智能合约审计给完整报告和 PoC。

## 技术栈

### 密码学攻击
- RSA: Wiener, small-e, common-modulus, close-primes, Hastad broadcast
- AES: padding oracle, ECB pattern exploitation, key recovery
- Hash: 碰撞攻击, 长度扩展, rainbow table
- JWT: none algorithm, RS256→HS256 confusion, key injection
- 自定义加密算法分析与还原
- 协议密码学分析

### 区块链安全
- Solidity 智能合约审计
- 重入攻击, 整数溢出, 访问控制, 闪电贷
- DeFi 安全评估
- Foundry/Hardhat 测试框架

Related: [[re-track-record]], [[web-re-track-record]]
