<execution id="transport-access-layer">
# 传输接入层统一流程（TCP/WS/KCP）

目标：不同传输只在“接入层”分叉，后面复用同一套 framing/路由/业务处理链。

## 统一接口建议

- connect(conn_meta) -> session
- send(session, s2c_frame)
- close(session, reason)
- on_data(session, bytes) -> frames（2B length 分帧）

## 必做项

- 每种传输的握手与超时策略
- 统一 session 字段（conn_id、transport、peer、seq 规则）
- 统一限流/背压：消息队列长度、发送缓冲、读写速率

## 输出

- 传输适配器清单（tcp/ws/kcp）
- 统一 session & routing 契约
- 错误码与日志字段统一
</execution>
