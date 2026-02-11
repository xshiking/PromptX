const fs = require('fs').promises;
const path = require('path');
const os = require('os');
const CognitionSystem = require('./CognitionSystem');
const Anchor = require('./Anchor');
const logger = require('@promptx/logger');
const ProjectManager = require('~/project/ProjectManager');

/**
 * CognitionManager - 认知系统管理器
 * 
 * 负责管理多个角色的认知系统实例
 * 每个角色都有独立的 CognitionSystem 实例和存储路径
 * 
 * 使用单例模式确保内存状态一致性
 * 
 * 存储结构：
 * ~/.promptx/cognition/
 *   ├── java-developer/
 *   │   └── mind.json
 *   ├── product-manager/
 *   │   └── mind.json
 *   └── copywriter/
 *       └── mind.json
 */
class CognitionManager {
  constructor(resourceManager = null) {
    this.resourceManager = resourceManager;
    this.systems = new Map(); // `${scope}:${roleId}` -> CognitionSystem
    this.userBasePath = path.join(os.homedir(), '.promptx', 'cognition');
  }
  
  /**
   * 获取单例实例
   * @param {Object} resourceManager - 可选的资源管理器
   * @returns {CognitionManager}
   */
  static getInstance(resourceManager = null) {
    if (!CognitionManager.instance) {
      CognitionManager.instance = new CognitionManager(resourceManager);
      logger.info('[CognitionManager] Created singleton instance');
    }
    return CognitionManager.instance;
  }

  /**
   * 获取 scope 对应的 basePath
   * - user: ~/.promptx/cognition
   * - project: project://.promptx/memory/cognition （支持HTTP映射）
   * @param {'user'|'project'} scope
   * @returns {Promise<string>}
   */
  async getBasePath(scope) {
    if (scope === 'user') {
      return this.userBasePath;
    }

    if (scope === 'project') {
      if (!ProjectManager.isInitialized()) {
        throw new Error('项目未初始化，请先调用 project 命令绑定项目');
      }

      let currentProject = null;
      try {
        currentProject = ProjectManager.getCurrentProject();
      } catch {
        // ignore
      }

      // 优先使用@project协议（支持HTTP模式映射）
      const projectProtocol = this.resourceManager?.protocols?.get?.('project');
      if (projectProtocol && typeof projectProtocol.resolvePath === 'function') {
        const resolved = await projectProtocol.resolvePath('.promptx/memory/cognition');
        logger.debug('[CognitionManager] Resolved project cognition basePath', {
          scope,
          transport: currentProject?.transport,
          workingDirectory: currentProject?.workingDirectory,
          resolved
        });
        return resolved;
      }

      // 兜底：直接拼接本地项目路径
      const projectRoot = ProjectManager.getCurrentProjectPath();
      const resolved = path.join(projectRoot, '.promptx', 'memory', 'cognition');
      logger.debug('[CognitionManager] Resolved project cognition basePath (fallback)', {
        scope,
        transport: currentProject?.transport,
        workingDirectory: currentProject?.workingDirectory,
        resolved
      });
      return resolved;
    }

    throw new Error(`不支持的scope: ${scope}`);
  }

  /**
   * 获取角色的存储路径
   * @param {string} roleId - 角色ID
   * @param {'user'|'project'} scope - 存储范围
   * @returns {string} 存储路径
   */
  async getRolePath(roleId, scope = 'user') {
    const basePath = await this.getBasePath(scope);
    return path.join(basePath, roleId);
  }

  /**
   * 获取角色的 network.json 文件路径
   * @param {string} roleId - 角色ID
   * @param {'user'|'project'} scope - 存储范围
   * @returns {string} network.json 文件路径
   */
  async getNetworkFilePath(roleId, scope = 'user') {
    const rolePath = await this.getRolePath(roleId, scope);
    return path.join(rolePath, 'network.json');
  }

  /**
   * 确保角色的存储目录存在
   * @param {string} roleId - 角色ID
   * @param {'user'|'project'} scope - 存储范围
   */
  async ensureRoleDirectory(roleId, scope = 'user') {
    const rolePath = await this.getRolePath(roleId, scope);
    try {
      await fs.mkdir(rolePath, { recursive: true });
      logger.debug(`[CognitionManager] Ensured directory for role: ${roleId}`);
    } catch (error) {
      logger.error(`[CognitionManager] Failed to create directory for role ${roleId}:`, error);
      throw error;
    }
  }

  /**
   * 获取或创建角色的认知系统实例
   * @param {string} roleId - 角色ID
   * @param {Object} [options]
   * @param {'user'|'project'} [options.scope] - 数据范围
   * @returns {CognitionSystem} 认知系统实例
   */
  async getSystem(roleId, options = {}) {
    const scope = options.scope || 'user';
    const key = `${scope}:${roleId}`;

    if (!this.systems.has(key)) {
      logger.info(`[CognitionManager] Creating new CognitionSystem for role: ${roleId}`, { scope });

      // user scope：允许创建目录；project scope：避免读操作产生副作用（不主动创建）
      if (scope === 'user') {
        await this.ensureRoleDirectory(roleId, scope);
      }

      // 创建新的认知系统实例
      const system = new CognitionSystem({
        memoryMode: scope === 'project' ? 'readonly' : 'readwrite'
      });

      // 为Network添加必要的属性
      system.network.roleId = roleId;
      system.network.directory = await this.getRolePath(roleId, scope);

      // 尝试加载已有的认知数据
      const networkFilePath = await this.getNetworkFilePath(roleId, scope);

      // 额外日志：帮助定位“路径/文件不存在”
      try {
        const engramsPath = path.join(system.network.directory, 'engrams.db');
        const [networkExists, engramsExists] = await Promise.all([
          fs.access(networkFilePath).then(() => true).catch(() => false),
          fs.access(engramsPath).then(() => true).catch(() => false)
        ]);
        logger.debug('[CognitionManager] Cognition storage probe', {
          scope,
          roleId,
          roleDir: system.network.directory,
          networkFilePath,
          networkExists,
          engramsPath,
          engramsExists,
          memoryMode: system.memoryMode
        });
      } catch (e) {
        logger.debug('[CognitionManager] Cognition storage probe failed (ignored)', {
          scope,
          roleId,
          error: e?.message || String(e)
        });
      }

      try {
        await system.network.load(networkFilePath);
        logger.info(`[CognitionManager] Loaded existing network data for role: ${roleId}`, { scope });
      } catch (error) {
        // 文件不存在或解析失败，使用空的认知系统
        if (error.code !== 'ENOENT') {
          logger.warn(`[CognitionManager] Failed to load network data for role ${roleId}:`, error.message);
        } else {
          logger.debug(`[CognitionManager] No existing network data for role: ${roleId}`, { scope });
        }
      }

      this.systems.set(key, system);
    }

    return this.systems.get(key);
  }

  /**
   * 保存角色的认知数据
   * @param {string} roleId - 角色ID
   * @param {Object} [options]
   * @param {'user'} [options.scope] - 仅支持user保存（remember保持个人记忆）
   */
  async saveSystem(roleId, options = {}) {
    const scope = options.scope || 'user';
    const key = `${scope}:${roleId}`;
    const system = this.systems.get(key);
    if (!system) {
      logger.warn(`[CognitionManager] No system to save for role: ${roleId}`);
      return;
    }

    try {
      // 确保目录存在
      await this.ensureRoleDirectory(roleId, scope);
      
      // 使用 Network 的 persist 方法直接保存
      const networkFilePath = await this.getNetworkFilePath(roleId, scope);
      await system.network.persist(networkFilePath);
      
      logger.info(`[CognitionManager] Saved network data for role: ${roleId}`);
    } catch (error) {
      logger.error(`[CognitionManager] Failed to save network data for role ${roleId}:`, error);
      throw error;
    }
  }

  /**
   * 将mind状态锚定到用户目录（避免project scope 产生仓库副作用）
   */
  async anchorToUser(roleId, centerWord, mind) {
    try {
      const userRoleDir = await this.getRolePath(roleId, 'user');
      // 仅提供Anchor所需字段，避免与Network强耦合
      const anchor = new Anchor({ roleId, directory: userRoleDir });
      await anchor.execute(centerWord, mind);
    } catch (error) {
      logger.error('[CognitionManager] Failed to anchor to user scope', { error: error.message });
    }
  }

  /**
   * 从用户目录加载锚定状态（避免project scope 共享用户工作记忆）
   */
  async loadUserAnchor(roleId) {
    try {
      const userRoleDir = await this.getRolePath(roleId, 'user');
      const anchor = new Anchor({ roleId, directory: userRoleDir });
      return await anchor.load();
    } catch (error) {
      logger.error('[CognitionManager] Failed to load user anchor', { error: error.message });
      return null;
    }
  }

  /**
   * Prime - 获取角色的认知概览
   * 优先从锚定状态恢复，如果没有则执行常规prime
   * @param {string} roleId - 角色ID
   * @param {Object} [options]
   * @param {'user'|'project'|'both'} [options.scope]
   * @returns {Mind} Mind 对象
   */
  async prime(roleId, options = {}) {
    const scope = options.scope || 'user';
    logger.info(`[CognitionManager] Prime for role: ${roleId}`);
    
    const system = await this.getSystem(roleId, { scope: scope === 'both' ? 'user' : scope });
    logger.debug(`[CognitionManager] System network size before prime: ${system.network.size()}`);
    
    // 尝试从锚定状态恢复
    const anchoredState = await this.loadUserAnchor(roleId);
    
    let mind = null;
    
    if (anchoredState && anchoredState.centerWord) {
      // 从锚定状态恢复：执行recall(centerWord)
      logger.info(`[CognitionManager] Prime from anchored state`, {
        centerWord: anchoredState.centerWord,
        timestamp: new Date(anchoredState.timestamp).toISOString(),
        nodeCount: anchoredState.metadata?.nodeCount
      });
      
      mind = await system.recall(anchoredState.centerWord);
      
      if (mind) {
        logger.info(`[CognitionManager] Successfully primed from anchored state: "${anchoredState.centerWord}"`);
      }
    }
    
    // 如果没有锚定状态或恢复失败，执行常规prime
    if (!mind) {
      logger.debug(`[CognitionManager] No anchored state or recovery failed, using regular prime`);
      mind = await system.prime();
    }
    
    if (!mind) {
      logger.warn(`[CognitionManager] Prime returned null for role: ${roleId}`);
      return null;
    }
    
    logger.debug(`[CognitionManager] Prime returned Mind:`, {
      hasMind: !!mind,
      activatedCuesSize: mind?.activatedCues?.size || 0,
      connectionsCount: mind?.connections?.length || 0
    });
    
    return mind;
  }

  /**
   * Recall - 从角色的认知中检索相关记忆
   * 每次recall后自动锚定状态
   * @param {string} roleId - 角色ID
   * @param {string} query - 查询词
   * @param {Object} options - 可选参数
   * @param {string} options.mode - 认知激活模式 ('creative' | 'balanced' | 'focused')
   * @param {'project'|'user'|'both'} options.scope - 读取范围
   * @returns {Promise<Mind>} Mind 对象（包含engrams）
   */
  async recall(roleId, query, options = {}) {
    const mode = options.mode || 'balanced';
    const scope = options.scope || 'user';
    const debug = !!options.debug;
    logger.info(`[CognitionManager] Recall for role: ${roleId}, query: "${query}", scope: ${scope}, mode: ${mode}`);

    const buildDiagnostics = async (singleScope) => {
      const basePath = await this.getBasePath(singleScope);
      const roleDir = await this.getRolePath(roleId, singleScope);
      const networkFilePath = await this.getNetworkFilePath(roleId, singleScope);
      const engramsPath = path.join(roleDir, 'engrams.db');
      const [networkExists, engramsExists] = await Promise.all([
        fs.access(networkFilePath).then(() => true).catch(() => false),
        fs.access(engramsPath).then(() => true).catch(() => false)
      ]);

      return {
        scope: singleScope,
        basePath,
        roleId,
        roleDir,
        networkFilePath,
        networkExists,
        engramsPath,
        engramsExists,
        note: singleScope === 'project'
          ? 'project scope is readonly: missing engrams.db will be skipped (no file creation)'
          : undefined
      };
    };

    const recallOnce = async (singleScope) => {
      const system = await this.getSystem(roleId, { scope: singleScope });

      // Project scope memory may be created/synced after the server started.
      // If we already cached an empty system (network.json was missing at that time),
      // reload network.json on-demand when it becomes available.
      if (singleScope === 'project') {
        try {
          const networkFilePath = await this.getNetworkFilePath(roleId, singleScope);
          const exists = await fs.access(networkFilePath).then(() => true).catch(() => false);
          if (exists && system?.network?.size && system.network.size() === 0) {
            await system.network.load(networkFilePath);
            logger.info('[CognitionManager] Reloaded project network.json (hot)', {
              roleId,
              networkFilePath
            });
          }
        } catch (e) {
          logger.warn('[CognitionManager] Failed to hot-reload project network.json (ignored)', {
            roleId,
            error: e?.message || String(e)
          });
        }
      }

      const mind = await system.recall(query, { mode });
      if (mind && debug) {
        try {
          mind.diagnostics = await buildDiagnostics(singleScope);
        } catch (e) {
          mind.diagnostics = { scope: singleScope, error: e?.message || String(e) };
        }
      }
      return mind;
    };

    let mind = null;
    if (scope === 'both') {
      const [projectMind, userMind] = await Promise.all([
        recallOnce('project').catch(() => null),
        recallOnce('user').catch(() => null)
      ]);

      mind = userMind || projectMind;
      if (mind && projectMind && mind !== projectMind) {
        mind.merge(projectMind);
      }

      // 合并engrams（去重）
      const mergedEngrams = [];
      const seen = new Set();
      const addEngrams = (list) => {
        if (!Array.isArray(list)) return;
        for (const e of list) {
          const id = e?.id || JSON.stringify(e);
          if (!seen.has(id)) {
            seen.add(id);
            mergedEngrams.push(e);
          }
        }
      };
      addEngrams(userMind?.engrams);
      addEngrams(projectMind?.engrams);
      if (mind) {
        mind.engrams = mergedEngrams;
        if (debug) {
          mind.diagnostics = {
            scope: 'both',
            sources: [
              userMind?.diagnostics || { scope: 'user' },
              projectMind?.diagnostics || { scope: 'project' }
            ]
          };
        }
      }
    } else {
      mind = await recallOnce(scope);
    }

    if (!mind) {
      logger.warn(`[CognitionManager] Recall returned null for role: ${roleId}, query: ${query}`);
      return null;
    }

    // 自动锚定当前认知状态（写入用户目录，避免project scope产生副作用）
    if (mind && mind.activatedCues && mind.activatedCues.size > 0) {
      await this.anchorToUser(roleId, query, mind);
    }

    return mind;
  }

  /**
   * Remember - 保存新的记忆到角色的认知系统
   * @param {string} roleId - 角色ID
   * @param {Array} engrams - 记忆数组
   */
  async remember(roleId, engrams) {
    logger.info(`[CognitionManager] Remember for role: ${roleId}, ${engrams.length} engrams`);
    
    // remember 保持个人记忆（user scope）
    const system = await this.getSystem(roleId, { scope: 'user' });
    const Engram = require('./Engram');
    
    for (const engramData of engrams) {
      try {
        // 创建Engram对象
        const engram = new Engram({
          content: engramData.content,
          schema: engramData.schema,
          strength: engramData.strength,
          type: engramData.type,  // 传递type字段
          timestamp: Date.now()  // 使用当前时间戳
        });
        
        if (!engram.isValid()) {
          logger.warn(`[CognitionManager] Invalid engram (schema too short):`, engramData);
          continue;
        }
        
        // CognitionSystem现在会自动处理Memory存储
        await system.remember(engram);
        
        logger.debug(`[CognitionManager] Processed engram:`, {
          preview: engram.getPreview(),
          strength: engram.strength
        });
        
      } catch (error) {
        logger.error(`[CognitionManager] Failed to process engram:`, error);
        // 重新抛出错误，让上层感知到失败
        throw error;
      }
    }
    
    // 保存更新后的认知数据
    await this.saveSystem(roleId, { scope: 'user' });
    
    logger.info(`[CognitionManager] Successfully saved ${engrams.length} engrams for role: ${roleId}`);
  }

  /**
   * 解析 schema 字符串为概念列表
   * @param {string} schema - 结构化的知识表示
   * @returns {Array<string>} 概念列表
   */
  parseSchema(schema) {
    if (!schema) return [];

    // 支持多种分隔符：优先使用 - 分隔符
    let concepts = [];

    if (schema.includes(' - ')) {
      // 用 - 分割（标准格式）
      concepts = schema.split(/\s*-\s*/).filter(c => c.trim());
    } else if (schema.includes('\n')) {
      // 兼容旧格式：用换行符分割
      const lines = schema.split('\n').filter(line => line.trim());
      for (const line of lines) {
        // 移除缩进和特殊符号，提取概念
        const concept = line.trim().replace(/^[-*>#\s]+/, '').trim();
        if (concept) {
          concepts.push(concept);
        }
      }
    } else {
      // 如果没有分隔符，尝试用空格分割
      concepts = schema.split(/\s+/).filter(c => c.trim());
    }

    return concepts;
  }

  /**
   * 清理角色的认知数据
   * @param {string} roleId - 角色ID
   */
  async clearRole(roleId) {
    logger.warn(`[CognitionManager] Clearing cognition data for role: ${roleId}`);
    
    // 从内存中移除
    this.systems.delete(roleId);
    
    // 删除文件
    try {
      const networkFilePath = this.getNetworkFilePath(roleId);
      await fs.unlink(networkFilePath);
      logger.info(`[CognitionManager] Deleted network file for role: ${roleId}`);
    } catch (error) {
      if (error.code !== 'ENOENT') {
        logger.error(`[CognitionManager] Failed to delete network file for role ${roleId}:`, error);
      }
    }
  }

  /**
   * 获取所有已存储的角色列表
   */
  async listRoles() {
    try {
      await fs.mkdir(this.basePath, { recursive: true });
      const entries = await fs.readdir(this.basePath, { withFileTypes: true });
      
      const roles = [];
      for (const entry of entries) {
        if (entry.isDirectory()) {
          // 检查是否有 network.json 文件
          const networkFilePath = this.getNetworkFilePath(entry.name);
          try {
            await fs.access(networkFilePath);
            roles.push(entry.name);
          } catch {
            // 没有 network.json 文件，跳过
          }
        }
      }
      
      return roles;
    } catch (error) {
      logger.error('[CognitionManager] Failed to list roles:', error);
      return [];
    }
  }
}

module.exports = CognitionManager;