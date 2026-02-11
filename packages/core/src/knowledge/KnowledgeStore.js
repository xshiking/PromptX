const Database = require('better-sqlite3')
const path = require('path')
const os = require('os')
const fs = require('fs-extra')
const logger = require('@promptx/logger')

/**
 * KnowledgeStore - 角色知识库的本地存储（SQLite + FTS5）
 *
 * 设计要点：
 * - 按 roleId 隔离：每个角色一个 knowledge.db
 * - 与 cognition 完全隔离：不读写 ~/.promptx/cognition
 * - 支持增量：sources 表存 source_hash；docs 存 chunk
 */
class KnowledgeStore {
  /**
   * @param {Object} params
   * @param {string} params.roleId
   * @param {string} [params.basePath] - 默认 ~/.promptx/knowledge
   */
  constructor ({ roleId, basePath = null }) {
    if (!roleId) throw new Error('KnowledgeStore requires roleId')

    this.roleId = roleId
    this.basePath = basePath || path.join(os.homedir(), '.promptx', 'knowledge')
    this.dbPath = path.join(this.basePath, roleId, 'knowledge.db')

    fs.ensureDirSync(path.dirname(this.dbPath))

    this.db = new Database(this.dbPath)
    this.db.pragma('journal_mode = WAL')
    this.db.pragma('synchronous = NORMAL')

    this._initializeSchema()
    this._prepareStatements()

    logger.debug('[KnowledgeStore] Initialized', { roleId, dbPath: this.dbPath })
  }

  _probeFTS5 () {
    try {
      this.db.exec("CREATE VIRTUAL TABLE IF NOT EXISTS __fts5_probe USING fts5(x);")
      this.db.exec('DROP TABLE IF EXISTS __fts5_probe;')
      return true
    } catch (error) {
      const msg = error && error.message ? error.message : String(error)
      const e = new Error(`FTS5_UNAVAILABLE: ${msg}`)
      e.cause = error
      throw e
    }
  }

  _initializeSchema () {
    // 先探测 FTS5，避免后续静默失败
    this._probeFTS5()

    this.db.exec(`
      CREATE TABLE IF NOT EXISTS docs (
        doc_id TEXT PRIMARY KEY,
        role_id TEXT NOT NULL,
        source_path TEXT NOT NULL,
        chunk_index INTEGER NOT NULL,
        title_path TEXT,
        tags TEXT,
        content TEXT NOT NULL,
        content_hash TEXT NOT NULL,
        updated_at INTEGER NOT NULL
      );
    `)

    this.db.exec(`
      CREATE TABLE IF NOT EXISTS sources (
        source_path TEXT PRIMARY KEY,
        role_id TEXT NOT NULL,
        source_hash TEXT NOT NULL,
        updated_at INTEGER NOT NULL,
        meta TEXT
      );
    `)

    this.db.exec('CREATE INDEX IF NOT EXISTS idx_docs_role_source ON docs(role_id, source_path);')
    this.db.exec('CREATE INDEX IF NOT EXISTS idx_sources_role ON sources(role_id);')

    // FTS5 表：external content（rowid 映射 docs.rowid）
    this.db.exec(`
      CREATE VIRTUAL TABLE IF NOT EXISTS docs_fts USING fts5(
        title_path,
        tags,
        content,
        content='docs',
        content_rowid='rowid',
        tokenize='unicode61'
      );
    `)

    // triggers 同步
    this.db.exec(`
      CREATE TRIGGER IF NOT EXISTS docs_ai AFTER INSERT ON docs BEGIN
        INSERT INTO docs_fts(rowid, title_path, tags, content)
        VALUES (new.rowid, new.title_path, new.tags, new.content);
      END;
    `)
    this.db.exec(`
      CREATE TRIGGER IF NOT EXISTS docs_ad AFTER DELETE ON docs BEGIN
        INSERT INTO docs_fts(docs_fts, rowid, title_path, tags, content)
        VALUES('delete', old.rowid, old.title_path, old.tags, old.content);
      END;
    `)
    this.db.exec(`
      CREATE TRIGGER IF NOT EXISTS docs_au AFTER UPDATE ON docs BEGIN
        INSERT INTO docs_fts(docs_fts, rowid, title_path, tags, content)
        VALUES('delete', old.rowid, old.title_path, old.tags, old.content);
        INSERT INTO docs_fts(rowid, title_path, tags, content)
        VALUES (new.rowid, new.title_path, new.tags, new.content);
      END;
    `)
  }

  _prepareStatements () {
    this.stmts = {
      getSourceHash: this.db.prepare(
        'SELECT source_hash FROM sources WHERE role_id = ? AND source_path = ?'
      ),
      upsertSource: this.db.prepare(`
        INSERT INTO sources (source_path, role_id, source_hash, updated_at, meta)
        VALUES (@source_path, @role_id, @source_hash, @updated_at, @meta)
        ON CONFLICT(source_path) DO UPDATE SET
          role_id=excluded.role_id,
          source_hash=excluded.source_hash,
          updated_at=excluded.updated_at,
          meta=excluded.meta
      `),
      deleteDocsBySource: this.db.prepare(
        'DELETE FROM docs WHERE role_id = ? AND source_path = ?'
      ),
      insertDoc: this.db.prepare(`
        INSERT OR REPLACE INTO docs (
          doc_id, role_id, source_path, chunk_index,
          title_path, tags, content, content_hash, updated_at
        ) VALUES (
          @doc_id, @role_id, @source_path, @chunk_index,
          @title_path, @tags, @content, @content_hash, @updated_at
        )
      `),
      countDocs: this.db.prepare(
        'SELECT COUNT(1) AS c FROM docs WHERE role_id = ?'
      ),
      listSources: this.db.prepare(
        'SELECT source_path, source_hash, updated_at FROM sources WHERE role_id = ? ORDER BY updated_at DESC LIMIT ?'
      ),
      listAllSources: this.db.prepare(
        'SELECT source_path FROM sources WHERE role_id = ?'
      ),
      deleteSource: this.db.prepare(
        'DELETE FROM sources WHERE role_id = ? AND source_path = ?'
      ),
      searchLike: this.db.prepare(`
        SELECT
          doc_id,
          source_path,
          title_path,
          chunk_index,
          CASE
            WHEN instr(content, ?) > 0
            THEN substr(content, max(1, instr(content, ?) - 20), 200)
            ELSE substr(content, 1, 200)
          END AS snippet,
          999999 AS score
        FROM docs
        WHERE role_id = ? AND content LIKE '%' || ? || '%'
        ORDER BY updated_at DESC
        LIMIT ?
      `),
      search: this.db.prepare(`
        SELECT
          d.doc_id,
          d.source_path,
          d.title_path,
          d.chunk_index,
          snippet(docs_fts, 2, '', '', ' … ', 20) AS snippet,
          bm25(docs_fts) AS score
        FROM docs_fts
        JOIN docs d ON d.rowid = docs_fts.rowid
        WHERE d.role_id = ? AND docs_fts MATCH ?
        ORDER BY score ASC
        LIMIT ?
      `)
    }
  }

  getDocCount () {
    const row = this.stmts.countDocs.get(this.roleId)
    return row ? Number(row.c || 0) : 0
  }

  getRecentSources (limit = 10) {
    const n = Math.max(1, Math.min(50, Number(limit || 10)))
    return this.stmts.listSources.all(this.roleId, n)
  }

  getAllSourcePaths () {
    const rows = this.stmts.listAllSources.all(this.roleId)
    return (rows || []).map(r => r.source_path).filter(Boolean)
  }

  deleteSource (sourcePath) {
    this.stmts.deleteSource.run(this.roleId, sourcePath)
  }

  getSourceHash (sourcePath) {
    const row = this.stmts.getSourceHash.get(this.roleId, sourcePath)
    return row ? row.source_hash : null
  }

  upsertSource ({ sourcePath, sourceHash, meta = null }) {
    const now = Date.now()
    this.stmts.upsertSource.run({
      source_path: sourcePath,
      role_id: this.roleId,
      source_hash: sourceHash,
      updated_at: now,
      meta: meta ? JSON.stringify(meta) : null
    })
  }

  replaceDocsForSource (sourcePath, docs) {
    const now = Date.now()
    const tx = this.db.transaction(() => {
      this.stmts.deleteDocsBySource.run(this.roleId, sourcePath)
      for (const doc of docs) {
        this.stmts.insertDoc.run({
          doc_id: doc.doc_id,
          role_id: this.roleId,
          source_path: sourcePath,
          chunk_index: doc.chunk_index,
          title_path: doc.title_path,
          tags: doc.tags || null,
          content: doc.content,
          content_hash: doc.content_hash,
          updated_at: now
        })
      }
    })
    tx()
  }

  deleteDocsForSource (sourcePath) {
    this.stmts.deleteDocsBySource.run(this.roleId, sourcePath)
  }

  /**
   * @param {string} query
   * @param {Object} [options]
   * @param {number} [options.limit]
   * @param {'strict'|'fuzzy'} [options.mode]
   */
  search (query, options = {}) {
    const limit = Number(options.limit || 5)
    const mode = options.mode || 'strict'

    const strictMatch = KnowledgeStore.buildStrictMatchQuery(query)
    let rows = this.stmts.search.all(this.roleId, strictMatch, limit)

    if (mode === 'fuzzy' && rows.length === 0) {
      const fuzzyMatch = KnowledgeStore.buildFuzzyMatchQuery(query)
      if (fuzzyMatch && fuzzyMatch !== strictMatch) {
        rows = this.stmts.search.all(this.roleId, fuzzyMatch, limit)
      }
    }

    // 兜底：FTS 对中文“包含式关键词”命中率很差，fuzzy 仍无命中时，降级到 LIKE
    if (mode === 'fuzzy' && rows.length === 0) {
      const needle = KnowledgeStore.pickLikeNeedle(query)
      if (needle) {
        rows = this.stmts.searchLike.all(needle, needle, this.roleId, needle, limit)
      }
    }

    return rows.map(r => ({
      doc_id: r.doc_id,
      source_path: r.source_path,
      title_path: r.title_path,
      chunk_index: r.chunk_index,
      snippet: r.snippet,
      score: r.score
    }))
  }

  close () {
    try { this.db.close() } catch {}
  }

  static tokenizeQuery (query) {
    const q = String(query || '').trim()
    if (!q) return []

    const normalized = q
      .replace(/[\u3000]/g, ' ')
      .replace(/[，。；、：！？（）【】《》“”‘’]/g, ' ')
      .replace(/[.,;:!?()[\]{}<>]/g, ' ')

    const parts = normalized.split(/\s+/).filter(Boolean)
    return parts.slice(0, 12)
  }

  static buildStrictMatchQuery (query) {
    const tokens = KnowledgeStore.tokenizeQuery(query)
    if (tokens.length === 0) return '""'
    return tokens.map(t => `"${String(t).replace(/"/g, '""')}"`).join(' ')
  }

  static buildFuzzyMatchQuery (query) {
    const tokens = KnowledgeStore.tokenizeQuery(query)
    if (tokens.length === 0) return null

    const terms = []
    for (const t of tokens) {
      const cleaned = String(t).replace(/"/g, '""')
      terms.push(`"${cleaned}"`)
      if (cleaned.length >= 2) {
        const noQuotes = cleaned.replace(/\s+/g, '')
        if (noQuotes) terms.push(`${noQuotes}*`)
      }
    }
    return terms.join(' OR ')
  }

  static pickLikeNeedle (query) {
    const q = String(query || '').trim()
    if (!q) return null
    const tokens = KnowledgeStore.tokenizeQuery(q)
    if (tokens.length === 0) return q.slice(0, 32)
    let best = tokens[0]
    for (const t of tokens) {
      if (String(t).length > String(best).length) best = t
    }
    const needle = String(best || '').trim()
    return needle ? needle.slice(0, 32) : q.slice(0, 32)
  }
}

module.exports = KnowledgeStore

