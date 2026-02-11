const BasePouchCommand = require('../BasePouchCommand')
const CognitionArea = require('../areas/CognitionArea')
const StateArea = require('../areas/common/StateArea')
// const ConsciousnessLayer = require('../layers/ConsciousnessLayer') // 已移除意识层
const CognitionLayer = require('../layers/CognitionLayer')
const RoleLayer = require('../layers/RoleLayer')
const { getGlobalResourceManager } = require('../../resource')
const CognitionManager = require('../../cognition/CognitionManager')
const logger = require('@promptx/logger')

/**
 * 记忆检索命令 - 基于认知体系
 * 使用 CognitionManager 进行智能语义检索
 * 使用Layer架构组装输出
 */
class RecallCommand extends BasePouchCommand {
  constructor () {
    super()
    this.lastSearchCount = 0
    this.resourceManager = getGlobalResourceManager()
    this.cognitionManager = CognitionManager.getInstance(this.resourceManager)
  }

  /**
   * 组装Layers - 使用两层架构
   */
  async assembleLayers(args) {
    // 解析参数：--role, query, mode
    const { role, query, mode, scope, debug } = this.parseArgs(args)

    if (!role) {
      // 错误情况：只创建角色层显示错误
      const roleLayer = new RoleLayer()
      roleLayer.addRoleArea(new StateArea(
        'error: 缺少必填参数 role',
        ['使用方法：recall 角色ID [查询关键词]',
         '示例：recall java-developer "React Hooks"',
         '通过 discover 工具查看所有可用角色']
      ))
      this.registerLayer(roleLayer)
      return
    }

    logger.info('🧠 [RecallCommand] 开始记忆检索流程 (基于认知体系)')
    logger.info(` [RecallCommand] 角色: ${role}, 查询内容: ${query ? `"${query}"` : '全部记忆'}, 范围: ${scope || 'user'}, 模式: ${mode || 'balanced'}, debug: ${!!debug}`)

    try {
      let mind = null
      let fallbackToDMN = false

      // 始终执行 recall，query为null时触发DMN模式
      mind = await this.cognitionManager.recall(role, query, { mode, scope, debug })

      // DMN Fallback: 如果有查询词但没找到任何记忆，自动回退到DMN模式
      if (query && (!mind || mind.activatedCues.size === 0)) {
        logger.info('[RecallCommand] No results found for query, falling back to DMN mode')
        mind = await this.cognitionManager.recall(role, null, { mode, scope, debug })
        fallbackToDMN = true
      }

      if (!mind) {
        logger.warn(`[RecallCommand] No mind returned for role: ${role}, query: ${query}`)
      } else {
        // Debug logging for mind structure in RecallCommand
        logger.info('[RecallCommand] DEBUG - Mind structure after recall/prime:', {
          hasMind: !!mind,
          mindKeys: Object.keys(mind),
          hasEngrams: !!mind.engrams,
          engramsLength: mind.engrams?.length,
          engramsType: typeof mind.engrams,
          activatedCuesSize: mind.activatedCues?.size,
          roleId: role,
          query: query,
          fallbackToDMN: fallbackToDMN,
          operationType: query ? 'recall' : 'prime'
        })

        // Deep debug: log actual mind object structure
        logger.debug('[RecallCommand] DEBUG - Full mind object:', JSON.stringify(mind, null, 2))
      }

      const nodeCount = mind ? mind.activatedCues.size : 0
      logger.info(` [RecallCommand] 认知检索完成 - 激活 ${nodeCount} 个节点${fallbackToDMN ? ' (DMN Fallback)' : ''}`)

      // 设置上下文
      this.context.roleId = role
      this.context.query = query
      this.context.scope = scope
      this.context.debug = debug
      this.context.mind = mind
      this.context.fallbackToDMN = fallbackToDMN

      // 1. 创建认知层 (最高优先级)
      const operationType = fallbackToDMN ? 'prime' : (query ? 'recall' : 'prime')
      const cognitionLayer = fallbackToDMN
        ? CognitionLayer.createForPrime(mind, role)
        : (query
            ? CognitionLayer.createForRecall(mind, role, query)
            : CognitionLayer.createForPrime(mind, role))

      // 添加 fallback 标记到 metadata
      if (fallbackToDMN) {
        cognitionLayer.metadata.fallbackToDMN = true
        cognitionLayer.metadata.originalQuery = query
      }

      this.registerLayer(cognitionLayer)

      // 2. 创建角色层 (次优先级)
      const roleLayer = new RoleLayer({ roleId: role })
      const stateArea = new StateArea('recall_completed', {
        role,
        query,
        count: nodeCount
      })
      roleLayer.addRoleArea(stateArea)
      this.registerLayer(roleLayer)

    } catch (error) {
      logger.error(` [RecallCommand] 记忆检索失败: ${error.message}`)
      logger.debug(` [RecallCommand] 错误堆栈: ${error.stack}`)
      
      // 错误情况：只创建角色层显示错误
      const roleLayer = new RoleLayer()
      const errorArea = new StateArea(
        `error: ${error.message}`,
        ['检查角色ID是否正确', '重试检索操作', '如持续失败，查看日志详情']
      )
      roleLayer.addRoleArea(errorArea)
      this.registerLayer(roleLayer)
    }
  }

  /**
   * 解析命令参数
   * @param {Array} args - 命令参数
   * @returns {Object} 解析后的参数对象
   */
  parseArgs (args) {
    if (!args || args.length === 0) {
      return {}
    }

    // 如果第一个参数是对象（从MCP工具调用）
    if (typeof args[0] === 'object') {
      return args[0]
    }

    // 命令行格式：recall role [query] [--mode=creative|balanced|focused]
    const role = args[0]
    let mode = null
    let scope = null
    let debug = false
    const queryParts = []

    // 解析参数
    for (let i = 1; i < args.length; i++) {
      const arg = args[i]
      if (arg.startsWith('--mode=')) {
        mode = arg.split('=')[1]
      } else if (arg.startsWith('--scope=')) {
        scope = arg.split('=')[1]
      } else if (arg === '--debug') {
        debug = true
      } else {
        queryParts.push(arg)
      }
    }

    const query = queryParts.join(' ')

    return { role, query, mode, scope, debug }
  }
}

module.exports = RecallCommand