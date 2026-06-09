/* ═══════════════════════════════════════════════
   ui.js — UI Components & Event Wiring
   ═══════════════════════════════════════════════ */

const UI = (() => {
  let toastTimeout = null;

  /* ---- Toast ---- */
  function toast(msg) {
    const container = document.getElementById('toastContainer');
    const el = document.createElement('div');
    el.className = 'toast';
    el.textContent = msg;
    container.appendChild(el);
    clearTimeout(toastTimeout);
    setTimeout(() => { if (el.parentNode) el.remove(); }, 2500);
  }

  /* ---- Palette ---- */
  const DEFAULT_PALETTE = [
    '#1a1a1a', '#ffffff', '#ef4444', '#f97316',
    '#eab308', '#22c55e', '#06b6d4', '#3b82f6',
    '#8b5cf6', '#ec4899', '#be123c', '#7c2d12',
    '#713f12', '#166534', '#164e63', '#1e3a5f',
  ];

  let paletteSwatches = [];

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
    paletteSwatches.forEach(s => {
      s.classList.toggle('active', s.dataset.color === color);
    });
  }

  /* ---- Mode switch ---- */
  function initModeSwitch(onSwitch) {
    const btns = document.querySelectorAll('.mode-btn');
    btns.forEach(btn => {
      btn.addEventListener('click', () => {
        btns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        onSwitch(btn.dataset.mode);
      });
    });
  }

  /* ---- Tool buttons ---- */
  function initTools(onToolChange) {
    const btns = document.querySelectorAll('[data-tool]');
    btns.forEach(btn => {
      btn.addEventListener('click', () => {
        btns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        onToolChange(btn.dataset.tool);
      });
    });
  }

  function setToolActive(tool) {
    document.querySelectorAll('[data-tool]').forEach(b => b.classList.toggle('active', b.dataset.tool === tool));
  }

  /* ---- Image upload (pixelize mode) ---- */
  function initImageUpload(onFile) {
    const uploadBtn = document.getElementById('uploadBtn');
    const input = document.getElementById('imageUpload');
    uploadBtn.addEventListener('click', () => input.click());
    input.addEventListener('change', (e) => {
      if (e.target.files.length > 0) onFile(e.target.files[0]);
    });
  }

  return {
    toast,
    renderPalette, updatePaletteActive,
    initModeSwitch, initTools, setToolActive,
    initImageUpload,
  };
})();
