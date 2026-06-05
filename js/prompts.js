/* ========================================
   Prompt 构建器 — 导演记忆感知版
   ======================================== */
const Prompts = {
  _guide(lv) {
    if (lv <= 3) return '可适度偏离设定。';
    if (lv <= 5) return '自然融入设定，可引入合理即兴元素。';
    if (lv <= 8) return '严格遵循设定，每次回应呼应已有世界观。';
    return '设定是铁律，不可违背。';
  },

  /** 导演：分析场景，编排 NPC。现在能看到每个 NPC 的记忆，避免全知全能。 */
  director(worldSetting, characters, userAction, history, att) {
    const chars = characters.map(c => {
      const mem = c.memory ? ' | 已知：' + c.memory.slice(-300) : '';
      return c.name + '（' + c.role + '）' + mem + ' | 性格：' + (c.personality || '').slice(0,80);
    }).join('\n');

    const recent = history.slice(-30);
    let hist = recent.map(h => '[' + h.role + '] ' + h.content).join('\n');
    if (hist.length > 2000000) hist = recent.slice(-15).map(h => '[' + h.role + '] ' + (h.content || '').slice(0,200)).join('\n');

    return '你是舞台剧导演。你了解每个角色知道什么、不知道什么。不要安排角色对ta不知道的事情做出反应。\n\n'
      + '【设定遵循度：' + att + '/10】' + this._guide(att) + '\n'
      + '【世界观】' + (worldSetting || '通用') + '\n'
      + '【全部角色及其所知】\n' + chars + '\n'
      + '【近期剧情】\n' + (hist || '（刚开始）') + '\n'
      + '【主角刚做了什么】\n' + userAction + '\n\n'
      + '输出严格JSON（不要markdown，不要任何额外文字）：\n'
      + '{"scene":"2-3句话描述当前场景的环境、氛围。这是用户唯一会看到的环境描写。","acts":[{"npc":"角色名","direction":"2-3句表演指导——根据该角色已有的记忆和当前场景，ta此刻的状态、情绪、反应方向。只写ta该知道的事。"}]}\n'
      + '规则：\n'
      + '1. 只安排被主角直接影响的角色，最多3幕。情绪流露也算影响。\n'
      + '2. 每个角色的direction必须基于ta已有的记忆。一个角色不可能对ta不知道的事做出反应。\n'
      + '3. 如果有角色不在当前场景，不要安排ta出场。';
  },

  /** NPC 群演：一次调用输出所有在场 NPC */
  groupNpc(actNpcs, chars, scene, userAction, att) {
    const cards = actNpcs.map(act => {
      const c = chars.find(x => x.name === act.npc);
      if (!c) return '';
      return '【' + c.name + '】\n身份：' + c.role
        + '\n性格：' + (c.personality || '').slice(0,200)
        + '\n记忆（仅此而已）：' + (c.memory || '无')
        + '\n导演指导：' + act.direction;
    }).join('\n\n');

    return '你同时扮演以下所有角色。每个角色独立，只知道自己的记忆。\n\n'
      + '【场景】' + scene + '\n'
      + '【主角刚做了什么】' + userAction + '\n'
      + '【设定遵循度：' + att + '/10】' + this._guide(att) + '\n\n'
      + cards + '\n\n'
      + '按以下格式输出（每个角色一段）：\n[角色名]\n（角色的对话、动作、表情）\n\n'
      + '规则：\n'
      + '1. 每个角色只输出自己的对话、动作、表情。不描述主角。\n'
      + '2. 按出场顺序回应。后面的角色可以回应前面角色的发言。\n'
      + '3. 角色只能基于自己的记忆行动。不知道的事假装不知道。\n'
      + '4. 未被互动的角色可简略回应。\n'
      + '5. 不写旁白、环境描写。';
  },

  memoryExtract(characters, narrative, userAction) {
    const cl = characters.map(c => c.name + '（' + c.role + '）记忆：' + (c.memory || '无')).join('\n');
    return '你是记忆管理助手。\n【角色】\n' + cl + '\n【主角行动】' + userAction + '\n【场景】' + narrative
      + '\n输出JSON：{"memoryUpdates":[{"name":"角色名","newInfo":"新获得的信息"}],"newCharacters":[{"name":"名","role":"身份","personality":"性格","relation":"关系"}]}\n只提取在场角色亲身经历的信息。新角色只提取有名有姓的。';
  },

  memoryCompress(npc) {
    return '压缩角色记忆到30%，保留关键事件和关系。\n角色：' + npc.name + '（' + npc.role + '）\n记忆：' + npc.memory + '\n直接输出压缩后文本。';
  },
};
