/* ═══════════════════════════════════════════════
   app.js — Application Orchestration
   ═══════════════════════════════════════════════ */

(function () {
  'use strict';

  let currentMode = 'draw';
  let isDrawing = false;
  let undoStack = [];
  let redoStack = [];
  let pixelizedResult = null;

  /* ---- Init ---- */
  function init() {
    Engine.init(document.getElementById('pixelCanvas'));

    // Build palette
    const paletteContainer = document.getElementById('palette');
    UI.renderPalette(paletteContainer, Tools.getColor(), selectColor);

    // Wire up UI
    UI.initModeSwitch(switchMode);
    UI.initTools(switchTool);
    UI.initImageUpload(handleImageUpload);

    // Canvas events
    const canvas = document.getElementById('pixelCanvas');
    canvas.addEventListener('mousedown', onMouseDown);
    canvas.addEventListener('mousemove', onMouseMove);
    canvas.addEventListener('mouseup', onMouseUp);
    canvas.addEventListener('mouseleave', onMouseUp);
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());

    // Touch
    canvas.addEventListener('touchstart', onTouchStart, { passive: false });
    canvas.addEventListener('touchmove', onTouchMove, { passive: false });
    canvas.addEventListener('touchend', onTouchEnd, { passive: false });

    // Color picker
    document.getElementById('customColor').addEventListener('input', (e) => {
      selectColor(e.target.value);
    });
    document.getElementById('colorHex').addEventListener('input', (e) => {
      const v = e.target.value.trim();
      if (/^#[0-9a-f]{6}$/i.test(v)) selectColor(v);
    });

    // Undo / Redo
    document.getElementById('undoBtn').addEventListener('click', undo);
    document.getElementById('redoBtn').addEventListener('click', redo);

    // Canvas size
    document.getElementById('resizeCanvas').addEventListener('click', () => {
      const w = parseInt(document.getElementById('canvasW').value) || 32;
      const h = parseInt(document.getElementById('canvasH').value) || 32;
      saveUndo();
      Engine.resize(w, h);
      updateInfo();
      UI.toast(`Canvas: ${w} x ${h}`);
    });

    // Clear
    document.getElementById('clearCanvas').addEventListener('click', () => {
      saveUndo();
      Engine.fillAll('#ffffff');
      Engine.render();
      UI.toast('Canvas cleared');
    });

    // Grid toggle
    document.getElementById('gridToggle').addEventListener('click', function () {
      const on = Engine.toggleGrid();
      this.classList.toggle('active', on);
    });

    // Zoom
    const zoomSlider = document.getElementById('zoomSlider');
    zoomSlider.addEventListener('input', () => {
      Engine.setZoom(parseInt(zoomSlider.value));
      updateInfo();
    });
    document.getElementById('zoomIn').addEventListener('click', () => {
      zoomSlider.value = Math.min(3200, parseInt(zoomSlider.value) + 100);
      Engine.setZoom(parseInt(zoomSlider.value));
      updateInfo();
    });
    document.getElementById('zoomOut').addEventListener('click', () => {
      zoomSlider.value = Math.max(100, parseInt(zoomSlider.value) - 100);
      Engine.setZoom(parseInt(zoomSlider.value));
      updateInfo();
    });

    // Fullscreen
    document.getElementById('fullscreenBtn').addEventListener('click', () => {
      if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(() => {});
      } else {
        document.exitFullscreen().catch(() => {});
      }
    });

    // Pixelize controls
    document.getElementById('blockSize').addEventListener('input', (e) => {
      document.getElementById('blockSizeDisplay').textContent = e.target.value;
    });
    document.getElementById('paletteColors').addEventListener('input', (e) => {
      document.getElementById('paletteDisplay').textContent = e.target.value;
    });
    document.getElementById('applyPixelize').addEventListener('click', applyPixelize);
    document.getElementById('exportPixelizeBtn').addEventListener('click', exportPixelized);

    // Keyboard shortcuts
    document.addEventListener('keydown', onKeyDown);

    // Initial render
    Engine.fillAll('#ffffff');
    Engine.render();
    updateInfo();
  }

  /* ---- Mode switching ---- */
  function switchMode(mode) {
    currentMode = mode;
    document.getElementById('drawTools').classList.toggle('hidden', mode !== 'draw');
    document.getElementById('pixelizeTools').classList.toggle('hidden', mode !== 'pixelize');
    document.getElementById('drawControls').classList.toggle('hidden', mode !== 'draw');
    document.getElementById('pixelizeControls').classList.toggle('hidden', mode !== 'pixelize');
    document.getElementById('canvasSizeSection').style.display = (mode !== 'draw') ? 'none' : '';

    if (mode === 'pixelize') {
      if (pixelizedResult) showPixelizedPreview();
    } else if (mode === 'draw') {
      // Restore the draw canvas dimensions
      const canvas = document.getElementById('pixelCanvas');
      const w = Engine.getWidth(), h = Engine.getHeight();
      const zoom = Engine.getZoom();
      canvas.width = w; canvas.height = h;
      canvas.style.width = (w * zoom / 100) + 'px';
      canvas.style.height = (h * zoom / 100) + 'px';
      Engine.render();
    }
  }

  /* ---- Tool switching ---- */
  function switchTool(tool) {
    Tools.setTool(tool);
    document.getElementById('toolDisplay').textContent = tool.charAt(0).toUpperCase() + tool.slice(1);

    // Toggle symmetry modes
    if (tool === 'symmetry-v') {
      Tools.setSymmetryV(!Tools.getSymmetryV());
      UI.toast(Tools.getSymmetryV() ? 'Symmetry V: ON' : 'Symmetry V: OFF');
      UI.setToolActive(Tools.getSymmetryV() ? 'symmetry-v' : 'pencil');
      Tools.setTool('pencil');
      document.getElementById('toolDisplay').textContent = 'Pencil';
    } else if (tool === 'symmetry-h') {
      Tools.setSymmetryH(!Tools.getSymmetryH());
      UI.toast(Tools.getSymmetryH() ? 'Symmetry H: ON' : 'Symmetry H: OFF');
      UI.setToolActive(Tools.getSymmetryH() ? 'symmetry-h' : 'pencil');
      Tools.setTool('pencil');
      document.getElementById('toolDisplay').textContent = 'Pencil';
    } else if (tool === 'mirror') {
      Tools.setMirror(!Tools.getMirror());
      UI.toast(Tools.getMirror() ? 'Mirror: ON' : 'Mirror: OFF');
      UI.setToolActive(Tools.getMirror() ? 'mirror' : 'pencil');
      Tools.setTool('pencil');
      document.getElementById('toolDisplay').textContent = 'Pencil';
    }
  }

  /* ---- Color ---- */
  function selectColor(color) {
    Tools.setColor(color);
    document.getElementById('customColor').value = color;
    document.getElementById('colorHex').value = color;
    UI.updatePaletteActive(color);
  }

  /* ---- Drawing ---- */
  function onMouseDown(e) {
    if (currentMode !== 'draw') return;
    saveUndo();
    isDrawing = true;
    const pos = Engine.canvasToPixel(e.clientX, e.clientY);
    applyDrawTool(pos.x, pos.y);
  }

  function onMouseMove(e) {
    if (!isDrawing || currentMode !== 'draw') return;
    const pos = Engine.canvasToPixel(e.clientX, e.clientY);
    applyDrawTool(pos.x, pos.y);
  }

  function onMouseUp() {
    isDrawing = false;
  }

  /* ---- Touch ---- */
  function onTouchStart(e) {
    e.preventDefault();
    if (currentMode !== 'draw') return;
    const t = e.touches[0];
    saveUndo();
    isDrawing = true;
    const pos = Engine.canvasToPixel(t.clientX, t.clientY);
    applyDrawTool(pos.x, pos.y);
  }

  function onTouchMove(e) {
    e.preventDefault();
    if (!isDrawing || currentMode !== 'draw') return;
    const t = e.touches[0];
    const pos = Engine.canvasToPixel(t.clientX, t.clientY);
    applyDrawTool(pos.x, pos.y);
  }

  function onTouchEnd() {
    isDrawing = false;
  }

  function applyDrawTool(x, y) {
    const grid = Engine.getGrid();
    const w = Engine.getWidth();
    const h = Engine.getHeight();
    const tool = Tools.getTool();
    const color = Tools.getColor();

    let changed = false;

    if (tool === 'pencil') {
      const changes = Tools.pencil(grid, x, y, color, w, h);
      changed = changes.length > 0;
    } else if (tool === 'eraser') {
      const changes = Tools.erase(grid, x, y, w, h);
      changed = changes.length > 0;
    } else if (tool === 'fill') {
      saveUndo();
      const changes = Tools.floodFill(grid, x, y, color, w, h);
      changed = changes.length > 0;
    } else if (tool === 'eyedropper') {
      const c = Tools.eyedropper(grid, x, y);
      if (c) selectColor(c);
      return;
    }

    if (changed) {
      Engine.markDirty();
      Engine.render();
    }
  }

  /* ---- Undo / Redo ---- */
  function saveUndo() {
    undoStack.push(Engine.getGridCopy());
    if (undoStack.length > 50) undoStack.shift();
    redoStack = [];
  }

  function undo() {
    if (undoStack.length === 0) return;
    redoStack.push(Engine.getGridCopy());
    Engine.setGridFromCopy(undoStack.pop());
    UI.toast('Undo');
  }

  function redo() {
    if (redoStack.length === 0) return;
    undoStack.push(Engine.getGridCopy());
    Engine.setGridFromCopy(redoStack.pop());
    UI.toast('Redo');
  }

  /* ---- Image Upload (pixelize) ---- */
  function handleImageUpload(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        Pixelizer.setImage(img);
        // Show original in canvas area
        const canvas = document.getElementById('pixelCanvas');
        const ctx = canvas.getContext('2d');
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        canvas.style.width = Math.min(img.naturalWidth, 800) + 'px';
        canvas.style.height = Math.min(img.naturalHeight, 600) + 'px';
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        UI.toast(`Loaded: ${img.naturalWidth} x ${img.naturalHeight}`);
        applyPixelize();
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  }

  /* ---- Pixelize ---- */
  function applyPixelize() {
    if (!Pixelizer.hasImage()) {
      UI.toast('Upload an image first');
      return;
    }
    const blockSize = parseInt(document.getElementById('blockSize').value);
    const numColors = parseInt(document.getElementById('paletteColors').value);
    const dither = document.getElementById('ditherToggle').checked;

    pixelizedResult = Pixelizer.pixelize(Pixelizer.getImage(), blockSize, numColors, dither);
    showPixelizedPreview();
    UI.toast(`Pixelized: ${pixelizedResult.width} x ${pixelizedResult.height}`);
  }

  function showPixelizedPreview() {
    if (!pixelizedResult) return;
    const canvas = document.getElementById('pixelCanvas');
    const ctx = canvas.getContext('2d');
    const zoom = parseInt(document.getElementById('zoomSlider').value) || 800;
    canvas.width = pixelizedResult.width;
    canvas.height = pixelizedResult.height;
    canvas.style.width = pixelizedResult.width * (zoom / 100) + 'px';
    canvas.style.height = pixelizedResult.height * (zoom / 100) + 'px';
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(pixelizedResult.canvas, 0, 0, pixelizedResult.width, pixelizedResult.height);
  }

  function exportPixelized() {
    if (!pixelizedResult) { UI.toast('Nothing to export'); return; }
    downloadURL(pixelizedResult.dataUrl, 'pixelized.png');
    UI.toast('Exported!');
  }

  /* ---- Keyboard shortcuts ---- */
  function onKeyDown(e) {
    if (e.target.tagName === 'INPUT') return;

    if (e.ctrlKey && e.key === 'z' && !e.shiftKey) { e.preventDefault(); undo(); return; }
    if ((e.ctrlKey && e.key === 'z' && e.shiftKey) || (e.ctrlKey && e.key === 'Z')) { e.preventDefault(); redo(); return; }
    if (e.ctrlKey && e.key === 'g') { e.preventDefault(); document.getElementById('gridToggle').click(); return; }
    if (e.ctrlKey && e.key === 'e') {
      e.preventDefault();
      if (currentMode === 'draw') {
        const url = Engine.exportScaledPNG(4);
        downloadURL(url, 'pixel-art.png');
        UI.toast('Exported!');
      } else {
        exportPixelized();
      }
      return;
    }

    // Draw mode tool shortcuts
    if (currentMode === 'draw') {
      switch (e.key.toLowerCase()) {
        case 'b': switchTool('pencil'); UI.setToolActive('pencil'); break;
        case 'g': switchTool('fill'); UI.setToolActive('fill'); break;
        case 'e': switchTool('eraser'); UI.setToolActive('eraser'); break;
        case 'i': switchTool('eyedropper'); UI.setToolActive('eyedropper'); break;
        case 'm': switchTool('mirror'); break;
        case 'f':
          if (!e.ctrlKey) document.getElementById('fullscreenBtn').click();
          break;
      }
      if (e.shiftKey) {
        switch (e.key.toLowerCase()) {
          case 'v': switchTool('symmetry-v'); break;
          case 'h': switchTool('symmetry-h'); break;
        }
      }
    }
  }

  /* ---- Helpers ---- */
  function downloadURL(url, filename) {
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
  }

  function updateInfo() {
    document.getElementById('sizeDisplay').textContent = `${Engine.getWidth()} x ${Engine.getHeight()}`;
    document.getElementById('zoomDisplay').textContent = `${Engine.getZoom()}%`;
  }

  /* ---- Start ---- */
  document.addEventListener('DOMContentLoaded', init);
})();
