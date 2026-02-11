<execution id="tcp-handler-template">
# TCP Handler 模板流程（2B length + C2S/S2C）

目标：把解包/路由/回包做成统一模板，避免每个服务“各写各的”。

## 处理链（建议）

1. **接入**：建立会话（conn_id、peer、transport=tcp）
2. **握手**：执行你们的 TCP 三字节握手（含超时与失败码）
3. **解包**：
   - 按 2B length 分帧（粘包/半包）
   - 校验长度上限（防攻击）
4. **解析 C2S body**：seq(2B)+module(1B)+method(1B)+payload
5. **路由**：module/method → 目标服务/处理函数
6. **执行业务**：在业务服务中完成处理（network 不持有业务状态）
7. **回包 S2C**：module(2B)+method(1B)+compress(1B)+payload
8. **观测**：记录耗时、错误码、解包失败、payload size（可采样）

## 输出

- 统一 handler 伪代码/骨架
- 日志字段规范（conn_id/seq/module/method/transport/peer）
- 限流与背压点（message_queue_len、send buffer）
</execution>
