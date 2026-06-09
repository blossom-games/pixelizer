/* ═══════════════════════════════════════════════
   pixelizer.js — Image Pixelization Engine
   ═══════════════════════════════════════════════ */

const Pixelizer = (() => {
  let uploadedImage = null;

  function setImage(img) { uploadedImage = img; }
  function hasImage() { return uploadedImage !== null; }
  function getImage() { return uploadedImage; }

  /* ---- Main pixelize function ---- */
  function pixelize(img, blockSize, numColors, dither) {
    const sw = img.naturalWidth || img.width;
    const sh = img.naturalHeight || img.height;

    // Step 1: downscale to pixel grid
    const pw = Math.max(1, Math.floor(sw / blockSize));
    const ph = Math.max(1, Math.floor(sh / blockSize));

    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = pw;
    tempCanvas.height = ph;
    const tempCtx = tempCanvas.getContext('2d');
    tempCtx.imageSmoothingEnabled = false;
    tempCtx.drawImage(img, 0, 0, pw, ph);

    let imageData = tempCtx.getImageData(0, 0, pw, ph);

    // Step 2: color palette reduction
    if (numColors && numColors < 256) {
      imageData = quantizeColors(imageData, numColors, dither);
    }

    // Step 3: scale back up (nearest neighbor)
    const resultCanvas = document.createElement('canvas');
    resultCanvas.width = pw;
    resultCanvas.height = ph;
    const resultCtx = resultCanvas.getContext('2d');
    resultCtx.putImageData(imageData, 0, 0);

    return { canvas: resultCanvas, width: pw, height: ph, dataUrl: resultCanvas.toDataURL('image/png') };
  }

  /* ---- Color Quantization (Median Cut) ---- */
  function quantizeColors(imageData, numColors, dither) {
    const { data, width, height } = imageData;
    const pixels = [];
    for (let i = 0; i < data.length; i += 4) {
      pixels.push([data[i], data[i + 1], data[i + 2]]);
    }

    // Simple k-means quantization
    const palette = buildPaletteKMeans(pixels, numColors);

    // Apply palette
    const result = new Uint8ClampedArray(data.length);

    if (dither) {
      floydSteinberg(data, width, height, palette, result);
    } else {
      for (let i = 0; i < data.length; i += 4) {
        const color = nearestColor([data[i], data[i + 1], data[i + 2]], palette);
        result[i] = color[0]; result[i + 1] = color[1];
        result[i + 2] = color[2]; result[i + 3] = data[i + 3];
      }
    }

    return new ImageData(result, width, height);
  }

  function buildPaletteKMeans(pixels, k) {
    if (pixels.length === 0) return [[0, 0, 0]];
    if (pixels.length <= k) return pixels;

    // Smart initial centroids (spread across luminance)
    const sorted = [...pixels].sort((a, b) => {
      const la = a[0] * 0.299 + a[1] * 0.587 + a[2] * 0.114;
      const lb = b[0] * 0.299 + b[1] * 0.587 + b[2] * 0.114;
      return la - lb;
    });

    const step = Math.max(1, Math.floor(sorted.length / k));
    let centroids = [];
    for (let i = 0; i < k; i++) {
      const idx = Math.min(i * step, sorted.length - 1);
      centroids.push([...sorted[idx]]);
    }

    // Iterate k-means
    for (let iter = 0; iter < 10; iter++) {
      const clusters = Array.from({ length: centroids.length }, () => []);
      for (const p of pixels) {
        let minDist = Infinity, bestIdx = 0;
        for (let j = 0; j < centroids.length; j++) {
          const d = colorDist(p, centroids[j]);
          if (d < minDist) { minDist = d; bestIdx = j; }
        }
        clusters[bestIdx].push(p);
      }

      let moved = false;
      for (let j = 0; j < centroids.length; j++) {
        if (clusters[j].length === 0) continue;
        const avg = [0, 0, 0];
        for (const p of clusters[j]) {
          avg[0] += p[0]; avg[1] += p[1]; avg[2] += p[2];
        }
        avg[0] = Math.round(avg[0] / clusters[j].length);
        avg[1] = Math.round(avg[1] / clusters[j].length);
        avg[2] = Math.round(avg[2] / clusters[j].length);
        if (avg[0] !== centroids[j][0] || avg[1] !== centroids[j][1] || avg[2] !== centroids[j][2]) {
          centroids[j] = avg; moved = true;
        }
      }
      if (!moved) break;
    }

    return centroids;
  }

  function colorDist(a, b) {
    const dr = a[0] - b[0], dg = a[1] - b[1], db = a[2] - b[2];
    return dr * dr + dg * dg + db * db;
  }

  function nearestColor(c, palette) {
    let minDist = Infinity, best = palette[0];
    for (const p of palette) {
      const d = colorDist(c, p);
      if (d < minDist) { minDist = d; best = p; }
    }
    return best;
  }

  /* ---- Floyd-Steinberg Dithering ---- */
  function floydSteinberg(data, w, h, palette, result) {
    const err = new Float32Array(data.length);
    for (let i = 0; i < data.length; i++) err[i] = data[i];

    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const idx = (y * w + x) * 4;
        const oldR = err[idx], oldG = err[idx + 1], oldB = err[idx + 2];
        const newC = nearestColor([oldR, oldG, oldB], palette);
        result[idx] = newC[0]; result[idx + 1] = newC[1];
        result[idx + 2] = newC[2]; result[idx + 3] = 255;

        const qr = oldR - newC[0], qg = oldG - newC[1], qb = oldB - newC[2];

        const distribute = (dx, dy, factor) => {
          if (x + dx < 0 || x + dx >= w || y + dy < 0 || y + dy >= h) return;
          const i = ((y + dy) * w + (x + dx)) * 4;
          err[i] += qr * factor;
          err[i + 1] += qg * factor;
          err[i + 2] += qb * factor;
        };

        distribute(1, 0, 7 / 16);
        distribute(-1, 1, 3 / 16);
        distribute(0, 1, 5 / 16);
        distribute(1, 1, 1 / 16);
      }
    }
  }

  return { setImage, hasImage, getImage, pixelize };
})();
