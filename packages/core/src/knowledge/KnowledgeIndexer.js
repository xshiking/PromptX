const crypto = require('crypto')
const logger = require('@promptx/logger')
const DPMLContentParser = require('../dpml/DPMLContentParser')
const KnowledgeStore = require('./KnowledgeStore')
const MarkdownChunker = require('./MarkdownChunker')

/**
 * KnowledgeIndexer - 从 role 的 @knowledge 引用构建知识库索引
 *
 * v0 规则：
 * - 来源：读取 @role://<roleId> 的 <knowledge> 段引用清单（@knowledge://...）
 * - 增量：sources.source_hash 相同则跳过
 * - 切片：MarkdownChunker（标题层级 + 段落预算）
 * - 清理：role.md 移除引用后，清理陈旧 sources/docs
 */
class KnowledgeIndexer {
  constructor ({ resourceManager, options = {} }) {
    this.resourceManager = resourceManager
    this.dpmlParser = new DPMLContentParser()
    this.chunker = new MarkdownChunker(options.chunker || {})
  }

  /**
   * @param {string} roleId
   * @param {Object} [options]
   * @param {boolean} [options.force]
   * @returns {Promise<{indexedSources:number, skippedSources:number, totalSources:number}>}
   */
  async indexRole (roleId, options = {}) {
    const force = !!options.force
    const store = new KnowledgeStore({ roleId })

    try {
      const sources = await this.getKnowledgeSourcesFromRole(roleId)
      const currentSourceSet = new Set(sources)

      let indexedSources = 0
      let skippedSources = 0

      for (const sourcePath of sources) {
        try {
          const loaded = await this.resourceManager.loadResource(sourcePath)
          if (!loaded || !loaded.success) {
            logger.warn('[KnowledgeIndexer] Failed to load knowledge resource', { roleId, sourcePath })
            continue
          }

          const raw = this.extractKnowledgeInnerContent(loaded.content)
          const sourceHash = KnowledgeIndexer.sha1(raw)

          const existingHash = store.getSourceHash(sourcePath)
          if (!force && existingHash && existingHash === sourceHash) {
            skippedSources++
            continue
          }

          const chunks = this.chunker.chunk(raw)
          const docs = chunks.map(c => ({
            doc_id: KnowledgeIndexer.docId(roleId, sourcePath, c.chunk_index),
            chunk_index: c.chunk_index,
            title_path: c.title_path,
            tags: null,
            content: c.content,
            content_hash: KnowledgeIndexer.sha1(c.content)
          }))

          store.replaceDocsForSource(sourcePath, docs)
          store.upsertSource({ sourcePath, sourceHash, meta: { chunkCount: docs.length } })
          indexedSources++
        } catch (e) {
          logger.error('[KnowledgeIndexer] Index source failed', {
            roleId,
            sourcePath,
            error: e && e.message ? e.message : String(e)
          })
        }
      }

      // 清理：role.md 中已移除引用的旧 source 需要从库里删除（避免陈旧索引）
      try {
        const existingSources = store.getAllSourcePaths()
        for (const oldSource of existingSources) {
          if (!currentSourceSet.has(oldSource)) {
            store.deleteDocsForSource(oldSource)
            store.deleteSource(oldSource)
          }
        }
      } catch (e) {
        logger.warn('[KnowledgeIndexer] Cleanup stale sources failed', {
          roleId,
          error: e && e.message ? e.message : String(e)
        })
      }

      return { indexedSources, skippedSources, totalSources: sources.length }
    } finally {
      store.close()
    }
  }

  async getKnowledgeSourcesFromRole (roleId) {
    const roleRes = await this.resourceManager.loadResource(`@role://${roleId}`)
    if (!roleRes || !roleRes.success || !roleRes.content) {
      throw new Error(`Role not found or empty: @role://${roleId}`)
    }

    const semantics = this.dpmlParser.parseRoleDocument(roleRes.content)
    const refs = semantics?.knowledge?.references || []
    const sources = refs
      .filter(r => r.protocol === 'knowledge')
      .map(r => `@knowledge://${r.resource}`)

    const seen = new Set()
    const unique = []
    for (const s of sources) {
      if (!seen.has(s)) {
        unique.push(s)
        seen.add(s)
      }
    }
    return unique
  }

  extractKnowledgeInnerContent (content) {
    const text = String(content || '')
    // 支持 <knowledge> 与带属性的 <knowledge id="...">
    const match = text.match(/<knowledge[^>]*>([\s\S]*?)<\/knowledge>/i)
    if (match && match[1] != null) {
      return String(match[1]).trim()
    }
    return text.trim()
  }

  static sha1 (text) {
    return crypto.createHash('sha1').update(String(text || ''), 'utf8').digest('hex')
  }

  static docId (roleId, sourcePath, chunkIndex) {
    return KnowledgeIndexer.sha1(`${roleId}|${sourcePath}|${chunkIndex}`)
  }
}

module.exports = KnowledgeIndexer

