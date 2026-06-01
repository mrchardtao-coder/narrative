/* ========================================
   核心引擎 — 消息管线 + 世界管理 + 记忆
   ======================================== */
const Engine = {
  isProcessing: false,

  /* ——— 初始化 ——— */
  ensureWorld() {
    let ws = Store.getWorlds();
    if (ws.length === 0) {
      const d = DEFAULT_WORLD;
      Store.createWorld(d.name, d.worldSetting, d.characterSetting, CONFIG.DEFAULT_ATTENTION);
      Store.updateCurrentWorld({ protagonistName: d.protagonistName, prologue: d.prologue });
      for (const c of d.characters) Store.addCharacter(c.name, c.role, c.personality, c.relation, '');
      return;
    }
    // 升级空旧世界
    const w = Store.getCurrentWorld();
    if (w && !w.worldSetting && !w.characters.length && !w.history.length && (!w.protagonistName || w.name === '我的世界') && typeof DEFAULT_WORLD !== 'undefined') {
      const d = DEFAULT_WORLD;
      Store.updateCurrentWorld({ name: d.name, worldSetting: d.worldSetting, characterSetting: d.characterSetting, protagonistName: d.protagonistName, prologue: d.prologue });
      for (const c of d.characters) Store.addCharacter(c.name, c.role, c.personality, c.relation, '');
      UI.loadWorldState();
    }
    if (!Store.getCurrentWorldId() && ws.length > 0) Store.setCurrentWorldId(ws[0].id);
  },

  /* ——— 设置 ——— */
  openSettings() { UI.showSettings(); },
  closeSettings() {
    const w = Store.getCurrentWorld();
    if (w) {
      Store.updateCurrentWorld({
        name: UI.els.worldName.value.trim(),
        worldSetting: UI.els.worldSetting.value.trim(),
        characterSetting: UI.els.characterSetting.value.trim(),
        prologue: UI.els.prologueSetting.value.trim(),
        attention: parseInt(UI.els.attentionSlider.value),
        narratorEnabled: UI.els.narratorToggle.checked,
        protagonistName: UI.els.protagonistName.value.trim(),
        protagonistAvatar: UI.protagonistDataUrl,
      });
    }
    UI.hideSettings();
  },

  saveAndStart() {
    const name = UI.els.worldName.value.trim();
    const ws = UI.els.worldSetting.value.trim();
    if (!name) { alert('填世界名称'); return; }
    if (!ws) { alert('填世界观'); return; }
    const w = Store.getCurrentWorld();
    if (w) {
      Store.updateCurrentWorld({
        name, worldSetting: ws,
        characterSetting: UI.els.characterSetting.value.trim(),
        prologue: UI.els.prologueSetting.value.trim(),
        attention: parseInt(UI.els.attentionSlider.value),
        narratorEnabled: UI.els.narratorToggle.checked,
        protagonistName: UI.els.protagonistName.value.trim(),
        protagonistAvatar: UI.protagonistDataUrl,
      });
    } else {
      Store.createWorld(name, ws, UI.els.characterSetting.value.trim(), parseInt(UI.els.attentionSlider.value));
    }
    UI.hideSettings();
    UI.loadWorldState();
    if (Store.getProviders().length === 0) {
      alert('请进入 ⚡ API 设置 配置至少一个模型提供者');
      UI.openApiPanel();
    } else if (Store.getHistory().length === 0) {
      this.startStory();
    }
  },

  resetStory() {
    if (!confirm('确定重置？世界设定和角色卡保留。')) return;
    Store.clearHistory();
    // 清空 NPC 记忆
    for (const c of Store.getCharacters()) Store.updateCharacter(c.id, c.name, c.role, c.personality, c.relation, '', c.avatar);
    UI.els.storyContent.innerHTML = '';
    UI.showWelcome();
    UI.hideSettings();
  },

  /* ——— 故事启动 ——— */
  async startStory() {
    this.isProcessing = true; UI.els.btnSend.disabled = true;
    const cfg = Store.resolveCallParams(Store.getModelAssignment('narratorModel'));
    const w = Store.getCurrentWorld();
    if (!cfg || !w) { this.isProcessing = false; UI.els.btnSend.disabled = false; return; }

    try {
      const prologue = w.prologue || '';
      const prompt = prologue
        ? `【前情提要已展示】${prologue}
【任务】只描述主角当前所处的场景环境（光线、位置、氛围）。2-3句话。不要写主角的行为或想法。`
        : '【任务】只描述故事开场时主角所处的场景环境。2-3句话。不要写主角的行为或想法。';

      const apiHist = [];
      const txt = await API.narrator(cfg, w.worldSetting, w.characterSetting, w.attention, apiHist, prompt, null);
      if (txt) {
        Store.appendHistory({ role: 'user', content: prologue ? `【前情提要】\n${prologue}` : '（故事开始）' });
        Store.appendHistory({ role: 'assistant', content: txt, source: 'narrator' });
        if (prologue) UI.systemNote('📜 前情提要');
        else UI.systemNote('✦ 故事开始 ✦');
        if (w.narratorEnabled !== false) UI._bubble('narrator', txt);
      }
    } catch (e) {
      UI.systemNote(`启动失败：${e.message}`);
    } finally {
      this.isProcessing = false; UI.els.btnSend.disabled = false; UI.scroll();
    }
  },

  /* ——— 消息发送（导演管线） ——— */
  async send() {
    if (this.isProcessing) return;
    const userText = UI.els.userInput.value.trim();
    const imgFile = UI.selectedImage;
    if (!userText && !imgFile) return;

    const dirCfg = Store.resolveCallParams(Store.getModelAssignment('directorModel'));
    const narCfg = Store.resolveCallParams(Store.getModelAssignment('narratorModel'));
    if (!dirCfg || !narCfg) { alert('请先在 API 设置中配置模型'); UI.openApiPanel(); return; }

    this.isProcessing = true; UI.els.btnSend.disabled = true; UI.hideWelcome();

    // 展示主角消息
    const userContent = imgFile ? (userText ? `[图片] ${userText}` : '[图片]') : userText;
    UI._bubble('protagonist', userContent);
    UI.els.userInput.value = ''; UI.els.userInput.style.height = 'auto'; UI.clearImage();
    Store.appendHistory({ role: 'user', content: userContent });

    UI.showLoading('世界正在演化');
    const start = Store.getHistory().length - 1; // 用户消息索引

    try {
      const w = Store.getCurrentWorld();
      const hist = Store.getHistory();
      const chars = Store.getCharacters();

      // 1. 导演
      let script = { scene: '' };
      try {
        script = await API.director(dirCfg, w.worldSetting, chars, userText, hist, w.attention);
      } catch(e) {
        console.warn('导演失败，跳过NPC直接走旁白:', e.message);
        script = { scene: '', acts: [] };
      }

      // 2. NPC 并行
      if (script.acts && script.acts.length > 0) {
        const map = Object.fromEntries(chars.map(c => [c.name, c]));
        const results = await Promise.all(script.acts.map(async act => {
          const npc = map[act.npc];
          if (!npc) return null;
          const npcCfg = Store.resolveCallParams(Store.getNpcModel(npc.id)) || dirCfg;
          const ctx = `【场景】${script.scene||''}\n【演出指导】${act.direction}`;
          try { const r = await API.npc(npcCfg, npc, ctx, w.attention); return { name: act.npc, content: r, id: npc.id }; }
          catch(e) { return { name: act.npc, content: '', id: npc.id }; }
        }));

        for (const r of results) {
          if (r && r.content) Store.appendHistory({ role: 'assistant', content: r.content, source: r.id, sourceName: r.name });
        }
      }

      // 3. 旁白
      UI.removeLoading();
      const npcOut = script.acts
        ? script.acts.map(a => Store.getHistory().filter(h => h.sourceName === a.npc).pop()?.content || '').filter(Boolean)
        : [];
      const narInput = `【场景】${script.scene||''}\n【已知NPC已作出反应】${npcOut.join(' | ')}`;
      const apiHist = Store.getHistory().map(h => ({ role: h.role, content: h.content }));
      const env = await API.narrator(narCfg, w.worldSetting, w.characterSetting, w.attention, apiHist, narInput, null);

      if (env) {
        Store.appendHistory({ role: 'assistant', content: env, source: 'narrator' });
        if (w.narratorEnabled !== false) UI._bubble('narrator', env);
      }

      // 渲染 NPC（增量）
      UI.renderNewEntries(Store.getHistory(), start + 1);

      // 4. 记忆提取
      if (chars.length > 0) this._extractMem(dirCfg, chars, env || script.scene, userContent);

    } catch (e) {
      UI.removeLoading();
      UI.systemNote(`出错：${e.message}`);
      console.error(e);
    } finally {
      this.isProcessing = false; UI.els.btnSend.disabled = false;
      UI.els.userInput.focus(); UI.scroll();
    }
  },

  /* ——— 回退 ——— */
  rollback(idx) {
    if (!confirm('从此处重置后续对话？世界设定和角色卡保留，NPC记忆将回退。')) return;
    Store.truncateHistory(idx + 1);
    for (const c of Store.getCharacters()) Store.updateCharacter(c.id, c.name, c.role, c.personality, c.relation, '', c.avatar);
    UI.els.storyContent.innerHTML = '';
    UI.renderHistory(Store.getHistory());
    // 异步重建记忆
    const cfg = Store.resolveCallParams(Store.getModelAssignment('directorModel'));
    if (cfg) this._rebuildMem(cfg, Store.getCurrentWorld());
  },

  async _rebuildMem(cfg, world) {
    try {
      const txt = world.history.map(h => `[${h.role}] ${h.content}`).join('\n');
      const { memoryUpdates } = await API.extractMemory(cfg, world.characters, txt, '');
      for (const m of (memoryUpdates||[])) {
        const c = world.characters.find(x => x.name === m.name);
        if (c) Store.updateCharacter(c.id, c.name, c.role, c.personality, c.relation, m.newInfo||'', c.avatar);
      }
    } catch(e) { /* 静默 */ }
  },

  /* ——— 记忆 ——— */
  async _extractMem(cfg, chars, narrative, userAction) {
    try {
      const { memoryUpdates=[], newCharacters=[] } = await API.extractMemory(cfg, chars, narrative, userAction);
      for (const u of memoryUpdates) {
        const c = chars.find(x => x.name === u.name);
        if (!c || !u.newInfo) continue;
        const nm = (c.memory ? c.memory+'\n'+u.newInfo : u.newInfo);
        Store.updateCharacter(c.id, c.name, c.role, c.personality, c.relation, nm, c.avatar);
        if ((nm||'').length * CONFIG.MEMORY_CHAR_TO_TOKEN >= CONFIG.MEMORY_COMPRESS_THRESHOLD) this._compressMem(cfg, {...c, memory: nm});
      }
      for (const nc of newCharacters) {
        if (!nc.name || Store.getCharacters().find(c => c.name === nc.name)) continue;
        Store.addCharacter(nc.name, nc.role||'未知', nc.personality||'', nc.relation||'', '');
      }
    } catch(e) { /* 静默 */ }
  },

  async _compressMem(cfg, npc) {
    try {
      const c = await API.compressMemory(cfg, npc);
      Store.updateCharacter(npc.id, npc.name, npc.role, npc.personality, npc.relation, c, npc.avatar);
    } catch(e) { /* 静默 */ }
  },

  /* ——— Service Worker ——— */
  regSW() {
    if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(()=>{});
  },
};
