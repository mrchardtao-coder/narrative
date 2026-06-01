/* ========================================
   本地存储管理 — 缓存版（单例对象）
   多模型提供者 + 角色独立模型 + 主题
   ======================================== */

const Store = (() => {
  let _cache = null;      // { worlds: [...], currentId: '...' }
  let _apiCache = null;   // { providers, directorModel, narratorModel, visionModel, npcModels, theme }

  /* ---- 缓存加载 ---- */
  function _load() {
    if (_cache) return;
    try {
      let raw = localStorage.getItem('narrative_worlds');
      if (!raw) {
        raw = localStorage.getItem('narrative_worlds_bak');
        if (raw) localStorage.setItem('narrative_worlds', raw);
      }
      _cache = {
        worlds: raw ? JSON.parse(raw) : [],
        currentId: localStorage.getItem('narrative_current_id') || null,
      };
    } catch (e) {
      _cache = { worlds: [], currentId: null };
    }
  }

  function _save() {
    if (!_cache) return;
    try {
      const data = JSON.stringify(_cache.worlds);
      localStorage.setItem('narrative_worlds', data);
      localStorage.setItem('narrative_worlds_bak', data);
      if (_cache.currentId) localStorage.setItem('narrative_current_id', _cache.currentId);
      else localStorage.removeItem('narrative_current_id');
    } catch (e) {
      _cache = null;
    }
  }

  function _loadApi() {
    if (_apiCache) return;
    try {
      const raw = localStorage.getItem('narrative_api_settings');
      if (raw) {
        _apiCache = JSON.parse(raw);
      }
    } catch (e) {}
    if (!_apiCache) _apiCache = {};
    // 迁移旧格式: deepseekKey → providers[0]
    if (!_apiCache.providers || _apiCache.providers.length === 0) {
      const oldDsKey = localStorage.getItem('narrative_ds_key');
      const oldMimoKey = localStorage.getItem('narrative_mimo_key');
      const oldMimoEp = localStorage.getItem('narrative_mimo_endpoint');
      const oldDsModel = localStorage.getItem('narrative_ds_model') || 'deepseek-v4-pro';
      const oldNarModel = localStorage.getItem('narrative_narrator_model') || 'deepseek-v4-flash';
      _apiCache.providers = [];
      if (oldDsKey) {
        const id = 'ds_' + Date.now().toString(36);
        _apiCache.providers.push({
          id, name: 'DeepSeek', endpoint: 'https://api.deepseek.com/chat/completions',
          apiKey: oldDsKey, models: [oldDsModel, oldNarModel], authType: 'bearer',
        });
        _apiCache.directorModel = { providerId: id, model: 'deepseek-v4-flash' };
        _apiCache.narratorModel = { providerId: id, model: 'deepseek-v4-flash' };
      }
      if (oldMimoKey) {
        const id = 'mimo_' + Date.now().toString(36);
        _apiCache.providers.push({
          id, name: 'MIMO', endpoint: oldMimoEp || 'https://api.xiaomimimo.com/v1/chat/completions',
          apiKey: oldMimoKey, models: ['mimo-v2.5-pro', 'mimo-v2.5-flash'], authType: 'api-key',
        });
        _apiCache.visionModel = { providerId: id, model: 'mimo-v2.5-pro' };
      }
      if (!_apiCache.directorModel && _apiCache.providers.length > 0) {
        const p = _apiCache.providers[0];
        _apiCache.directorModel = { providerId: p.id, model: p.models[0] || 'deepseek-v4-flash' };
        _apiCache.narratorModel = { providerId: p.id, model: p.models[0] || 'deepseek-v4-flash' };
      }
      if (!_apiCache.visionModel && _apiCache.providers.length > 0) {
        const p = _apiCache.providers[0];
        _apiCache.visionModel = { providerId: p.id, model: p.models[0] || 'mimo-v2.5-pro' };
      }
      _apiCache.npcModels = _apiCache.npcModels || {};
      _apiCache.theme = _apiCache.theme || 'dark';
      _saveApi();
      // 清理旧键
      ['narrative_ds_key','narrative_ds_model','narrative_mimo_key','narrative_mimo_endpoint','narrative_narrator_model'].forEach(k => localStorage.removeItem(k));
    }
    // 确保必要字段
    _apiCache.npcModels = _apiCache.npcModels || {};
    _apiCache.theme = _apiCache.theme || 'dark';
  }

  function _saveApi() {
    if (!_apiCache) return;
    localStorage.setItem('narrative_api_settings', JSON.stringify(_apiCache));
  }

  /* ---- 世界存取 ---- */
  function _currentIdx() {
    _load();
    if (!_cache.currentId) return -1;
    return _cache.worlds.findIndex(w => w.id === _cache.currentId);
  }

  return {
    /* ---- 多模型提供者 ---- */
    getProviders() { _loadApi(); return _apiCache.providers || []; },
    addProvider(name, endpoint, apiKey, authType) {
      _loadApi();
      const p = { id: Date.now().toString(36), name, endpoint, apiKey, models: [], authType: authType || 'bearer' };
      _apiCache.providers.push(p);
      _saveApi();
      return p;
    },
    updateProvider(id, updates) {
      _loadApi();
      const idx = _apiCache.providers.findIndex(p => p.id === id);
      if (idx === -1) return;
      Object.assign(_apiCache.providers[idx], updates);
      _saveApi();
    },
    removeProvider(id) {
      _loadApi();
      _apiCache.providers = _apiCache.providers.filter(p => p.id !== id);
      _saveApi();
    },
    getProvider(id) {
      _loadApi();
      return _apiCache.providers.find(p => p.id === id) || null;
    },

    /* ---- 模型分配 ---- */
    getModelAssignment(role) {
      _loadApi();
      return _apiCache[role] || null;
    },
    setModelAssignment(role, providerId, model) {
      _loadApi();
      _apiCache[role] = { providerId, model };
      _saveApi();
    },
    getNpcModel(npcId) {
      _loadApi();
      return _apiCache.npcModels[npcId] || null;
    },
    setNpcModel(npcId, providerId, model) {
      _loadApi();
      _apiCache.npcModels[npcId] = { providerId, model };
      _saveApi();
    },
    removeNpcModel(npcId) {
      _loadApi();
      delete _apiCache.npcModels[npcId];
      _saveApi();
    },

    /* ---- 解析模型调用参数 ---- */
    resolveCallParams(assignment, fallbackProviderId) {
      _loadApi();
      if (!assignment || !assignment.providerId) {
        assignment = _apiCache.directorModel;
      }
      if (!assignment) return null;
      const p = _apiCache.providers.find(x => x.id === assignment.providerId);
      if (!p) return null;
      return { provider: p, model: assignment.model, authType: p.authType, apiKey: p.apiKey, endpoint: p.endpoint };
    },

    /* ---- 主题 ---- */
    getTheme() { _loadApi(); return _apiCache.theme || 'dark'; },
    setTheme(t) { _loadApi(); _apiCache.theme = t; _saveApi(); },

    /* ---- 兼容旧 getApiKeys ---- */
    getApiKeys() {
      _loadApi();
      const result = {};
      for (const p of (_apiCache.providers || [])) {
        result[p.name.toLowerCase() + 'Key'] = p.apiKey;
        result[p.name.toLowerCase() + 'Endpoint'] = p.endpoint;
      }
      const d = _apiCache.directorModel;
      const n = _apiCache.narratorModel;
      const v = _apiCache.visionModel;
      if (d) result.deepseekModel = d.model;
      if (n) result.narratorModel = n.model;
      return result;
    },

    /* ---- 工具 ---- */
    forceSave() { _save(); },

    /* ---- 世界 CRUD ---- */
    getWorlds() { _load(); return _cache.worlds; },
    getCurrentWorldId() { _load(); return _cache.currentId; },
    setCurrentWorldId(id) { _load(); _cache.currentId = id; _save(); },
    getCurrentWorld() {
      const idx = _currentIdx();
      return idx >= 0 ? _cache.worlds[idx] : null;
    },

    createWorld(name, worldSetting, characterSetting, attention) {
      _load();
      const world = {
        id: Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
        name: name || '新世界', worldSetting: worldSetting || '',
        characterSetting: characterSetting || '', attention: attention || 5,
        prologue: '', protagonistName: '', protagonistAvatar: '',
        narratorEnabled: true, characters: [], history: [],
      };
      _cache.worlds.push(world);
      _cache.currentId = world.id;
      _save();
      return world;
    },

    updateCurrentWorld(updates) {
      const w = this.getCurrentWorld();
      if (!w) return;
      Object.assign(w, updates);
      _save();
    },

    deleteWorld(id) {
      _load();
      _cache.worlds = _cache.worlds.filter(w => w.id !== id);
      if (_cache.currentId === id) {
        _cache.currentId = _cache.worlds.length > 0 ? _cache.worlds[0].id : null;
      }
      _save();
    },

    /* ---- 角色卡 ---- */
    getCharacters() { const w = this.getCurrentWorld(); return w ? w.characters : []; },
    addCharacter(name, role, personality, relation, avatar, memory, npcModelId) {
      const w = this.getCurrentWorld();
      if (!w) return null;
      const c = {
        id: Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
        name, role, personality, relation: relation || '',
        avatar: avatar || '', memory: memory || '',
        npcModelId: npcModelId || '',
      };
      w.characters.push(c);
      _save();
      return c;
    },
    updateCharacter(id, name, role, personality, relation, memory, avatar, npcModelId) {
      const w = this.getCurrentWorld();
      if (!w) return;
      const idx = w.characters.findIndex(c => c.id === id);
      if (idx === -1) return;
      w.characters[idx] = {
        ...w.characters[idx],
        name, role, personality, relation: relation || '',
        memory: memory !== undefined ? memory : w.characters[idx].memory,
        avatar: avatar !== undefined ? avatar : w.characters[idx].avatar,
        npcModelId: npcModelId !== undefined ? npcModelId : w.characters[idx].npcModelId,
      };
      _save();
    },
    deleteCharacter(id) {
      const w = this.getCurrentWorld();
      if (!w) return;
      w.characters = w.characters.filter(c => c.id !== id);
      _save();
    },
    findCharacterById(id) { return this.getCharacters().find(c => c.id === id) || null; },

    /* ---- 历史 ---- */
    getHistory() { const w = this.getCurrentWorld(); return w ? w.history : []; },
    appendHistory(entry) {
      const w = this.getCurrentWorld();
      if (!w) return;
      w.history.push(entry);
      if (w.history.length > 300) w.history.splice(0, w.history.length - 300);
      _save();
    },
    clearHistory() { const w = this.getCurrentWorld(); if (!w) return; w.history = []; _save(); },
    truncateHistory(keepCount) {
      const w = this.getCurrentWorld();
      if (!w) return;
      w.history = w.history.slice(0, keepCount);
      _save();
    },

    /* ---- 迁移 ---- */
    migrateIfNeeded() {
      _load();
      if (_cache.worlds.length > 0) return;
      const oldWorld = localStorage.getItem('narrative_world');
      const oldHist = localStorage.getItem('narrative_history');
      if (oldWorld || oldHist) {
        try {
          const world = {
            id: 'migrated_' + Date.now().toString(36), name: '我的世界',
            worldSetting: oldWorld || '',
            characterSetting: localStorage.getItem('narrative_character') || '',
            attention: parseInt(localStorage.getItem('narrative_attention')) || 5,
            prologue: '', protagonistName: '', protagonistAvatar: '',
            characters: (() => {
              try { const c = JSON.parse(localStorage.getItem('narrative_characters')); return Array.isArray(c) ? c.map(x => ({...x, memory: x.memory||'', avatar: x.avatar||''})) : []; } catch(e) { return []; }
            })(),
            history: (() => {
              try { const h = JSON.parse(oldHist); return Array.isArray(h) ? h : []; } catch(e) { return []; }
            })(),
          };
          _cache.worlds = [world];
          _cache.currentId = world.id;
          _save();
          ['narrative_world','narrative_character','narrative_npc','narrative_attention','narrative_characters','narrative_history','narrative_summary'].forEach(k => localStorage.removeItem(k));
        } catch(e) {}
      }
    },
  };
})();
