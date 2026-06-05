/* ========================================
   API 客户端 — 导演 + 群演 + 记忆
   ======================================== */
const API = {
  async _post(cfg, messages, opts) {
    opts = opts || {};
    const h = { 'Content-Type': 'application/json' };
    if (cfg.authType === 'api-key') h['api-key'] = cfg.apiKey;
    else h['Authorization'] = 'Bearer ' + cfg.apiKey;

    const body = { model: cfg.model, messages, max_tokens: opts.max_tokens || 500,
      temperature: opts.temperature ?? 0.85, top_p: opts.top_p ?? 0.95, stream: false };

    const res = await fetch(cfg.endpoint, { method: 'POST', headers: h,
      body: JSON.stringify(body), signal: AbortSignal.timeout(30000) });

    if (!res.ok) { const e = await res.text().catch(() => ''); throw new Error('API ' + res.status + ': ' + e.slice(0,150)); }
    const data = await res.json();
    return data.choices[0].message.content.trim();
  },

  /** 拉取模型列表 */
  async fetchModels(endpoint, apiKey, authType) {
    const u = endpoint.replace(/\/chat\/completions\/?$/, '/models').replace(/\/v1\/?$/, '/models');
    const h = { 'Content-Type': 'application/json' };
    if (authType === 'api-key') h['api-key'] = apiKey; else h['Authorization'] = 'Bearer ' + apiKey;
    try {
      const r = await fetch(u, { headers: h, signal: AbortSignal.timeout(10000) });
      if (!r.ok) return [];
      const d = await r.json();
      return (d.data || []).map(m => m.id).filter(id => !id.includes('embedding') && !id.includes('rerank'));
    } catch (e) { return []; }
  },

  /** 导演：分析场景，编排 NPC */
  async director(cfg, worldSetting, chars, userAction, history, att) {
    const msg = Prompts.director(worldSetting, chars, userAction, history, att);
    let text;
    try { text = await this._post(cfg, [{ role: 'system', content: msg }], { max_tokens: 500, temperature: 0.5 }); }
    catch (e) { throw e; }

    let clean = text.replace(/```json|```/g, '').trim();
    let m = clean.match(/\{[\s\S]*\}/);
    if (!m) {
      try {
        text = await this._post(cfg, [{ role: 'system', content: msg + '\n\n刚才不是纯JSON。重新输出，只要JSON。' }], { max_tokens: 500, temperature: 0.3 });
        clean = text.replace(/```json|```/g, '').trim();
        m = clean.match(/\{[\s\S]*\}/);
      } catch (e) {}
    }
    if (!m) throw new Error('导演JSON解析失败');
    return JSON.parse(m[0]);
  },

  /** 群演：一次调用输出所有 NPC */
  async groupNpc(cfg, actNpcs, chars, scene, userAction, att) {
    const msg = Prompts.groupNpc(actNpcs, chars, scene, userAction, att);
    const text = await this._post(cfg, [{ role: 'system', content: msg }], { max_tokens: 800, temperature: 0.9 });

    const results = [];
    const parts = text.split(/\n(?=\[)/);
    for (const part of parts) {
      const m = part.match(/^\[(.+?)\]\n?([\s\S]*)/);
      if (m) {
        const name = m[1].trim();
        const c = chars.find(x => x.name === name);
        results.push({ name, content: m[2].trim(), id: c ? c.id : '' });
      }
    }
    if (results.length === 0 && actNpcs.length > 0) {
      const c = chars.find(x => x.name === actNpcs[0].npc);
      results.push({ name: actNpcs[0].npc, content: text, id: c ? c.id : '' });
    }
    return results;
  },

  /** 识图 */
  async describe(cfg, file, userText) {
    const b64 = await new Promise((resolve, reject) => {
      const r = new FileReader(); r.onload = () => resolve(r.result.split(',')[1]); r.onerror = reject; r.readAsDataURL(file);
    });
    const msgs = [{ role: 'user', content: [{ type: 'text', text: '描述图片。' + (userText ? '用户说：' + userText : '') }, { type: 'image_url', image_url: { url: 'data:' + file.type + ';base64,' + b64 } }] }];
    return this._post(cfg, msgs, { max_tokens: 300, temperature: 0.7 });
  },

  /** 记忆提取 */
  async extractMemory(cfg, chars, narrative, userAction) {
    const msg = Prompts.memoryExtract(chars, narrative, userAction);
    const text = await this._post(cfg, [{ role: 'system', content: msg }], { max_tokens: 1000, temperature: 0.5 });
    const m = text.match(/\{[\s\S]*\}/);
    if (!m) return { memoryUpdates: [], newCharacters: [] };
    try { return JSON.parse(m[0]); } catch (e) { return { memoryUpdates: [], newCharacters: [] }; }
  },

  /** 记忆压缩 */
  async compressMemory(cfg, npc) {
    const msg = Prompts.memoryCompress(npc);
    return this._post(cfg, [{ role: 'system', content: msg }], { max_tokens: 800, temperature: 0.5 });
  },
};
