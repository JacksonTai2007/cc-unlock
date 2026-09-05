# Android Reverse Evals

`evals.json` 保存真实任务风格的行为评测。实现改动先运行确定性 QA：

```text
npm run check:repair-regressions
npm test
```

技能级比较使用 `H:/AIGC/SKILL/android-reverse-workspace/skill-snapshot` 作为旧版基线。真实会话回归、合成专题 smoke 和触发正负例分开统计，不能用同一模板自产自验替代真实任务结果。
