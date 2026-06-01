/* ========================================
   入口
   ======================================== */
document.addEventListener('DOMContentLoaded', () => {
  UI.cache();
  UI.bindAll();
  UI.initTheme();
  Engine.ensureWorld();
  UI.loadWorldState();
  Engine.regSW();
});
