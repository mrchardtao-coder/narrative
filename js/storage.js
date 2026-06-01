/* ========================================
   存储层 — 缓存模式
   两个 localStorage 键：
   - narrative_data: 世界列表 + 当前世界ID
   - narrative_config: API设置 + 主题
   ======================================== */
const Store = (() => {
  let _data = null;    // { worlds, currentId }
  let _conf = null;    // { providers, directorModel, narratorModel, visionModel, npcModels, theme }

  function ld() {
    if (_data) return;
    try {
      let raw = localStorage.getItem('narrative_data');
      if (!raw) raw = localStorage.getItem('narrative_data_bak');
      if (raw) {
        _data = JSON.parse(raw);
        if (!_data.currentId || !_data.worlds) throw new Error('bad format');
      }
    } catch (e) { /* fall through */ }
    if (!_data) _data = { worlds: [], currentId: null };
  }

  function sv() {
    if (!_data) return;
    try {
      const raw = JSON.stringify(_data);
      localStorage.setItem('narrative_data', raw);
      localStorage.setItem('narrative_data_bak', raw);
    } catch (e) { _data = null; }
  }

  function lc() {
    if (_conf) return;
    try {
      const raw = localStorage.getItem('narrative_config');
      if (raw) _conf = JSON.parse(raw);
    } catch (e) { /* fall through */ }
    if (!_conf) _conf = { providers: [], npcModels: {}, theme: 'dark' };
    // 迁移旧格式
    if (!_conf.providers || _conf.providers.length === 0) {
      const oldKey = localStorage.getItem('narrative_ds_key');
      if (oldKey) {
        const pid = 'ds_' + Date.now().toString(36);
        _conf.providers = [{
          id: pid, name: 'DeepSeek', endpoint: 'https://api.deepseek.com/v1/chat/completions',
          apiKey: oldKey, models: ['deepseek-v4-pro', 'deepseek-v4-flash'], authType: 'bearer',
        }];
        _conf.directorModel = { providerId: pid, model: 'deepseek-v4-flash' };
        _conf.narratorModel = { providerId: pid, model: 'deepseek-v4-flash' };
        _conf.visionModel = { providerId: pid, model: 'deepseek-v4-pro' };
        ['narrative_ds_key','narrative_ds_model','narrative_mimo_key','narrative_mimo_endpoint','narrative_narrator_model','narrative_api_settings'].forEach(k => localStorage.removeItem(k));
        sc();
      }
    }
  }

  function sc() {
    if (!_conf) return;
    localStorage.setItem('narrative_config', JSON.stringify(_conf));
  }

  function widx() {
    ld();
    if (!_data.currentId) return -1;
    return _data.worlds.findIndex(w => w.id === _data.currentId);
  }

  return {
    /* ——— 提供者 ——— */
    getProviders() { lc(); return _conf.providers; },
    addProvider(name, endpoint, apiKey, authType) {
      lc();
      const p = { id: Date.now().toString(36) + Math.random().toString(36).slice(2,6), name, endpoint, apiKey, models: [], authType: authType || 'bearer' };
      _conf.providers.push(p);
      sc(); return p;
    },
    updateProvider(id, updates) {
      lc();
      const idx = _conf.providers.findIndex(p => p.id === id);
      if (idx === -1) return;
      Object.assign(_conf.providers[idx], updates);
      sc();
    },
    removeProvider(id) {
      lc();
      _conf.providers = _conf.providers.filter(p => p.id !== id);
      sc();
    },
    getProvider(id) { lc(); return _conf.providers.find(p => p.id === id) || null; },

    /* ——— 模型分配 ——— */
    getModelAssignment(role) { lc(); return _conf[role] || null; },
    setModelAssignment(role, providerId, model) { lc(); _conf[role] = { providerId, model }; sc(); },
    getNpcModel(npcId) { lc(); return (_conf.npcModels || {})[npcId] || null; },
    setNpcModel(npcId, providerId, model) { lc(); _conf.npcModels[npcId] = { providerId, model }; sc(); },

    resolveCallParams(assignment) {
      lc();
      if (!assignment || !assignment.providerId) assignment = _conf.directorModel;
      if (!assignment) return null;
      const p = _conf.providers.find(x => x.id === assignment.providerId);
      if (!p) return null;
      return { provider: p, model: assignment.model, authType: p.authType, apiKey: p.apiKey, endpoint: p.endpoint };
    },

    /* ——— 主题 ——— */
    getTheme() { lc(); return _conf.theme || 'dark'; },
    setTheme(t) { lc(); _conf.theme = t; sc(); },

    /* ——— 世界 CRUD ——— */
    getWorlds() { ld(); return _data.worlds; },
    getCurrentWorldId() { ld(); return _data.currentId; },
    setCurrentWorldId(id) { ld(); _data.currentId = id; sv(); },
    getCurrentWorld() { const i = widx(); return i >= 0 ? _data.worlds[i] : null; },

    createWorld(name, worldSetting, characterSetting, attention) {
      ld();
      const w = {
        id: Date.now().toString(36) + Math.random().toString(36).slice(2, 8),
        name: name || '新世界', worldSetting: worldSetting || '', characterSetting: characterSetting || '',
        attention: attention || 5, prologue: '', protagonistName: '', protagonistAvatar: '',
        narratorEnabled: true, characters: [], history: [],
      };
      _data.worlds.push(w);
      _data.currentId = w.id;
      sv(); return w;
    },

    updateCurrentWorld(updates) { const w = this.getCurrentWorld(); if (!w) return; Object.assign(w, updates); sv(); },

    deleteWorld(id) {
      ld();
      _data.worlds = _data.worlds.filter(w => w.id !== id);
      if (_data.currentId === id) _data.currentId = _data.worlds.length > 0 ? _data.worlds[0].id : null;
      sv();
    },

    /* ——— 角色卡 ——— */
    getCharacters() { const w = this.getCurrentWorld(); return w ? w.characters : []; },
    addCharacter(name, role, personality, relation, avatar, memory, npcModelId) {
      const w = this.getCurrentWorld(); if (!w) return null;
      const c = { id: Date.now().toString(36) + Math.random().toString(36).slice(2,8), name, role, personality, relation: relation || '', avatar: avatar || '', memory: memory || '', npcModelId: npcModelId || '' };
      w.characters.push(c); sv(); return c;
    },
    updateCharacter(id, name, role, personality, relation, memory, avatar, npcModelId) {
      const w = this.getCurrentWorld(); if (!w) return;
      const idx = w.characters.findIndex(c => c.id === id); if (idx === -1) return;
      const old = w.characters[idx];
      w.characters[idx] = { ...old, name, role, personality, relation: relation || '', memory: memory !== undefined ? memory : old.memory, avatar: avatar !== undefined ? avatar : old.avatar, npcModelId: npcModelId !== undefined ? npcModelId : old.npcModelId };
      sv();
    },
    deleteCharacter(id) { const w = this.getCurrentWorld(); if (!w) return; w.characters = w.characters.filter(c => c.id !== id); sv(); },
    findCharacterById(id) { return this.getCharacters().find(c => c.id === id) || null; },

    /* ——— 历史 ——— */
    getHistory() { const w = this.getCurrentWorld(); return w ? w.history : []; },
    appendHistory(entry) { const w = this.getCurrentWorld(); if (!w) return; w.history.push(entry); if (w.history.length > CONFIG.MAX_HISTORY) w.history.splice(0, w.history.length - CONFIG.MAX_HISTORY); sv(); },
    clearHistory() { const w = this.getCurrentWorld(); if (!w) return; w.history = []; sv(); },
    truncateHistory(k) { const w = this.getCurrentWorld(); if (!w) return; w.history = w.history.slice(0, k); sv(); },
    forceSave() { sv(); },
  };
})();
