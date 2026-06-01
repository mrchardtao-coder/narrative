/* ========================================
   API 调用与分流
   两层架构：
   1. 环境叙事（含图片分流）— 不涉及 NPC 细节
   2. NPC 独立演绎 — 每个 NPC 单独调用，完全隔离
   3. 记忆提取
   ======================================== */

const API = {

  /**
   * 第一层：环境叙事
   * 纯文本 → DeepSeek 环境叙事
   * 含图片 → MIMO 识图 → DeepSeek 环境叙事
   */
  async narrateEnvironment(apiKeys, worldSetting, characterSetting, attentionLevel, history, userText, imageFile) {
    let enrichedText = userText;

    if (imageFile) {
      const imageDesc = await API.describeImage(apiKeys, imageFile, userText);
      enrichedText = userText
        ? `[用户上传了一张图片，图片内容描述：${imageDesc}]\n\n${userText}`
        : `[用户上传了一张图片，图片内容描述：${imageDesc}]`;
    }

    const messages = PromptBuilder.buildEnvironmentMessages(
      worldSetting, characterSetting, attentionLevel, history, enrichedText
    );

    const response = await fetch(CONFIG.DEEPSEEK_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKeys.deepseekKey}` },
      body: JSON.stringify({
        model: apiKeys.narratorModel || 'deepseek-v4-flash',
        messages,
        max_tokens: 500,
        temperature: 0.85,
        top_p: 0.95,
        frequency_penalty: 0.3,
        presence_penalty: 0.3,
      }),
    });

    if (!response.ok) throw new Error(`DeepSeek 环境叙事错误 (${response.status})`);
    const data = await response.json();
    return data.choices?.[0]?.message?.content || '';
  },

  /**
   * 导演调用：分析场景，输出舞台剧本
   */
  async callDirector(apiKeys, worldSetting, characters, userAction) {
    const model = apiKeys.narratorModel || 'deepseek-v4-flash';
    const messages = [
      { role: 'system', content: PromptBuilder.buildDirectorPrompt(worldSetting, characters, userAction) },
    ];

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    try {
      const response = await fetch('https://api.deepseek.com/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKeys.deepseekKey}` },
        body: JSON.stringify({
          model,
          messages,
          max_tokens: 400,
          temperature: 0.7,
          top_p: 0.95,
          stream: false,
        }),
        signal: controller.signal,
      });

      if (!response.ok) throw new Error(`导演调用失败 ${response.status}`);
      const data = await response.json();
      const text = data.choices[0].message.content.trim();
      // 提取 JSON
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error('导演输出格式错误');
      return JSON.parse(jsonMatch[0]);
    } finally {
      clearTimeout(timeout);
    }
  },

  /**
   * 第二层：NPC 独立演绎
   * 每个 NPC 一次独立调用，只含该 NPC 自己的角色卡+记忆+场景
   * 返回 { name, content }
   */
  async narrateNpc(apiKeys, npc, sceneContext) {
    const messages = PromptBuilder.buildNpcMessages(npc, sceneContext);

    try {
      const response = await fetch(CONFIG.DEEPSEEK_API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKeys.deepseekKey}` },
        body: JSON.stringify({
          model: apiKeys.deepseekModel || 'deepseek-v4-pro',
          messages,
          max_tokens: 400,
          temperature: 0.9,
          top_p: 0.95,
          frequency_penalty: 0.3,
          presence_penalty: 0.3,
        }),
      });

      if (!response.ok) return { name: npc.name, content: '' };
      const data = await response.json();
      return { name: npc.name, content: data.choices?.[0]?.message?.content || '' };
    } catch (e) {
      console.warn(`NPC ${npc.name} 调用失败:`, e);
      return { name: npc.name, content: '' };
    }
  },

  /**
   * 记忆压缩
   */
  async compressMemory(apiKeys, npc) {
    const messages = [
      { role: 'system', content: PromptBuilder.buildMemoryCompressPrompt(npc) },
      { role: 'user', content: '请压缩上述记忆。' }
    ];

    const response = await fetch(CONFIG.DEEPSEEK_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKeys.deepseekKey}` },
      body: JSON.stringify({ model: apiKeys.deepseekModel || 'deepseek-v4-pro', messages, max_tokens: 4000, temperature: 0.3 }),
    });

    if (!response.ok) return npc.memory;
    const data = await response.json();
    return data.choices?.[0]?.message?.content || npc.memory;
  },

  /**
   * 记忆提取
   */
  async extractMemory(apiKeys, characters, lastNarrative, lastUserAction) {
    if (!characters || characters.length === 0) return { memoryUpdates: [], newCharacters: [] };

    const messages = [
      { role: 'system', content: PromptBuilder.buildMemoryExtractionPrompt(characters, lastNarrative, lastUserAction) },
      { role: 'user', content: '请分析并返回 JSON。' }
    ];

    try {
      const response = await fetch(CONFIG.DEEPSEEK_API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKeys.deepseekKey}` },
        body: JSON.stringify({ model: apiKeys.deepseekModel || 'deepseek-v4-pro', messages, max_tokens: 2000, temperature: 0.3 }),
      });

      if (!response.ok) return { memoryUpdates: [], newCharacters: [] };
      const data = await response.json();
      const content = data.choices?.[0]?.message?.content || '';
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) return { memoryUpdates: [], newCharacters: [] };
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        memoryUpdates: parsed.memoryUpdates || [],
        newCharacters: parsed.newCharacters || [],
      };
    } catch (e) {
      console.warn('记忆提取失败:', e);
      return { memoryUpdates: [], newCharacters: [] };
    }
  },

  /** MIMO 识图 */
  async describeImage(apiKeys, imageFile, contextText) {
    const base64 = await API.fileToBase64(imageFile);
    const mimeType = imageFile.type || 'image/jpeg';

    const response = await fetch(apiKeys.mimoEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'api-key': apiKeys.mimoKey },
      body: JSON.stringify({
        model: CONFIG.MIMO_MODEL,
        messages: [
          { role: 'system', content: '你是一个图像描述助手。详细描述图片中的场景、人物、物体、氛围、光线、颜色等视觉信息。用流畅中文叙述，注重细节但不过度解读。' },
          { role: 'user', content: [
            { type: 'image_url', image_url: { url: `data:${mimeType};base64,${base64}` } },
            { type: 'text', text: contextText ? `用户正在玩交互式叙事游戏。上下文：${contextText}` : '请描述这张图片。' }
          ]}
        ],
        max_tokens: 500, temperature: 0.7,
      }),
    });

    if (!response.ok) throw new Error(`MIMO API 错误 (${response.status})`);
    const data = await response.json();
    return data.choices?.[0]?.message?.content || '(图片描述失败)';
  },

  fileToBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result.split(',')[1]);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  },
};
