## Why

当前角色知识以 Markdown 形式在激活阶段被整体展开进上下文，带来两类问题：一是知识库增大后上下文成本与噪音快速上升，二是无法做到“按问题取用”，角色在具体任务里难以稳定地拿到最相关的知识片段。现在需要引入**独立于记忆网**的知识库检索与自动注入，让“角色随时读知识”对用户无感且可控。

## What Changes

- 新增**角色知识库**的独立存储与索引（SQLite + FTS5），按 `roleId` 隔离，落盘于用户目录 `~/.promptx/knowledge/<roleId>/knowledge.db`。
- 新增知识库**增量索引**流程：基于 `@role://<roleId>` 的 `<knowledge>` 引用清单（`@knowledge://...`）导入；当源文档内容变化时，仅更新受影响条目。
- 新增知识库**检索接口与工具链**：
  - Core：`knowledge.search`（CLI/内部调用）
  - MCP：`promptx_knowledge_search`（供宿主与模型调用）
- 新增桌面端**自动检索注入**（对用户无感）：每次用户提问时，在发送给模型前自动调用 `promptx_knowledge_search(roleId, userQuery)` 获取 TopK 片段，并以稳定格式注入到提示词上下文。
- 明确边界：知识库系统**不写入**、**不依赖**记忆网（`cognition` 的 `engrams.db` / `network.json`），与 `recall/remember` 完全解耦。

## Capabilities

### New Capabilities

- `role-knowledge-index`：为指定 `roleId` 构建/更新独立知识库索引（SQLite FTS5），支持增量更新与按来源回溯（`source_path`、标题路径、chunk）。
- `role-knowledge-search`：基于 FTS5 的全文检索能力，提供 TopK 知识片段（带 `source_path/title_path/snippet/score`），并通过 Core CLI 与 MCP 工具对外暴露。
- `desktop-knowledge-auto-inject`：桌面端在每轮用户请求前自动检索并注入知识片段（对用户无感），控制注入预算并提供可解释的“来源 + 片段”格式，降低幻觉风险。

### Modified Capabilities

- （无）

## Impact

- **Core（packages/core）**：新增 `knowledge/` 模块（store/indexer/manager/chunker）、新增 pouch CLI 命令 `knowledge.search`（及可选 `knowledge.reindex`）。
- **MCP Server（packages/mcp-server）**：新增工具 `knowledge_search`（及可选 `knowledge_reindex`），用于宿主自动注入与显式调用。
- **Desktop（apps/desktop）**：在“发送给模型前”的提示词组装链路增加一次知识检索与上下文注入；需要处理注入长度预算、失败降级（例如索引不可用/无命中时不注入）。
- **依赖与运行环境**：依赖 SQLite FTS5 能力（通过 `better-sqlite3`）；需在初始化阶段进行可用性探测并提供明确错误/降级策略。

