/* ═══════════════════════════════════════════════
   canvas-engine.js — Pixel Grid State & Rendering
   ═══════════════════════════════════════════════ */

const Engine = (() => {
  let canvas, ctx;
  let grid = [];
  let width = 32, height = 32;
  let zoom = 800;
  let gridVisible = true;
  let dirty = true;
  const STORAGE_KEY = 'pixelstudio_autosave';

  /* ---- Init / Resize ---- */
  function init(canvasEl) {
    canvas = canvasEl;
    ctx = canvas.getContext('2d');
    // Try auto-save restore
    if (!tryAutoload()) resize(width, height);
  }

  function resize(w, h) {
    width = Math.max(8, Math.min(256, w));
    height = Math.max(8, Math.min(256, h));
    const old = grid;
    grid = [];
    for (let y = 0; y < height; y++) {
      grid[y] = [];
      for (let x = 0; x < width; x++) {
        grid[y][x] = (old[y] && old[y][x]) ? old[y][x] : '#ffffff';
      }
    }
    updateCanvasSize();
    dirty = true;
    render();
  }

  function updateCanvasSize() {
    const px = Math.round(width * (zoom / 100));
    const py = Math.round(height * (zoom / 100));
    canvas.width = width;
    canvas.height = height;
    canvas.style.width = px + 'px';
    canvas.style.height = py + 'px';
  }

  /* ---- Zoom ---- */
  function setZoom(z) {
    zoom = Math.max(100, Math.min(3200, z));
    updateCanvasSize();
    dirty = true;
    render();
  }
  function getZoom() { return zoom; }
  function resetZoom() {
    const vp = document.getElementById('canvasViewport');
    const vw = vp.clientWidth - 80, vh = vp.clientHeight - 80;
    const zx = Math.floor((vw / width) * 100);
    const zy = Math.floor((vh / height) * 100);
    setZoom(Math.max(100, Math.min(3200, Math.min(zx, zy))));
    return zoom;
  }
  function zoomAtPoint(z, cx, cy) {
    const oldScale = zoom / 100;
    setZoom(z);
    const newScale = zoom / 100;
    const vp = document.getElementById('canvasViewport');
    vp.scrollLeft += (cx - vp.clientWidth / 2) * (newScale / oldScale - 1);
    vp.scrollTop += (cy - vp.clientHeight / 2) * (newScale / oldScale - 1);
  }

  /* ---- Grid Access ---- */
  function getGrid() { return grid; }
  function getWidth() { return width; }
  function getHeight() { return height; }
  function getPixel(x, y) {
    if (x < 0 || x >= width || y < 0 || y >= height) return null;
    return grid[y][x];
  }
  function setPixel(x, y, color) {
    if (x < 0 || x >= width || y < 0 || y >= height) return false;
    grid[y][x] = color;
    dirty = true;
    return true;
  }
  function fillAll(color) {
    for (let y = 0; y < height; y++)
      for (let x = 0; x < width; x++)
        grid[y][x] = color;
    dirty = true;
  }
  function getGridCopy() { return grid.map(row => [...row]); }

  function setGridFromCopy(data) {
    grid = data;
    width = grid[0].length;
    height = grid.length;
    updateCanvasSize();
    dirty = true;
    render();
  }

  /* ---- Auto-save ---- */
  function tryAutoload() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return false;
      const data = JSON.parse(raw);
      if (!data.grid || !data.grid.length) return false;
      width = data.grid[0].length;
      height = data.grid.length;
      grid = data.grid;
      updateCanvasSize();
      dirty = true;
      render();
      return true;
    } catch (e) { return false; }
  }

  function autosave() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ grid }));
    } catch (e) { /* storage full — ignore */ }
  }

  /* ---- Rendering ---- */
  function render() {
    if (!dirty) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        ctx.fillStyle = grid[y][x];
        ctx.fillRect(x, y, 1, 1);
      }
    }
    if (gridVisible && zoom >= 200) {
      const scale = zoom / 100;
      ctx.strokeStyle = 'rgba(0,0,0,0.07)';
      ctx.lineWidth = Math.max(0.5, 1 / scale);
      for (let x = 1; x < width; x++) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, height); ctx.stroke();
      }
      for (let y = 1; y < height; y++) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(width, y); ctx.stroke();
      }
    }
    dirty = false;
  }

  function markDirty() { dirty = true; }
  function toggleGrid() { gridVisible = !gridVisible; dirty = true; render(); return gridVisible; }

  /* ---- Coordinate helpers ---- */
  function canvasToPixel(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    const scale = zoom / 100;
    return {
      x: Math.max(0, Math.min(width - 1, Math.floor((clientX - rect.left) / scale))),
      y: Math.max(0, Math.min(height - 1, Math.floor((clientY - rect.top) / scale))),
    };
  }

  /* ---- Export ---- */
  function exportScaledPNG(s) {
    const scale = s || 1;
    const off = document.createElement('canvas');
    off.width = width * scale;
    off.height = height * scale;
    const octx = off.getContext('2d');
    octx.imageSmoothingEnabled = false;
    for (let y = 0; y < height; y++)
      for (let x = 0; x < width; x++) {
        octx.fillStyle = grid[y][x];
        octx.fillRect(x * scale, y * scale, scale, scale);
      }
    return off.toDataURL('image/png');
  }

  return {
    init, resize,
    getGrid, getWidth, getHeight, getPixel, setPixel, fillAll,
    getGridCopy, setGridFromCopy,
    setZoom, getZoom, resetZoom, zoomAtPoint,
    render, markDirty, toggleGrid,
    autosave,
    canvasToPixel,
    exportScaledPNG,
  };
})();
