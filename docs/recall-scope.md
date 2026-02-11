# recall 的 scope：读取个人/项目/合并记忆

本文档记录 PromptX 记忆检索工具 `recall` 新增的读取范围参数 `scope`，用于支持**项目级共享记忆**，同时保持 `remember` 仍只写入个人记忆。

## 目标

- **共享**：允许团队把项目记忆放在项目目录下并共享（如提交到 Git）。
- **安全**：`project` scope 读取时不创建/不写入数据库文件，避免污染仓库。
- **兼容**：不传 `scope` 时保持原行为（读取个人记忆）。

## 参数说明

`scope`（可选）取值：

- **`user`**：只读个人记忆（默认）
- **`project`**：只读项目记忆（共享）
- **`both`**：合并读取（个人 + 项目）

> `remember` 行为不变：仍只写入 `user`（个人记忆）。

## 使用方式

### MCP（推荐）

```json
{
  "role": "java-developer",
  "query": "React Hooks",
  "scope": "project",
  "mode": "focused"
}
```

### CLI

```bash
promptx recall java-developer "React Hooks" --scope=project --mode=focused
promptx recall java-developer "React Hooks" --scope=both
promptx recall java-developer --scope=user
```

## 行为定义

### project/both 需要先绑定项目

在使用 `scope=project|both` 前，需要先执行项目绑定（MCP/CLI 的 `project` 命令），让 `@project://` 协议可用。

### both 的合并策略

- **网络图合并**：两份 `Mind` 通过 `Mind.merge()` 合并激活节点与连接。
- **记忆内容合并**：`engrams` 做去重合并（按 `engram.id`）。

### Recall 的 DMN fallback 继承 scope

当 `query` 无命中自动回退 DMN（`query=null`）时，仍使用同一个 `scope` 进行读取。

### 锚定状态（state.json）只写个人

`recall` 触发的锚定（用于下次 prime/恢复上下文）固定写入 **user** 目录，避免在 `project` scope 下产生共享文件噪音。

## 存储位置

### 个人（user）

```
~/.promptx/cognition/<roleId>/
  network.json
  engrams.db
  state.json
```

### 项目（project）

```
<project>/.promptx/memory/cognition/<roleId>/
  network.json
  engrams.db
```

> 在 HTTP/远程模式下，`project://.promptx/...` 会映射到用户目录的项目空间（由 `ProjectProtocol` 处理），但逻辑语义保持一致：这是“项目级”数据源。

## 副作用与安全性

- **project scope 只读**：只在 `engrams.db` 文件存在时打开；不存在不会创建，也不会生成 WAL/SHM 文件。
- **user scope 读写**：保持现有逻辑，用于日常个人记忆积累。

## 共享建议（可选）

如果你希望团队共享项目记忆，可以把 `.promptx/memory/` 纳入同步（例如提交到仓库）。注意 `engrams.db` 属于二进制 SQLite 文件，多人并行改动可能产生合并冲突，需要配套协作约定（例如“集中更新”或改为文本化存储方案）。

