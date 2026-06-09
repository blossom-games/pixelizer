/* ═══════════════════════════════════════════════
   canvas-engine.js — Pixel Grid State & Rendering
   ═══════════════════════════════════════════════ */

const Engine = (() => {
  let canvas, ctx;
  let grid = [];           // 2D array of hex colors
  let width = 32, height = 32;
  let zoom = 800;          // percent
  let gridVisible = true;
  let dirty = true;

  /* ---- Init / Resize ---- */
  function init(canvasEl) {
    canvas = canvasEl;
    ctx = canvas.getContext('2d');
    resize(width, height);
  }

  function resize(w, h) {
    width = Math.max(8, Math.min(256, w));
    height = Math.max(8, Math.min(256, h));
    // Rebuild grid preserving old data
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

  function resizeKeep(w, h, data) {
    width = w; height = h; grid = data;
    updateCanvasSize();
    dirty = true; render();
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

  function getGridCopy() {
    return grid.map(row => [...row]);
  }
  function setGridFromCopy(data) {
    grid = data;
    width = grid[0].length;
    height = grid.length;
    updateCanvasSize();
    dirty = true;
    render();
  }

  /* ---- Rendering ---- */
  function render() {
    if (!dirty) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw pixels
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        ctx.fillStyle = grid[y][x];
        ctx.fillRect(x, y, 1, 1);
      }
    }

    // Grid lines (when zoomed enough)
    if (gridVisible && zoom >= 400) {
      const scale = zoom / 100;
      ctx.strokeStyle = 'rgba(0,0,0,0.08)';
      ctx.lineWidth = 1 / scale;
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
    const gx = Math.floor((clientX - rect.left) / scale);
    const gy = Math.floor((clientY - rect.top) / scale);
    return { x: Math.max(0, Math.min(width - 1, gx)), y: Math.max(0, Math.min(height - 1, gy)) };
  }

  /* ---- Export ---- */
  function exportPNG() {
    const offscreen = document.createElement('canvas');
    offscreen.width = width;
    offscreen.height = height;
    const offCtx = offscreen.getContext('2d');
    for (let y = 0; y < height; y++)
      for (let x = 0; x < width; x++) {
        offCtx.fillStyle = grid[y][x];
        offCtx.fillRect(x, y, 1, 1);
      }
    return offscreen.toDataURL('image/png');
  }

  function exportScaledPNG(scale) {
    const s = scale || 1;
    const offscreen = document.createElement('canvas');
    offscreen.width = width * s;
    offscreen.height = height * s;
    const offCtx = offscreen.getContext('2d');
    offCtx.imageSmoothingEnabled = false;
    for (let y = 0; y < height; y++)
      for (let x = 0; x < width; x++) {
        offCtx.fillStyle = grid[y][x];
        offCtx.fillRect(x * s, y * s, s, s);
      }
    return offscreen.toDataURL('image/png');
  }

  return {
    init, resize, resizeKeep,
    getGrid, getWidth, getHeight, getPixel, setPixel, fillAll,
    getGridCopy, setGridFromCopy,
    setZoom, getZoom,
    render, markDirty, toggleGrid,
    canvasToPixel,
    exportPNG, exportScaledPNG,
  };
})();
