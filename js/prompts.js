/* ========================================
   Prompt 构建器
   设定遵循度对导演/NPC/旁白统一生效
   ======================================== */
const Prompts = {
  _guide(lv) {
    if (lv <= 3) return '可适度偏离设定，让故事自然流动。';
    if (lv <= 5) return '叙事中自然融入设定，可引入合理即兴元素。';
    if (lv <= 8) return '叙事须与设定紧密相连，每次回应至少呼应一个已有设定。';
    return '设定是不可违背的铁律，每个回应必须展示设定对世界的深刻影响。';
  },

  /** 导演：分析场景，编排 NPC */
  director(worldSetting, characters, userAction, history, att) {
    const chars = characters.map(c => `${c.name}（${c.role}）| 性格：${(c.personality||'').slice(0,80)}`).join('\n');
    const recent = history.slice(-30);
    let hist = recent.map(h => `[${h.role}] ${h.content}`).join('\n');
    // 超 500K 字符压缩
    if (hist.length > 2000000) {
      hist = recent.slice(-15).map(h => `[${h.role}] ${(h.content||'').slice(0,200)}`).join('\n');
    }
    return `你是舞台剧导演。编排接下来的场景。

【设定遵循度：${att}/10】${this._guide(att)}

【世界观】${worldSetting || '通用'}
【角色】
${chars}
【近期剧情】
${hist || '（刚开始）'}
【主角动作】
${userAction}

输出严格JSON（不要markdown代码块，不要任何额外文字）：
{"scene":"场景一句话","acts":[{"npc":"角色名","direction":"2-3句表演指导"}]}
规则：只安排被主角直接影响的角色，最多3幕。`;
  },

  /** 旁白：收尾描述 */
  narrator(worldSetting, charSetting, att) {
    return `你是环境叙述者。只描述物理世界。

【设定遵循度：${att}/10】${this._guide(att)}

【世界观】${worldSetting||'未设定'}
【主角】${charSetting||'未设定'}

规则：
1. 只许写2-3句话。纯环境描写。多一句扣分。
2. 你不许写任何人的动作、对话、表情、心理、情绪。你是摄像机，不是编剧。
3. 你收到的"已知NPC已作出反应"里已经有了NPC说的话和做的事。你不许重复、补充、改写它们。
4. 正确输出："竹叶在风中沙沙作响。远处传来晚钟的回音。"
5. 错误输出："她看着他，眼神温柔" ← 这是编剧在写角色，不是摄像机。
6. 人称只用"你"。`;
  },

  /** NPC 演绎 */
  npc(npc, sceneCtx, att) {
    return `你就是${npc.name}本人。

【角色】姓名：${npc.name} / 身份：${npc.role}
性格：${npc.personality}${npc.relation ? ' / 与主角关系：'+npc.relation : ''}
【记忆】${npc.memory || '无'}
【设定遵循度：${att}/10】${this._guide(att)}

【当前场景】
${sceneCtx}

规则：
1. 只输出你的对话、动作、表情。不描述主角。
2. 禁止"你看到""你察觉"来描述主角。
3. 正确示例："（擦了擦吧台，扫了陶沫一眼）又来了。"
4. 未被互动可沉默。不啰嗦。不加"XXX说："标签。`;
  },

  /** 记忆提取 */
  memoryExtract(characters, narrative, userAction) {
    const cl = characters.map(c => `${c.name}（${c.role}）记忆：${c.memory||'无'}`).join('\n');
    return `你是角色记忆管理助手。

【角色及记忆】
${cl}
【主角行动】${userAction}
【场景叙事】${narrative}

分析剧情，提取每个在场角色新获得的信息。只提取该角色亲身经历的信息。

输出JSON：
{"memoryUpdates":[{"name":"角色名","newInfo":"新获得的信息"}],"newCharacters":[{"name":"名","role":"身份","personality":"性格","relation":"关系"}]}
新角色只提取有名有姓的。无更新则空数组。`;
  },

  /** 记忆压缩 */
  memoryCompress(npc) {
    return `压缩以下角色记忆到30%，保留关键事件和关系变化，删冗余。

角色：${npc.name}（${npc.role}）
记忆：${npc.memory}
直接输出压缩后文本。`;
  },
};
