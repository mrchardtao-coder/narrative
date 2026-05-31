/* ========================================
   本地存储管理 — 缓存版（单例对象）
   所有世界操作通过 _cache 中唯一对象，避免多解析引用不一致
   ======================================== */

const Store = (() => {
  let _cache = null;      // { worlds: [...], currentId: '...' }
  let _apiCache = null;   // { deepseekKey, mimoKey, mimoEndpoint }

  const _defaultKeys = {
    deepseekKey: '',
    mimoKey: '',
  };

  /* ---- 缓存加载 ---- */
  function _load() {
    if (_cache) return;
    try {
      const raw = localStorage.getItem('narrative_worlds');
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
      localStorage.setItem('narrative_worlds', JSON.stringify(_cache.worlds));
      if (_cache.currentId) localStorage.setItem('narrative_current_id', _cache.currentId);
      else localStorage.removeItem('narrative_current_id');
    } catch (e) { console.warn('Store 写入失败', e); }
  }

  function _loadApi() {
    if (_apiCache) return;
    _apiCache = {
      deepseekKey: localStorage.getItem('narrative_ds_key') || _defaultKeys.deepseekKey,
      mimoKey: localStorage.getItem('narrative_mimo_key') || _defaultKeys.mimoKey,
      mimoEndpoint: localStorage.getItem('narrative_mimo_endpoint') || 'https://api.xiaomimimo.com/v1/chat/completions',
    };
  }

  function _saveApi() {
    if (!_apiCache) return;
    localStorage.setItem('narrative_ds_key', _apiCache.deepseekKey);
    localStorage.setItem('narrative_mimo_key', _apiCache.mimoKey);
    localStorage.setItem('narrative_mimo_endpoint', _apiCache.mimoEndpoint);
  }

  /* ---- 世界存取 ---- */
  function _world(idx) {
    _load();
    if (idx === undefined || idx < 0 || idx >= _cache.worlds.length) return null;
    return _cache.worlds[idx];
  }

  function _currentIdx() {
    _load();
    if (!_cache.currentId) return -1;
    return _cache.worlds.findIndex(w => w.id === _cache.currentId);
  }

  return {
    /* ---- API Keys ---- */
    getApiKeys() {
      _loadApi();
      return { ..._apiCache };
    },
    saveApiKeys(keys) {
      _loadApi();
      Object.assign(_apiCache, keys);
      _saveApi();
    },

    /* ---- 世界 CRUD ---- */
    getWorlds() {
      _load();
      return _cache.worlds;
    },
    getCurrentWorldId() {
      _load();
      return _cache.currentId;
    },
    setCurrentWorldId(id) {
      _load();
      _cache.currentId = id;
      _save();
    },
    getCurrentWorld() {
      const idx = _currentIdx();
      return idx >= 0 ? _cache.worlds[idx] : null;
    },

    createWorld(name, worldSetting, characterSetting, attention) {
      _load();
      const world = {
        id: Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
        name: name || '新世界',
        worldSetting: worldSetting || '',
        characterSetting: characterSetting || '',
        attention: attention || 5,
        prologue: '',
        protagonistName: '',
        protagonistAvatar: '',
        characters: [],
        history: [],
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
    getCharacters() {
      const w = this.getCurrentWorld();
      return w ? w.characters : [];
    },
    addCharacter(name, role, personality, relation, avatar) {
      const w = this.getCurrentWorld();
      if (!w) return null;
      const c = {
        id: Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
        name, role, personality, relation: relation || '',
        avatar: avatar || '', memory: '',
      };
      w.characters.push(c);
      _save();
      return c;
    },
    updateCharacter(id, name, role, personality, relation, memory, avatar) {
      const w = this.getCurrentWorld();
      if (!w) return;
      const idx = w.characters.findIndex(c => c.id === id);
      if (idx === -1) return;
      w.characters[idx] = {
        ...w.characters[idx],
        name, role, personality, relation: relation || '',
        memory: memory !== undefined ? memory : w.characters[idx].memory,
        avatar: avatar !== undefined ? avatar : w.characters[idx].avatar,
      };
      _save();
    },
    deleteCharacter(id) {
      const w = this.getCurrentWorld();
      if (!w) return;
      w.characters = w.characters.filter(c => c.id !== id);
      _save();
    },
    findCharacterById(id) {
      return this.getCharacters().find(c => c.id === id) || null;
    },

    /* ---- 历史 ---- */
    getHistory() {
      const w = this.getCurrentWorld();
      return w ? w.history : [];
    },
    appendHistory(entry) {
      const w = this.getCurrentWorld();
      if (!w) return;
      w.history.push(entry);
      if (w.history.length > 300) w.history.splice(0, w.history.length - 300);
      _save();
    },
    clearHistory() {
      const w = this.getCurrentWorld();
      if (!w) return;
      w.history = [];
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
            id: 'migrated_' + Date.now().toString(36),
            name: '我的世界',
            worldSetting: oldWorld || '',
            characterSetting: localStorage.getItem('narrative_character') || '',
            attention: parseInt(localStorage.getItem('narrative_attention')) || 5,
            prologue: '',
            protagonistName: '',
            protagonistAvatar: '',
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
