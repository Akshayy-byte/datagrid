import type { DrawBaseArgs } from '../types';

export function renderResizeHandles(
  ctx: CanvasRenderingContext2D,
  args: DrawBaseArgs & { resizeHandleState?: { visibleIndex: number; progress: number; mouseY: number } },
  getColumnRightEdgeX: (columnWidths: { gutter: number; columns: number[] }, scrollLeft: number, index: number) => number,
  toRgba: (color: string, alpha: number) => string,
  alignToDevicePixelEdge: (n: number) => number,
): void {
  const state = args.resizeHandleState;
  if (!state || state.visibleIndex == null || state.visibleIndex < 0) return;

  const { rect, theme, columnWidths, scroll, helpers } = args;
  const idx = Math.min(state.visibleIndex, columnWidths.columns.length - 1);
  const handleX = getColumnRightEdgeX(columnWidths as any, scroll.left, idx);
  if (handleX < 0 || handleX > rect.width) return;

  const progress = Math.max(0, Math.min(1, state.progress ?? 0));

  const RESIZE_HANDLE_VISUAL_WIDTH = 4;
  const RESIZE_HANDLE_PILL_RADIUS = 6;
  const RESIZE_HANDLE_PILL_DOT_SPACING = 8;
  const basePillWidth = theme.resizeHandlePillWidth;
  const basePillHeight = theme.resizeHandlePillHeight;
  const baseDotRadius = theme.resizeHandleDotRadius;

  const opacity = 0.9 + 0.1 * progress;
  const widthMultiplier = 0.8 + 0.2 * progress;
  const heightMultiplier = 0.9 + 0.1 * progress;
  const pillDotOpacityMultiplier = 1 * progress;
  const animatedWidth = RESIZE_HANDLE_VISUAL_WIDTH * widthMultiplier;
  const pillWidth = basePillWidth * widthMultiplier;
  const pillHeight = basePillHeight * heightMultiplier;
  const pillRadius = RESIZE_HANDLE_PILL_RADIUS;

  const screenX = handleX;
  const pillX = screenX - pillWidth / 2;
  const pillY = state.mouseY - pillHeight / 2;

  ctx.save();
  ctx.strokeStyle = theme.resizeHandleLineColor;
  ctx.lineWidth = animatedWidth;
  ctx.globalAlpha = opacity;

  if (pillY > 0) {
    ctx.beginPath();
    ctx.moveTo(screenX, 0);
    ctx.lineTo(screenX, pillY);
    ctx.stroke();
  }

  if (pillY + pillHeight < rect.height) {
    ctx.beginPath();
    ctx.moveTo(screenX, pillY + pillHeight);
    ctx.lineTo(screenX, rect.height);
    ctx.stroke();
  }

  ctx.fillStyle = theme.resizeHandlePillFill;
  ctx.beginPath();
  ctx.roundRect(pillX, pillY, pillWidth, pillHeight, pillRadius);
  ctx.fill();

  const dotAlpha = Math.max(0, Math.min(1, theme.resizeHandleDotOpacity * pillDotOpacityMultiplier));
  ctx.globalAlpha = 1;
  ctx.fillStyle = toRgba(theme.resizeHandleDotColor, dotAlpha);
  const dotX = alignToDevicePixelEdge(screenX);
  const totalDotsHeight = (3 - 1) * RESIZE_HANDLE_PILL_DOT_SPACING;
  const dotsStartY = alignToDevicePixelEdge(state.mouseY - totalDotsHeight / 2);
  for (let i = 0; i < 3; i++) {
    const dotY = alignToDevicePixelEdge(dotsStartY + i * RESIZE_HANDLE_PILL_DOT_SPACING);
    ctx.beginPath();
    ctx.arc(dotX, dotY, baseDotRadius, 0, 2 * Math.PI);
    ctx.fill();
  }

  ctx.globalAlpha = 1;
  ctx.restore();
}

