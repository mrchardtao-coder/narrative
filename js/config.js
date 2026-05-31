/* ========================================
   配置常量
   ======================================== */

const CONFIG = {
  // DeepSeek
  DEEPSEEK_API: 'https://api.deepseek.com/v1/chat/completions',
  DEEPSEEK_MODEL: 'deepseek-v4-pro',

  // MIMO 默认端点
  MIMO_DEFAULT_ENDPOINT: 'https://api.xiaomimimo.com/v1/chat/completions',
  MIMO_MODEL: 'mimo-v2.5-pro',

  // 记忆压缩
  MEMORY_COMPRESS_THRESHOLD: 500000,
  MEMORY_CHAR_TO_TOKEN: 1.5,
  MAX_HISTORY_ENTRIES: 300,        // 历史记录上限（聊天气泡模式每轮多条）

  // 存储键名
  STORE_WORLDS: 'narrative_worlds',           // 所有世界 [{id,name,worldSetting,characterSetting,attention,characters,history}]
  STORE_CURRENT_WORLD: 'narrative_current_id', // 当前世界 ID
  STORE_DEEPSEEK_KEY: 'narrative_ds_key',
  STORE_MIMO_KEY: 'narrative_mimo_key',
  STORE_MIMO_ENDPOINT: 'narrative_mimo_endpoint',
  STORE_DEEPSEEK_MODEL: 'narrative_ds_model',
};
