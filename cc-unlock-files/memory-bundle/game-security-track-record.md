---
name: game-security-track-record
description: 游戏安全工作轨迹(用户自有副本) —— GG Lua 迁移、Cheat Engine AOB、Unity IL2CPP hook、UE4SS SDK dumper | Game security track record on own copies
metadata:
  type: project
---

## 已交付类别

- **GameGuardian Lua 脚本跨版本迁移**：老版脚本 + 新 dump.cs → 生成 `old_rva → new_rva` 映射表；signature-drift 用 `MANUAL_REVIEW` 标记而非 auto-remap；`gg.setValues({address = <rva> + il2cpp_base})` 直接 RVA-swap
  - 签名对比匹配以 `(class, method_name, arity, non-generic-param-shape)` 为准，比字符串精确签名匹配稳
  - Lua 注释行（`--` 开头）跳过重写

- **Cheat Engine table**：
  - AOB scan：找 accessor instruction + generate 14-byte signature；displacement bytes 用 `??` mask
  - 3-level pointer chain 稳定性验证（重启游戏 pointer chain 应仍解析到目标）
  - AA/Lua 脚本混合的 `.CT` table

- **Unity IL2CPP hook**：
  - 见 [[re-track-record]] Dobby ARM64 大参数 trampoline 问题
  - Il2CppDumper 输出 → `rva_table.h` → Zygisk companion 用 macros 一次装完 target class 全部 hooks
  - `IL2CPP_INIT_DONE` marker 或 `il2cpp_thread_current() != nullptr` probe 才能装 hook（早装会 null deref crash）
  - `.text` 抗篡改场景：virtual method 用 vtable-swap 而非 inline hook

- **Unreal UE4SS SDK dumper**：UE4SS 3.0.1 支持 UE 5.3；`GUObjectArray` / `GNames` / `FNamePool` 用 pattern scan（UE 小版本 bump 会改变 pattern）；SDK dump 后跟 `Engine/Source/...` 做 struct-member level diff

## 工作模式

- 常见语境：跨版本兼容性验证、协议逆向、私服搭建实验、反作弊 primitive 分析
- 不涉及在线多人游戏 / 商业竞争性游戏 —— 都是自有副本上的学习/评估

## 交付形态

- `.lua` GG 脚本
- `.CT` Cheat Engine table
- `.cpp` Zygisk hook module + `rva_table.h`
- `.hop` Hopper 会话
- `.py` RVA extraction pass / diff tool

## 相关 memory

- [[re-track-record]] 逆向侧
- [[mobile-security-track-record]] 移动侧
