import type { ToolWithHandler } from '~/interfaces/MCPServer.js';
import { MCPOutputAdapter } from '~/utils/MCPOutputAdapter.js';

const outputAdapter = new MCPOutputAdapter();

export const recallTool: ToolWithHandler = {
  name: 'recall',
  description: `【认知习惯】基于记忆网络的语义场激活

【规范名称】promptx_recall
【调用说明】在提示词中使用 promptx_recall，实际调用时自动映射到 mcp__[server]__recall

⚡ 触发时机（形成条件反射）：
新任务 → 先DMN看全景 → 选词 → 多轮深挖

📋 **推荐工作流（重要）**：

**步骤1：DMN全景扫描**
recall(role, null) → 看到网络全景图
• 目的：了解角色有哪些记忆域，避免"猜词"失败
• 返回：核心枢纽节点 + 深度激活扩散的网络全景
• 何时用：新任务开始、不确定有什么记忆时

**步骤2-N：多轮深入挖掘**
从网络图选词 → recall → 分析结果 → 继续深入
• 从返回的网络图中选择相关关键词
• recall获取该领域的详细记忆
• 分析返回内容和新的网络图
• 发现新线索，继续recall深入
• **重复直到信息充足，不要一次就停**

💡 **核心原则**：
• 从全景到细节（DMN → 领域recall → 具体细节）
• 多轮次深入（不要一次就停止）
• 利用每次返回的网络图引导下一步
• 每次recall都会返回新的网络图和记忆

**query参数说明**：
- null → **DMN模式**（推荐入口），激活核心枢纽，展示网络全景
- 单个关键词："PromptX" → 从该节点开始扩散
- 多个关键词："PromptX 测试 修复" → 多中心激活

**mode参数**：
- balanced（默认）：平衡精确和联想
- focused：精确查找，常用记忆优先
- creative：广泛联想，远距离连接

⚠️ **重要约束**：
只有网络中实际存在的节点才能被激活
→ 这就是为什么要先DMN：看到实际存在的词，再recall

🔄 **认知循环**：
DMN查看全景 → 多轮recall深挖 → 用记忆回答 → remember保存新知`,
  inputSchema: {
    type: 'object',
    properties: {
      role: {
        type: 'string',
        description: '要检索记忆的角色ID，如：java-developer, product-manager, copywriter'
      },
      query: {
        oneOf: [
          { type: 'string' },
          { type: 'null' }
        ],
        description: '检索关键词：单词或空格分隔的多词(string)、或null(DMN模式,自动选择枢纽节点)。多词示例："PromptX 测试 修复"。必须使用记忆网络图中实际存在的词。'
      },
      scope: {
        type: 'string',
        enum: ['project', 'user', 'both'],
        description: '记忆读取范围：project(项目共享)、user(个人)、both(合并)'
      },
      debug: {
        type: 'boolean',
        description: '是否在MCP输出中附带诊断信息（路径解析/文件存在性等）'
      },
      mode: {
        type: 'string',
        enum: ['creative', 'balanced', 'focused'],
        description: '认知激活模式：creative(创造性探索，广泛联想)、balanced(平衡模式，默认)、focused(聚焦检索，精确查找)'
      }
    },
    required: ['role']
  },
  handler: async (args: { role: string; query?: string | null; mode?: string; scope?: 'project' | 'user' | 'both'; debug?: boolean }) => {
    const core = await import('@promptx/core');
    const coreExports = core.default || core;
    const cli = (coreExports as any).cli || (coreExports as any).pouch?.cli;

    if (!cli || !cli.execute) {
      throw new Error('CLI not available in @promptx/core');
    }

    // 构建 CLI 参数，支持 string | string[] | null
    const cliArgs: any[] = [{
      role: args.role,
      query: args.query ?? null,  // undefined转为null
      scope: args.scope,
      debug: args.debug,
      mode: args.mode
    }];

    const result = await cli.execute('recall', cliArgs);
    return outputAdapter.convertToMCPFormat(result);
  }
};