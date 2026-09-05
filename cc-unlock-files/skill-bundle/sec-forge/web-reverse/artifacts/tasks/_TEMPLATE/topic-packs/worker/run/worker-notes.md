# Worker Notes

## 目标请求 / 可疑字段

- 目标请求：
- 可疑字段：
- 字段分层：
  - 初始化即有：
  - 交互后新增：
  - 异步回填：

## Worker Inventory

| kind | script/blob | creator | create timing | role | status |
| --- | --- | --- | --- | --- | --- |
| dedicated-worker |  |  |  |  |  |

## 创建链

- 创建函数：
- 直接 URL / Blob：
- 若是 Blob：
  - Blob 构造入参：
  - 拼接来源：
  - `createObjectURL` 调用点：
  - 最终 `Worker(...)` 消费点：

## Message Flow

| direction | trigger | fields | request-field mapping | notes |
| --- | --- | --- | --- | --- |
| main -> worker |  |  |  |  |
| worker -> main |  |  |  |  |

## 输出边界

- output sink（如 `btoa/json/base64`）：
- 真正计算入口：
- 最后一次语义变化点：
- 最终进入请求的字段：

## Roles

- worker 在整体链路中的职责：
- 是否承担签名 / 加密 / 指纹 / 挑战编排 / 反调试：

## Service Worker 控制面

- `fetch` 拦截：
- cache routing：
- upgrade control：
- navigation preload：

## 复现边界

- 最小输入：
- 最小输出：
- 依赖的 env / time / random：
- 当前推荐模式：浏览器内复用 / 本地复现 / 纯算法提取

## 下一步最小 probe

- 
