/* ═══════════════════════════════════════════════
   tools.js — Drawing Algorithms
   ═══════════════════════════════════════════════ */

const Tools = (() => {
  let currentTool = 'pencil';
  let currentColor = '#1a1a1a';
  let symmetryV = false;
  let symmetryH = false;
  let mirror = false;

  /* ---- Tool state ---- */
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

  /* ---- Apply symmetry transforms to get all affected coords ---- */
  function getAffectedCoords(x, y, w, h) {
    const points = [{ x, y }];

    if (symmetryV) {
      const sx = w - 1 - x;
      if (sx !== x) points.push({ x: sx, y });
    }
    if (symmetryH) {
      const sy = h - 1 - y;
      if (sy !== y) points.push({ x, y: sy });
    }
    if (symmetryV && symmetryH) {
      const sx = w - 1 - x;
      const sy = h - 1 - y;
      if (sx !== x && sy !== y) points.push({ x: sx, y: sy });
    }
    if (mirror) {
      // Mirror across vertical center: reflect x around center
      const cx = Math.floor(w / 2);
      const mx = cx + (cx - x);
      if (mx >= 0 && mx < w && mx !== x) points.push({ x: mx, y });
      // Also mirror the symmetry points if both active
      if (symmetryV) {
        const mx2 = cx + (cx - (w - 1 - x));
        if (mx2 >= 0 && mx2 < w && mx2 !== x) points.push({ x: mx2, y });
      }
    }

    return points;
  }

  /* ---- Pencil ---- */
  function pencil(grid, x, y, color, w, h) {
    const points = getAffectedCoords(x, y, w, h);
    const changes = [];
    for (const p of points) {
      if (p.x >= 0 && p.x < w && p.y >= 0 && p.y < h && grid[p.y][p.x] !== color) {
        grid[p.y][p.x] = color;
        changes.push(p);
      }
    }
    return changes;
  }

  /* ---- Flood Fill ---- */
  function floodFill(grid, startX, startY, fillColor, w, h) {
    if (grid[startY][startX] === fillColor) return [];
    const targetColor = grid[startY][startX];
    const stack = [{ x: startX, y: startY }];
    const visited = new Set();
    const changes = [];

    while (stack.length > 0) {
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

  /* ---- Eraser ---- */
  function erase(grid, x, y, w, h) {
    const points = getAffectedCoords(x, y, w, h);
    const changes = [];
    for (const p of points) {
      if (p.x >= 0 && p.x < w && p.y >= 0 && p.y < h && grid[p.y][p.x] !== '#ffffff') {
        grid[p.y][p.x] = '#ffffff';
        changes.push(p);
      }
    }
    return changes;
  }

  /* ---- Eyedropper ---- */
  function eyedropper(grid, x, y) {
    if (x < 0 || x >= grid[0].length || y < 0 || y >= grid.length) return null;
    return grid[y][x];
  }

  return {
    getTool, setTool, getColor, setColor,
    getSymmetryV, setSymmetryV, getSymmetryH, setSymmetryH, getMirror, setMirror,
    pencil, floodFill, erase, eyedropper,
  };
})();
