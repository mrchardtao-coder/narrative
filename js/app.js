/* ========================================
   入口 — 带错误诊断
   ======================================== */
document.addEventListener('DOMContentLoaded', () => {
  try {
    UI.cache();
    UI.bindAll();
    UI.initTheme();
    Engine.ensureWorld();
    UI.loadWorldState();
    Engine.regSW();
  } catch (e) {
    document.body.innerHTML = `<div style="padding:20px;color:red;font-family:monospace"><h3>初始化失败</h3><pre>${e.message}\n${e.stack||''}</pre><h4>localStorage 诊断</h4><pre>narrative_data: ${localStorage.getItem('narrative_data')||'空'}\nnarrative_config: ${localStorage.getItem('narrative_config')||'空'}\nnarrative_ds_key: ${localStorage.getItem('narrative_ds_key')||'空'}\nnarrative_worlds: ${localStorage.getItem('narrative_worlds')||'空'}</pre></div>`;
  }
});
