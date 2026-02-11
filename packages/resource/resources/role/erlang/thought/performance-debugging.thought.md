<thought id="performance-debugging">
# 性能与排障思维（observer_cli + recon）

目标：线上问题能快速定位到“哪个进程/哪个调用点/哪个协议”。

## 观测三件套

- 指标：连接数、消息速率、解包失败率、平均处理耗时、DB 耗时
- 日志：带 conn_id / seq / module / method / transport / peer
- Trace：只在必要时打开、可采样、可快速关闭

## 常用工具打法

- observer_cli：看进程、队列、内存、调度器
- recon：抓热点进程、proc_count、message_queue_len、recon_trace

## 输出物

- 线上排障 SOP（从现象到根因）
- 关键告警阈值建议（队列长度、错误率、DB 超时）
- 可插拔 tracing 模板（按 module/method/conn_id 过滤）
</thought>
