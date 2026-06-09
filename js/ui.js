/* ═══════════════════════════════════════════════
   ui.js — UI Components
   ═══════════════════════════════════════════════ */

const UI = (() => {
  const DEFAULT_PALETTE = [
    '#1a1a1a', '#ffffff', '#ef4444', '#f97316',
    '#eab308', '#22c55e', '#06b6d4', '#3b82f6',
    '#8b5cf6', '#ec4899', '#be123c', '#7c2d12',
    '#713f12', '#166534', '#164e63', '#1e3a5f',
  ];

  let paletteSwatches = [];
  let colorHistory = [];

  /* ---- Toast ---- */
  function toast(msg, dur) {
    const container = document.getElementById('toastContainer');
    const el = document.createElement('div');
    el.className = 'toast';
    el.textContent = msg;
    container.appendChild(el);
    setTimeout(() => { if (el.parentNode) el.remove(); }, dur || 2200);
  }

  /* ---- Palette ---- */
  function renderPalette(container, activeColor, onSelect) {
    container.innerHTML = '';
    paletteSwatches = DEFAULT_PALETTE.map(c => {
      const swatch = document.createElement('div');
      swatch.className = 'swatch' + (c === activeColor ? ' active' : '');
      swatch.style.background = c;
      swatch.dataset.color = c;
      swatch.addEventListener('click', () => onSelect(c));
      container.appendChild(swatch);
      return swatch;
    });
  }

  function updatePaletteActive(color) {
    paletteSwatches.forEach(s => s.classList.toggle('active', s.dataset.color === color));
  }

  function addColorToHistory(color) {
    colorHistory = colorHistory.filter(c => c !== color);
    colorHistory.unshift(color);
    if (colorHistory.length > 8) colorHistory.pop();
    renderColorHistory();
  }

  function renderColorHistory() {
    const el = document.getElementById('colorHistory');
    if (!el) return;
    el.innerHTML = '';
    colorHistory.forEach(c => {
      const swatch = document.createElement('div');
      swatch.className = 'swatch history-swatch';
      swatch.style.background = c;
      swatch.dataset.color = c;
      swatch.addEventListener('click', () => {
        const hex = document.getElementById('customColor');
        hex.value = c;
        hex.dispatchEvent(new Event('input'));
      });
      el.appendChild(swatch);
    });
  }

  /* ---- Shortcut hint ---- */
  function showShortcutHint(elem, hint) {
    const tip = document.createElement('span');
    tip.className = 'shortcut-hint';
    tip.textContent = hint;
    elem.appendChild(tip);
  }

  /* ---- Loading overlay ---- */
  function showLoading(msg) {
    let overlay = document.getElementById('loadingOverlay');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'loadingOverlay';
      overlay.innerHTML = '<div class="loading-spinner"></div><div class="loading-text"></div>';
      document.body.appendChild(overlay);
    }
    overlay.querySelector('.loading-text').textContent = msg || 'Processing...';
    overlay.classList.add('visible');
  }

  function hideLoading() {
    const overlay = document.getElementById('loadingOverlay');
    if (overlay) overlay.classList.remove('visible');
  }

  /* ---- Init tools ---- */
  function initModeSwitch(onSwitch) {
    document.querySelectorAll('.mode-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        onSwitch(btn.dataset.mode);
      });
    });
  }

  function initTools(onToolChange) {
    document.querySelectorAll('[data-tool]').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('[data-tool]').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        onToolChange(btn.dataset.tool);
      });
    });
  }

  function setToolActive(tool) {
    document.querySelectorAll('[data-tool]').forEach(b =>
      b.classList.toggle('active', b.dataset.tool === tool));
  }

  /* ---- Image upload ---- */
  function initImageUpload(onFile) {
    const uploadBtn = document.getElementById('uploadBtn');
    const input = document.getElementById('imageUpload');
    const area = document.getElementById('canvasViewport');

    uploadBtn.addEventListener('click', () => input.click());
    input.addEventListener('change', e => {
      if (e.target.files.length) onFile(e.target.files[0]);
    });

    // Drag-and-drop
    area.addEventListener('dragover', e => { e.preventDefault(); area.classList.add('drag-over'); });
    area.addEventListener('dragleave', () => area.classList.remove('drag-over'));
    area.addEventListener('drop', e => {
      e.preventDefault();
      area.classList.remove('drag-over');
      if (e.dataTransfer.files.length) onFile(e.dataTransfer.files[0]);
    });
  }

  return {
    toast,
    renderPalette, updatePaletteActive, addColorToHistory,
    showLoading, hideLoading,
    initModeSwitch, initTools, setToolActive,
    initImageUpload,
  };
})();
