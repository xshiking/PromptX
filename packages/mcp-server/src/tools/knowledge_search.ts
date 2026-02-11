import type { ToolWithHandler } from '~/interfaces/MCPServer.js';
import { MCPOutputAdapter } from '~/utils/MCPOutputAdapter.js';

const outputAdapter = new MCPOutputAdapter();

export const knowledgeSearchTool: ToolWithHandler = {
  name: 'knowledge_search',
  description: `【角色知识库】按需检索角色知识（独立于记忆网）

【规范名称】promptx_knowledge_search
【调用说明】在提示词中使用 promptx_knowledge_search，实际调用时自动映射到 mcp__[server]__knowledge_search

用途：
- 每轮按问题检索 TopK 知识片段（source_path/title_path/snippet）
- 结果适合直接注入上下文（预算可控）
`,
  inputSchema: {
    type: 'object',
    properties: {
      role: { type: 'string', description: '角色ID，如：js-dev, java-developer' },
      query: { type: 'string', description: '检索查询语句' },
      mode: {
        type: 'string',
        enum: ['strict', 'fuzzy'],
        description: '检索模式：strict（默认）= 词项AND；fuzzy = 回退 OR+前缀/LIKE 兜底'
      },
      limit: { type: 'number', description: '返回条数（默认5）' },
      debug: { type: 'boolean', description: '是否输出诊断信息（docCount/sources）' }
    },
    required: ['role', 'query']
  },
  handler: async (args: {
    role: string;
    query: string;
    limit?: number;
    mode?: 'strict' | 'fuzzy';
    debug?: boolean;
  }) => {
    const core = await import('@promptx/core');
    const coreExports = core.default || core;
    const cli = (coreExports as any).cli || (coreExports as any).pouch?.cli;

    if (!cli || !cli.execute) throw new Error('CLI not available in @promptx/core');

    const result = await cli.execute('knowledge.search', [{
      role: args.role,
      query: args.query,
      mode: args.mode ?? 'strict',
      limit: args.limit ?? 5,
      debug: args.debug === true
    }]);

    return outputAdapter.convertToMCPFormat(result);
  }
};

