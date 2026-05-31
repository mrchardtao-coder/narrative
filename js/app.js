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
      deepseekKey: q('#deepseek-key'), deepseekModel: q('#deepseek-model'),
      mimoKey: q('#mimo-key'), mimoEndpoint: q('#mimo-endpoint'),
      saveSettings: q('#settings-save'), resetStory: q('#settings-reset'),
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
    e.toggleDsKey.addEventListener('click', () => this.togglePassword(e.deepseekKey, e.toggleDsKey));
    e.toggleMimoKey.addEventListener('click', () => this.togglePassword(e.mimoKey, e.toggleMimoKey));
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
    this.els.deepseekKey.value = keys.deepseekKey || '';
    this.els.deepseekModel.value = keys.deepseekModel || 'deepseek-v4-pro';
    this.els.mimoKey.value = keys.mimoKey || '';
    this.els.mimoEndpoint.value = keys.mimoEndpoint || '';
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
    const showBtn = index < total - 1; // 最后一条不显示回退按钮
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
    if (!confirm('从此处重置之后的所有对话？世界观和角色设定会保留。')) return;
    Store.truncateHistory(index + 1);
    this.els.storyContent.innerHTML = '';
    this.renderHistory(Store.getHistory());
  },

  scrollToBottom() {
    requestAnimationFrame(() => { this.els.storyArea.scrollTop = this.els.storyArea.scrollHeight; });
  },

  esc(text) {
    const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' };
    return String(text).replace(/[&<>"]/g, c => map[c]);
  },

  /* ---- 消息发送（两层架构 + 聊天气泡）---- */
  async sendMessage() {
    if (this.isProcessing) return;
    const userText = this.els.userInput.value.trim();
    const imageFile = this.selectedImage;
    if (!userText && !imageFile) return;

    const apiKeys = Store.getApiKeys();
    if (!apiKeys.deepseekKey) { alert('请先填写 DeepSeek API Key。'); this.showSettings(); return; }

    this.isProcessing = true; this.els.btnSend.disabled = true; this.hideWelcome();

    // 展示主角消息
    if (imageFile) this.renderChatBubble('protagonist', userText || '📷');
    else this.renderChatBubble('protagonist', userText);

    const userContent = imageFile ? (userText ? `[图片] ${userText}` : '[图片]') : userText;
    this.els.userInput.value = ''; this.autoResizeInput(); this.clearImage();

    try {
      const world = Store.getCurrentWorld();
      const history = Store.getHistory();
      const characters = Store.getCharacters();
      const attention = world ? world.attention : CONFIG.DEFAULT_ATTENTION;

      // 构建 API 用的 history（不含 source 字段，保持兼容）
      const apiHistory = history.map(h => ({ role: h.role, content: h.content }));

      const envNarrative = await API.narrateEnvironment(
        apiKeys, world.worldSetting, world.characterSetting, attention, apiHistory,
        userText || '（用户上传了一张图片）', imageFile
      );

      if (!envNarrative) throw new Error('环境叙事生成失败');

      // 记录历史
      Store.appendHistory({ role: 'user', content: userContent });
      Store.appendHistory({ role: 'assistant', content: envNarrative, source: 'narrator' });
      this.renderChatBubble('narrator', envNarrative);

      // NPC 独立调用
      if (characters.length > 0) {
        const sceneNpcs = this.findNpcsInText(envNarrative, characters);
        if (sceneNpcs.length > 0) {
          const npcResponses = await Promise.all(
            sceneNpcs.map(npc => API.narrateNpc(apiKeys, npc, envNarrative))
          );
          for (const r of npcResponses) {
            if (r.content) {
              const npc = sceneNpcs.find(n => n.name === r.name);
              Store.appendHistory({ role: 'assistant', content: r.content, source: npc ? npc.id : '', sourceName: r.name });
              this.renderChatBubble('npc', r.content, npc);
            }
          }
        }
        this.extractAndSaveMemory(apiKeys, characters, envNarrative, userContent);
      }
    } catch (err) {
      console.error('发送失败:', err);
      this.renderSystemNote(`出错了：${err.message}`);
    } finally {
      this.isProcessing = false; this.els.btnSend.disabled = false;
      this.els.userInput.focus(); this.scrollToBottom();
    }
  },

  findNpcsInText(text, characters) {
    return characters.filter(c => text.includes(c.name));
  },

  async sendInitialPrompt() {
    this.isProcessing = true; this.els.btnSend.disabled = true;
    const apiKeys = Store.getApiKeys(); const world = Store.getCurrentWorld();
    const characters = Store.getCharacters(); const attention = world ? world.attention : CONFIG.DEFAULT_ATTENTION;
    const prologue = world ? (world.prologue || '') : '';

    try {
      const startPrompt = prologue
        ? `【前情提要】\n${prologue}\n\n（以上是故事开始前已经发生的事。请从这里继续叙事，用一段引人入胜的开场衔接前情提要，引入当前场景和主角的处境。）`
        : '（故事开始。请以一段引人入胜的开场叙事引入这个世界和主角的处境。）';

      const envNarrative = await API.narrateEnvironment(
        apiKeys, world.worldSetting, world.characterSetting, attention, [], startPrompt, null
      );
      if (envNarrative) {
        Store.appendHistory({ role: 'user', content: prologue ? `【前情提要】\n${prologue}` : '（故事开始）' });
        Store.appendHistory({ role: 'assistant', content: envNarrative, source: 'narrator' });
        if (prologue) this.renderSystemNote('📜 前情提要');
        else this.renderSystemNote('✦ 故事开始 ✦');
        this.renderChatBubble('narrator', envNarrative);
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

  async extractAndSaveMemory(apiKeys, characters, narrative, userAction) {
    try {
      const result = await API.extractMemory(apiKeys, characters, narrative, userAction);
      if (!result) return;
      const { memoryUpdates = [], newCharacters = [] } = result;
      for (const update of memoryUpdates) {
        const c = characters.find(x => x.name === update.name);
        if (!c || !update.newInfo) continue;
        const existing = c.memory || '';
        const newMemory = existing ? existing + '\n' + update.newInfo : update.newInfo;
        Store.updateCharacter(c.id, c.name, c.role, c.personality, c.relation, newMemory, c.avatar);
        if (this.estimateTokens(newMemory) >= CONFIG.MEMORY_COMPRESS_THRESHOLD) {
          this.compressCharacterMemory(apiKeys, { ...c, memory: newMemory });
        }
      }
      for (const nc of newCharacters) {
        if (!nc.name) continue;
        if (Store.getCharacters().find(c => c.name === nc.name)) continue;
        Store.addCharacter(nc.name, nc.role || '未知', nc.personality || '', nc.relation || '', '');
      }
    } catch (e) { console.warn('记忆提取失败:', e); }
  },

  async compressCharacterMemory(apiKeys, npc) {
    try {
      const compressed = await API.compressMemory(apiKeys, npc);
      Store.updateCharacter(npc.id, npc.name, npc.role, npc.personality, npc.relation, compressed, npc.avatar);
    } catch (e) { console.warn('记忆压缩失败:', npc.name, e); }
  },

  /* ---- 角色卡管理 ---- */
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
    } else {
      e.editTitle.textContent = '新建角色卡'; e.editId.value = ''; e.editName.value = '';
      e.editRole.value = ''; e.editPersonality.value = ''; e.editRelation.value = ''; e.editMemory.value = '';
      e.btnDeleteCharacter.classList.add('hidden');
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
      Store.updateCharacter(id, name, role, personality, relation, memory, this.editDataUrl);
    } else {
      Store.addCharacter(name, role, personality, relation, this.editDataUrl, memory);
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
