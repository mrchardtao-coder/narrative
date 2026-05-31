/* ========================================
   本地存储管理 — 多世界版
   ======================================== */

const Store = {
  _defaultKeys: {
    deepseekKey: '',
    mimoKey: '',
  },

  /* ---- 基础读写 ---- */
  _get(key, fallback = null) {
    try {
      const raw = localStorage.getItem(key);
      if (raw === null) return fallback;
      try { return JSON.parse(raw); } catch (_) { return raw; }
    } catch (e) { return fallback; }
  },
  _set(key, value) {
    try {
      localStorage.setItem(key, typeof value === 'string' ? value : JSON.stringify(value));
    } catch (e) { console.warn('Store 写入失败:', key, e); }
  },
  _remove(key) { try { localStorage.removeItem(key); } catch (e) {} },

  /* ============================================
     API Keys（全局，跨世界共享）
     ============================================ */
  getApiKeys() {
    return {
      deepseekKey: this._get(CONFIG.STORE_DEEPSEEK_KEY) || this._defaultKeys.deepseekKey,
      mimoKey: this._get(CONFIG.STORE_MIMO_KEY) || this._defaultKeys.mimoKey,
      mimoEndpoint: this._get(CONFIG.STORE_MIMO_ENDPOINT) || CONFIG.MIMO_DEFAULT_ENDPOINT,
    };
  },
  saveApiKeys(keys) {
    this._set(CONFIG.STORE_DEEPSEEK_KEY, keys.deepseekKey);
    this._set(CONFIG.STORE_MIMO_KEY, keys.mimoKey);
    this._set(CONFIG.STORE_MIMO_ENDPOINT, keys.mimoEndpoint);
  },

  /* ============================================
     世界管理
     ============================================ */
  getWorlds() {
    return this._get(CONFIG.STORE_WORLDS, []);
  },

  _saveWorlds(worlds) {
    this._set(CONFIG.STORE_WORLDS, worlds);
  },

  getCurrentWorldId() {
    return this._get(CONFIG.STORE_CURRENT_WORLD) || null;
  },

  setCurrentWorldId(id) {
    this._set(CONFIG.STORE_CURRENT_WORLD, id);
  },

  /** 获取当前世界对象 */
  getCurrentWorld() {
    const id = this.getCurrentWorldId();
    if (!id) return null;
    return this.getWorlds().find(w => w.id === id) || null;
  },

  /** 创建新世界，返回世界对象 */
  createWorld(name, worldSetting, characterSetting, attention) {
    const worlds = this.getWorlds();
    const world = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
      name: name || '新世界',
      worldSetting: worldSetting || '',
      characterSetting: characterSetting || '',
      attention: attention || CONFIG.DEFAULT_ATTENTION,
      protagonistName: '',
      protagonistAvatar: '',
      characters: [],
      history: [],
    };
    worlds.push(world);
    this._saveWorlds(worlds);
    this.setCurrentWorldId(world.id);
    return world;
  },

  /** 更新当前世界设定 */
  updateCurrentWorld(updates) {
    const worlds = this.getWorlds();
    const id = this.getCurrentWorldId();
    const idx = worlds.findIndex(w => w.id === id);
    if (idx === -1) return null;
    Object.assign(worlds[idx], updates);
    this._saveWorlds(worlds);
    return worlds[idx];
  },

  /** 删除世界 */
  deleteWorld(id) {
    let worlds = this.getWorlds().filter(w => w.id !== id);
    this._saveWorlds(worlds);
    if (this.getCurrentWorldId() === id) {
      this.setCurrentWorldId(worlds.length > 0 ? worlds[0].id : null);
    }
  },

  /* ============================================
     角色卡（属于当前世界）
     ============================================ */
  getCharacters() {
    const world = this.getCurrentWorld();
    return world ? world.characters : [];
  },

  /** 原子操作：读取当前世界、修改、保存，避免多对象引用不一致 */
  _withWorld(fn) {
    const worlds = this.getWorlds();
    const id = this.getCurrentWorldId();
    const idx = worlds.findIndex(w => w.id === id);
    if (idx === -1) return;
    fn(worlds[idx]);
    this._saveWorlds(worlds);
  },

  findCharacterById(id) {
    return this.getCharacters().find(c => c.id === id) || null;
  },

  addCharacter(name, role, personality, relation, avatar) {
    let result = null;
    this._withWorld(world => {
      const c = {
        id: Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
        name, role, personality, relation: relation || '',
        avatar: avatar || '', memory: '',
      };
      world.characters.push(c);
      result = c;
    });
    return result;
  },

  updateCharacter(id, name, role, personality, relation, memory, avatar) {
    this._withWorld(world => {
      const idx = world.characters.findIndex(c => c.id === id);
      if (idx === -1) return;
      world.characters[idx] = {
        ...world.characters[idx],
        name, role, personality, relation: relation || '',
        memory: memory !== undefined ? memory : world.characters[idx].memory,
        avatar: avatar !== undefined ? avatar : world.characters[idx].avatar,
      };
    });
  },

  deleteCharacter(id) {
    this._withWorld(world => {
      world.characters = world.characters.filter(c => c.id !== id);
    });
  },

  /* ============================================
     对话历史（属于当前世界）
     ============================================ */
  getHistory() {
    const world = this.getCurrentWorld();
    return world ? world.history : [];
  },

  appendHistory(entry) {
    const world = this.getCurrentWorld();
    if (!world) return;
    world.history.push(entry);
    if (world.history.length > CONFIG.MAX_HISTORY_ENTRIES) {
      world.history.splice(0, world.history.length - CONFIG.MAX_HISTORY_ENTRIES);
    }
    const worlds = this.getWorlds();
    const idx = worlds.findIndex(w => w.id === world.id);
    if (idx !== -1) { worlds[idx] = world; this._saveWorlds(worlds); }
  },

  clearHistory() {
    const world = this.getCurrentWorld();
    if (!world) return;
    world.history = [];
    const worlds = this.getWorlds();
    const idx = worlds.findIndex(w => w.id === world.id);
    if (idx !== -1) { worlds[idx] = world; this._saveWorlds(worlds); }
  },

  /* ============================================
     兼容旧数据迁移
     ============================================ */
  migrateIfNeeded() {
    // 如果已有旧版单世界数据且尚未迁移，自动创建第一个世界
    if (this.getWorlds().length > 0) return;
    const oldWorld = this._get('narrative_world');
    const oldChar = this._get('narrative_character');
    const oldNpc = this._get('narrative_npc');
    const oldAtt = this._get('narrative_attention', CONFIG.DEFAULT_ATTENTION);
    const oldHist = this._get('narrative_history', []);
    const oldChars = this._get('narrative_characters', []);

    if (oldWorld || oldChar || oldHist.length > 0) {
      // 迁移旧角色卡格式（无 memory 字段的补上）
      const migratedChars = oldChars.map(c => ({ ...c, memory: c.memory || '' }));
      const world = {
        id: 'migrated_' + Date.now().toString(36),
        name: '我的世界',
        worldSetting: oldWorld || '',
        characterSetting: oldChar || '',
        attention: oldAtt,
        characters: oldChars.length > 0 ? migratedChars : (
          oldNpc ? [{ id: 'legacy', name: '旧角色', role: '旧设定', personality: oldNpc, relation: '', memory: '' }] : []
        ),
        history: oldHist,
      };
      this._saveWorlds([world]);
      this.setCurrentWorldId(world.id);
      // 清理旧键
      ['narrative_world','narrative_character','narrative_npc','narrative_attention',
       'narrative_characters','narrative_history','narrative_summary'].forEach(k => this._remove(k));
    }
  },
};
