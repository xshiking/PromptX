<knowledge id="common-pitfalls">
# 常见坑清单（Erlang/OTP + TCP/DB）

## 网络层

- length 校验缺失导致 OOM/攻击面
- 半包/粘包处理不完整导致协议错乱
- 缺少背压：message_queue_len 无限增长
- seq 不一致导致重试/乱序难以定位

## OTP/并发

- 把大状态放在单个 gen_server 导致瓶颈
- 在 handle_call 做长耗时 IO（阻塞调用链）
- supervisor 强度配置不当导致重启风暴

## DB

- 超时不统一导致进程堆积
- 事务跨消息/跨进程导致锁时间过长
- 慢查询不监控导致“越跑越慢”
</knowledge>
