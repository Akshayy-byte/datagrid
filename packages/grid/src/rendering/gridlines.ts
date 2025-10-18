import type { DrawBaseArgs } from '../types';

export function drawHeaderGridlines(
  ctx: CanvasRenderingContext2D,
  args: DrawBaseArgs,
): void {
  const { theme, columnWidths, visibleRange, rect: canvasRect, headerHeight, scroll, helpers } = args;
  if (!canvasRect || canvasRect.width <= 0 || canvasRect.height <= 0) return;

  ctx.save();
  ctx.strokeStyle = theme.border || '#e5e5e5';
  ctx.lineWidth = theme.gridlineWidth || 0.5;

  // Vertical lines within header region
  let x = columnWidths.gutter - scroll.left;
  for (let col = 0; col <= visibleRange.endCol && col < columnWidths.columns.length; col++) {
    const shouldDraw = col >= visibleRange.startCol;
    if (shouldDraw) {
      const drawX = helpers.alignX(x);
      ctx.beginPath();
      ctx.moveTo(drawX, 0);
      ctx.lineTo(drawX, headerHeight);
      ctx.stroke();
    }
    if (col < columnWidths.columns.length) {
      x += columnWidths.columns[col] ?? 0;
    }
  }

  // Header bottom border
  const headerBottom = helpers.alignY(headerHeight);
  ctx.beginPath();
  ctx.moveTo(0, headerBottom);
  ctx.lineTo(canvasRect.width, headerBottom);
  ctx.stroke();

  ctx.restore();
}

export function drawDefaultGridlines(
  ctx: CanvasRenderingContext2D,
  args: DrawBaseArgs,
): void {
  const { theme, columnWidths, visibleRange, rect: canvasRect, scroll, rowHeight, headerHeight, helpers } = args;
  if (!canvasRect || canvasRect.width <= 0 || canvasRect.height <= 0) return;

  ctx.save();
  ctx.strokeStyle = theme.border || '#e5e5e5';
  ctx.lineWidth = theme.gridlineWidth || 0.5;

  // Gutter right border
  const gutterRight = helpers.alignX(columnWidths.gutter);
  ctx.beginPath();
  ctx.moveTo(gutterRight, 0);
  ctx.lineTo(gutterRight, canvasRect.height);
  ctx.stroke();

  // Column borders
  let x = columnWidths.gutter - scroll.left;
  for (let col = 0; col <= visibleRange.endCol && col < columnWidths.columns.length; col++) {
    const shouldDraw = col >= visibleRange.startCol;
    if (shouldDraw) {
      const drawX = helpers.alignX(x);
      ctx.beginPath();
      ctx.moveTo(drawX, 0);
      ctx.lineTo(drawX, canvasRect.height);
      ctx.stroke();
    }
    if (col < columnWidths.columns.length) {
      x += columnWidths.columns[col] ?? 0;
    }
  }

  // Header bottom border (sticky)
  const headerBottom = helpers.alignY(headerHeight);
  ctx.beginPath();
  ctx.moveTo(0, headerBottom);
  ctx.lineTo(canvasRect.width, headerBottom);
  ctx.stroke();

  // Row borders
  const rowHeightVal = rowHeight;
  const headerHeightVal = headerHeight;
  let y = headerHeightVal - (scroll.top % rowHeightVal);
  for (let row = visibleRange.startRow; row < visibleRange.endRow; row++) {
    const alignedY = helpers.alignY(y);
    if (alignedY > headerHeightVal) {
      ctx.beginPath();
      ctx.moveTo(0, alignedY);
      ctx.lineTo(canvasRect.width, alignedY);
      ctx.stroke();
    }
    y += rowHeightVal;
  }

  ctx.restore();
}


