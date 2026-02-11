<thought id="transport-handshake">
# 传输握手与连接生命周期（TCP/WS/KCP）

目标：不同传输的接入差异“集中处理”，业务层只面对统一的会话模型。

## TCP

- 你们有“TCP 三字节握手”（需明确：内容、时机、超时、失败码）
- 连接生命周期：accept → handshake → auth（可选）→ normal → close

## WebSocket

- HTTP upgrade 握手（Header/Path/Token）
- upgrade 成功后仍需复用同一套 framing/路由（建议：WS 只做承载，不改协议合同）

## KCP

- KCP 层三次握手（关注：会话标识、重连、丢包/乱序）
- 仍要有应用层的 handshake（区分“链路通”和“业务可用”）

## 输出物

- 会话状态机（handshake/auth/ready/closing）
- 统一的连接属性（conn_id、peer、transport、seq、module/method）
- 统一的超时策略与限流点
</thought>
