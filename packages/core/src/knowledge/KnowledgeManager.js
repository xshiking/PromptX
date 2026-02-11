const logger = require('@promptx/logger')
const KnowledgeStore = require('./KnowledgeStore')
const KnowledgeIndexer = require('./KnowledgeIndexer')
const DPMLContentParser = require('../dpml/DPMLContentParser')
const SemanticRenderer = require('../dpml/SemanticRenderer')

/**
 * KnowledgeManager - 知识库门面
 */
class KnowledgeManager {
  constructor (resourceManager) {
    this.resourceManager = resourceManager
    this.indexer = new KnowledgeIndexer({ resourceManager })
    // 节流：避免同一 role 在短时间内重复增量扫描
    this.lastEnsureAt = new Map() // roleId -> timestamp(ms)

    this.dpmlParser = new DPMLContentParser()
    this.semanticRenderer = new SemanticRenderer()
  }

  async ensureIndexed (roleId, options = {}) {
    const throttleMs = Number(options.throttleMs ?? 1500)
    const now = Date.now()
    const last = this.lastEnsureAt.get(roleId) || 0
    if (throttleMs > 0 && now - last < throttleMs) return
    this.lastEnsureAt.set(roleId, now)

    try {
      await this.indexer.indexRole(roleId, { force: false })
    } catch (e) {
      logger.error('[KnowledgeManager] ensureIndexed failed', {
        roleId,
        error: e && e.message ? e.message : String(e)
      })
      throw e
    }
  }

  async search (roleId, query, options = {}) {
    const limit = options.limit || 5
    const mode = options.mode || 'strict'
    await this.ensureIndexed(roleId)

    const store = new KnowledgeStore({ roleId })
    try {
      return store.search(query, { limit, mode })
    } finally {
      store.close()
    }
  }

  async reindex (roleId) {
    await this.indexer.indexRole(roleId, { force: true })
    this.lastEnsureAt.set(roleId, Date.now())
  }

  /**
   * 按“当前角色读取知识库”的方式渲染知识段（用于注入/预览）
   * @param {string} roleId
   * @returns {Promise<string>}
   */
  async renderRoleKnowledge (roleId) {
    if (!this.resourceManager?.initialized) {
      if (typeof this.resourceManager?.initializeWithNewArchitecture === 'function') {
        await this.resourceManager.initializeWithNewArchitecture()
      }
    }

    const res = await this.resourceManager.loadResource(`@role://${roleId}`)
    if (!res || !res.success || !res.content) {
      throw new Error(`Role not found or empty: @role://${roleId}`)
    }

    const semantics = this.dpmlParser.parseRoleDocument(res.content)
    if (!semantics?.knowledge) {
      return '# 📚 专业知识体系\n\n（角色未定义 knowledge 段）'
    }

    const rendered = await this.semanticRenderer.renderSemanticContent(
      semantics.knowledge,
      this.resourceManager
    )
    return `# 📚 专业知识体系\n${rendered}`.trim()
  }
}

module.exports = KnowledgeManager

