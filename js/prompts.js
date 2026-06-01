/* ========================================
   Prompt 构建器
   ======================================== */
const Prompts = {
  _guide(lv) {
    if (lv <= 3) return '可适度偏离设定，让故事自然流动。';
    if (lv <= 5) return '叙事中自然融入设定，可引入合理即兴元素。';
    if (lv <= 8) return '叙事须与设定紧密相连，每次回应至少呼应一个已有设定。';
    return '设定是不可违背的铁律。';
  },

  director(worldSetting, characters, userAction, history, att) {
    const chars = characters.map(c => `${c.name}（${c.role}）| ${(c.personality||'').slice(0,80)}`).join('\n');
    const recent = history.slice(-30);
    let hist = recent.map(h => `[${h.role}] ${h.content}`).join('\n');
    if (hist.length > 2000000) hist = recent.slice(-15).map(h => `[${h.role}] ${(h.content||'').slice(0,200)}`).join('\n');
    return `你是舞台剧导演。

【设定遵循度：${att}/10】${this._guide(att)}
【世界观】${worldSetting || '通用'}
【角色】\n${chars}
【近期剧情】\n${hist || '（刚开始）'}
【主角动作】\n${userAction}

输出严格JSON（不要markdown，不要额外文字）：
{"scene":"用2-3句话描述当前场景的环境、氛围、光线、声音。这是用户唯一会看到的环境描写，要完整。","acts":[{"npc":"角色名","direction":"2-3句表演指导"}]}
只安排被主角直接影响的角色，最多3幕。`;
  },

  npc(npc, sceneCtx, att) {
    return `你就是${npc.name}本人。

【角色】姓名：${npc.name} / 身份：${npc.role}
性格：${npc.personality}${npc.relation ? ' / 关系：'+npc.relation : ''}
【记忆】${npc.memory || '无'}
【设定遵循度：${att}/10】${this._guide(att)}

【当前场景】\n${sceneCtx}

规则：
1. 只输出你的对话、动作、表情。不描述主角。
2. 未被互动可沉默。不啰嗦。不加"XXX说："标签。`;
  },

  memoryExtract(characters, narrative, userAction) {
    const cl = characters.map(c => `${c.name}（${c.role}）记忆：${c.memory||'无'}`).join('\n');
    return `你是角色记忆管理助手。
【角色】\n${cl}
【主角行动】${userAction}
【场景】${narrative}
输出JSON：{"memoryUpdates":[{"name":"角色名","newInfo":"新信息"}],"newCharacters":[{"name":"名","role":"身份","personality":"性格","relation":"关系"}]}
新角色只提取有名有姓的。`;
  },

  memoryCompress(npc) {
    return `压缩以下角色记忆到30%，保留关键事件和关系变化。
角色：${npc.name}（${npc.role}）
记忆：${npc.memory}
直接输出压缩后文本。`;
  },
};
