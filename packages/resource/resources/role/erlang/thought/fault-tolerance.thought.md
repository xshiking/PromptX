<thought id="fault-tolerance">
# 容错与监督树思维（OTP 的核心价值）

目标：服务出现局部故障时“自动恢复且不扩大影响面”。

## 监督树策略

- one_for_one：单点故障只重启自身（默认推荐）
- rest_for_one：故障进程后面的子进程一起重启（用于强依赖链）
- one_for_all：全体一起重启（慎用）

## 故障域划分

- network 相关进程故障不能拖垮业务核心
- mdb/logdb 故障要有降级/缓冲策略（例如写入降级、异步落盘）
- battle/game 这类核心服务要优先保证“可恢复”和“可观测”

## 输出物

- supervisor 树与重启强度（intensity/period）建议
- 降级策略清单（DB 不可用、外部依赖抖动、CPU 飙升）
- 失败可观测：错误码、日志字段、关键告警
</thought>
