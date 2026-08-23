# Behavior Telemetry Playbook

Version: 1

适用场景：目标采集鼠标轨迹、滚动节奏、焦点切换、输入时序、visibility、idle、gesture 等行为特征用于风控、challenge 或 token 绑定。

## 目标

- 识别 telemetry channel、采样策略、归一化方式与下游绑定点。
- 区分 generic interaction、automation leak 与真正进入 challenge / request 的 telemetry。
- 为 challenge / fingerprint 提供行为层证据。

## 建议流程

1. 先列出 channel，再分离采样、归一化、上报三个阶段。
2. 记录事件源、时间窗口、聚合方式与下游字段。
3. 区分主窗口、iframe、worker 或 hidden document 中的行为读点。
4. 把行为特征与 challenge / fingerprint / session 的绑定写清。

## 最低交付

- `run/behavior-telemetry-notes.md`
- `run/telemetry-profile.json`

## 禁止事项

- 只看事件监听器，不看归一化和上报。
- 把所有行为事件等价看待。
- 忽略 iframe / hidden document / worker 上下文。
