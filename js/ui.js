/* ========================================
   UI 模块
   负责所有 DOM 渲染和事件绑定
   ======================================== */
const UI = {
  els: {},
  protagonistDataUrl: '',
  editDataUrl: '',
  selectedImage: null,

  cache() {
    const q = s => document.querySelector(s);
    this.els = {
      // 主界面
      storyContent: q('#story-content'), storyArea: q('#story-area'), welcome: q('#welcome'),
      userInput: q('#user-input'), imageInput: q('#image-input'),
      btnSend: q('#btn-send'), btnImage: q('#btn-image'),
      btnSwitchWorld: q('#btn-switch-world'), currentWorldName: q('#current-world-name'),
      openSettings: q('#open-settings'), disclaimer: q('.disclaimer-bar'),

      // 设置
      overlay: q('#settings-overlay'), closeSettings: q('#settings-close'),
      worldName: q('#world-name'), worldSetting: q('#world-setting'),
      prologueSetting: q('#prologue-setting'),
      characterSetting: q('#character-setting'), protagonistName: q('#protagonist-name'),
      protagonistAvatarPreview: q('#protagonist-avatar-preview'), protagonistAvatarInput: q('#protagonist-avatar-input'),
      btnProtagonistAvatar: q('#btn-protagonist-avatar'),
      npcCount: q('#npc-count'), btnOpenCharacters: q('#btn-open-characters'),
      attentionSlider: q('#attention-slider'), attentionLabel: q('#attention-label'),
      narratorToggle: q('#narrator-toggle'),
      themeBtns: q('#settings-overlay').querySelectorAll('.theme-selector button'),
      btnOpenApi: q('#btn-open-api'),
      saveSettings: q('#settings-save'), resetStory: q('#settings-reset'), refreshPage: q('#settings-refresh'),

      // API 面板
      apiOverlay: q('#api-overlay'), apiClose: q('#api-close'),
      apiProvidersList: q('#api-providers-list'), btnAddProvider: q('#btn-add-provider'),
      assignDirector: q('#assign-director'), assignNarrator: q('#assign-narrator'), assignVision: q('#assign-vision'),

      // 世界切换
      worldsOverlay: q('#worlds-overlay'), worldsList: q('#worlds-list'), worldsClose: q('#worlds-close'),
      btnNewWorld: q('#btn-new-world'),

      // 角色卡
      charactersOverlay: q('#characters-overlay'), charactersList: q('#characters-list'),
      charactersSearch: q('#characters-search-input'), charactersBack: q('#characters-back'),
      btnNewCharacter: q('#btn-new-character'),

      // 角色卡编辑
      editOverlay: q('#character-edit-overlay'), editBack: q('#edit-back'), editTitle: q('#edit-title'),
      editId: q('#edit-id'), editName: q('#edit-name'), editRole: q('#edit-role'),
      editPersonality: q('#edit-personality'), editRelation: q('#edit-relation'),
      editMemory: q('#edit-memory'), memoryStats: q('#memory-stats'),
      editAvatarPreview: q('#edit-avatar-preview'), editAvatarInput: q('#edit-avatar-input'),
      btnEditAvatar: q('#btn-edit-avatar'), btnSaveCharacter: q('#btn-save-character'), btnDeleteCharacter: q('#btn-delete-character'),
      editNpcModel: q('#edit-npc-model'),
    };
  },

  /* ==================== 事件绑定 ==================== */
  bindAll() {
    const e = this.els;
    e.openSettings.addEventListener('click', () => { try { Engine.openSettings(); } catch(e) { alert('设置:'+e.message); } });
    e.closeSettings.addEventListener('click', () => { try { Engine.closeSettings(); } catch(e) { alert('关设置:'+e.message); } });
    e.saveSettings.addEventListener('click', () => { try { Engine.saveAndStart(); } catch(e) { alert('保存:'+e.message); } });
    e.resetStory.addEventListener('click', () => Engine.resetStory());
    e.refreshPage.addEventListener('click', () => location.reload());
    e.overlay.addEventListener('click', ev => { if (ev.target === e.overlay) Engine.closeSettings(); });

    e.btnOpenApi.addEventListener('click', () => this.openApiPanel());
    e.apiClose.addEventListener('click', () => this.closeApiPanel());
    e.btnAddProvider.addEventListener('click', () => this.addProvider());
    e.assignDirector.addEventListener('change', () => this.saveAssignments());
    e.assignNarrator.addEventListener('change', () => this.saveAssignments());
    e.assignVision.addEventListener('change', () => this.saveAssignments());
    e.apiOverlay.addEventListener('click', ev => { if (ev.target === e.apiOverlay) this.closeApiPanel(); });

    e.btnSwitchWorld.addEventListener('click', () => this.openWorlds());
    e.worldsClose.addEventListener('click', () => this.closeWorlds());
    e.btnNewWorld.addEventListener('click', () => this.createWorld());
    e.worldsOverlay.addEventListener('click', ev => { if (ev.target === e.worldsOverlay) this.closeWorlds(); });

    e.btnOpenCharacters.addEventListener('click', () => this.openChars());
    e.charactersBack.addEventListener('click', () => this.closeChars());
    e.btnNewCharacter.addEventListener('click', () => this.editChar(null));
    e.charactersSearch.addEventListener('input', () => this.renderCharList());
    e.charactersOverlay.addEventListener('click', ev => { if (ev.target === e.charactersOverlay) this.closeChars(); });

    e.editBack.addEventListener('click', () => this.closeCharEdit());
    e.btnSaveCharacter.addEventListener('click', () => this.saveChar());
    e.btnDeleteCharacter.addEventListener('click', () => this.delChar());
    e.editMemory.addEventListener('input', () => this.updateMemStats());
    e.editOverlay.addEventListener('click', ev => { if (ev.target === e.editOverlay) this.closeCharEdit(); });

    e.btnProtagonistAvatar.addEventListener('click', () => e.protagonistAvatarInput.click());
    e.protagonistAvatarInput.addEventListener('change', ev => this.onAvatar(ev, 'p'));
    e.btnEditAvatar.addEventListener('click', () => e.editAvatarInput.click());
    e.editAvatarInput.addEventListener('change', ev => this.onAvatar(ev, 'e'));

    e.attentionSlider.addEventListener('input', () => { e.attentionLabel.textContent = e.attentionSlider.value; });
    e.narratorToggle.addEventListener('change', () => this.toggleNarrator());

    e.themeBtns.forEach(b => b.addEventListener('click', () => this.setTheme(b.dataset.theme)));

    e.btnSend.addEventListener('click', () => Engine.send());
    e.userInput.addEventListener('keydown', ev => { if (ev.key === 'Enter' && !ev.shiftKey) { ev.preventDefault(); Engine.send(); } });
    e.userInput.addEventListener('input', () => { e.userInput.style.height = 'auto'; e.userInput.style.height = Math.min(e.userInput.scrollHeight, 100) + 'px'; });
    e.btnImage.addEventListener('click', () => e.imageInput.click());
    e.imageInput.addEventListener('change', ev => this.onImage(ev));
  },

  /* ==================== 聊天渲染 ==================== */
  renderHistory(hist) {
    this.els.storyContent.innerHTML = '';
    if (!hist || hist.length === 0) return;
    for (let i = 0; i < hist.length; i++) this._renderEntry(hist[i], i, hist.length);
    this.scroll();
  },

  renderNewEntries(hist, fromIdx) {
    for (let i = fromIdx; i < hist.length; i++) this._renderEntry(hist[i], i, hist.length);
    this.scroll();
  },

  _renderEntry(entry, idx, total) {
    if (entry.role === 'user') {
      this._bubble('protagonist', entry.content, null, idx);
    } else if (entry.source === 'narrator') {
      this._bubble('narrator', entry.content);
    } else if (entry.source) {
      const c = Store.findCharacterById(entry.source);
      this._bubble('npc', entry.content, c, idx);
    } else {
      this._bubble('narrator', entry.content);
    }
  },

  _bubble(type, content, npc, idx) {
    const div = document.createElement('div');
    div.className = `chat-message ${type}`;
    if (type === 'narrator') div.classList.add('narrator-msg');

    const esc = s => String(s).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'})[c]);
    const paras = content.split('\n').filter(p => p.trim()).map(p => esc(p)).join('<br>');

    if (type === 'protagonist') {
      const w = Store.getCurrentWorld();
      const name = w ? (w.protagonistName || '主角') : '主角';
      const av = w ? (w.protagonistAvatar || '') : '';
      const ahtml = av ? `<div class="chat-avatar"><img src="${av}" alt=""></div>` : `<div class="chat-avatar">${name[0]}</div>`;
      div.innerHTML = `${ahtml}<div class="chat-body"><div class="chat-sender">${esc(name)}</div><div class="chat-bubble">${paras}<button class="chat-rollback" data-idx="${idx}">↩</button></div></div>`;
    } else if (type === 'npc' && npc) {
      const ahtml = npc.avatar ? `<div class="chat-avatar"><img src="${npc.avatar}" alt=""></div>` : `<div class="chat-avatar">${npc.name[0]}</div>`;
      div.innerHTML = `${ahtml}<div class="chat-body"><div class="chat-sender">${esc(npc.name)}</div><div class="chat-bubble">${paras}<button class="chat-rollback" data-idx="${idx}">↩</button></div></div>`;
    } else {
      div.innerHTML = `<div class="chat-body"><div class="chat-bubble">${paras}</div></div>`;
    }

    this.els.storyContent.appendChild(div);
    const btn = div.querySelector('.chat-rollback');
    if (btn) btn.addEventListener('click', e => { e.stopPropagation(); Engine.rollback(parseInt(btn.dataset.idx)); });
  },

  systemNote(text) {
    const d = document.createElement('div'); d.className = 'system-note'; d.textContent = text;
    this.els.storyContent.appendChild(d); this.scroll();
  },

  showLoading(text) {
    const d = document.createElement('div'); d.className = 'loading-bubble';
    d.innerHTML = `<span class="loading-dots">${text}<span class="dots-anim">...</span></span>`;
    d.id = 'loading-indicator';
    this.els.storyContent.appendChild(d); this.scroll();
  },

  removeLoading() {
    const el = document.getElementById('loading-indicator');
    if (el) el.remove();
  },

  scroll() { requestAnimationFrame(() => { this.els.storyArea.scrollTop = this.els.storyArea.scrollHeight; }); },

  hideWelcome() { this.els.welcome.classList.add('hidden'); },
  showWelcome() { this.els.welcome.classList.remove('hidden'); },

  /* ==================== 设置面板 ==================== */
  loadSettingsForm() {
    try {
    const w = Store.getCurrentWorld();
    const e = this.els;
    e.worldName.value = w ? w.name : '';
    e.worldSetting.value = w ? w.worldSetting : '';
    e.prologueSetting.value = w ? (w.prologue || '') : '';
    e.characterSetting.value = w ? w.characterSetting : '';
    e.protagonistName.value = w ? (w.protagonistName || '') : '';
    this.protagonistDataUrl = w ? (w.protagonistAvatar || '') : '';
    this._renderAvatar(e.protagonistAvatarPreview, this.protagonistDataUrl);
    e.attentionSlider.value = w ? w.attention : CONFIG.DEFAULT_ATTENTION;
    e.attentionLabel.textContent = e.attentionSlider.value;
    e.narratorToggle.checked = w ? (w.narratorEnabled !== false) : true;
    this._updateThemeBtns();
    this._updateNpcCount();
    } catch(e) { alert('加载设置表单出错：'+e.message); }
  },

  showSettings() { this.loadSettingsForm(); this.els.overlay.classList.remove('hidden'); },
  hideSettings() { this.els.overlay.classList.add('hidden'); },

  _updateNpcCount() {
    const c = Store.getCharacters();
    this.els.npcCount.textContent = c.length > 0 ? `${c.length} 个角色` : '暂无角色';
  },

  /* ==================== 主题 ==================== */
  _updateThemeBtns() {
    const t = Store.getTheme();
    this.els.themeBtns.forEach(b => b.classList.toggle('active', b.dataset.theme === t));
  },

  setTheme(t) {
    Store.setTheme(t);
    this._updateThemeBtns();
    this._applyTheme(t);
  },

  _applyTheme(t) {
    const html = document.documentElement;
    if (t === 'system') html.classList.toggle('light', window.matchMedia('(prefers-color-scheme: light)').matches);
    else html.classList.toggle('light', t === 'light');
  },

  initTheme() {
    this._applyTheme(Store.getTheme());
    window.matchMedia('(prefers-color-scheme: light)').addEventListener('change', () => {
      if (Store.getTheme() === 'system') this._applyTheme('system');
    });
  },

  /* ==================== 旁白切换 ==================== */
  toggleNarrator() {
    const en = this.els.narratorToggle.checked;
    document.querySelectorAll('.narrator-msg').forEach(el => { el.style.display = en ? '' : 'none'; });
  },

  initNarratorVisibility() {
    const w = Store.getCurrentWorld();
    if (w && w.narratorEnabled === false) {
      document.querySelectorAll('.narrator-msg').forEach(el => el.style.display = 'none');
    }
  },

  /* ==================== API 面板 ==================== */
  openApiPanel() { this._renderApiPanel(); this.els.apiOverlay.classList.remove('hidden'); },
  closeApiPanel() { this.els.apiOverlay.classList.add('hidden'); },

  _renderApiPanel() {
    const ps = Store.getProviders();
    this.els.apiProvidersList.innerHTML = ps.map(p => {
      const ms = (p.models||[]).map(m => `<span class="model-tag">${m}</span>`).join('') || '<span style="font-size:12px;color:var(--text-muted)">未获取</span>';
      return `<div class="api-provider-card">
        <div class="api-provider-header"><strong>${p.name}</strong><button data-del="${p.id}">删除</button></div>
        <div class="api-provider-body">
          <label>接口地址</label><input data-id="${p.id}" data-field="endpoint" value="${p.endpoint||''}" placeholder="https://api.deepseek.com/v1/chat/completions">
          <label>API Key</label><input type="password" data-id="${p.id}" data-field="apiKey" value="${p.apiKey||''}" placeholder="sk-...">
          <label>鉴权</label><select data-id="${p.id}" data-field="authType"><option value="bearer" ${p.authType==='bearer'?'selected':''}>Bearer</option><option value="api-key" ${p.authType==='api-key'?'selected':''}>api-key</option></select>
          <button data-fetch="${p.id}" class="btn-small">🔍 获取模型</button>
          <div class="model-list">${ms}</div>
        </div></div>`;
    }).join('');
    this.els.apiProvidersList.querySelectorAll('button[data-del]').forEach(b => b.onclick = () => { Store.removeProvider(b.dataset.del); this._renderApiPanel(); });
    this.els.apiProvidersList.querySelectorAll('button[data-fetch]').forEach(b => b.onclick = () => this._fetchModels(b.dataset.fetch));
    this.els.apiProvidersList.querySelectorAll('input, select').forEach(el => el.onchange = () => {
      Store.updateProvider(el.dataset.id, { [el.dataset.field]: el.value }); this._renderApiPanel();
    });
    this._renderAssignments();
  },

  async _fetchModels(pid) {
    const p = Store.getProvider(pid);
    if (!p || !p.apiKey) { alert('先填 API Key'); return; }
    const ms = await API.fetchModels(p.endpoint, p.apiKey, p.authType);
    if (ms.length === 0) { alert('获取失败，检查 Key 和地址'); return; }
    Store.updateProvider(pid, { models: ms });
    this._renderApiPanel();
  },

  addProvider() {
    Store.addProvider('新提供者', 'https://api.deepseek.com/v1/chat/completions', '', 'bearer');
    this._renderApiPanel();
  },

  _renderAssignments() {
    const all = [];
    for (const p of Store.getProviders()) for (const m of (p.models||[])) all.push({ label: `${p.name} / ${m}`, val: `${p.id}:${m}` });
    const opts = all.map(x => `<option value="${x.val}">${x.label}</option>`).join('');
    [this.els.assignDirector, this.els.assignNarrator, this.els.assignVision].forEach(s => s.innerHTML = opts);
    const set = (s, role) => { const a = Store.getModelAssignment(role); if (a) s.value = `${a.providerId}:${a.model}`; };
    set(this.els.assignDirector, 'directorModel');
    set(this.els.assignNarrator, 'narratorModel');
    set(this.els.assignVision, 'visionModel');
  },

  saveAssignments() {
    const p = v => { const [pid, ...r] = v.split(':'); return { providerId: pid, model: r.join(':') }; };
    Store.setModelAssignment('directorModel', ...Object.values(p(this.els.assignDirector.value)));
    Store.setModelAssignment('narratorModel', ...Object.values(p(this.els.assignNarrator.value)));
    Store.setModelAssignment('visionModel', ...Object.values(p(this.els.assignVision.value)));
  },

  /* ==================== 世界切换 ==================== */
  openWorlds() { this._renderWorlds(); this.els.worldsOverlay.classList.remove('hidden'); },
  closeWorlds() { this.els.worldsOverlay.classList.add('hidden'); },

  _renderWorlds() {
    const ws = Store.getWorlds(), cid = Store.getCurrentWorldId();
    this.els.worldsList.innerHTML = ws.map(w =>
      `<div class="world-card ${w.id===cid?'active':''}" data-id="${w.id}">
        <div class="world-card-info"><div class="world-card-name">${w.name}</div><div class="world-card-desc">${(w.worldSetting||'未设定').slice(0,50)}</div></div>
        ${w.id===cid?'<span class="world-card-badge">当前</span>':''}
        ${ws.length>1?`<button class="world-card-delete" data-del="${w.id}">🗑</button>`:''}
      </div>`).join('');
    this.els.worldsList.querySelectorAll('.world-card').forEach(c => c.onclick = ev => {
      if (ev.target.closest('.world-card-delete')) return; this._switchWorld(c.dataset.id);
    });
    this.els.worldsList.querySelectorAll('.world-card-delete').forEach(b => b.onclick = ev => {
      ev.stopPropagation(); if (!confirm('删除？')) return;
      Store.deleteWorld(b.dataset.del);
      if (Store.getWorlds().length === 0) Store.createWorld('群像', '', '', CONFIG.DEFAULT_ATTENTION);
      this._renderWorlds(); this.loadWorldState();
    });
  },

  _switchWorld(id) {
    Store.setCurrentWorldId(id);
    this.closeWorlds();
    this.loadWorldState();
  },

  createWorld() {
    const n = prompt('世界名称：', '新世界'); if (!n) return;
    Store.createWorld(n.trim(), '', '', CONFIG.DEFAULT_ATTENTION);
    this.closeWorlds(); this.loadWorldState();
  },

  loadWorldState() {
    UI.els.currentWorldName.textContent = (Store.getCurrentWorld() || {}).name || '叙事';
    const w = Store.getCurrentWorld();
    if (!w) return;
    this.renderHistory(w.history);
    this.initNarratorVisibility();
    if (w.worldSetting) this.hideWelcome(); else this.showWelcome();
  },

  /* ==================== 角色卡管理 ==================== */
  openChars() { this.renderCharList(); this.els.charactersOverlay.classList.remove('hidden'); },
  closeChars() { this.els.charactersOverlay.classList.add('hidden'); this.els.charactersSearch.value = ''; },

  renderCharList() {
    let cs = Store.getCharacters();
    const q = (this.els.charactersSearch.value||'').trim().toLowerCase();
    if (q) cs = cs.filter(c => c.name.toLowerCase().includes(q) || (c.role||'').toLowerCase().includes(q) || (c.personality||'').toLowerCase().includes(q));
    if (cs.length === 0) { this.els.charactersList.innerHTML = '<div class="characters-empty">无角色</div>'; return; }
    this.els.charactersList.innerHTML = cs.map(c => {
      const tok = Math.round((c.memory||'').length * CONFIG.MEMORY_CHAR_TO_TOKEN);
      let w = ''; if (tok >= CONFIG.MEMORY_COMPRESS_THRESHOLD) w = ' 🔴'; else if (tok >= CONFIG.MEMORY_COMPRESS_THRESHOLD * 0.8) w = ' ⚡';
      return `<div class="character-card" data-id="${c.id}"><div class="character-card-header"><div><div class="character-card-name">${c.name}${w}</div><div class="character-card-role">${c.role||''}</div></div><span class="character-card-arrow">›</span></div></div>`;
    }).join('');
    this.els.charactersList.querySelectorAll('.character-card').forEach(c => c.onclick = () => this.editChar(c.dataset.id));
  },

  editChar(id) {
    const e = this.els; this.editDataUrl = '';
    this._popNpcModels(e.editNpcModel, '');
    if (id) {
      const c = Store.findCharacterById(id); if (!c) return;
      e.editTitle.textContent = '编辑角色卡'; e.editId.value = c.id;
      e.editName.value = c.name; e.editRole.value = c.role; e.editPersonality.value = c.personality;
      e.editRelation.value = c.relation||''; e.editMemory.value = c.memory||'';
      this.editDataUrl = c.avatar||'';
      e.btnDeleteCharacter.classList.remove('hidden');
      this._popNpcModels(e.editNpcModel, c.npcModelId||'');
    } else {
      e.editTitle.textContent = '新建角色卡'; e.editId.value = '';
      e.editName.value = e.editRole.value = e.editPersonality.value = e.editRelation.value = e.editMemory.value = '';
      e.btnDeleteCharacter.classList.add('hidden');
    }
    this._renderAvatar(e.editAvatarPreview, this.editDataUrl);
    this.updateMemStats();
    e.editOverlay.classList.remove('hidden');
  },

  _popNpcModels(sel, cur) {
    sel.innerHTML = '<option value="">跟随全局</option>';
    for (const p of Store.getProviders()) for (const m of (p.models||[]))
      sel.innerHTML += `<option value="${p.id}:${m}">${p.name} / ${m}</option>`;
    sel.value = cur;
  },

  closeCharEdit() { this.els.editOverlay.classList.add('hidden'); },
  updateMemStats() {
    const t = this.els.editMemory.value||''; const tok = Math.round(t.length * CONFIG.MEMORY_CHAR_TO_TOKEN);
    this.els.memoryStats.textContent = `${tok.toLocaleString()} tokens · ${t.length.toLocaleString()} 字符`;
  },

  saveChar() {
    const e = this.els;
    const id = e.editId.value, name = e.editName.value.trim(), role = e.editRole.value.trim();
    const per = e.editPersonality.value.trim(), rel = e.editRelation.value.trim();
    const mem = e.editMemory.value.trim(), av = this.editDataUrl, nm = e.editNpcModel.value;
    if (!name) { alert('填姓名'); return; }
    if (id) Store.updateCharacter(id, name, role, per, rel, mem, av, nm);
    else Store.addCharacter(name, role, per, rel, av, mem, nm);
    this.closeCharEdit(); this.renderCharList(); this._updateNpcCount();
  },

  delChar() {
    const id = this.els.editId.value; if (!id || !confirm('确定删除？')) return;
    Store.deleteCharacter(id); this.closeCharEdit(); this.renderCharList(); this._updateNpcCount();
  },

  /* ==================== 图片 ==================== */
  onAvatar(e, type) {
    const f = e.target.files[0]; if (!f || !f.type.startsWith('image/')) return;
    if (f.size > 2*1024*1024) { alert('头像不超过2MB'); return; }
    const r = new FileReader();
    r.onload = () => {
      if (type === 'p') { this.protagonistDataUrl = r.result; this._renderAvatar(this.els.protagonistAvatarPreview, r.result); }
      else { this.editDataUrl = r.result; this._renderAvatar(this.els.editAvatarPreview, r.result); }
    };
    r.readAsDataURL(f);
  },

  _renderAvatar(el, url) {
    el.innerHTML = url ? `<img src="${url}" alt="">` : '';
    el.classList.toggle('has-image', !!url);
  },

  onImage(e) {
    const f = e.target.files[0]; if (!f) return;
    if (!f.type.startsWith('image/')) { alert('请选图片'); return; }
    if (f.size > 10*1024*1024) { alert('不超过10MB'); return; }
    this.selectedImage = f;
    this.els.btnImage.style.color = 'var(--accent)';
    this.els.userInput.placeholder = '描述图片（可选），然后发送';
    this.els.userInput.focus();
  },

  clearImage() {
    this.selectedImage = null; this.els.imageInput.value = '';
    this.els.btnImage.style.color = ''; this.els.userInput.placeholder = '描述你的行动……';
  },
};
