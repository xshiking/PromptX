<thought id="otp-service-architecture">
# OTP 服务架构思维（多服务拆分）

目标：用 OTP 约束复杂度，保证服务可维护、可演进、可恢复。

## 服务边界（按你们现状）

- game：主游戏逻辑
- battle：战斗
- social：社交
- lobby：大厅/匹配
- login：登录
- robot：机器人/压测
- admin：后台管理（Mochiweb + ErlyDTL 也可能在此）
- mdb：数据库抽象层
- logdb：日志数据库
- network：网络通信层（接入、解包、路由、限流）
- data：配置数据管理
- mcp：MCP 协议服务

## OTP 最小骨架

- application：启动入口（读取配置、启动 supervisor）
- supervisor：监督树（按职责分组、隔离故障域）
- gen_server：状态进程（把共享状态收拢到进程内）

## 设计原则

- 网络层（network）不要“直接做业务”，只做：会话、路由、背压、观测
- 业务层以“消息”作为接口，避免跨进程共享状态
- mdb/logdb 抽象要稳定：把 SQL/连接管理与业务隔离

## 输出物

- 服务目录结构规范（rebar3 app 结构）
- supervisor 树草图（故障域划分）
- 进程职责表（谁拥有状态、谁只做纯函数）
</thought>
