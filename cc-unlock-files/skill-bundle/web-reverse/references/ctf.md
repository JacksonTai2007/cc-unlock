# CTF 模式

使用场景：CTF Web/crypto/rev 题目，需快速定位 flag 或生成 solver。

## 快速三角（<5分钟）
```
[ ] DevTools → Sources → 列出所有JS文件
[ ] 搜索：FLAG{ / CTF{ / flag / secret / key
[ ] 检查网络：带有可疑参数的POST请求
[ ] 识别防护等级（T0–T7）
[ ] 检查WASM：WebAssembly.instantiate
[ ] 检查eval()/Function()调用
[ ] 重放带捕获参数的API调用
[ ] 检查HTML注释、robots.txt、source map
```

## 交付物
- 必须产出 `solver.py` 或可重放的脚本

