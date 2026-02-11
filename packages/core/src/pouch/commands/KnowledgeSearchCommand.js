const BasePouchCommand = require('../BasePouchCommand')
const { getGlobalResourceManager } = require('../../resource')
const KnowledgeManager = require('../../knowledge/KnowledgeManager')
const logger = require('@promptx/logger')

/**
 * knowledge.search - 角色知识库全文检索（独立于记忆网）
 *
 * 说明：
 * - v0 返回注入友好的文本（带 source_path/title_path/snippet）
 * - 桌面端自动注入可直接调用 KnowledgeManager（避免依赖 MCP 的 text 包装）
 */
class KnowledgeSearchCommand extends BasePouchCommand {
  constructor () {
    super()
    this.resourceManager = getGlobalResourceManager()
    this.knowledgeManager = new KnowledgeManager(this.resourceManager)
  }

  getPurpose () {
    return '检索角色知识库（SQLite FTS5），返回相关知识片段（独立于记忆网）'
  }

  async getContent (args) {
    const { role, query, limit, mode, debug } = this.parseArgs(args)

    if (!role || !query) {
      return this.getUsageHelp()
    }

    // 确保 ResourceManager 初始化
    if (!this.resourceManager.initialized) {
      await this.resourceManager.initializeWithNewArchitecture()
    }

    logger.info('[KnowledgeSearchCommand] Search', { role, query, limit, mode, debug })

    const results = await this.knowledgeManager.search(role, query, { limit, mode: mode || 'strict' })

    const k = Math.min(Number(limit || 5), results.length)
    let out = `## 📚 知识库检索结果\n\n- role: ${role}\n- query: "${query}"\n- mode: ${mode || 'strict'}\n- topK: ${k}\n`

    if (debug) {
      // 诊断：看看这个 role 当前到底有没有 docs / sources
      const KnowledgeStore = require('../../knowledge/KnowledgeStore')
      const store = new KnowledgeStore({ roleId: role })
      try {
        const docCount = store.getDocCount()
        const recentSources = store.getRecentSources(10)
        out += `- debug.docCount: ${docCount}\n`
        out += `- debug.recentSources: ${recentSources.length}\n`
        if (recentSources.length > 0) {
          out += '\n### debug.sources\n'
          for (const s of recentSources) {
            out += `- ${s.source_path}\n`
          }
        }
      } finally {
        store.close()
      }
    }

    if (results.length === 0) {
      out += '\n（无命中）\n'
      return out
    }

    out += '\n'
    results.slice(0, k).forEach((r, idx) => {
      const title = r.title_path || 'ROOT'
      out += `${idx + 1}) ${title}（${r.source_path}）\n`
      out += `片段：${r.snippet || ''}\n\n`
    })

    return out.trim()
  }

  parseArgs (args) {
    if (!args || args.length === 0) return {}

    // MCP 传对象
    if (typeof args[0] === 'object') {
      const obj = args[0] || {}
      return {
        role: obj.role,
        query: obj.query,
        limit: obj.limit,
        mode: obj.mode,
        debug: obj.debug === true
      }
    }

    // CLI 形式：knowledge.search role "query..." [--limit=5] [--mode=strict|fuzzy]
    const role = args[0]
    let limit = 5
    let mode = 'strict'
    let debug = false
    const queryParts = []
    for (let i = 1; i < args.length; i++) {
      const a = args[i]
      if (a && a.startsWith('--limit=')) {
        const v = Number(a.split('=')[1])
        if (!Number.isNaN(v) && v > 0) limit = v
      } else if (a && a.startsWith('--mode=')) {
        const v = String(a.split('=')[1] || '').trim()
        if (v === 'strict' || v === 'fuzzy') mode = v
      } else if (a === '--debug') {
        debug = true
      } else {
        queryParts.push(a)
      }
    }
    return { role, query: queryParts.join(' '), limit, mode, debug }
  }

  getUsageHelp () {
    return `📚 **knowledge.search - 角色知识库检索**

用法：
- MCP：knowledge.search({ role, query, limit?, mode? })
- CLI：knowledge.search <roleId> <query...> [--limit=5] [--mode=strict|fuzzy] [--debug]

示例：
- knowledge.search java-developer "Spring 事务传播" --limit=5
- knowledge.search java-developer "Spring 事务传播" --mode=fuzzy --limit=5
`
  }
}

module.exports = KnowledgeSearchCommand

