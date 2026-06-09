/* ═══════════════════════════════════════════════
   tools.js — Drawing Algorithms
   ═══════════════════════════════════════════════ */

const Tools = (() => {
  let currentTool = 'pencil';
  let currentColor = '#1a1a1a';
  let symmetryV = false;
  let symmetryH = false;
  let mirror = false;
  let brushSize = 1;
  let lineStart = null; // { x, y } when mid-line

  /* ---- Getters / Setters ---- */
  function getTool() { return currentTool; }
  function setTool(t) { currentTool = t; }
  function getColor() { return currentColor; }
  function setColor(c) { currentColor = c; }
  function getSymmetryV() { return symmetryV; }
  function setSymmetryV(v) { symmetryV = v; }
  function getSymmetryH() { return symmetryH; }
  function setSymmetryH(v) { symmetryH = v; }
  function getMirror() { return mirror; }
  function setMirror(v) { mirror = v; }
  function getBrushSize() { return brushSize; }
  function setBrushSize(s) { brushSize = Math.max(1, Math.min(10, s)); }
  function getLineStart() { return lineStart; }

  function setLineStart(p) {
    if (p) lineStart = { x: p.x, y: p.y };
    else lineStart = null;
  }

  /* ---- Symmetry coords ---- */
  function getAffectedCoords(x, y, w, h) {
    const set = new Map();
    set.set(`${x},${y}`, { x, y });

    if (symmetryV) {
      const sx = w - 1 - x;
      if (sx >= 0 && sx < w) set.set(`${sx},${y}`, { x: sx, y });
    }
    if (symmetryH) {
      const sy = h - 1 - y;
      if (sy >= 0 && sy < h) set.set(`${x},${sy}`, { x, y: sy });
    }
    if (symmetryV && symmetryH) {
      const sx = w - 1 - x, sy = h - 1 - y;
      if (sx >= 0 && sx < w && sy >= 0 && sy < h)
        set.set(`${sx},${sy}`, { x: sx, y: sy });
    }
    if (mirror) {
      const cx = Math.floor(w / 2);
      const mx = cx + (cx - x);
      if (mx >= 0 && mx < w && mx !== x) set.set(`${mx},${y}`, { x: mx, y });
    }
    return [...set.values()];
  }

  /* ---- Apply brush size to a coordinate ---- */
  function *expandBrush(cx, cy, size) {
    const half = Math.floor(size / 2);
    for (let dy = -half; dy < size - half; dy++)
      for (let dx = -half; dx < size - half; dx++)
        yield { x: cx + dx, y: cy + dy };
  }

  /* ---- Pencil ---- */
  function pencil(grid, x, y, color, w, h) {
    const changes = [];
    const visited = new Set();
    for (const p of expandBrush(x, y, brushSize)) {
      const coords = getAffectedCoords(p.x, p.y, w, h);
      for (const c of coords) {
        const key = `${c.x},${c.y}`;
        if (visited.has(key)) continue;
        if (c.x < 0 || c.x >= w || c.y < 0 || c.y >= h) continue;
        if (grid[c.y][c.x] === color) continue;
        visited.add(key);
        grid[c.y][c.x] = color;
        changes.push(c);
      }
    }
    return changes;
  }

  /* ---- Eraser ---- */
  function erase(grid, x, y, w, h) {
    const changes = [];
    const visited = new Set();
    for (const p of expandBrush(x, y, brushSize)) {
      const coords = getAffectedCoords(p.x, p.y, w, h);
      for (const c of coords) {
        const key = `${c.x},${c.y}`;
        if (visited.has(key)) continue;
        if (c.x < 0 || c.x >= w || c.y < 0 || c.y >= h) continue;
        if (grid[c.y][c.x] === '#ffffff') continue;
        visited.add(key);
        grid[c.y][c.x] = '#ffffff';
        changes.push(c);
      }
    }
    return changes;
  }

  /* ---- Line tool (Bresenham) ---- */
  function line(grid, x0, y0, x1, y1, color, w, h) {
    const changes = [];
    const dx = Math.abs(x1 - x0), sx = x0 < x1 ? 1 : -1;
    const dy = -Math.abs(y1 - y0), sy = y0 < y1 ? 1 : -1;
    let err = dx + dy, e2;
    let cx = x0, cy = y0;

    while (true) {
      if (cx >= 0 && cx < w && cy >= 0 && cy < h) {
        for (const p of expandBrush(cx, cy, brushSize)) {
          const coords = getAffectedCoords(p.x, p.y, w, h);
          for (const c of coords) {
            if (c.x < 0 || c.x >= w || c.y < 0 || c.y >= h) continue;
            if (grid[c.y][c.x] === color) continue;
            grid[c.y][c.x] = color;
            changes.push(c);
          }
        }
      }
      if (cx === x1 && cy === y1) break;
      e2 = 2 * err;
      if (e2 >= dy) { err += dy; cx += sx; }
      if (e2 <= dx) { err += dx; cy += sy; }
    }
    return changes;
  }

  /* ---- Rectangle tool ---- */
  function rect(grid, x0, y0, x1, y1, color, w, h, fill) {
    const minX = Math.max(0, Math.min(x0, x1));
    const maxX = Math.min(w - 1, Math.max(x0, x1));
    const minY = Math.max(0, Math.min(y0, y1));
    const maxY = Math.min(h - 1, Math.max(y0, y1));
    const changes = [];

    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        if (!fill && x !== minX && x !== maxX && y !== minY && y !== maxY) continue;
        if (grid[y][x] === color) continue;
        grid[y][x] = color;
        changes.push({ x, y });
      }
    }
    return changes;
  }

  /* ---- Circle tool (midpoint) ---- */
  function circle(grid, cx, cy, rx, ry, color, w, h, fill) {
    const changes = [];
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        if (!inEllipse(x, y, cx, cy, rx, ry, fill)) continue;
        if (grid[y][x] === color) continue;
        grid[y][x] = color;
        changes.push({ x, y });
      }
    }
    return changes;
  }

  function inEllipse(x, y, cx, cy, rx, ry, fill) {
    const dx = x - cx, dy = y - cy;
    const inside = (dx * dx) / (rx * rx + 0.5) + (dy * dy) / (ry * ry + 0.5) <= 1;
    if (!inside) return false;
    if (fill) return true;
    // Outline only
    const dxo = Math.abs(dx), dyo = Math.abs(dy);
    const outer = (dxo * dxo) / (rx * rx) + (dyo * dyo) / (ry * ry) <= 1;
    return !outer;
  }

  /* ---- Flood Fill ---- */
  function floodFill(grid, startX, startY, fillColor, w, h) {
    if (grid[startY][startX] === fillColor) return [];
    const targetColor = grid[startY][startX];
    const stack = [{ x: startX, y: startY }];
    const visited = new Set();
    const changes = [];
    while (stack.length) {
      const { x, y } = stack.pop();
      const key = `${x},${y}`;
      if (visited.has(key)) continue;
      visited.add(key);
      if (grid[y][x] !== targetColor) continue;
      grid[y][x] = fillColor;
      changes.push({ x, y });
      if (x > 0) stack.push({ x: x - 1, y });
      if (x < w - 1) stack.push({ x: x + 1, y });
      if (y > 0) stack.push({ x, y: y - 1 });
      if (y < h - 1) stack.push({ x, y: y + 1 });
    }
    return changes;
  }

  /* ---- Eyedropper ---- */
  function eyedropper(grid, x, y) {
    if (!grid[y] || x < 0 || x >= grid[0].length || y < 0 || y >= grid.length) return null;
    return grid[y][x];
  }

  return {
    getTool, setTool, getColor, setColor,
    getSymmetryV, setSymmetryV, getSymmetryH, setSymmetryH, getMirror, setMirror,
    getBrushSize, setBrushSize,
    getLineStart, setLineStart,
    pencil, erase, line, rect, circle, floodFill, eyedropper,
  };
})();
