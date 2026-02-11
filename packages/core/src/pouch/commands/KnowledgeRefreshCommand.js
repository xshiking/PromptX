const BasePouchCommand = require('../BasePouchCommand')
const { getGlobalResourceManager } = require('../../resource')
const KnowledgeManager = require('../../knowledge/KnowledgeManager')
const logger = require('@promptx/logger')

/**
 * knowledge.refresh - 显式刷新/重建某角色知识库索引
 *
 * 用途：
 * - 批量编辑 .knowledge.md / role.md 后，一次性强制重建
 * - 预热：先 refresh，再 search
 */
class KnowledgeRefreshCommand extends BasePouchCommand {
  constructor () {
    super()
    this.resourceManager = getGlobalResourceManager()
    this.knowledgeManager = new KnowledgeManager(this.resourceManager)
  }

  getPurpose () {
    return '刷新角色知识库索引（SQLite FTS5），用于批量修改后的显式更新'
  }

  async getContent (args) {
    const { role, force } = this.parseArgs(args)

    if (!role) {
      return this.getUsageHelp()
    }

    // 确保 ResourceManager 初始化
    if (!this.resourceManager.initialized) {
      await this.resourceManager.initializeWithNewArchitecture()
    }

    const doForce = force !== false // 默认 true
    logger.info('[KnowledgeRefreshCommand] Refresh', { role, force: doForce })

    if (doForce) {
      await this.knowledgeManager.reindex(role)
    } else {
      await this.knowledgeManager.ensureIndexed(role, { throttleMs: 0 })
    }

    return `## ✅ 知识库已刷新\n\n- role: ${role}\n- force: ${doForce}\n`
  }

  parseArgs (args) {
    if (!args || args.length === 0) return {}

    // MCP 传对象
    if (typeof args[0] === 'object') {
      const obj = args[0] || {}
      return {
        role: obj.role || obj.roleId,
        force: obj.force
      }
    }

    // CLI：knowledge.refresh <roleId> [--force=true|false]
    const role = args[0]
    let force = true
    for (let i = 1; i < args.length; i++) {
      const a = String(args[i] || '')
      if (a.startsWith('--force=')) {
        const v = a.split('=')[1]
        force = v !== 'false'
      } else if (a === '--no-force') {
        force = false
      }
    }
    return { role, force }
  }

  getUsageHelp () {
    return `📚 **knowledge.refresh - 角色知识库刷新**

用法：
- MCP：knowledge.refresh({ role, force? })
- CLI：knowledge.refresh <roleId> [--force=true|false]

说明：
- force=true（默认）：强制重建索引（推荐批量修改后使用）
- force=false：仅做一次增量检查（不节流）
`
  }
}

module.exports = KnowledgeRefreshCommand

