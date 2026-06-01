/* ========================================
   System Prompt 构建器
   两层架构：环境叙事 + NPC 独立演绎
   ======================================== */

const PromptBuilder = {

  _attentionGuide(level) {
    if (level <= 3) return '可以适度偏离设定，让故事自然流动。但核心世界观不能违背。';
    if (level <= 5) return '叙事中自然融入世界观设定。可引入合理即兴元素。';
    if (level <= 8) return '叙事必须与世界观紧密相连。每次回应至少呼应一个已有的世界观要素。';
    return '世界观是你不可违背的铁律。每个回应必须展示设定对世界的深刻影响。';
  },

  /**
   * 第一层：环境叙事 Prompt
   * 不含 NPC 具体信息，AI 只负责描述环境、事件、氛围
   */
  buildEnvironmentPrompt(worldSetting, characterSetting, attentionLevel) {
    const guide = this._attentionGuide(attentionLevel || CONFIG.DEFAULT_ATTENTION);

    return `你是一个交互式叙事引擎。你只负责描述环境、氛围、事件推进。你不是任何 NPC，不替任何角色说话。

【世界观设定】
${worldSetting || '（未设定）'}

【主角设定】
${characterSetting || '（未设定）'}

【设定遵循度：${attentionLevel}/10】${guide}

【核心规则】
1. 简短。用 2-4 句话描述环境变化和事件推进。
2. 【禁止代替 NPC】不要描述任何 NPC 的对话、内心想法、情绪反应。你只能描述物理世界——光线、声音、物体、位置变化。NPC 的反应由独立引擎生成，你无权干涉。
3. 不要重复已经描述过的场景信息。
4. 叙事时使用第二人称「你」。
5. 每次只推进一小步剧情。`;
  },

  /**
   * 第二层：NPC 独立演绎 Prompt
   * 每个 NPC 独立调用，只含该 NPC 的角色卡 + 记忆 + 当前场景
   */
  buildNpcPrompt(npc, sceneContext) {
    return `你现在就是${npc.name}。你不是旁白，不是说书人，你就是${npc.name}本人。

【你是谁】
姓名：${npc.name}
身份：${npc.role}
性格：${npc.personality}${npc.relation ? '\n与主角的关系：' + npc.relation : ''}

【你已知的事】
${npc.memory || '（你目前还不知道任何特别的事）'}

【现在正在发生的事】
${sceneContext}

【输出规则——严格遵循】
1. 你只输出${npc.name}的对话、动作、表情、内心活动。不要描述主角在做什么——主角的行为由玩家决定。
2. 禁止写"你看到""你察觉""你发现"来描述主角。你不是在叙述故事，你是在扮演自己。
3. 正确的输出示例：
   - "她擦了擦吧台，淡淡扫了你一眼：'又来了。'"
   - "她从柱子后面探出半个脑袋，手里攥着一个油纸包，犹豫着要不要递给你。"
   - "她没有说话，只是静静站在回廊尽头，目光落在你身上。"
4. 错误的输出示例（不要这样写）：
   - "你站在槐树下，感受到清晨的凉意。" ← 这是旁白在描述主角
   - "你察觉到背后有一道目光。" ← 这是旁白在描述主角
5. 如果当前场景与你无关，或者主角没有直接与你互动，你可以保持沉默。沉默时输出空即可。
6. 如果你的性格沉默寡言，就不要长篇大论。
7. 直接输出内容，不要加"${npc.name}说："之类的标签。`;
  },

  /**
   * 记忆压缩 Prompt
   */
  buildMemoryCompressPrompt(npc) {
    return `你是一个记忆压缩助手。以下是一个角色经过长期剧情积累的全部记忆，已经非常冗长。请将其压缩为精简版本。

角色：${npc.name}（${npc.role}）

原始记忆：
${npc.memory}

压缩规则：
1. 保留所有关键事件、重要对话、角色关系变化。
2. 删除冗余描述、重复信息、无足轻重的细节。
3. 以时间顺序组织，用简洁但完整的语言复述。
4. 绝不编造原始记忆中不存在的信息。
5. 目标：压缩到原长度的 30% 左右，但信息不丢失。
6. 压缩后的记忆仍然是一个人可以阅读的自然语言文本，不是列表或要点。
7. 直接输出压缩后的记忆文本，不要加任何前缀说明。`;
  },

  /**
   * 记忆提取 Prompt
   */
  buildMemoryExtractionPrompt(characters, lastNarrative, lastUserAction) {
    const charList = characters.map(c =>
      `${c.name}（${c.role}）当前记忆：${c.memory || '无'}`
    ).join('\n');

    return `你是一个角色记忆管理助手。以下是交互式叙事游戏中的一段剧情。

【当前角色及其已有记忆】
${charList}

【用户（主角）的行动】
${lastUserAction}

【本段场景叙事】
${lastNarrative}

请分析这段剧情，判断每个角色是否获得了新的信息。只提取该角色在剧情中亲身经历、亲眼看到、亲耳听到的信息。

返回格式（JSON 对象）：
{
  "memoryUpdates": [
    {"name": "角色名", "newInfo": "在本段剧情中新获得的信息。"}
  ],
  "newCharacters": [
    {"name": "新角色名", "role": "从叙事中推断的身份/职业", "personality": "从叙事中推断的性格特征", "relation": "与主角的关系（如果有）"}
  ]
}

规则：
- 【记忆更新】只有当角色在本段剧情中明确在场时，才能记录新信息。如果角色不在场，即使其他角色谈论了他，也不要记录。
- 【新角色检测】如果本段叙事中出现了有名有姓的、不在上述角色列表中的新人物，在 newCharacters 中列出。从叙事文本中提取 TA 的身份和性格线索。如果叙事信息不足以判断，可以标注"未知"。
- 【新角色检测】只提取有明确姓名的新角色。路人甲、酒馆里的客人等无名角色不提取。
- 新信息要详细记录。保留完整的对话内容和观察到的事件细节，不要概括压缩。
- 只提取本段剧情中「新增」的信息，不要重复角色已有记忆中的旧内容。
- 每条记录的长度由信息量决定，该详细就详细。
- 如果本段没有记忆更新，memoryUpdates 为空数组 []。如果没有新角色，newCharacters 为空数组 []。`;
  },

  /**
   * 构建环境叙事 messages
   */
  buildEnvironmentMessages(worldSetting, characterSetting, attentionLevel, history, userMessage) {
    return [
      { role: 'system', content: this.buildEnvironmentPrompt(worldSetting, characterSetting, attentionLevel) },
      ...history,
      { role: 'user', content: userMessage },
    ];
  },

  /**
   * 构建 NPC 独立调用 messages
   */
  buildNpcMessages(npc, sceneContext) {
    return [
      { role: 'system', content: this.buildNpcPrompt(npc, sceneContext) },
      { role: 'user', content: '（根据当前场景，以你扮演的角色的身份做出反应。如果场景中没有与你直接相关的事，可以保持沉默或只做一个简短的在位描述。）' },
    ];
  },
};
