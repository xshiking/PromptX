import type { ToolWithHandler } from '~/interfaces/MCPServer.js';
import { MCPOutputAdapter } from '~/utils/MCPOutputAdapter.js';

const outputAdapter = new MCPOutputAdapter();

export const knowledgeRefreshTool: ToolWithHandler = {
  name: 'knowledge_refresh',
  description: `【角色知识库】显式刷新/重建角色知识库索引

【规范名称】promptx_knowledge_refresh
【调用说明】在提示词中使用 promptx_knowledge_refresh，实际调用时自动映射到 mcp__[server]__knowledge_refresh
`,
  inputSchema: {
    type: 'object',
    properties: {
      role: { type: 'string', description: '角色ID，如：js-dev, java-developer' },
      force: { type: 'boolean', description: '是否强制重建索引（默认true）' }
    },
    required: ['role']
  },
  handler: async (args: { role: string; force?: boolean }) => {
    const core = await import('@promptx/core');
    const coreExports = core.default || core;
    const cli = (coreExports as any).cli || (coreExports as any).pouch?.cli;

    if (!cli || !cli.execute) throw new Error('CLI not available in @promptx/core');

    const result = await cli.execute('knowledge.refresh', [{
      role: args.role,
      force: args.force !== false
    }]);

    return outputAdapter.convertToMCPFormat(result);
  }
};

