import type { Rect } from '../types';

export interface CanvasDprOptions {
  devicePixelRatio?: number;
  onCanvasRectChange?: (rect: Rect) => void;
}

export function setupCanvasForDpr(
  canvas: HTMLCanvasElement,
  ctx: CanvasRenderingContext2D,
  opts: CanvasDprOptions = {},
): Rect {
  const dpr = opts.devicePixelRatio ?? (window.devicePixelRatio || 1);
  const rect = canvas.getBoundingClientRect();
  canvas.width = rect.width * dpr;
  canvas.height = rect.height * dpr;
  ctx.scale(dpr, dpr);
  canvas.style.width = `${rect.width}px`;
  canvas.style.height = `${rect.height}px`;
  if (opts.onCanvasRectChange) opts.onCanvasRectChange({ width: rect.width, height: rect.height });
  return { width: rect.width, height: rect.height };
}

export function ensureCanvasSizeForDpr(
  canvas: HTMLCanvasElement,
  ctx: CanvasRenderingContext2D,
  canvasRect: Rect,
  opts: CanvasDprOptions = {},
): void {
  const dpr = opts.devicePixelRatio ?? (window.devicePixelRatio || 1);
  const expectedWidth = canvasRect.width * dpr;
  const expectedHeight = canvasRect.height * dpr;
  canvas.width = expectedWidth;
  canvas.height = expectedHeight;
  canvas.style.width = `${canvasRect.width}px`;
  canvas.style.height = `${canvasRect.height}px`;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.scale(dpr, dpr);
}


