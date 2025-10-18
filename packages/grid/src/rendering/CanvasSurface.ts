import type { Rect } from '../types';
import { ensureCanvasSizeForDpr, setupCanvasForDpr } from '../utils/canvasDpr';

export class CanvasSurface {
  public readonly canvas: HTMLCanvasElement;
  public readonly ctx: CanvasRenderingContext2D;
  public readonly devicePixelRatio: number;
  private readonly onCanvasRectChange?: (rect: Rect) => void;

  constructor(canvas: HTMLCanvasElement, onCanvasRectChange?: (rect: Rect) => void) {
    this.canvas = canvas;
    this.ctx = (canvas.getContext('2d', { alpha: false, desynchronized: true }) as CanvasRenderingContext2D) || canvas.getContext('2d')!;
    this.devicePixelRatio = window.devicePixelRatio || 1;
    this.onCanvasRectChange = onCanvasRectChange;
  }

  public setupCanvas(): void {
    const { canvas, ctx } = this;
    setupCanvasForDpr(canvas, ctx, {
      devicePixelRatio: this.devicePixelRatio,
      onCanvasRectChange: this.onCanvasRectChange,
    });
  }

  public ensureCanvasSetup(canvasRect: Rect): void {
    const { canvas, ctx } = this;
    ensureCanvasSizeForDpr(canvas, ctx, canvasRect, {
      devicePixelRatio: this.devicePixelRatio,
    });
  }

  public resize(): void {
    this.setupCanvas();
  }
}


