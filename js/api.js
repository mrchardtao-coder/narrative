/* ========================================
   API 客户端 — 统一调用入口
   ======================================== */
const API = {
  /** 通用 HTTP */
  async _post(cfg, messages, opts = {}) {
    const { endpoint, apiKey, authType, model } = cfg;
    const h = { 'Content-Type': 'application/json' };
    if (authType === 'api-key') h['api-key'] = apiKey;
    else h['Authorization'] = `Bearer ${apiKey}`;

    const body = { model, messages, max_tokens: opts.max_tokens || 500, temperature: opts.temperature ?? 0.85, top_p: opts.top_p ?? 0.95, stream: false };
    const res = await fetch(endpoint, { method: 'POST', headers: h, body: JSON.stringify(body), signal: AbortSignal.timeout(30000) });
    if (!res.ok) { const e = await res.text().catch(()=>''); throw new Error(`API ${res.status}: ${e.slice(0,150)}`); }
    const data = await res.json();
    return data.choices[0].message.content.trim();
  },

  /** 拉取模型列表 */
  async fetchModels(endpoint, apiKey, authType) {
    const u = endpoint.replace(/\/chat\/completions\/?$/, '/models').replace(/\/v1\/?$/, '/models');
    const h = { 'Content-Type': 'application/json' };
    if (authType === 'api-key') h['api-key'] = apiKey; else h['Authorization'] = `Bearer ${apiKey}`;
    try {
      const r = await fetch(u, { headers: h, signal: AbortSignal.timeout(10000) });
      if (!r.ok) return [];
      const d = await r.json();
      return (d.data||[]).map(m=>m.id).filter(id=>!id.includes('embedding')&&!id.includes('rerank'));
    } catch(e) { return []; }
  },

  /** 导演 */
  async director(cfg, worldSetting, chars, userAction, history, att) {
    const msg = Prompts.director(worldSetting, chars, userAction, history, att);
    const text = await this._post(cfg, [{ role: 'system', content: msg }], { max_tokens: 400, temperature: 0.7 });
    const m = text.match(/\{[\s\S]*\}/); if (!m) throw new Error('导演JSON格式错误');
    return JSON.parse(m[0]);
  },

  /** 旁白 */
  async narrator(cfg, worldSetting, charSetting, att, history, userMsg, imageFile) {
    let txt = userMsg;
    if (imageFile) {
      const visCfg = Store.resolveCallParams(Store.getModelAssignment('visionModel'));
      if (visCfg) txt = userMsg + '\n[图片：' + await this.describe(visCfg, imageFile, userMsg) + ']';
    }
    const sys = { role: 'system', content: Prompts.narrator(worldSetting, charSetting, att) };
    return this._post(cfg, [sys, ...history, { role: 'user', content: txt }], { max_tokens: 500 });
  },

  /** NPC */
  async npc(cfg, npc, sceneCtx, att) {
    const sys = { role: 'system', content: Prompts.npc(npc, sceneCtx, att) };
    const txt = await this._post(cfg, [sys, { role: 'user', content: '根据场景做出反应。可沉默。' }], { max_tokens: 400, temperature: 0.9 });
    return txt;
  },

  /** 识图 */
  async describe(cfg, file, userText) {
    const b64 = await new Promise((resolve, reject) => {
      const r = new FileReader(); r.onload = () => resolve(r.result.split(',')[1]); r.onerror = reject; r.readAsDataURL(file);
    });
    const msgs = [{ role: 'user', content: [{ type: 'text', text: `描述图片。${userText?'用户同时说：'+userText:''}` }, { type: 'image_url', image_url: { url: `data:${file.type};base64,${b64}` } }] }];
    return this._post(cfg, msgs, { max_tokens: 300, temperature: 0.7 });
  },

  /** 记忆提取 */
  async extractMemory(cfg, chars, narrative, userAction) {
    const msg = Prompts.memoryExtract(chars, narrative, userAction);
    const text = await this._post(cfg, [{ role: 'system', content: msg }], { max_tokens: 1000, temperature: 0.5 });
    const m = text.match(/\{[\s\S]*\}/); if (!m) return { memoryUpdates:[], newCharacters:[] };
    try { return JSON.parse(m[0]); } catch(e) { return { memoryUpdates:[], newCharacters:[] }; }
  },

  /** 记忆压缩 */
  async compressMemory(cfg, npc) {
    const msg = Prompts.memoryCompress(npc);
    return this._post(cfg, [{ role: 'system', content: msg }], { max_tokens: 800, temperature: 0.5 });
  },
};
