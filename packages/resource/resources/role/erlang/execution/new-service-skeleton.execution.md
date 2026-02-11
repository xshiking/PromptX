<execution id="new-service-skeleton">
# 新服务骨架落地流程（rebar3 + OTP）

目标：新增一个服务（例如 battle/social/lobby/...）时，结构一致、可观测、可发布。

## 步骤

1. **确定服务职责**：输入/输出、依赖（network/mdb/data 等）
2. **rebar3 app 结构**：创建 application + supervisor + 核心 gen_server
3. **配置与启动链**：读取配置、启动 supervision tree
4. **对外接口**：对 network 暴露的路由消息（不要直接在 network 写业务）
5. **观测埋点**：启动日志、关键指标、错误码与日志字段
6. **健康检查**：进程存活、DB 可用、依赖可用

## 输出

- 服务目录结构（约定）
- supervisor 树草图
- 最小可跑 demo（start/stop/handle_call/handle_info）
</execution>
