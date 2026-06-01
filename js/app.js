/* ========================================
   主应用逻辑 — 聊天气泡版
   ======================================== */

const App = {
  isProcessing: false,
  selectedImage: null,
  protagonistDataUrl: '',
  editDataUrl: '',
  els: {},

  init() {
    this.cacheElements();
    this.bindEvents();
    Store.migrateIfNeeded();
    this.ensureWorld();
    this.loadWorldState();
    this.registerServiceWorker();
  },

  cacheElements() {
    const q = s => document.querySelector(s);
    this.els = {
      worldsOverlay: q('#worlds-overlay'), worldsList: q('#worlds-list'), worldsClose: q('#worlds-close'),
      btnNewWorld: q('#btn-new-world'), btnSwitchWorld: q('#btn-switch-world'), currentWorldName: q('#current-world-name'),

      overlay: q('#settings-overlay'), worldName: q('#world-name'), worldSetting: q('#world-setting'),
      prologueSetting: q('#prologue-setting'),
      characterSetting: q('#character-setting'), protagonistName: q('#protagonist-name'),
      protagonistAvatarPreview: q('#protagonist-avatar-preview'), protagonistAvatarInput: q('#protagonist-avatar-input'),
      btnProtagonistAvatar: q('#btn-protagonist-avatar'),
      npcCount: q('#npc-count'), btnOpenCharacters: q('#btn-open-characters'),
      attentionSlider: q('#attention-slider'), attentionLabel: q('#attention-label'),
      narratorToggle: q('#narrator-toggle'),
      themeBtns: q('#settings-overlay').querySelectorAll('.theme-selector button'),
      btnOpenApi: q('#btn-open-api'),
      apiOverlay: q('#api-overlay'), apiClose: q('#api-close'), apiProvidersList: q('#api-providers-list'),
      btnAddProvider: q('#btn-add-provider'),
      assignDirector: q('#assign-director'), assignNarrator: q('#assign-narrator'), assignVision: q('#assign-vision'),
      editNpcModel: q('#edit-npc-model'),
      saveSettings: q('#settings-save'), resetStory: q('#settings-reset'),
      refreshPage: q('#settings-refresh'),
      closeSettings: q('#settings-close'), openSettings: q('#open-settings'),
      toggleDsKey: q('#toggle-deepseek-key'), toggleMimoKey: q('#toggle-mimo-key'),

      charactersOverlay: q('#characters-overlay'), charactersList: q('#characters-list'),
      charactersSearch: q('#characters-search-input'), charactersBack: q('#characters-back'),
      btnNewCharacter: q('#btn-new-character'),

      editOverlay: q('#character-edit-overlay'), editBack: q('#edit-back'), editTitle: q('#edit-title'),
      editId: q('#edit-id'), editName: q('#edit-name'), editRole: q('#edit-role'),
      editPersonality: q('#edit-personality'), editRelation: q('#edit-relation'),
      editMemory: q('#edit-memory'), memoryStats: q('#memory-stats'),
      editAvatarPreview: q('#edit-avatar-preview'), editAvatarInput: q('#edit-avatar-input'),
      btnEditAvatar: q('#btn-edit-avatar'), btnSaveCharacter: q('#btn-save-character'),
      btnDeleteCharacter: q('#btn-delete-character'),

      storyContent: q('#story-content'), storyArea: q('#story-area'), welcome: q('#welcome'),
      userInput: q('#user-input'), imageInput: q('#image-input'), btnSend: q('#btn-send'), btnImage: q('#btn-image'),
    };
  },

  bindEvents() {
    const e = this.els;
    e.btnSwitchWorld.addEventListener('click', () => this.openWorldsPanel());
    e.worldsClose.addEventListener('click', () => this.closeWorldsPanel());
    e.btnNewWorld.addEventListener('click', () => this.createNewWorld());
    e.worldsOverlay.addEventListener('click', ev => { if (ev.target === e.worldsOverlay) this.closeWorldsPanel(); });
    e.openSettings.addEventListener('click', () => this.showSettings());
    e.closeSettings.addEventListener('click', () => this.hideSettings());
    e.saveSettings.addEventListener('click', () => this.saveAndStart());
    e.resetStory.addEventListener('click', () => this.confirmReset());
    e.refreshPage.addEventListener('click', () => location.reload());
    e.overlay.addEventListener('click', ev => { if (ev.target === e.overlay) this.hideSettings(); });
    e.btnOpenCharacters.addEventListener('click', () => this.openCharactersPanel());
    e.charactersBack.addEventListener('click', () => this.closeCharactersPanel());
    e.btnNewCharacter.addEventListener('click', () => this.openCharacterEdit(null));
    e.charactersSearch.addEventListener('input', () => this.renderCharactersList());
    e.charactersOverlay.addEventListener('click', ev => { if (ev.target === e.charactersOverlay) this.closeCharactersPanel(); });
    e.editBack.addEventListener('click', () => this.closeCharacterEdit());
    e.btnSaveCharacter.addEventListener('click', () => this.saveCharacter());
    e.btnDeleteCharacter.addEventListener('click', () => this.deleteCharacter());
    e.editMemory.addEventListener('input', () => this.updateMemoryStats());
    e.editOverlay.addEventListener('click', ev => { if (ev.target === e.editOverlay) this.closeCharacterEdit(); });
    e.btnProtagonistAvatar.addEventListener('click', () => e.protagonistAvatarInput.click());
    e.protagonistAvatarInput.addEventListener('change', ev => this.handleAvatarSelect(ev, 'protagonist'));
    e.btnEditAvatar.addEventListener('click', () => e.editAvatarInput.click());
    e.editAvatarInput.addEventListener('change', ev => this.handleAvatarSelect(ev, 'edit'));
    e.attentionSlider.addEventListener('input', () => { e.attentionLabel.textContent = e.attentionSlider.value; });
    e.narratorToggle.addEventListener('change', () => this.toggleNarratorVisibility());
    e.themeBtns.forEach(b => b.addEventListener('click', () => this.setTheme(b.dataset.theme)));
    e.btnOpenApi.addEventListener('click', () => this.openApiPanel());
    e.apiClose.addEventListener('click', () => this.closeApiPanel());
    e.btnAddProvider.addEventListener('click', () => this.addProvider());
    e.assignDirector.addEventListener('change', () => this.saveModelAssignments());
    e.assignNarrator.addEventListener('change', () => this.saveModelAssignments());
    e.assignVision.addEventListener('change', () => this.saveModelAssignments());
    e.apiOverlay.addEventListener('click', ev => { if (ev.target === e.apiOverlay) this.closeApiPanel(); });
    e.btnSend.addEventListener('click', () => this.sendMessage());
    e.userInput.addEventListener('keydown', ev => this.handleInputKeydown(ev));
    e.userInput.addEventListener('input', () => this.autoResizeInput());
    e.btnImage.addEventListener('click', () => e.imageInput.click());
    e.imageInput.addEventListener('change', ev => this.handleImageSelect(ev));
  },

  /* ---- 头像 ---- */
  handleAvatarSelect(e, type) {
    const file = e.target.files[0];
    if (!file || !file.type.startsWith('image/')) return;
    if (file.size > 2 * 1024 * 1024) { alert('头像图片不能超过 2MB'); return; }
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result;
      if (type === 'protagonist') {
        this.protagonistDataUrl = dataUrl;
        this.renderAvatarPreview(this.els.protagonistAvatarPreview, dataUrl);
      } else {
        this.editDataUrl = dataUrl;
        this.renderAvatarPreview(this.els.editAvatarPreview, dataUrl);
      }
    };
    reader.readAsDataURL(file);
  },

  renderAvatarPreview(el, dataUrl) {
    el.innerHTML = `<img src="${dataUrl}" alt="">`;
    el.classList.add('has-image');
  },

  /* ---- 世界管理 ---- */
  ensureWorld() {
    let worlds = Store.getWorlds();
    if (worlds.length === 0) {
      const d = DEFAULT_WORLD;
      Store.createWorld(d.name, d.worldSetting, d.characterSetting, CONFIG.DEFAULT_ATTENTION);
      Store.updateCurrentWorld({ protagonistName: d.protagonistName, prologue: d.prologue });
      for (const c of d.characters) Store.addCharacter(c.name, c.role, c.personality, c.relation, '');
      return;
    }
    // 如果当前世界是空的旧默认世界，也升级为群像
    const w = Store.getCurrentWorld();
    if (w && !w.worldSetting && !w.characters.length && !w.history.length && (!w.protagonistName || w.name === '我的世界')) {
      const d = DEFAULT_WORLD;
      Store.updateCurrentWorld({ name: d.name, worldSetting: d.worldSetting, characterSetting: d.characterSetting, protagonistName: d.protagonistName, prologue: d.prologue });
      for (const c of d.characters) Store.addCharacter(c.name, c.role, c.personality, c.relation, '');
      this.updateWorldName();
    }
    if (!Store.getCurrentWorldId()) {
      worlds = Store.getWorlds();
      Store.setCurrentWorldId(worlds[0].id);
    }
  },

  loadWorldState() {
    this.updateWorldName();
    const world = Store.getCurrentWorld();
    if (!world) return;
    this.renderHistory(world.history);
    if (world.narratorEnabled === false) {
      document.querySelectorAll('.narrator-msg').forEach(el => el.style.display = 'none');
    }
    if (world.worldSetting) this.hideWelcome();
  },

  updateWorldName() {
    const world = Store.getCurrentWorld();
    this.els.currentWorldName.textContent = world ? world.name : '叙事';
  },

  openWorldsPanel() { this.renderWorldsList(); this.els.worldsOverlay.classList.remove('hidden'); },
  closeWorldsPanel() { this.els.worldsOverlay.classList.add('hidden'); },

  renderWorldsList() {
    const worlds = Store.getWorlds(); const currentId = Store.getCurrentWorldId();
    this.els.worldsList.innerHTML = worlds.map(w => `
      <div class="world-card ${w.id === currentId ? 'active' : ''}" data-id="${w.id}">
        <div class="world-card-info"><div class="world-card-name">${this.esc(w.name)}</div><div class="world-card-desc">${this.esc(w.worldSetting || '未设定')}</div></div>
        ${w.id === currentId ? '<span class="world-card-badge">当前</span>' : ''}
        ${worlds.length > 1 ? `<button class="world-card-delete" data-delete="${w.id}">🗑</button>` : ''}
      </div>`).join('');
    this.els.worldsList.querySelectorAll('.world-card').forEach(card => card.addEventListener('click', (ev) => {
      if (ev.target.closest('.world-card-delete')) return; this.switchToWorld(card.dataset.id);
    }));
    this.els.worldsList.querySelectorAll('.world-card-delete').forEach(btn => btn.addEventListener('click', (ev) => {
      ev.stopPropagation(); if (confirm('确定删除这个世界？')) { Store.deleteWorld(btn.dataset.delete); this.ensureWorld(); this.renderWorldsList(); this.loadWorldState(); }
    }));
  },

  switchToWorld(id) {
    Store.setCurrentWorldId(id); this.closeWorldsPanel(); this.updateWorldName();
    this.els.storyContent.innerHTML = '';
    const world = Store.getCurrentWorld();
    if (world) { this.renderHistory(world.history); if (world.worldSetting) this.hideWelcome(); else this.showWelcome(); }
    this.scrollToBottom();
  },

  createNewWorld() {
    const name = prompt('给新世界起个名字：', '新世界'); if (!name) return;
    Store.createWorld(name.trim(), '', '', CONFIG.DEFAULT_ATTENTION);
    this.closeWorldsPanel(); this.updateWorldName(); this.els.storyContent.innerHTML = ''; this.showWelcome();
  },

  /* ---- 设置 ---- */
  showSettings() {
    const world = Store.getCurrentWorld(); const keys = Store.getApiKeys();
    this.els.worldName.value = world ? world.name : '';
    this.els.worldSetting.value = world ? world.worldSetting : '';
    this.els.prologueSetting.value = world ? (world.prologue || '') : '';
    this.els.characterSetting.value = world ? world.characterSetting : '';
    this.els.protagonistName.value = world ? (world.protagonistName || '') : '';
    this.protagonistDataUrl = world ? (world.protagonistAvatar || '') : '';
    this.renderAvatarPreview(this.els.protagonistAvatarPreview, this.protagonistDataUrl);
    this.els.attentionSlider.value = world ? world.attention : CONFIG.DEFAULT_ATTENTION;
    this.els.attentionLabel.textContent = this.els.attentionSlider.value;
    this.els.narratorToggle.checked = world ? (world.narratorEnabled !== false) : true;
    this.updateThemeBtns();
    this.updateNpcCount(); this.els.overlay.classList.remove('hidden');
  },

  hideSettings() {
    // 自动保存当前表单内容到世界设定
    const world = Store.getCurrentWorld();
    if (world) {
      Store.updateCurrentWorld({
        name: this.els.worldName.value.trim(),
        worldSetting: this.els.worldSetting.value.trim(),
        characterSetting: this.els.characterSetting.value.trim(),
        prologue: this.els.prologueSetting.value.trim(),
        attention: parseInt(this.els.attentionSlider.value),
        narratorEnabled: this.els.narratorToggle.checked,
        protagonistName: this.els.protagonistName.value.trim(),
        protagonistAvatar: this.protagonistDataUrl,
      });
    }
    this.els.overlay.classList.add('hidden');
  },

  saveAndStart() {
    const name = this.els.worldName.value.trim();
    const ws = this.els.worldSetting.value.trim(); if (!ws) { alert('请填写世界观'); return; }
    if (!name) { alert('请填写世界名称'); return; }
    Store.saveApiKeys({ deepseekKey: this.els.deepseekKey.value.trim(), deepseekModel: this.els.deepseekModel.value.trim() || 'deepseek-v4-pro', mimoKey: this.els.mimoKey.value.trim(), mimoEndpoint: this.els.mimoEndpoint.value.trim() || CONFIG.MIMO_DEFAULT_ENDPOINT });
    Store.updateCurrentWorld({
      name, worldSetting: ws, characterSetting: this.els.characterSetting.value.trim(),
      prologue: this.els.prologueSetting.value.trim(),
      attention: parseInt(this.els.attentionSlider.value),
      narratorEnabled: this.els.narratorToggle.checked,
      protagonistName: this.els.protagonistName.value.trim(),
      protagonistAvatar: this.protagonistDataUrl,
    });
    this.updateWorldName(); this.els.overlay.classList.add('hidden'); this.hideWelcome();
    if (Store.getHistory().length === 0) this.sendInitialPrompt();
  },

  confirmReset() {
    if (confirm('确定重置当前世界的故事记录？')) { Store.clearHistory(); this.els.storyContent.innerHTML = ''; this.showWelcome(); this.hideSettings(); }
  },

  togglePassword(el, btn) { const pw = el.type === 'password'; el.type = pw ? 'text' : 'password'; btn.textContent = pw ? '🙈' : '👁'; },

  /* ---- 聊天气泡渲染 ---- */
  hideWelcome() { const w = this.els.welcome; if (w) w.style.display = 'none'; },
  showWelcome() { const w = this.els.welcome; if (w) w.style.display = ''; },

  renderHistory(history) {
    if (!history || history.length === 0) return;
    this.hideWelcome();
    const total = history.length;
    for (let i = 0; i < total; i++) this.renderChatEntry(history[i], i, total);
    this.scrollToBottom();
  },

  /** 根据 source 渲染不同的聊天气泡 */
  renderChatEntry(entry, index, total) {
    const showBtn = true;
    if (entry.role === 'user') {
      this.renderChatBubble('protagonist', entry.content, null, index, showBtn);
    } else if (entry.source === 'narrator') {
      this.renderChatBubble('narrator', entry.content);
    } else if (entry.source) {
      const world = Store.getCurrentWorld();
      const npc = world ? world.characters.find(c => c.id === entry.source) : null;
      this.renderChatBubble('npc', entry.content, npc, index, showBtn);
    } else {
      this.renderChatBubble('narrator', entry.content);
    }
  },

  /** 聊天气泡 */
  renderChatBubble(type, content, npc, index, showBtn) {
    const div = document.createElement('div');
    div.className = `chat-message ${type}`;
    if (type === 'narrator') div.classList.add('narrator-msg');

    if (type === 'protagonist') {
      const world = Store.getCurrentWorld();
      const pName = world ? world.protagonistName || '主角' : '主角';
      const pAvatar = world ? world.protagonistAvatar || '' : '';
      div.innerHTML = this._buildBubbleHTML(pName, '', pAvatar, content, index, showBtn);
    } else if (type === 'npc' && npc) {
      div.innerHTML = this._buildBubbleHTML(npc.name, npc.role, npc.avatar || '', content, index, showBtn);
    } else if (type === 'narrator') {
      const paras = content.split('\n').filter(p => p.trim());
      div.innerHTML = `<div class="chat-body"><div class="chat-bubble">${paras.map(p => this.esc(p)).join('<br>')}</div></div>`;
    }

    this.els.storyContent.appendChild(div);
    // 绑定回退按钮事件
    if (showBtn) {
      const btn = div.querySelector('.chat-rollback');
      if (btn) btn.addEventListener('click', (e) => { e.stopPropagation(); this.rollbackFrom(index); });
    }
    this.scrollToBottom();
  },

  _buildBubbleHTML(name, role, avatarUrl, content, index, showBtn) {
    const paras = content.split('\n').filter(p => p.trim());
    const avatarHTML = avatarUrl
      ? `<div class="chat-avatar"><img src="${avatarUrl}" alt=""></div>`
      : `<div class="chat-avatar">${name[0] || '?'}</div>`;
    const btnHTML = showBtn ? `<button class="chat-rollback" data-index="${index}" title="从此处重置">↩</button>` : '';
    return `
      ${avatarHTML}
      <div class="chat-body">
        <div class="chat-sender">${this.esc(name)}</div>
        <div class="chat-bubble">${paras.map(p => this.esc(p)).join('<br>')}${btnHTML}</div>
      </div>`;
  },

  renderSystemNote(text) {
    const div = document.createElement('div');
    div.className = 'chat-message narrator';
    div.innerHTML = `<div class="chat-body"><div class="chat-bubble">${this.esc(text)}</div></div>`;
    this.els.storyContent.appendChild(div);
    this.scrollToBottom();
  },

  /** 从指定消息索引处截断历史 */
  rollbackFrom(index) {
    if (!confirm('从此处重置之后的所有对话？世界设定和角色卡保留，NPC记忆将回退。')) return;
    Store.truncateHistory(index + 1);
    // 回退NPC记忆
    const world = Store.getCurrentWorld();
    if (world) {
      world.characters.forEach(c => c.memory = '');
      Store.forceSave();
      const apiKeys = Store.getApiKeys();
      if (apiKeys.deepseekKey && world.history.length > 0) {
        this.rebuildMemories(apiKeys, world).catch(() => {});
      }
    }
    this.els.storyContent.innerHTML = '';
    this.renderHistory(Store.getHistory());
  },

  /** 切换旁白显示/隐藏 */
  toggleNarratorVisibility() {
    const enabled = this.els.narratorToggle.checked;
    const world = Store.getCurrentWorld();
    if (world) { world.narratorEnabled = enabled; }
    document.querySelectorAll('.narrator-msg').forEach(el => {
      el.style.display = enabled ? '' : 'none';
    });
  },

  /** 回退后异步重建NPC记忆 */
  async rebuildMemories(apiKeys, world) {
    try {
      const historyText = world.history.map(h => `[${h.role}] ${h.content}`).join('\n');
      const { memoryUpdates } = await API.extractMemory(apiKeys, world.characters, historyText);
      for (const m of (memoryUpdates || [])) {
        const c = world.characters.find(x => x.name === m.name);
        if (c) c.memory = m.newInfo || '';
      }
      Store.forceSave();
    } catch(e) { /* 静默 */ }
  },

  scrollToBottom() {
    requestAnimationFrame(() => { this.els.storyArea.scrollTop = this.els.storyArea.scrollHeight; });
  },

  esc(text) {
    const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' };
    return String(text).replace(/[&<>"]/g, c => map[c]);
  },

  /* ---- 消息发送（导演管线）---- */
  async sendMessage() {
    if (this.isProcessing) return;
    const userText = this.els.userInput.value.trim();
    const imageFile = this.selectedImage;
    if (!userText && !imageFile) return;

    const apiKeys = Store.getApiKeys();
    if (Store.getProviders().length === 0) { alert('请先在 API 设置中添加至少一个模型提供者。'); this.openApiPanel(); return; }

    this.isProcessing = true; this.els.btnSend.disabled = true; this.hideWelcome();

    if (imageFile) this.renderChatBubble('protagonist', userText || '📷');
    else this.renderChatBubble('protagonist', userText);

    const userContent = imageFile ? (userText ? `[图片] ${userText}` : '[图片]') : userText;
    this.els.userInput.value = ''; this.autoResizeInput(); this.clearImage();

    const loadingBubble = this.showLoading('世界正在演化...');

    try {
      const world = Store.getCurrentWorld();
      const history = Store.getHistory();
      const characters = Store.getCharacters();

      // 解析调用参数
      const dirCfg = Store.resolveCallParams(Store.getModelAssignment('directorModel'));
      const narCfg = Store.resolveCallParams(Store.getModelAssignment('narratorModel'));
      if (!dirCfg || !narCfg) throw new Error('请先在 API 设置中配置模型');

      // 1. 导演调用（含近期历史）
      const script = await API.callDirector(dirCfg, world.worldSetting, characters, userText, history, world.attention);

      // 录制历史（用户输入先存）
      Store.appendHistory({ role: 'user', content: userContent });

      // 2. NPC 并行生成
      if (script.acts && script.acts.length > 0) {
        const npcMap = Object.fromEntries(characters.map(c => [c.name, c]));
        const npcResults = await Promise.all(
          script.acts.map(async (act) => {
            const npc = npcMap[act.npc];
            if (!npc) return { name: act.npc, content: '' };
            const ctx = `【场景】${script.scene || ''}\n【你的演出指导】${act.direction}`;
            try {
              const npcCfg = Store.resolveCallParams(Store.getNpcModel(npc.id)) || dirCfg;
              const r = await API.narrateNpc(npcCfg, npc, ctx, world.attention);
              return { name: act.npc, content: r.content || '', npcId: npc.id };
            } catch(e) { return { name: act.npc, content: '', npcId: npc.id }; }
          })
        );

        // 按顺序展示 NPC 响应
        for (const r of npcResults) {
          if (r.content) {
            const npc = characters.find(c => c.id === r.npcId);
            Store.appendHistory({ role: 'assistant', content: r.content, source: npc ? npc.id : '', sourceName: r.name });
          }
        }
      }

      // 3. 旁白收尾
      removeLoading(loadingBubble);
      const npcOutputs = script.acts
        ? script.acts.map(a => Store.getHistory().filter(h => h.sourceName === a.npc).pop()?.content || '').filter(Boolean)
        : [];
      const narratorInput = `【场景】${script.scene || ''}\n【已知NPC已作出反应】${npcOutputs.join(' | ')}`;
      const apiHistory = history.map(h => ({ role: h.role, content: h.content }));
      const envNarrative = await API.narrateEnvironment(
        narCfg, world.worldSetting, world.characterSetting, world.attention, apiHistory,
        narratorInput, null
      );

      if (envNarrative) {
        Store.appendHistory({ role: 'assistant', content: envNarrative, source: 'narrator' });
        if (world.narratorEnabled !== false) this.renderChatBubble('narrator', envNarrative);
      }

      // 4. 渲染 NPC（按历史）
      this.renderHistoryFrom(Store.getHistory(), history.length);

      // 5. 提取记忆
      if (characters.length > 0) {
        this.extractAndSaveMemory(dirCfg, characters, envNarrative || script.scene, userContent);
      }
    } catch (err) {
      removeLoading(loadingBubble);
      console.error('发送失败:', err);
      this.renderSystemNote(`出错了：${err.message}`);
    } finally {
      this.isProcessing = false; this.els.btnSend.disabled = false;
      this.els.userInput.focus(); this.scrollToBottom();
    }
  },

  /** 加载提示 */
  showLoading(text) {
    const div = document.createElement('div');
    div.className = 'loading-bubble';
    div.innerHTML = `<span class="loading-dots">${this.esc(text)}<span class="dots-anim">...</span></span>`;
    this.els.storyContent.appendChild(div);
    this.scrollToBottom();
    return div;
  },

  /** 增量渲染新历史 */
  renderHistoryFrom(history, startIdx) {
    for (let i = startIdx; i < history.length; i++) {
      this.renderChatEntry(history[i], i, history.length);
    }

  /** 智能筛选：用户提到的 + 环境中有互动迹象的，上限 3 */
  findActiveNpcs(userText, envText, characters) {
    const keywords = ['对你说', '看着你', '走向你', '开口', '说道', '问道', '朝你', '在你身旁', '在你身后', '在你面前'];
    const mentioned = characters.filter(c => userText.includes(c.name));
    const envNpcs = characters.filter(c => {
      if (!envText.includes(c.name)) return false;
      const idx = envText.indexOf(c.name);
      const nearby = envText.substring(Math.max(0, idx - 20), idx + c.name.length + 30);
      return keywords.some(k => nearby.includes(k));
    });
    // 合并去重
    const seen = new Set(mentioned.map(c => c.id));
    const result = [...mentioned];
    for (const c of envNpcs) {
      if (!seen.has(c.id)) { result.push(c); seen.add(c.id); }
    }
    return result.slice(0, 3);
  },

  async sendInitialPrompt() {
    this.isProcessing = true; this.els.btnSend.disabled = true;
    const narCfg = Store.resolveCallParams(Store.getModelAssignment('narratorModel'));
    const world = Store.getCurrentWorld();
    const characters = Store.getCharacters(); const attention = world ? world.attention : CONFIG.DEFAULT_ATTENTION;
    const prologue = world ? (world.prologue || '') : '';

    try {
      const startPrompt = prologue
        ? `【前情提要】\n${prologue}\n\n（以上是故事开始前已经发生的事。请从这里继续叙事，用一段引人入胜的开场衔接前情提要，引入当前场景和主角的处境。）`
        : '（故事开始。请以一段引人入胜的开场叙事引入这个世界和主角的处境。）';

      const envNarrative = await API.narrateEnvironment(
        narCfg, world.worldSetting, world.characterSetting, attention, [], startPrompt, null
      );
      if (envNarrative) {
        Store.appendHistory({ role: 'user', content: prologue ? `【前情提要】\n${prologue}` : '（故事开始）' });
        Store.appendHistory({ role: 'assistant', content: envNarrative, source: 'narrator' });
        if (prologue) this.renderSystemNote('📜 前情提要');
        else this.renderSystemNote('✦ 故事开始 ✦');
        if (world.narratorEnabled !== false) this.renderChatBubble('narrator', envNarrative);
        // 开场不触发 NPC 响应，等用户第一次主动行动后再触发
      }
    } catch (err) {
      console.error('初始提示失败:', err);
      this.renderSystemNote(`启动故事时出错：${err.message}`);
    } finally {
      this.isProcessing = false; this.els.btnSend.disabled = false; this.scrollToBottom();
    }
  },

  /* ---- 记忆 ---- */
  estimateTokens(text) {
    return Math.round((text || '').length * CONFIG.MEMORY_CHAR_TO_TOKEN);
  },

  async extractAndSaveMemory(cfg, characters, narrative, userAction) {
    try {
      const result = await API.extractMemory(cfg, characters, narrative, userAction);
      if (!result) return;
      const { memoryUpdates = [], newCharacters = [] } = result;
      for (const update of memoryUpdates) {
        const c = characters.find(x => x.name === update.name);
        if (!c || !update.newInfo) continue;
        const existing = c.memory || '';
        const newMemory = existing ? existing + '\n' + update.newInfo : update.newInfo;
        Store.updateCharacter(c.id, c.name, c.role, c.personality, c.relation, newMemory, c.avatar);
        if (this.estimateTokens(newMemory) >= CONFIG.MEMORY_COMPRESS_THRESHOLD) {
          this.compressCharacterMemory(cfg, { ...c, memory: newMemory });
        }
      }
      for (const nc of newCharacters) {
        if (!nc.name) continue;
        if (Store.getCharacters().find(c => c.name === nc.name)) continue;
        Store.addCharacter(nc.name, nc.role || '未知', nc.personality || '', nc.relation || '', '');
      }
    } catch (e) { console.warn('记忆提取失败:', e); }
  },

  async compressCharacterMemory(cfg, npc) {
    try {
      const compressed = await API.compressMemory(cfg, npc);
      Store.updateCharacter(npc.id, npc.name, npc.role, npc.personality, npc.relation, compressed, npc.avatar);
    } catch (e) { console.warn('记忆压缩失败:', npc.name, e); }
  },

  /* ---- 主题 ---- */
  updateThemeBtns() {
    const t = Store.getTheme();
    this.els.themeBtns.forEach(b => b.classList.toggle('active', b.dataset.theme === t));
    this.applyTheme(t);
  },
  setTheme(t) {
    Store.setTheme(t);
    this.updateThemeBtns();
  },
  applyTheme(t) {
    const html = document.documentElement;
    if (t === 'system') {
      html.classList.toggle('light', window.matchMedia('(prefers-color-scheme: light)').matches);
    } else {
      html.classList.toggle('light', t === 'light');
    }
  },

  /* ---- API 面板 ---- */
  openApiPanel() {
    this.renderApiPanel();
    this.els.apiOverlay.classList.remove('hidden');
  },
  closeApiPanel() { this.els.apiOverlay.classList.add('hidden'); },

  renderApiPanel() {
    const providers = Store.getProviders();
    const list = this.els.apiProvidersList;
    list.innerHTML = providers.map(p => {
      const models = (p.models || []).map(m => `<span class="model-tag">${m}</span>`).join('') || '<span style="font-size:12px;color:var(--text-muted)">输入 API Key 后点击获取模型</span>';
      return `<div class="api-provider-card">
        <div class="api-provider-header"><strong>${p.name}</strong><button data-del="${p.id}">删除</button></div>
        <div class="api-provider-body">
          <label>接口地址</label><input type="text" data-id="${p.id}" data-field="endpoint" value="${p.endpoint || ''}" placeholder="https://api.deepseek.com/v1/chat/completions">
          <label>API Key</label><input type="password" data-id="${p.id}" data-field="apiKey" value="${p.apiKey || ''}" placeholder="sk-...">
          <label>鉴权方式</label><select data-id="${p.id}" data-field="authType"><option value="bearer" ${p.authType==='bearer'?'selected':''}>Bearer</option><option value="api-key" ${p.authType==='api-key'?'selected':''}>api-key</option></select>
          <button class="btn-small" data-fetch="${p.id}">🔍 获取模型列表</button>
          <div class="model-list">${models}</div>
        </div>
      </div>`;
    }).join('');
    // 绑定事件
    list.querySelectorAll('button[data-del]').forEach(b => b.addEventListener('click', () => { Store.removeProvider(b.dataset.del); this.renderApiPanel(); }));
    list.querySelectorAll('button[data-fetch]').forEach(b => b.addEventListener('click', () => this.fetchProviderModels(b.dataset.fetch)));
    list.querySelectorAll('input, select').forEach(el => {
      el.addEventListener('change', () => this.updateProviderField(el.dataset.id, el.dataset.field, el.value));
    });
    this.renderModelAssignments();
  },

  updateProviderField(id, field, value) {
    Store.updateProvider(id, { [field]: value });
    this.renderApiPanel();
  },

  async fetchProviderModels(providerId) {
    const p = Store.getProvider(providerId);
    if (!p || !p.apiKey) { alert('请先填写 API Key'); return; }
    const models = await API.fetchModels(p.endpoint, p.apiKey, p.authType);
    if (models.length === 0) { alert('获取失败，请检查 API Key 和接口地址'); return; }
    Store.updateProvider(providerId, { models });
    this.renderApiPanel();
  },

  addProvider() {
    Store.addProvider('新提供者', 'https://api.deepseek.com/v1/chat/completions', '', 'bearer');
    this.renderApiPanel();
  },

  renderModelAssignments() {
    const providers = Store.getProviders();
    const allModels = [];
    for (const p of providers) {
      for (const m of (p.models || [])) allModels.push({ label: `${p.name} / ${m}`, providerId: p.id, model: m });
    }
    const opts = allModels.map(x => `<option value="${x.providerId}:${x.model}">${x.label}</option>`).join('');
    [this.els.assignDirector, this.els.assignNarrator, this.els.assignVision].forEach(sel => {
      sel.innerHTML = opts;
    });
    const set = (sel, role) => {
      const a = Store.getModelAssignment(role);
      if (a) sel.value = `${a.providerId}:${a.model}`;
    };
    set(this.els.assignDirector, 'directorModel');
    set(this.els.assignNarrator, 'narratorModel');
    set(this.els.assignVision, 'visionModel');
  },

  saveModelAssignments() {
    const parse = v => { const [providerId, ...rest] = v.split(':'); return { providerId, model: rest.join(':') }; };
    Store.setModelAssignment('directorModel', ...Object.values(parse(this.els.assignDirector.value)));
    Store.setModelAssignment('narratorModel', ...Object.values(parse(this.els.assignNarrator.value)));
    Store.setModelAssignment('visionModel', ...Object.values(parse(this.els.assignVision.value)));
  },

  /* ---- 角色卡模型选择 ---- */
  populateNpcModelSelect(selectEl, currentValue) {
    selectEl.innerHTML = '<option value="">跟随全局设置</option>';
    for (const p of Store.getProviders()) {
      for (const m of (p.models || [])) selectEl.innerHTML += `<option value="${p.id}:${m}">${p.name} / ${m}</option>`;
    }
    selectEl.value = currentValue || '';
  },

  updateNpcCount() {
    const chars = Store.getCharacters();
    this.els.npcCount.textContent = chars.length > 0 ? `${chars.length} 个角色` : '暂无角色';
  },

  openCharactersPanel() { this.renderCharactersList(); this.els.charactersOverlay.classList.remove('hidden'); },

  closeCharactersPanel() { this.els.charactersOverlay.classList.add('hidden'); this.els.charactersSearch.value = ''; },

  renderCharactersList() {
    let chars = Store.getCharacters();
    const query = (this.els.charactersSearch.value || '').trim().toLowerCase();
    if (query) chars = chars.filter(c => c.name.toLowerCase().includes(query) || c.role.toLowerCase().includes(query) || (c.personality || '').toLowerCase().includes(query));
    const list = this.els.charactersList;
    if (chars.length === 0) { list.innerHTML = '<div class="characters-empty">还没有角色，点击下方按钮创建</div>'; return; }
    list.innerHTML = chars.map(c => {
      const tokens = this.estimateTokens(c.memory || '');
      const memInfo = c.memory ? `${tokens.toLocaleString()} tokens · ${c.memory.length.toLocaleString()} 字符` : '无记忆';
      let warn = ''; if (tokens >= CONFIG.MEMORY_COMPRESS_THRESHOLD * 0.8) warn = ' ⚡'; if (tokens >= CONFIG.MEMORY_COMPRESS_THRESHOLD) warn = ' 🔴';
      return `<div class="character-card" data-id="${c.id}"><div class="character-card-header"><div><div class="character-card-name">${this.esc(c.name)}${warn}</div><div class="character-card-role">${this.esc(c.role)}</div><div class="character-card-memory-info">${memInfo}</div></div><span class="character-card-arrow">›</span></div></div>`;
    }).join('');
    list.querySelectorAll('.character-card').forEach(card => card.addEventListener('click', () => this.openCharacterEdit(card.dataset.id)));
  },

  openCharacterEdit(id) {
    const e = this.els; this.editDataUrl = '';
    if (id) {
      const c = Store.findCharacterById(id); if (!c) return;
      e.editTitle.textContent = '编辑角色卡'; e.editId.value = c.id; e.editName.value = c.name;
      e.editRole.value = c.role; e.editPersonality.value = c.personality;
      e.editRelation.value = c.relation || ''; e.editMemory.value = c.memory || '';
      this.editDataUrl = c.avatar || '';
      e.btnDeleteCharacter.classList.remove('hidden');
      this.populateNpcModelSelect(e.editNpcModel, c.npcModelId || '');
    } else {
      e.editTitle.textContent = '新建角色卡'; e.editId.value = ''; e.editName.value = '';
      e.editRole.value = ''; e.editPersonality.value = ''; e.editRelation.value = ''; e.editMemory.value = '';
      e.btnDeleteCharacter.classList.add('hidden');
      this.populateNpcModelSelect(e.editNpcModel, '');
    }
    this.renderAvatarPreview(e.editAvatarPreview, this.editDataUrl);
    this.updateMemoryStats(); e.editOverlay.classList.remove('hidden');
  },

  closeCharacterEdit() { this.els.editOverlay.classList.add('hidden'); },

  updateMemoryStats() {
    const text = this.els.editMemory.value || ''; const tokens = this.estimateTokens(text);
    const threshold = CONFIG.MEMORY_COMPRESS_THRESHOLD;
    let extra = ''; if (tokens >= threshold) extra = ' · 将自动压缩'; else if (tokens >= threshold * 0.8) extra = ' · 接近阈值';
    this.els.memoryStats.textContent = `${tokens.toLocaleString()} tokens · ${text.length.toLocaleString()} 字符${extra}`;
  },

  saveCharacter() {
    const e = this.els; const id = e.editId.value; const name = e.editName.value.trim();
    const role = e.editRole.value.trim(); const personality = e.editPersonality.value.trim();
    const relation = e.editRelation.value.trim(); const memory = e.editMemory.value.trim();
    if (!name) { alert('请填写角色姓名'); return; }
    if (id) {
      Store.updateCharacter(id, name, role, personality, relation, memory, this.editDataUrl, e.editNpcModel.value);
    } else {
      Store.addCharacter(name, role, personality, relation, this.editDataUrl, memory, e.editNpcModel.value);
    }
    this.closeCharacterEdit(); this.renderCharactersList(); this.updateNpcCount();
  },

  deleteCharacter() {
    const id = this.els.editId.value; if (!id || !confirm('确定删除？')) return;
    Store.deleteCharacter(id); this.closeCharacterEdit(); this.renderCharactersList(); this.updateNpcCount();
  },

  /* ---- 图片 & 输入 ---- */
  handleImageSelect(e) {
    const file = e.target.files[0]; if (!file) return;
    if (!file.type.startsWith('image/')) { alert('请选择图片文件'); return; }
    if (file.size > 10 * 1024 * 1024) { alert('图片不能超过 10MB'); return; }
    this.selectedImage = file; this.els.btnImage.style.color = 'var(--accent)';
    this.els.userInput.placeholder = '描述这张图片（可选），然后发送……'; this.els.userInput.focus();
  },

  clearImage() { this.selectedImage = null; this.els.imageInput.value = ''; this.els.btnImage.style.color = ''; this.els.userInput.placeholder = '描述你的行动……'; },

  handleInputKeydown(e) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); this.sendMessage(); }
    if (e.key === 'Escape' && this.selectedImage) { e.preventDefault(); this.clearImage(); }
  },

  autoResizeInput() {
    const el = this.els.userInput; el.style.height = 'auto'; el.style.height = Math.min(el.scrollHeight, 100) + 'px';
  },

  registerServiceWorker() {
    if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
  },
};

document.addEventListener('DOMContentLoaded', () => App.init());
