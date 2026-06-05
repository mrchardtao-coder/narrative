/* ========================================
   引擎 — 导演(flash) → 群演(pro) → 记忆
   ======================================== */
const Engine = {
  isProcessing: false,
  _lastFailedInput: null,

  ensureWorld() {
    let ws = Store.getWorlds();
    if (ws.length === 0) {
      const d = DEFAULT_WORLD;
      Store.createWorld(d.name, d.worldSetting, d.characterSetting, CONFIG.DEFAULT_ATTENTION);
      Store.updateCurrentWorld({ protagonistName: d.protagonistName, prologue: d.prologue, protagonistAvatar: d.protagonistAvatar || '' });
      for (const c of d.characters) Store.addCharacter(c.name, c.role, c.personality, c.relation, '');
      return;
    }
    const w = Store.getCurrentWorld();
    if (w && !w.worldSetting && !w.characters.length && !w.history.length && (!w.protagonistName || w.name === '我的世界') && typeof DEFAULT_WORLD !== 'undefined') {
      const d = DEFAULT_WORLD;
      Store.updateCurrentWorld({ name: d.name, worldSetting: d.worldSetting, characterSetting: d.characterSetting, protagonistName: d.protagonistName, prologue: d.prologue, protagonistAvatar: d.protagonistAvatar || '' });
      for (const c of d.characters) Store.addCharacter(c.name, c.role, c.personality, c.relation, '');
      UI.loadWorldState();
    }
    if (!Store.getCurrentWorldId() && ws.length > 0) Store.setCurrentWorldId(ws[0].id);
  },

  /* ——— 设置 ——— */
  openSettings() { UI.showSettings(); },
  closeSettings() {
    const w = Store.getCurrentWorld();
    if (w) Store.updateCurrentWorld({
      name: UI.els.worldName.value.trim(), worldSetting: UI.els.worldSetting.value.trim(),
      characterSetting: UI.els.characterSetting.value.trim(), prologue: UI.els.prologueSetting.value.trim(),
      attention: parseInt(UI.els.attentionSlider.value), protagonistName: UI.els.protagonistName.value.trim(),
      protagonistAvatar: UI.protagonistDataUrl,
    });
    UI.hideSettings();
  },

  saveAndStart() {
    const name = UI.els.worldName.value.trim(), ws = UI.els.worldSetting.value.trim();
    if (!name) { alert('填世界名称'); return; }
    if (!ws) { alert('填世界观'); return; }
    const w = Store.getCurrentWorld();
    if (w) Store.updateCurrentWorld({ name, worldSetting: ws, characterSetting: UI.els.characterSetting.value.trim(), prologue: UI.els.prologueSetting.value.trim(), attention: parseInt(UI.els.attentionSlider.value), protagonistName: UI.els.protagonistName.value.trim(), protagonistAvatar: UI.protagonistDataUrl });
    else Store.createWorld(name, ws, UI.els.characterSetting.value.trim(), parseInt(UI.els.attentionSlider.value));
    UI.hideSettings(); UI.loadWorldState();
    if (Store.getProviders().length === 0) { alert('请进入 API 设置配置模型'); UI.openApiPanel(); }
    else if (Store.getHistory().length === 0) this.startStory();
  },

  resetStory() {
    if (!confirm('确定重置？世界设定和角色卡保留。')) return;
    Store.clearHistory();
    for (const c of Store.getCharacters()) Store.updateCharacter(c.id, c.name, c.role, c.personality, c.relation, '', c.avatar);
    UI.els.storyContent.innerHTML = ''; UI.showWelcome(); UI.hideSettings();
  },

  /* ——— 开篇 ——— */
  async startStory() {
    this.isProcessing = true; UI.els.btnSend.disabled = true;
    const cfg = Store.resolveCallParams(Store.getModelAssignment('directorModel'));
    const w = Store.getCurrentWorld();
    if (!cfg || !w) { this.isProcessing = false; UI.els.btnSend.disabled = false; return; }

    try {
      const prologue = w.prologue || '';
      if (prologue) { Store.appendHistory({ role: 'user', content: '【前情提要】\n' + prologue }); UI.systemNote('📜 前情提要'); }
      else { Store.appendHistory({ role: 'user', content: '（故事开始）' }); UI.systemNote('✦ 故事开始 ✦'); }

      const script = await API.director(cfg, w.worldSetting, w.characters || [], '(故事开始)', [], w.attention);
      if (script.scene) Store.appendHistory({ role: 'assistant', content: script.scene, source: 'narrator' });
      UI.renderNewEntries(Store.getHistory(), 0);
    } catch (e) { UI.systemNote('启动失败：' + e.message); }
    finally { this.isProcessing = false; UI.els.btnSend.disabled = false; UI.scroll(); }
  },

  /* ——— 消息发送 ——— */
  async send() {
    if (this.isProcessing) return;
    const userText = UI.els.userInput.value.trim();
    if (!userText && !UI.selectedImage) return;

    const dirCfg = Store.resolveCallParams(Store.getModelAssignment('directorModel'));
    if (!dirCfg) { alert('请配置导演模型'); UI.openApiPanel(); return; }

    this.isProcessing = true; UI.els.btnSend.disabled = true; UI.hideWelcome();

    const userContent = UI.selectedImage ? (userText ? '[图片] ' + userText : '[图片]') : userText;
    UI._bubble('protagonist', userContent);
    UI.els.userInput.value = ''; UI.els.userInput.style.height = 'auto'; UI.clearImage();
    Store.appendHistory({ role: 'user', content: userContent });

    UI.showLoading('世界正在演化');
    const start = Store.getHistory().length - 1;

    try {
      const w = Store.getCurrentWorld();
      const hist = Store.getHistory();
      const chars = Store.getCharacters();

      // 1. 导演
      let script;
      try { script = await API.director(dirCfg, w.worldSetting, chars, userText, hist, w.attention); }
      catch (e) {
        console.warn('导演失败:', e.message);
        script = chars.length > 0 ? { scene: '', acts: [{ npc: chars[0].name, direction: '主角：' + userText }] } : { scene: '（世界沉默了一瞬）', acts: [] };
      }

      if (!script.scene && (!script.acts || script.acts.length === 0)) script.scene = '（世界沉默了一瞬）';

      // 2. 场景
      if (script.scene) Store.appendHistory({ role: 'assistant', content: script.scene, source: 'narrator' });

      // 3. 群演
      if (script.acts && script.acts.length > 0) {
        const npcCfg = Store.resolveCallParams(Store.getNpcModel(chars[0]?.id)) || dirCfg;
        const results = await API.groupNpc(npcCfg, script.acts, chars, script.scene, userText, w.attention);
        for (const r of results) {
          if (r && r.content) Store.appendHistory({ role: 'assistant', content: r.content, source: r.id, sourceName: r.name });
        }
      }

      UI.removeLoading();
      UI.renderNewEntries(Store.getHistory(), start + 1);

      if (chars.length > 0) this._extractMem(dirCfg, chars, script.scene, userContent);
    } catch (e) {
      UI.removeLoading();
      this._lastFailedInput = userText;
      UI.systemNote('出错：' + e.message + '（回前台自动重试）');
      console.error(e);
    } finally {
      this.isProcessing = false; UI.els.btnSend.disabled = false;
      UI.els.userInput.focus(); UI.scroll();
    }
  },

  /* ——— 编辑 / 分支 ——— */
  editMessage(idx) {
    const hist = Store.getHistory();
    if (idx < 0 || idx >= hist.length || hist[idx].role !== 'user') return;
    Store.forkAt(idx);
    UI.els.userInput.value = hist[idx].content;
    UI.els.userInput.style.height = 'auto';
    UI.els.userInput.style.height = Math.min(UI.els.userInput.scrollHeight, 100) + 'px';
    UI.els.userInput.focus();
    UI.renderHistory(Store.getHistory());
  },

  cycleBranch(idx, dir) {
    if (Store.cycleBranch(idx, dir)) UI.renderHistory(Store.getHistory());
  },

  /* ——— 记忆 ——— */
  async _extractMem(cfg, chars, narrative, userAction) {
    try {
      const { memoryUpdates = [], newCharacters = [] } = await API.extractMemory(cfg, chars, narrative, userAction);
      for (const u of memoryUpdates) {
        const c = chars.find(x => x.name === u.name);
        if (!c || !u.newInfo) continue;
        const nm = (c.memory ? c.memory + '\n' + u.newInfo : u.newInfo);
        Store.updateCharacter(c.id, c.name, c.role, c.personality, c.relation, nm, c.avatar);
        if ((nm || '').length * CONFIG.MEMORY_CHAR_TO_TOKEN >= CONFIG.MEMORY_COMPRESS_THRESHOLD) this._compressMem(cfg, { ...c, memory: nm });
      }
      for (const nc of newCharacters) {
        if (!nc.name || Store.getCharacters().find(c => c.name === nc.name)) continue;
        Store.addCharacter(nc.name, nc.role || '未知', nc.personality || '', nc.relation || '', '');
      }
    } catch (e) {}
  },

  async _compressMem(cfg, npc) {
    try {
      const c = await API.compressMemory(cfg, npc);
      Store.updateCharacter(npc.id, npc.name, npc.role, npc.personality, npc.relation, c, npc.avatar);
    } catch (e) {}
  },

  regSW() {
    if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden && this._lastFailedInput) {
        const t = this._lastFailedInput; this._lastFailedInput = null;
        UI.els.userInput.value = t; this.send();
      }
    });
  },
};
