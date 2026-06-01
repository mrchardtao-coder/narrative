/* ========================================
   API 调用 — 多模型提供者
   ======================================== */

const API = {

  /**
   * 拉取模型列表
   */
  async fetchModels(endpoint, apiKey, authType) {
    const modelsUrl = endpoint.replace(/\/chat\/completions\/?$/, '/models')
                              .replace(/\/v1\/?$/, '/models');
    const headers = { 'Content-Type': 'application/json' };
    if (authType === 'api-key') headers['api-key'] = apiKey;
    else headers['Authorization'] = `Bearer ${apiKey}`;
    try {
      const res = await fetch(modelsUrl, { method: 'GET', headers, signal: AbortSignal.timeout(10000) });
      if (!res.ok) return [];
      const data = await res.json();
      const models = (data.data || []).map(m => m.id).filter(id => !id.includes('embedding') && !id.includes('rerank'));
      return models.length > 0 ? models : [];
    } catch (e) { return []; }
  },

  /**
   * 通用调用
   */
  async _call(params) {
    const { endpoint, apiKey, authType, model, messages, max_tokens, temperature, top_p, stream } = params;
    const headers = { 'Content-Type': 'application/json' };
    if (authType === 'api-key') headers['api-key'] = apiKey;
    else headers['Authorization'] = `Bearer ${apiKey}`;

    const body = {
      model, messages, max_tokens: max_tokens || 500, temperature: temperature ?? 0.85, top_p: top_p ?? 0.95,
      stream: stream || false,
    };

    const res = await fetch(endpoint, { method: 'POST', headers, body: JSON.stringify(body), signal: AbortSignal.timeout(30000) });
    if (!res.ok) {
      const err = await res.text().catch(() => '');
      throw new Error(`API ${res.status}: ${err.slice(0, 200)}`);
    }
    const data = await res.json();
    return data.choices[0].message.content.trim();
  },

  /**
   * 导演调用
   */
  async callDirector(cfg, worldSetting, characters, userAction, history, attentionLevel) {
    const msg = PromptBuilder.buildDirectorPrompt(worldSetting, characters, userAction, history, attentionLevel);
    const text = await this._call({
      ...cfg, model: cfg.model || 'deepseek-v4-flash',
      messages: [{ role: 'system', content: msg }],
      max_tokens: 400, temperature: 0.7,
    });
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('导演输出格式错误');
    return JSON.parse(jsonMatch[0]);
  },

  /**
   * 环境叙事
   */
  async narrateEnvironment(cfg, worldSetting, characterSetting, attentionLevel, history, userMessage, imageFile) {
    let enrichedText = userMessage;
    if (imageFile) {
      const visCfg = Store.resolveCallParams(Store.getModelAssignment('visionModel'));
      if (visCfg) {
        const desc = await this.describeImage(visCfg, imageFile, userMessage);
        enrichedText = userMessage ? `${userMessage}\n[图片描述：${desc}]` : `[图片描述：${desc}]`;
      }
    }
    const messages = PromptBuilder.buildEnvironmentMessages(worldSetting, characterSetting, attentionLevel, history, enrichedText);
    return this._call({ ...cfg, model: cfg.model, messages, max_tokens: 500, temperature: 0.85 });
  },

  /**
   * NPC 演绎
   */
  async narrateNpc(cfg, npc, sceneContext, attentionLevel) {
    const messages = PromptBuilder.buildNpcMessages(npc, sceneContext, attentionLevel);
    return this._call({ ...cfg, model: cfg.model, messages, max_tokens: 400, temperature: 0.9 });
  },

  /**
   * MIMO 识图
   */
  async describeImage(cfg, imageFile, userText) {
    const base64 = await this._fileToBase64(imageFile);
    const messages = [
      { role: 'user', content: [
        { type: 'text', text: `请描述这张图片。${userText ? '用户同时说了：' + userText : ''}` },
        { type: 'image_url', image_url: { url: `data:${imageFile.type};base64,${base64}` } },
      ]},
    ];
    return this._call({ ...cfg, model: cfg.model || 'mimo-v2.5-pro', messages, max_tokens: 300, temperature: 0.7 });
  },

  _fileToBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result.split(',')[1]);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  },

  /**
   * 记忆提取
   */
  async extractMemory(cfg, characters, lastNarrative, lastUserAction) {
    const msg = PromptBuilder.buildMemoryExtractionPrompt(characters, lastNarrative, lastUserAction);
    const text = await this._call({ ...cfg, model: cfg.model, messages: [{ role: 'system', content: msg }], max_tokens: 1000, temperature: 0.5 });
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return { memoryUpdates: [], newCharacters: [] };
    return JSON.parse(jsonMatch[0]);
  },

  /**
   * 记忆压缩
   */
  async compressMemory(cfg, npc) {
    const msg = PromptBuilder.buildMemoryCompressPrompt(npc);
    return this._call({ ...cfg, model: cfg.model, messages: [{ role: 'system', content: msg }], max_tokens: 800, temperature: 0.5 });
  },
};
