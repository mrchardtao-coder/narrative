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
    const chars = characters.map(c => c.name + '（' + c.role + '）| ' + (c.personality||'').slice(0,80)).join('\n');
    const recent = history.slice(-30);
    let hist = recent.map(h => '[' + h.role + '] ' + h.content).join('\n');
    if (hist.length > 2000000) hist = recent.slice(-15).map(h => '[' + h.role + '] ' + (h.content||'').slice(0,200)).join('\n');
    return '你是舞台剧导演。\n\n【设定遵循度：' + att + '/10】' + this._guide(att) + '\n【世界观】' + (worldSetting || '通用') + '\n【角色】\n' + chars + '\n【近期剧情】\n' + (hist || '（刚开始）') + '\n【主角动作】\n' + userAction + '\n\n输出严格JSON（不要markdown，不要额外文字）：\n{"scene":"用2-3句话描述当前场景的环境、氛围、光线、声音。这是用户唯一会看到的环境描写，要完整。","acts":[{"npc":"角色名","direction":"2-3句表演指导"}]}\n只安排被主角的动作、话语、情绪直接影响到的角色。主角的表情变化、情绪流露也算影响。最多3幕。';
  },

  /** NPC 群演：一次调用输出所有在场 NPC */
  groupNpc(actNpcs, chars, scene, userAction, att) {
    const cards = actNpcs.map(act => {
      const c = chars.find(x => x.name === act.npc);
      if (!c) return '';
      return '【' + c.name + '】\n身份：' + c.role + '\n性格：' + (c.personality||'').slice(0,200) + '\n记忆：' + (c.memory||'无') + '\n导演指导：' + act.direction;
    }).join('\n\n');
    return '你同时扮演以下所有角色。每个角色独立回应。\n\n【场景】' + scene + '\n【主角刚刚做了什么】' + userAction + '\n【设定遵循度：' + att + '/10】' + this._guide(att) + '\n\n' + cards + '\n\n按以下格式输出（每个角色一段）：\n[角色名]\n（角色的对话、动作、表情）\n\n规则：\n1. 每个角色只输出自己的内容，不描述主角。\n2. 按出场顺序回应，后面的角色可回应前面角色的发言。\n3. 未被互动的角色输出"（沉默）"或简短回应。\n4. 不要写旁白、环境描写。';
  },

  memoryExtract(characters, narrative, userAction) {
    const cl = characters.map(c => c.name + '（' + c.role + '）记忆：' + (c.memory||'无')).join('\n');
    return '你是角色记忆管理助手。\n【角色】\n' + cl + '\n【主角行动】' + userAction + '\n【场景】' + narrative + '\n输出JSON：{"memoryUpdates":[{"name":"角色名","newInfo":"新信息"}],"newCharacters":[{"name":"名","role":"身份","personality":"性格","relation":"关系"}]}\n新角色只提取有名有姓的。';
  },

  memoryCompress(npc) {
    return '压缩以下角色记忆到30%，保留关键事件和关系变化。\n角色：' + npc.name + '（' + npc.role + '）\n记忆：' + npc.memory + '\n直接输出压缩后文本。';
  },
};
