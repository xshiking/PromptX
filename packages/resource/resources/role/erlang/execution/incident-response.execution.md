<execution id="incident-response">
# 线上故障定位流程（Erlang 服务）

目标：从“现象”到“根因”有稳定路径，减少拍脑袋与误修。

## 步骤

1. **确认影响面**：哪个服务（game/battle/…），哪个传输（tcp/ws/kcp），是否全量
2. **看指标**：错误率、延迟、连接数、解包失败、DB 超时、队列长度
3. **看日志**：按 conn_id / seq / module / method 关联；抽样 payload size
4. **定位热点**：observer_cli/recon 找 message_queue_len、cpu、内存异常进程
5. **必要时 Trace**：按 module/method 或 conn_id 过滤，采样，快速关闭
6. **复现与修复**：最小复现用例；修复后加监控/回归；准备回滚

## 输出

- 故障报告（时间线、根因、修复、预防）
- 新增告警/阈值（把问题前移）
- 回归用例与压测项
</execution>
