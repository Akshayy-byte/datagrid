'use client';

import { useEffect, useRef } from 'react';

export function BlobGridBackground() {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pointerImgRef = useRef<HTMLImageElement | null>(null);
  const dragImgRef = useRef<HTMLImageElement | null>(null);
  const pointerLoadedRef = useRef<boolean>(false);
  const dragLoadedRef = useRef<boolean>(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return;

    // canvas sizing
    let cssWidth = 0;
    let cssHeight = 0;
    let dpr = Math.max(1, Math.min(3, window.devicePixelRatio || 1));
    const resize = () => {
      const rect = container.getBoundingClientRect();
      const nextDpr = Math.max(1, Math.min(3, window.devicePixelRatio || 1));
      if (cssWidth !== rect.width || cssHeight !== rect.height || dpr !== nextDpr) {
        cssWidth = rect.width;
        cssHeight = rect.height;
        dpr = nextDpr;
        canvas.style.width = cssWidth + 'px';
        canvas.style.height = cssHeight + 'px';
        canvas.width = Math.max(1, Math.floor(cssWidth * dpr));
        canvas.height = Math.max(1, Math.floor(cssHeight * dpr));
      }
    };

    // animation state
    const cellWidth = 148; // +20px as requested
    const cellHeight = 44; // slightly taller rows for legibility
    const gridColor = 'rgba(255,255,255,0.12)';
    const gridLineWidthCss = 2;
    const selectBorderColor = 'rgba(45,212,191,0.9)';
    const selectFillColor = 'rgba(45,212,191,0.18)';
    const textColor = 'rgba(255,255,255,0.95)';
    const cursorColor = 'rgba(255,255,255,0.9)';
    const text = 'Blazingly Fast';

    const durations = {
      introFade: 600,
      move: 1400,
      click: 250,
      typePerChar: 120,
      pauseAfterType: 800,
      selectFade: 400,
      moveToStart: 900,
      expandSelect: 800,
      moveToTopOfSel: 700,
      drag: 1600,
      resetPause: 800,
    } as const;

    let stage = -1; // intro fade stage
    let stageStart = performance.now();
    const introStart = stageStart;
    let typed = 0;
    let dragOffsetX = 0;
    let dragOffsetY = 0;
    let lastCursorX = 0;
    let lastCursorY = 0;

    // precomputed selection target size
    const selCols = 3;
    const selRows = 3;

    const easeInOut = (t: number) => (t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t);
    const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
    const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

    const quadBezier = (
      t: number,
      p0x: number,
      p0y: number,
      c1x: number,
      c1y: number,
      p1x: number,
      p1y: number,
    ) => {
      const u = 1 - t;
      const x = u * u * p0x + 2 * u * t * c1x + t * t * p1x;
      const y = u * u * p0y + 2 * u * t * c1y + t * t * p1y;
      return { x, y };
    };

    const controlPoint = (
      sx: number,
      sy: number,
      ex: number,
      ey: number,
      curvature = 0.25,
    ) => {
      const dx = ex - sx;
      const dy = ey - sy;
      const mx = sx + dx * 0.5;
      const my = sy + dy * 0.5;
      const len = Math.hypot(dx, dy) || 1;
      const nx = -dy / len;
      const ny = dx / len;
      const offset = len * curvature;
      const bias = dy > 0 ? 1 : -1; // bias the arc for a natural feel
      return { x: mx + nx * offset * 0.6 * bias, y: my + ny * offset * 0.6 * bias };
    };

    const stepEase = (steps: number, t: number) => {
      const total = Math.max(0, steps);
      if (total === 0) return 0;
      const x = clamp01(t) * total;
      const i = Math.floor(x);
      const f = x - i;
      return Math.min(total, i + easeInOut(f));
    };

    // load SVG cursors into images
    const pointerSvg = `<?xml version="1.0" encoding="utf-8"?>\n<!DOCTYPE svg PUBLIC "-//W3C//DTD SVG 1.1//EN" "http://www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd">\n<svg version="1.1" xmlns="http://www.w3.org/2000/svg" x="0px" y="0px" viewBox="0 0 28 28" enable-background="new 0 0 28 28" xml:space="preserve"><polygon fill="#FFFFFF" points="8.2,20.9 8.2,4.9 19.8,16.5 13,16.5 12.6,16.6 "/><polygon fill="#FFFFFF" points="17.3,21.6 13.7,23.1 9,12 12.7,10.5 "/><rect x="12.5" y="13.6" transform="matrix(0.9221 -0.3871 0.3871 0.9221 -5.7605 6.5909)" width="2" height="8"/><polygon points="9.2,7.3 9.2,18.5 12.2,15.6 12.6,15.5 17.4,15.5 "/></svg>`;
    const dragSvg = `<?xml version="1.0" encoding="utf-8"?>\n<!DOCTYPE svg PUBLIC "-//W3C//DTD SVG 1.1//EN" "http://www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd">\n<svg version="1.1" xmlns="http://www.w3.org/2000/svg" x="0px" y="0px" viewBox="0 0 32 32" enable-background="new 0 0 32 32" xml:space="preserve"><path fill="#FFFFFF" d="M12.6,13c0.5-0.2,1.4-0.1,1.7,0.5c0.2,0.5,0.4,1.2,0.4,1.1c0-0.4,0-1.2,0.1-1.6 c0.1-0.3,0.3-0.6,0.7-0.7c0.3-0.1,0.6-0.1,0.9-0.1c0.3,0.1,0.6,0.3,0.8,0.5c0.4,0.6,0.4,1.9,0.4,1.8c0.1-0.3,0.1-1.2,0.3-1.6 c0.1-0.2,0.5-0.4,0.7-0.5c0.3-0.1,0.7-0.1,1,0c0.2,0,0.6,0.3,0.7,0.5c0.2,0.3,0.3,1.3,0.4,1.7c0,0.1,0.1-0.4,0.3-0.7 c0.4-0.6,1.8-0.8,1.9,0.6c0,0.7,0,0.6,0,1.1c0,0.5,0,0.8,0,1.2c0,0.4-0.1,1.3-0.2,1.7c-0.1,0.3-0.4,1-0.7,1.4c0,0-1.1,1.2-1.2,1.8 c-0.1,0.6-0.1,0.6-0.1,1c0,0.4,0.1,0.9,0.1,0.9s-0.8,0.1-1.2,0c-0.4-0.1-0.9-0.8-1-1.1c-0.2-0.3-0.5-0.3-0.7,0 c-0.2,0.4-0.7,1.1-1,1.1c-0.7,0.1-2.1,0-3.1,0c0,0,0.2-1-0.2-1.4c-0.3-0.3-0.8-0.8-1.1-1.1l-0.8-0.9c-0.3-0.4-1-0.9-1.2-2 c-0.2-0.9-0.2-1.4,0-1.8c0.2-0.4,0.7-0.6,0.9-0.6c0.2,0,0.7,0,0.9,0.1c0.2,0.1,0.3,0.2,0.5,0.4c0.2,0.3,0.3,0.5,0.2,0.1 c-0.1-0.3-0.3-0.6-0.4-1c-0.1-0.4-0.4-0.9-0.4-1.5C11.7,13.9,11.8,13.3,12.6,13"/></svg>`;
    // setup images
    const pointerImg = new Image();
    const dragImg = new Image();
    pointerImgRef.current = pointerImg;
    dragImgRef.current = dragImg;
    pointerImg.onload = () => { pointerLoadedRef.current = true; };
    dragImg.onload = () => { dragLoadedRef.current = true; };
    pointerImg.src = 'data:image/svg+xml;utf8,' + encodeURIComponent(pointerSvg);
    dragImg.src = 'data:image/svg+xml;utf8,' + encodeURIComponent(dragSvg);

    // baseline cursor positions (will be recomputed per-frame based on canvas size)
    const getLayout = () => {
      const halfX = cssWidth * 0.60;
      const col = Math.max(1, Math.floor(halfX / cellWidth));
      const row = Math.max(1, Math.floor((cssHeight * 0.45) / cellHeight));
      const cellX = col * cellWidth;
      const cellY = row * cellHeight;
      const cellCx = cellX + cellWidth / 2;
      const cellCy = cellY + cellHeight / 2;
      const cursorStartX = Math.min(cssWidth - 20, Math.max(20, cssWidth * 0.85));
      const cursorStartY = Math.max(20, cssHeight * 0.25);
      return { col, row, cellX, cellY, cellCx, cellCy, cursorStartX, cursorStartY };
    };

    let rafId = 0;
    const render = (now: number) => {
      resize();

      // clear and set transform
      if ('resetTransform' in ctx && typeof (ctx as any).resetTransform === 'function') {
        (ctx as any).resetTransform();
      }
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.save();
      ctx.scale(dpr, dpr);

      // draw grid (with intro fade)
      const introT = clamp01((performance.now() - introStart) / durations.introFade);
      const gridAlpha = stage === -1 ? easeInOut(introT) : 1;
      ctx.globalAlpha = gridAlpha;
      ctx.lineWidth = gridLineWidthCss / dpr;
      ctx.strokeStyle = gridColor;
      const alignOffset = gridLineWidthCss % 2 === 1 ? 0.5 : 0;

      for (let x = 0; x <= cssWidth; x += cellWidth) {
        ctx.beginPath();
        ctx.moveTo(x + alignOffset, 0);
        ctx.lineTo(x + alignOffset, cssHeight);
        ctx.stroke();
      }
      for (let y = 0; y <= cssHeight; y += cellHeight) {
        ctx.beginPath();
        ctx.moveTo(0, y + alignOffset);
        ctx.lineTo(cssWidth, y + alignOffset);
        ctx.stroke();
      }

      // right-half interaction animation
      const { cellX, cellY, cellCx, cellCy, cursorStartX, cursorStartY } = getLayout();

      // stage logic
      const dt = now - stageStart;
      if (stage === -1) {
        // Only grid fades in; start stage 0 after fade completes
        if (introT >= 1) { stage = 0; stageStart = now; }
      } else if (stage === 0) {
        // move cursor to target cell center with a curved path
        const p = easeInOut(clamp01(dt / durations.move));
        const cp = controlPoint(cursorStartX, cursorStartY, cellCx, cellCy, 0.25);
        const pos = quadBezier(p, cursorStartX, cursorStartY, cp.x, cp.y, cellCx, cellCy);
        lastCursorX = pos.x; lastCursorY = pos.y;
        drawCursor(ctx, pos.x, pos.y, 'pointer');
        if (p >= 1) { stage = 1; stageStart = now; }
      } else if (stage === 1) {
        // click effect
        const p = clamp01(dt / durations.click);
        const r = lerp(6, 3, p);
        lastCursorX = cellCx; lastCursorY = cellCy;
        drawCursor(ctx, lastCursorX, lastCursorY, 'pointer');
        if (p >= 1) { stage = 2; stageStart = now; typed = 0; }
      } else if (stage === 2) {
        // selected cell with typing
        drawSelectedCells(ctx, cellX, cellY, 1, 1, 0);
        const perChar = durations.typePerChar;
        const chars = Math.min(text.length, Math.floor(dt / perChar));
        typed = chars;
        const typedValue = text.slice(0, chars);
        drawCellText(ctx, cellX, cellY, typedValue);
        // caret behavior: solid while typing, blinking when static (after typing completes, before moving on)
        const typingComplete = chars >= text.length;
        if (typingComplete) {
          const blinkOn = Math.floor(now / 500) % 2 === 0;
          if (blinkOn) drawInputCaret(ctx, cellX, cellY, typedValue);
        } else {
          drawInputCaret(ctx, cellX, cellY, typedValue);
        }
        lastCursorX = cellCx + 12; lastCursorY = cellCy + 10;
        drawCursor(ctx, lastCursorX, lastCursorY, 'pointer');
        if (chars >= text.length && dt > text.length * perChar + durations.pauseAfterType) {
          stage = 3; stageStart = now;
        }
      } else if (stage === 3) {
        // move cursor to selection start (one row above the typed cell)
        const anchorCx = cellCx;
        const anchorCy = cellY - cellHeight / 2;
        const p = easeInOut(clamp01(dt / durations.moveToStart));
        const cp = controlPoint(lastCursorX, lastCursorY, anchorCx, anchorCy, 0.3);
        const pos = quadBezier(p, lastCursorX, lastCursorY, cp.x, cp.y, anchorCx, anchorCy);
        // keep selection fixed on the typed cell during the move
        drawSelectedCells(ctx, cellX, cellY, 1, 1, 0, 1);
        drawCellText(ctx, cellX, cellY, text.slice(0, typed));
        drawCursor(ctx, pos.x, pos.y, 'pointer');
        if (p >= 1) { stage = 4; stageStart = now; }
      } else if (stage === 4) {
        // expand selection from one row above to include typed cell and neighbors
        const selStartX = cellX;
        const selStartY = Math.max(0, cellY - cellHeight);
        const pRaw = clamp01(dt / Math.max(150, durations.expandSelect * 0.4)); // much faster
        // snap progression with eased intra-step motion
        const targetCols = selCols - 1; // steps from 1 -> selCols
        const targetRows = selRows - 1; // steps from 1 -> selRows
        const colsProgress = stepEase(targetCols, pRaw);
        const rowsProgress = stepEase(targetRows, pRaw);
        const cols = Math.max(1, Math.round(1 + colsProgress));
        const rows = Math.max(1, Math.round(1 + rowsProgress));
        // fade-in during early expansion
        const alpha = pRaw < 0.5 ? lerp(0.15, 1, easeInOut(pRaw / 0.5)) : 1;
        // selection grows only during drag-select phase
        const colsT = 1 + colsProgress;
        const rowsT = 1 + rowsProgress;
        drawSelectedCells(ctx, selStartX, selStartY, colsT, rowsT, 0, alpha);
        drawCellText(ctx, cellX, cellY, text.slice(0, typed));
        // cursor arcs to the bottom-right of the selection as it grows
        const endX = selStartX + colsT * cellWidth;
        const endY = selStartY + rowsT * cellHeight;
        const cp2 = controlPoint(lastCursorX || selStartX, lastCursorY || selStartY, endX, endY, 0.25);
        const pos = quadBezier(clamp01(colsProgress / Math.max(1, targetCols)), lastCursorX || selStartX, lastCursorY || selStartY, cp2.x, cp2.y, endX, endY);
        drawCursor(ctx, pos.x, pos.y, 'pointer');
        if (pRaw >= 1) { stage = 5; stageStart = now; }
      } else if (stage === 5) {
        // move cursor to the top-center of the selection before dragging
        const selStartX = cellX;
        const selStartY = Math.max(0, cellY - cellHeight);
        const selEndX = selStartX + selCols * cellWidth;
        const selEndY = selStartY + selRows * cellHeight;
        const topCenterX = selStartX + (selEndX - selStartX) / 2;
        const topCenterY = selStartY;
        const p = easeInOut(clamp01(dt / durations.moveToTopOfSel));
        const cp3 = controlPoint(selEndX, selEndY, topCenterX, topCenterY, 0.3);
        const pos = quadBezier(p, selEndX, selEndY, cp3.x, cp3.y, topCenterX, topCenterY);
        // hold full selection static before the drag-off phase
        drawSelectedCells(ctx, selStartX, selStartY, selCols, selRows, 0, 1);
        drawCellText(ctx, cellX, cellY, text.slice(0, typed));
        drawCursor(ctx, pos.x, pos.y, 'pointer');
        if (p >= 1) { stage = 6; stageStart = now; dragOffsetX = 0; }
      } else if (stage === 6) {
        // drag selection to the right off-screen starting from top-center with a human-like curved path
        const selStartX = cellX;
        const selStartY = Math.max(0, cellY - cellHeight);
        const startX = selStartX + (selCols * cellWidth) / 2;
        const startY = selStartY;
        const tRaw = clamp01(dt / durations.drag);
        const t = easeInOut(tRaw);
        const endX = cssWidth + selCols * cellWidth + 120;
        const endY = startY + Math.min(16, cellHeight * 0.4);
        const cp = controlPoint(startX, startY, endX, endY, 0.25);
        const pos = quadBezier(t, startX, startY, cp.x, cp.y, endX, endY);
        const dragX = pos.x - startX;
        const dragY = pos.y - startY;
        dragOffsetX = dragX;
        dragOffsetY = dragY;
        // selection ghost moves along the path
        drawSelectedCells(ctx, selStartX, selStartY + dragY, selCols, selRows, dragX, 1);
        // draw gridlines inside the moving selection so they 'follow' it
        drawGridInRect(ctx, selStartX + dragX, selStartY + dragY, selCols, selRows);
        // keep typed text visible inside the moving selection
        drawCellText(ctx, cellX + dragX, cellY + dragY, text);
        // dashed outline appears after drag starts (marching ants)
        drawMarchingAntsRect(
          ctx,
          selStartX,
          selStartY,
          selCols * cellWidth,
          selRows * cellHeight,
          now,
        );
        drawCursor(ctx, pos.x, pos.y, 'drag');
        if (tRaw >= 1) { stage = 7; stageStart = now; }
      } else if (stage === 7) {
        // fade out marching ants while cursor is off-canvas
        const selStartX = cellX;
        const selStartY = Math.max(0, cellY - cellHeight);
        const p = clamp01(dt / 300); // faster fade-out
        const alpha = 1 - p;
        if (alpha > 0) {
          drawMarchingAntsRect(
            ctx,
            selStartX,
            selStartY,
            selCols * cellWidth,
            selRows * cellHeight,
            now,
            alpha,
          );
        }
        if (p >= 1) { stage = 8; stageStart = now; }
      } else if (stage === 8) {
        // return cursor to original start position along a curved path
        const { cursorStartX, cursorStartY } = getLayout();
        const fromX = Math.min(cssWidth + 40, (cellX + (selCols * cellWidth) / 2) + dragOffsetX);
        const fromY = (Math.max(0, cellY - cellHeight)) + dragOffsetY;
        const p = easeInOut(clamp01(dt / durations.move));
        const cp = controlPoint(fromX, fromY, cursorStartX, cursorStartY, 0.25);
        const pos = quadBezier(p, fromX, fromY, cp.x, cp.y, cursorStartX, cursorStartY);
        drawCursor(ctx, pos.x, pos.y, 'pointer');
        if (p >= 1) { stage = 0; stageStart = now; typed = 0; dragOffsetX = 0; dragOffsetY = 0; }
      }

      ctx.restore();
      rafId = requestAnimationFrame(render);
    };

    const drawCursor = (
      c: CanvasRenderingContext2D,
      x: number,
      y: number,
      type: 'pointer' | 'drag',
    ) => {
      const img = type === 'drag' ? dragImgRef.current : pointerImgRef.current;
      const loaded = type === 'drag' ? dragLoadedRef.current : pointerLoadedRef.current;
      c.save();
      if (img && loaded) {
        const scale = Math.max(1, Math.min(1.75, (dpr || 1)));
        const w = type === 'drag' ? 24 * scale : 20 * scale;
        const h = type === 'drag' ? 24 * scale : 20 * scale;
        // offset so the tip aligns with the target point
        const offsetX = type === 'drag' ? w * 0.5 : 2;
        const offsetY = type === 'drag' ? h * 0.25 : 2;
        c.imageSmoothingEnabled = true;
        c.drawImage(img, x - offsetX, y - offsetY, w, h);
      } else {
        // fallback circle until SVGs load
        c.fillStyle = cursorColor;
        c.beginPath();
        c.arc(x, y, 6, 0, Math.PI * 2);
        c.fill();
      }
      c.restore();
    };

    const drawSelectedCells = (
      c: CanvasRenderingContext2D,
      x: number,
      y: number,
      cols: number,
      rows: number,
      offsetX: number,
      alpha = 1,
    ) => {
      const px = x + offsetX;
      const py = y;
      const w = cols * cellWidth;
      const h = rows * cellHeight;

      // fill inside area
      c.save();
      c.globalAlpha = Math.max(0, Math.min(1, alpha));
      c.fillStyle = selectFillColor;
      c.fillRect(px + 1, py + 1, w - 2, h - 2);

      // border
      // align selection stroke to gridlines; use full cell box
      const selBorderWidthCss = 2; // match grid thickness visually
      c.lineWidth = selBorderWidthCss / dpr;
      c.strokeStyle = selectBorderColor;
      const offset = selBorderWidthCss % 2 === 1 ? 0.5 : 0; // align to pixel grid
      c.beginPath();
      c.rect(px + offset, py + offset, w, h);
      c.stroke();
      c.restore();
    };

    const drawCellText = (
      c: CanvasRenderingContext2D,
      x: number,
      y: number,
      value: string,
    ) => {
      const paddingX = 12;
      const paddingY = 12;
      c.save();
      c.fillStyle = textColor;
      c.textAlign = 'left';
      c.textBaseline = 'middle';
      c.font = '600 16px Inter, ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, sans-serif';
      const ty = y + cellHeight / 2 + 1; // slight optical adjustment
      c.fillText(value, x + paddingX, ty);
      c.restore();
    };

    const measureTextWidth = (
      c: CanvasRenderingContext2D,
      value: string,
    ) => {
      c.save();
      c.font = '600 16px Inter, ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, sans-serif';
      const w = c.measureText(value).width;
      c.restore();
      return w;
    };

    const drawInputCaret = (
      c: CanvasRenderingContext2D,
      x: number,
      y: number,
      value: string,
    ) => {
      const paddingX = 12;
      const ty = y + cellHeight / 2 + 1;
      const tx = x + paddingX + measureTextWidth(c, value);
      c.save();
      c.strokeStyle = 'rgba(255,255,255,0.9)';
      c.lineWidth = 1.5 / dpr;
      // draw caret ~16px tall centered vertically
      c.beginPath();
      c.moveTo(tx, ty - 10);
      c.lineTo(tx, ty + 10);
      c.stroke();
      c.restore();
    };

    const drawMarchingAntsRect = (
      c: CanvasRenderingContext2D,
      x: number,
      y: number,
      w: number,
      h: number,
      nowMs: number,
      alpha = 1,
    ) => {
      c.save();
      c.globalAlpha = Math.max(0, Math.min(1, alpha));
      c.setLineDash([6, 4]);
      c.lineDashOffset = -((nowMs / 110) % 20);
      c.lineWidth = 4 / dpr; // slightly thicker
      c.strokeStyle = 'rgba(255,255,255,0.75)'; // 75% opacity white
      const offset = 0.5;
      c.strokeRect(x + offset, y + offset, w - 1, h - 1);
      c.restore();
    };

    const drawGridInRect = (
      c: CanvasRenderingContext2D,
      x: number,
      y: number,
      cols: number,
      rows: number,
    ) => {
      c.save();
      c.beginPath();
      c.rect(x, y, cols * cellWidth, rows * cellHeight);
      c.clip();
      c.lineWidth = gridLineWidthCss / dpr;
      c.strokeStyle = gridColor;
      const alignOffset = gridLineWidthCss % 2 === 1 ? 0.5 : 0;
      const maxX = x + cols * cellWidth;
      const maxY = y + rows * cellHeight;
      for (let vx = x; vx <= maxX; vx += cellWidth) {
        c.beginPath();
        c.moveTo(vx + alignOffset, y);
        c.lineTo(vx + alignOffset, maxY);
        c.stroke();
      }
      for (let hy = y; hy <= maxY; hy += cellHeight) {
        c.beginPath();
        c.moveTo(x, hy + alignOffset);
        c.lineTo(maxX, hy + alignOffset);
        c.stroke();
      }
      c.restore();
    };

    const observer = new ResizeObserver(() => {
      resize();
      // paint synchronously on resize to reduce perceived lag
      render(performance.now());
    });
    observer.observe(container);
    window.addEventListener('resize', () => {
      resize();
      render(performance.now());
    });
    // Do an immediate render to avoid the first-frame RAF delay
    resize();
    render(performance.now());

    return () => {
      cancelAnimationFrame(rafId);
      observer.disconnect();
      window.removeEventListener('resize', resize);
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className="absolute top-[-160px] left-[-160px] w-[calc(100%_+_320px)] h-[calc(100%_+_320px)] pointer-events-none"
    >
      {/* Blurred blob gradients: orange, teal, and purple */}
      <div
        className="pointer-events-none absolute inset-[-10%] [filter:blur(100px)]"
        style={{
          background: [
            'radial-gradient(80rem 80rem at 15% 20%, rgba(255,140,66,0.55), transparent 70%)',
            'radial-gradient(80rem 80rem at 85% 25%, rgba(45,212,191,0.55), transparent 70%)',
            'radial-gradient(80rem 80rem at 50% 90%, rgba(168,85,247,0.55), transparent 70%)',
          ].join(', '),
        }}
      />

      {/* Transparent canvas for the spreadsheet grid */}
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />

      {/* Soft highlight overlay */}
      <div
        className="pointer-events-none absolute inset-[-15%] opacity-30 mix-blend-overlay [mask-image:radial-gradient(80%_80%_at_50%_50%,_#000_60%,_transparent_100%)]"
        style={{
          background: [
            'radial-gradient(120rem 120rem at 50% 20%, rgba(255,255,255,0.06), transparent 60%)',
          ].join(', '),
        }}
      />
    </div>
  );
}


