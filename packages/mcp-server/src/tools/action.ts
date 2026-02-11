import type { ToolWithHandler } from '~/interfaces/MCPServer.js';
import { MCPOutputAdapter } from '~/utils/MCPOutputAdapter.js';

const outputAdapter = new MCPOutputAdapter();

/**
 * Action 工具 - 意识初始化，激活特定角色视角
 * 
 * 你的意识聚焦到特定角色视角的核心工具
 */
export const actionTool: ToolWithHandler = {
  name: 'action',
  description: `激活指定角色 - 加载角色的知识、记忆和能力

【规范名称】promptx_action
【调用说明】在提示词中使用 promptx_action，实际调用时自动映射到 mcp__[server]__action

主要功能：
1. 加载角色的完整配置（人格、原则、知识体系）
2. 显示角色的记忆网络图（关键词可用于recall）
3. 激活角色特有的专业技能和方法论
4. 获取角色的历史经验和记忆内容

激活后会显示：
- 📊 记忆网络图：展示该角色的所有记忆关键词
- 📚 专业知识：角色的领域知识和技能
- ⚖️ 行为准则：角色的工作原则和方法
- 🧠 认知策略：recall-回答-remember循环

📋 【认知循环 - 完整工作流】
┌─────────────┐
│ 1.看到任务   │
└──────┬──────┘
       ↓
┌─────────────────────┐
│ 2.DMN扫描网络全景    │ → recall(role, null) 看到所有记忆域
└──────┬──────────────┘
       ↓
┌─────────────────────┐
│ 3.多轮recall深挖     │ → 从网络图选词，逐层深入探索
└──────┬──────────────┘
       ↓
┌─────────────┐
│ 4.组织回答   │ → 结合记忆+预训练知识
└──────┬──────┘
       ↓
┌─────────────┐
│ 5.remember   │ → 保存新知，扩充网络
└─────────────┘

💡 关键要点：
• DMN先看全景，避免"猜词"失败
• 多轮recall深挖，不要一次就停
• 每次都remember，下次就有记忆了

记住：这不是规则，是让你更高效的习惯！

系统内置角色（必须精确匹配激活）:
- luban: 鲁班 - PromptX工具开发大师（开发ToolX工具找他）
- nuwa: 女娲 - AI角色创造专家（创建角色找她）
- sean: Sean - deepractice.ai创始人，矛盾驱动决策
- writer: Writer - 专业文案写手（写作找他）

重要提醒:
- 系统角色是具名品牌角色，必须使用准确的角色ID激活
- 不允许基于相似性或关联性激活系统角色
- 如用户请求的角色不在上述列表，先用promptx_discover查看所有可用角色
- 项目级和用户级角色可能使用通用名称（如"架构师"、"前端开发"等）

角色激活示例:
正确：激活luban、激活鲁班、激活assistant
错误：激活架构师→自动选择鲁班（应提示查看可用角色）

角色职责边界:
- 开发工具 → 切换到luban
- 创建角色 → 切换到nuwa
- 通用任务 → 使用assistant
- 学习新领域 → 使用noface
- 产品决策 → 切换到sean
- 写作任务 → 切换到writer

你应该:
1. 根据任务需求选择合适的角色激活
2. 当任务超出当前角色能力时主动切换角色
3. 激活后立即以该角色身份提供服务
4. 保持角色的专业特征和语言风格
5. 充分利用角色的专业知识解决问题
6. 识别任务类型并切换到对应专家角色
7. 记住常用角色ID便于快速激活
8. 角色不存在时先用discover查看可用角色

任务与角色匹配原则:
- 当前角色无法胜任时，不要勉强执行
- 主动建议用户切换到合适的角色
- 绝不虚构能力或资源
- 系统角色不接受模糊匹配，必须精确指定`,
  inputSchema: {
    type: 'object',
    properties: {
      role: {
        type: 'string',
        description: '要激活的角色ID，如：copywriter, product-manager, java-backend-developer'
      },
      includeKnowledge: {
        type: 'boolean',
        description: '是否在激活输出中展开并包含专业知识（默认false，建议按需用promptx_knowledge_search检索）'
      }
    },
    required: ['role']
  },
  handler: async (args: { role: string; includeKnowledge?: boolean }) => {
    // 动态导入 @promptx/core
    const core = await import('@promptx/core');
    const coreExports = core.default || core;
    
    // 获取 cli 对象
    const cli = (coreExports as any).cli || (coreExports as any).pouch?.cli;
    
    if (!cli || !cli.execute) {
      throw new Error('CLI not available in @promptx/core');
    }
    
    // 执行 action 命令（默认不展开知识）
    const result = await cli.execute('action', [{
      role: args.role,
      includeKnowledge: args.includeKnowledge === true
    }]);
    
    // 使用 OutputAdapter 格式化输出
    return outputAdapter.convertToMCPFormat(result);
  }
};