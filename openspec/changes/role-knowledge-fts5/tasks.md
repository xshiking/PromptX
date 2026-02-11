## 1. Core：知识库索引与检索模块（packages/core）

- [ ] 1.1 设计并创建 `packages/core/src/knowledge/` 模块目录结构（Store/Indexer/Manager/Chunker）
- [ ] 1.2 在 Core 中复用 `better-sqlite3` 打开知识库 DB（`~/.promptx/knowledge/<roleId>/knowledge.db`），并设置 WAL/NORMAL pragma
- [ ] 1.3 实现 FTS5 可用性探测（尝试创建 FTS5 虚表）；失败时返回可诊断错误（供桌面端降级）
- [ ] 1.4 实现 SQLite schema：`docs`/`sources`/`docs_fts`（external content）及触发器同步
- [ ] 1.5 实现 `MarkdownChunker`：按 `# / ## / ###` 标题层级生成 `title_path`，按段落累积并限制 chunk 大小
- [ ] 1.6 实现知识来源收集：加载 `@role://<roleId>` 并从 `<knowledge>` 提取 `@knowledge://...` 引用清单
- [ ] 1.7 实现增量索引：为每个 `source_path` 计算内容 hash；未变化跳过；变化则事务内替换该 source 的所有 chunks
- [ ] 1.8 实现检索 API：`search(roleId, query, {limit})` 返回 TopK（含 `source_path/title_path/snippet/score`）
- [ ] 1.9 确保索引/检索与 cognition 子系统完全隔离（不读写 `~/.promptx/cognition/<roleId>/`）

## 2. Core CLI：knowledge.search 命令（packages/core）

- [ ] 2.1 新增 pouch 命令 `knowledge.search`，输入 `{ role, query, limit }`，输出注入友好的结果格式
- [ ] 2.2 （可选）新增 `knowledge.reindex`（支持 `force`）用于调试/手工重建
- [ ] 2.3 将新命令注册到 Core CLI 路由（确保 `cli.execute('knowledge.search', ...)` 可用）

## 3. MCP Server：knowledge_search 工具（packages/mcp-server）

- [ ] 3.1 新增 MCP 工具 `knowledge_search.ts`（规范名 `promptx_knowledge_search`），透传到 Core `knowledge.search`
- [ ] 3.2 （可选）新增 MCP 工具 `knowledge_reindex.ts`（规范名 `promptx_knowledge_reindex`）
- [ ] 3.3 在 `packages/mcp-server/src/tools/index.ts` 注册新工具并确保输出格式稳定

## 4. Desktop：对用户无感的自动检索注入（apps/desktop）

- [ ] 4.1 定位桌面端“发送给模型前”的 prompt 组装入口（roleId、userQuery 可用处）
- [ ] 4.2 在该入口增加自动检索步骤：调用 `promptx_knowledge_search(roleId, userQuery, limit=k)`
- [ ] 4.3 设计并实现注入块的稳定格式（含 `source_path/title_path`），确保可解释
- [ ] 4.4 实现注入预算控制（TopK、每条 snippet 长度、总字符上限）；超出时自动裁剪
- [ ] 4.5 实现失败静默降级：工具超时/报错/无命中 → 不注入但继续请求
- [ ] 4.6 添加可选调试开关（例如设置项显示“本轮注入了哪些知识片段”）以便验证与排障

## 5. 验收与测试

- [ ] 5.1 Core：索引初始化与 FTS5 探测测试（FTS5 不可用时错误可读）
- [ ] 5.2 Core：增量更新测试（同 hash 跳过、变更后原 chunks 被替换）
- [ ] 5.3 Core：检索结果字段与排序测试（TopK、provenance、snippet）
- [ ] 5.4 MCP：工具调用链路测试（MCP → Core CLI → 结果）
- [ ] 5.5 Desktop：自动注入端到端验证（有命中时注入、无命中/失败时不影响对话）

