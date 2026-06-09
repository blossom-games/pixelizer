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
  let lastDrawPos = null;
  let isShiftDown = false;

  const MAX_UNDO = 100;

  /* ══════════ INIT ══════════ */
  function init() {
    Engine.init(document.getElementById('pixelCanvas'));

    const paletteContainer = document.getElementById('palette');
    UI.renderPalette(paletteContainer, Tools.getColor(), selectColor);

    UI.initModeSwitch(switchMode);
    UI.initTools(switchTool);
    UI.initImageUpload(handleImageUpload);

    const canvas = document.getElementById('pixelCanvas');

    // Mouse events
    canvas.addEventListener('mousedown', onPointerDown);
    canvas.addEventListener('mousemove', onPointerMove);
    canvas.addEventListener('mouseup', onPointerUp);
    canvas.addEventListener('mouseleave', onPointerUp);
    canvas.addEventListener('contextmenu', e => e.preventDefault());

    // Touch events
    canvas.addEventListener('touchstart', onTouchStart, { passive: false });
    canvas.addEventListener('touchmove', onTouchMove, { passive: false });
    canvas.addEventListener('touchend', onPointerUp, { passive: false });

    // Scroll wheel zoom
    const vp = document.getElementById('canvasViewport');
    vp.addEventListener('wheel', onScrollZoom, { passive: false });

    // Color picker
    document.getElementById('customColor').addEventListener('input', e => selectColor(e.target.value));
    document.getElementById('colorHex').addEventListener('input', e => {
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
      autosaveDirty();
    });

    // Clear
    document.getElementById('clearCanvas').addEventListener('click', () => {
      saveUndo();
      Engine.fillAll('#ffffff');
      Engine.render();
      UI.toast('Canvas cleared');
      autosaveDirty();
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

    // Fit zoom button (double-click zoom label)
    document.getElementById('zoomDisplay').addEventListener('dblclick', () => {
      const z = Engine.resetZoom();
      zoomSlider.value = z;
      updateInfo();
      UI.toast(`Zoom: ${z}%`);
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
    document.getElementById('blockSize').addEventListener('input', e => {
      document.getElementById('blockSizeDisplay').textContent = e.target.value;
    });
    document.getElementById('paletteColors').addEventListener('input', e => {
      document.getElementById('paletteDisplay').textContent = e.target.value;
    });
    document.getElementById('applyPixelize').addEventListener('click', applyPixelize);
    document.getElementById('exportPixelizeBtn').addEventListener('click', exportPixelized);

    // Brush size
    document.getElementById('brushSize').addEventListener('input', e => {
      Tools.setBrushSize(parseInt(e.target.value));
      document.getElementById('brushSizeDisplay').textContent = e.target.value;
    });

    // Keyboard shortcuts
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('keyup', e => { if (e.key === 'Shift') isShiftDown = false; });

    // Initial render
    Engine.fillAll('#ffffff');
    Engine.render();
    updateInfo();
  }

  /* ══════════ MODE ══════════ */
  function switchMode(mode) {
    currentMode = mode;
    document.getElementById('drawTools').classList.toggle('hidden', mode !== 'draw');
    document.getElementById('pixelizeTools').classList.toggle('hidden', mode !== 'pixelize');
    document.getElementById('drawControls').classList.toggle('hidden', mode !== 'draw');
    document.getElementById('pixelizeControls').classList.toggle('hidden', mode !== 'pixelize');
    document.getElementById('canvasSizeSection').style.display = (mode !== 'draw') ? 'none' : '';
    document.getElementById('brushSection').style.display = (mode !== 'draw') ? 'none' : '';

    if (mode === 'pixelize') {
      if (pixelizedResult) showPixelizedPreview();
    } else {
      const canvas = document.getElementById('pixelCanvas');
      const w = Engine.getWidth(), h = Engine.getHeight();
      const zoom = Engine.getZoom();
      canvas.width = w; canvas.height = h;
      canvas.style.width = (w * zoom / 100) + 'px';
      canvas.style.height = (h * zoom / 100) + 'px';
      Engine.render();
    }
  }

  /* ══════════ TOOLS ══════════ */
  function switchTool(tool) {
    Tools.setTool(tool);
    document.getElementById('toolDisplay').textContent = labelForTool(tool);

    if (tool === 'symmetry-v') {
      Tools.setSymmetryV(!Tools.getSymmetryV());
      UI.toast(Tools.getSymmetryV() ? 'Symmetry V ON' : 'Symmetry V OFF');
      UI.setToolActive(Tools.getSymmetryV() ? 'symmetry-v' : 'pencil');
      Tools.setTool('pencil');
      document.getElementById('toolDisplay').textContent = 'Pencil';
    } else if (tool === 'symmetry-h') {
      Tools.setSymmetryH(!Tools.getSymmetryH());
      UI.toast(Tools.getSymmetryH() ? 'Symmetry H ON' : 'Symmetry H OFF');
      UI.setToolActive(Tools.getSymmetryH() ? 'symmetry-h' : 'pencil');
      Tools.setTool('pencil');
      document.getElementById('toolDisplay').textContent = 'Pencil';
    } else if (tool === 'mirror') {
      Tools.setMirror(!Tools.getMirror());
      UI.toast(Tools.getMirror() ? 'Mirror ON' : 'Mirror OFF');
      UI.setToolActive(Tools.getMirror() ? 'mirror' : 'pencil');
      Tools.setTool('pencil');
      document.getElementById('toolDisplay').textContent = 'Pencil';
    } else if (tool === 'line' || tool === 'rect' || tool === 'circle') {
      // These tools need a start point — will be handled in pointer events
      Tools.setLineStart(null);
    }
  }

  function labelForTool(t) {
    const map = {
      pencil: 'Pencil', fill: 'Fill', eraser: 'Eraser',
      eyedropper: 'Dropper', line: 'Line', rect: 'Rect', circle: 'Circle',
      'symmetry-v': 'Sym-V', 'symmetry-h': 'Sym-H', mirror: 'Mirror',
    };
    return map[t] || t.charAt(0).toUpperCase() + t.slice(1);
  }

  /* ══════════ COLOR ══════════ */
  function selectColor(color) {
    Tools.setColor(color);
    document.getElementById('customColor').value = color;
    document.getElementById('colorHex').value = color;
    UI.updatePaletteActive(color);
    UI.addColorToHistory(color);
  }

  /* ══════════ POINTER EVENTS ══════════ */
  function onPointerDown(e) {
    if (currentMode !== 'draw') return;
    const pos = Engine.canvasToPixel(e.clientX, e.clientY);
    const tool = Tools.getTool();

    // For shape tools, first click sets start
    if ((tool === 'line' || tool === 'rect' || tool === 'circle') && !e.shiftKey && !isShiftDown) {
      if (!Tools.getLineStart()) {
        Tools.setLineStart(pos);
        UI.toast('Click endpoint');
        return;
      }
    }

    saveUndo();
    isDrawing = true;
    lastDrawPos = pos;
    applyDrawTool(pos.x, pos.y, pos.x, pos.y);
  }

  function onPointerMove(e) {
    if (currentMode !== 'draw') return;
    const pos = Engine.canvasToPixel(e.clientX, e.clientY);
    const tool = Tools.getTool();

    // Shape preview on hover when waiting for endpoint
    if ((tool === 'line' || tool === 'rect' || tool === 'circle') && Tools.getLineStart() && !isDrawing) {
      previewShape(pos);
      return;
    }

    if (isDrawing) {
      applyDrawTool(pos.x, pos.y, lastDrawPos.x, lastDrawPos.y);
      lastDrawPos = pos;
    }
  }

  function onPointerUp() {
    if (isDrawing) {
      isDrawing = false;
      autosaveDirty();
    }
    // Shape tools: keep lineStart until next click completes it
  }

  /* ══════════ TOUCH ══════════ */
  function onTouchStart(e) {
    e.preventDefault();
    if (currentMode !== 'draw') return;
    const t = e.touches[0];
    const pos = Engine.canvasToPixel(t.clientX, t.clientY);
    const tool = Tools.getTool();

    if ((tool === 'line' || tool === 'rect' || tool === 'circle') && !Tools.getLineStart()) {
      Tools.setLineStart(pos);
      return;
    }

    saveUndo();
    isDrawing = true;
    lastDrawPos = pos;
    applyDrawTool(pos.x, pos.y, pos.x, pos.y);
  }

  function onTouchMove(e) {
    e.preventDefault();
    if (!isDrawing || currentMode !== 'draw') return;
    const t = e.touches[0];
    const pos = Engine.canvasToPixel(t.clientX, t.clientY);
    applyDrawTool(pos.x, pos.y, lastDrawPos.x, lastDrawPos.y);
    lastDrawPos = pos;
  }

  /* ══════════ SCROLL ZOOM ══════════ */
  function onScrollZoom(e) {
    if (!e.ctrlKey && !e.metaKey) return;
    e.preventDefault();
    const delta = e.deltaY > 0 ? -100 : 100;
    const z = Math.max(100, Math.min(3200, Engine.getZoom() + delta));
    Engine.zoomAtPoint(z, e.clientX, e.clientY);
    document.getElementById('zoomSlider').value = z;
    updateInfo();
  }

  /* ══════════ SHAPE PREVIEW ══════════ */
  let previewDirty = false;

  function previewShape(pos) {
    // Quick inline preview — just mark dirty and let next render cycle draw
    if (!previewDirty) {
      previewDirty = true;
      requestAnimationFrame(() => { previewDirty = false; });
    }
  }

  /* ══════════ DRAW TOOL DISPATCH ══════════ */
  function applyDrawTool(x, y, prevX, prevY) {
    const grid = Engine.getGrid();
    const w = Engine.getWidth();
    const h = Engine.getHeight();
    const tool = Tools.getTool();
    const color = Tools.getColor();
    let changed = false;

    switch (tool) {
      case 'pencil': {
        const changes = Tools.pencil(grid, x, y, color, w, h);
        changed = changes.length > 0;
        break;
      }
      case 'eraser': {
        const changes = Tools.erase(grid, x, y, w, h);
        changed = changes.length > 0;
        break;
      }
      case 'fill': {
        const changes = Tools.floodFill(grid, x, y, color, w, h);
        changed = changes.length > 0;
        break;
      }
      case 'eyedropper': {
        const c = Tools.eyedropper(grid, x, y);
        if (c) selectColor(c);
        return;
      }
      case 'line': {
        const start = Tools.getLineStart();
        if (start) {
          const changes = Tools.line(grid, start.x, start.y, x, y, color, w, h);
          changed = changes.length > 0;
          Tools.setLineStart(null);
        }
        break;
      }
      case 'rect': {
        const start = Tools.getLineStart();
        if (start) {
          const fill = isShiftDown;
          const changes = Tools.rect(grid, start.x, start.y, x, y, color, w, h, fill);
          changed = changes.length > 0;
          Tools.setLineStart(null);
        }
        break;
      }
      case 'circle': {
        const start = Tools.getLineStart();
        if (start) {
          const rx = Math.abs(x - start.x), ry = Math.abs(y - start.y);
          const fill = isShiftDown;
          const changes = Tools.circle(grid, start.x, start.y, rx || 1, ry || 1, color, w, h, fill);
          changed = changes.length > 0;
          Tools.setLineStart(null);
        }
        break;
      }
    }

    if (changed) {
      Engine.markDirty();
      Engine.render();
    }
  }

  /* ══════════ UNDO / REDO ══════════ */
  function saveUndo() {
    undoStack.push(Engine.getGridCopy());
    if (undoStack.length > MAX_UNDO) undoStack.shift();
    redoStack = [];
  }

  function undo() {
    if (undoStack.length === 0) return;
    redoStack.push(Engine.getGridCopy());
    Engine.setGridFromCopy(undoStack.pop());
    UI.toast('Undo');
    autosaveDirty();
  }

  function redo() {
    if (redoStack.length === 0) return;
    undoStack.push(Engine.getGridCopy());
    Engine.setGridFromCopy(redoStack.pop());
    UI.toast('Redo');
    autosaveDirty();
  }

  /* ══════════ AUTO-SAVE ══════════ */
  let saveTimer = null;
  function autosaveDirty() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => Engine.autosave(), 1000);
  }

  /* ══════════ PIXELIZE ══════════ */
  function handleImageUpload(file) {
    UI.showLoading('Loading image...');
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        Pixelizer.setImage(img);
        const canvas = document.getElementById('pixelCanvas');
        const ctx = canvas.getContext('2d');
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const maxW = 800, maxH = 600;
        const sc = Math.min(1, maxW / img.naturalWidth, maxH / img.naturalHeight);
        canvas.style.width = Math.round(img.naturalWidth * sc) + 'px';
        canvas.style.height = Math.round(img.naturalHeight * sc) + 'px';
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        UI.hideLoading();
        UI.toast(`Loaded: ${img.naturalWidth} x ${img.naturalHeight}`);
        applyPixelize();
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  }

  function applyPixelize() {
    if (!Pixelizer.hasImage()) { UI.toast('Upload an image first'); return; }
    const blockSize = parseInt(document.getElementById('blockSize').value);
    const numColors = parseInt(document.getElementById('paletteColors').value);
    const dither = document.getElementById('ditherToggle').checked;

    UI.showLoading('Pixelizing...');
    setTimeout(() => {
      pixelizedResult = Pixelizer.pixelize(Pixelizer.getImage(), blockSize, numColors, dither);
      showPixelizedPreview();
      UI.hideLoading();
      UI.toast(`Pixelized: ${pixelizedResult.width} x ${pixelizedResult.height}`);
    }, 50);
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

  /* ══════════ KEYBOARD ══════════ */
  function onKeyDown(e) {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

    if (e.key === 'Shift') isShiftDown = true;

    // Ctrl shortcuts
    if (e.ctrlKey || e.metaKey) {
      switch (e.key.toLowerCase()) {
        case 'z':
          e.preventDefault();
          if (e.shiftKey) redo(); else undo();
          return;
        case 'g': e.preventDefault(); document.getElementById('gridToggle').click(); return;
        case 'e': e.preventDefault(); doExport(); return;
        case 's': e.preventDefault(); saveProject(); return;
        case 'o': e.preventDefault(); loadProject(); return;
        case 'c': e.preventDefault(); UI.toast('Copy not implemented'); return;
        case 'v': e.preventDefault(); UI.toast('Paste not implemented'); return;
      }
    }

    // Tool shortcuts (draw mode only)
    if (currentMode === 'draw' && !e.ctrlKey && !e.metaKey) {
      if (e.shiftKey) {
        switch (e.key.toLowerCase()) {
          case 'v': switchTool('symmetry-v'); e.preventDefault(); return;
          case 'h': switchTool('symmetry-h'); e.preventDefault(); return;
          case 'r': switchTool('rect'); e.preventDefault(); return;
        }
        return;
      }

      switch (e.key.toLowerCase()) {
        case 'b': switchTool('pencil'); UI.setToolActive('pencil'); e.preventDefault(); break;
        case 'g': switchTool('fill'); UI.setToolActive('fill'); e.preventDefault(); break;
        case 'e': switchTool('eraser'); UI.setToolActive('eraser'); e.preventDefault(); break;
        case 'i': switchTool('eyedropper'); UI.setToolActive('eyedropper'); e.preventDefault(); break;
        case 'm': switchTool('mirror'); e.preventDefault(); break;
        case 'l': switchTool('line'); UI.setToolActive('line'); e.preventDefault(); break;
        case 'r': switchTool('rect'); UI.setToolActive('rect'); e.preventDefault(); break;
        case 'c': switchTool('circle'); UI.setToolActive('circle'); e.preventDefault(); break;
        case 'f':
          if (!e.ctrlKey) document.getElementById('fullscreenBtn').click();
          break;
        case '1': document.getElementById('brushSize').value = 1; Tools.setBrushSize(1); updateBrushUI(); break;
        case '2': document.getElementById('brushSize').value = 2; Tools.setBrushSize(2); updateBrushUI(); break;
        case '3': document.getElementById('brushSize').value = 4; Tools.setBrushSize(4); updateBrushUI(); break;
        case 'z': if (!e.ctrlKey) undo(); break;
      }
    }
  }

  function updateBrushUI() {
    document.getElementById('brushSizeDisplay').textContent = document.getElementById('brushSize').value;
  }

  /* ══════════ EXPORT ══════════ */
  function doExport() {
    if (currentMode === 'draw') {
      const url = Engine.exportScaledPNG(4);
      downloadURL(url, 'pixel-art.png');
      UI.toast('Exported 4x PNG!');
    } else {
      exportPixelized();
    }
  }

  /* ══════════ SAVE / LOAD PROJECT ══════════ */
  function saveProject() {
    const data = {
      version: 1,
      width: Engine.getWidth(),
      height: Engine.getHeight(),
      grid: Engine.getGrid(),
      tool: Tools.getTool(),
      color: Tools.getColor(),
    };
    const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    downloadURL(url, 'pixel-project.json');
    URL.revokeObjectURL(url);
    UI.toast('Project saved!');
  }

  function loadProject() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        try {
          const data = JSON.parse(ev.target.result);
          if (!data.grid || !data.width) { UI.toast('Invalid project file'); return; }
          Engine.resize(data.width, data.height);
          const grid = Engine.getGrid();
          for (let y = 0; y < Math.min(data.grid.length, grid.length); y++)
            for (let x = 0; x < Math.min(data.grid[y].length, grid[y].length); x++)
              grid[y][x] = data.grid[y][x];
          Engine.markDirty();
          Engine.render();
          document.getElementById('canvasW').value = data.width;
          document.getElementById('canvasH').value = data.height;
          updateInfo();
          UI.toast('Project loaded!');
        } catch (err) { UI.toast('Error loading project'); }
      };
      reader.readAsText(file);
    };
    input.click();
  }

  /* ══════════ HELPERS ══════════ */
  function downloadURL(url, filename) {
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  function updateInfo() {
    document.getElementById('sizeDisplay').textContent = `${Engine.getWidth()} x ${Engine.getHeight()}`;
    document.getElementById('zoomDisplay').textContent = `${Engine.getZoom()}%`;
  }

  /* ══════════ BOOT ══════════ */
  document.addEventListener('DOMContentLoaded', init);
})();
