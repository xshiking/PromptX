/**
 * MarkdownChunker - 将 Markdown 按标题/段落切片
 *
 * 目标：
 * - 生成可检索的 chunk（用于全文检索注入）
 * - 保留来源可追溯：title_path / chunk_index
 * - v0 轻量实现：不引入 Markdown AST 解析器
 */
class MarkdownChunker {
  /**
   * @param {Object} [options]
   * @param {number} [options.maxChars] - 单个chunk的目标最大字符数（软上限）
   */
  constructor (options = {}) {
    this.maxChars = options.maxChars || 1200
  }

  /**
   * 将 Markdown 内容切成 chunks
   * @param {string} markdown
   * @returns {Array<{chunk_index:number,title_path:string,content:string}>}
   */
  chunk (markdown) {
    const text = (markdown || '').replace(/\r\n/g, '\n').replace(/\r/g, '\n')
    const lines = text.split('\n')

    /** @type {{level:number,text:string}[]} */
    const titleStack = []
    const chunks = []
    let currentLines = []
    let chunkIndex = 0
    let inCodeFence = false
    let fenceMarker = null // ``` or ~~~

    const currentTitlePath = () => {
      const p = titleStack.map(t => t.text).join(' > ')
      return p || 'ROOT'
    }

    const flush = () => {
      const content = currentLines.join('\n').trim()
      if (!content) {
        currentLines = []
        return
      }
      chunks.push({
        chunk_index: chunkIndex++,
        title_path: currentTitlePath(),
        content
      })
      currentLines = []
    }

    const maybeSplitOnBudget = (line) => {
      // 仅在非代码块中，利用空行作为“段落边界”进行切分
      if (inCodeFence) return
      if (line.trim() !== '') return

      const len = currentLines.join('\n').length
      if (len >= this.maxChars) {
        flush()
      }
    }

    for (const rawLine of lines) {
      const line = rawLine

      // fenced code block 处理（避免把代码块里的 ### 当作标题）
      const fenceMatch = line.match(/^(\s*)(```|~~~)/)
      if (fenceMatch) {
        const marker = fenceMatch[2]
        if (!inCodeFence) {
          inCodeFence = true
          fenceMarker = marker
        } else if (marker === fenceMarker) {
          inCodeFence = false
          fenceMarker = null
        }
        currentLines.push(line)
        continue
      }

      if (!inCodeFence) {
        // 标题边界：# / ## / ###（v0 只追踪 1-3 级）
        const headingMatch = line.match(/^(#{1,3})\s+(.*)$/)
        if (headingMatch) {
          // 切到新标题前，先把旧内容落盘
          flush()

          const level = headingMatch[1].length
          const title = (headingMatch[2] || '').trim()
          if (title) {
            while (titleStack.length > 0 && titleStack[titleStack.length - 1].level >= level) {
              titleStack.pop()
            }
            titleStack.push({ level, text: title })
          }
          // 标题本身不进入content（避免重复），title_path 已覆盖语义
          continue
        }
      }

      currentLines.push(line)
      maybeSplitOnBudget(line)
    }

    flush()
    return chunks
  }
}

module.exports = MarkdownChunker

