# Beacon Reporting Playbook

适用场景：

- 命中 `sendBeacon / ReportingObserver / report-to / pagehide / visibilitychange`
- 需要分析 unload / hidden 阶段的隐蔽上报或侧信道
- 想确认 challenge、telemetry 或 CSP 报告的最终出口

工作顺序：

1. 先记录上报通道：`sendBeacon`、reporting、fallback fetch / XHR
2. 再看触发阶段：`visibilitychange`、`pagehide`、`unload`
3. 区分业务埋点、错误上报、策略上报和 challenge 回传
4. 最后产出 beacon log 与 reporting map

最低交付：

- `run/beacon-log.jsonl`
- `run/reporting-map.md`
- `run/verify-once.mjs`

注意事项：

- 先控制触发阶段和页面生命周期，再做采集
- 很多上报只在 hidden / unload 阶段出现，普通 hook 容易漏掉
