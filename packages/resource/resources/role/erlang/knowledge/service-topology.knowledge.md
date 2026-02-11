<knowledge id="service-topology">
# 服务拓扑与职责边界（你们的多服务架构）

## 服务清单（当前）

- game：游戏逻辑主服务器
- battle：战斗服务器
- social：社交服务器
- lobby：大厅/匹配服务
- login：登录服务
- robot：机器人/压测服务
- admin：后台管理（Mochiweb / ErlyDTL）
- mdb：数据库抽象层
- logdb：日志数据库
- network：网络通信层（接入、解包、路由）
- data：配置数据管理
- mcp：MCP 协议服务

## 建议边界

- network：只处理会话、framing、路由、限流、观测（不写业务）
- mdb/logdb：封装 DB 访问与连接管理（业务不拼 SQL）
- game/battle/social/lobby：业务核心（通过消息/接口与 network 协作）
- robot：压测与回归工具化（不污染线上代码路径）
</knowledge>
