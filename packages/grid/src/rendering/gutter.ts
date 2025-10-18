import type { DrawBaseArgs } from '../types';

export function renderGutter(
  ctx: CanvasRenderingContext2D,
  args: DrawBaseArgs,
  getBaseY: (rowHeight: number, headerHeight: number, scrollTop: number) => number,
): void {
  const { rect, theme, columnWidths, rowHeight, headerHeight, visibleRange, helpers, scroll } = args;
  if (!rect || rect.width <= 0 || rect.height <= 0) return;

  // Fill gutter background only below header so header can be overlaid
  ctx.save();
  ctx.fillStyle = theme.muted;
  ctx.fillRect(0, headerHeight, columnWidths.gutter, rect.height - headerHeight);
  ctx.restore();

  // Draw row numbers in gutter (behind header - clipped below header)
  ctx.save();
  // Clip out the header so numbers don't draw over it
  ctx.beginPath();
  ctx.rect(0, headerHeight, columnWidths.gutter, rect.height - headerHeight);
  ctx.clip();
  ctx.fillStyle = theme.mutedForeground || theme.foreground;
  ctx.font = `${theme.textSm * 16}px ${theme.fontSans}`;
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';

  const startRow = Math.max(0, Math.floor(scroll.top / rowHeight));
  const endRow = Math.min(startRow + Math.ceil((rect.height - headerHeight) / rowHeight) + 1, Number.MAX_SAFE_INTEGER);
  const baseY = getBaseY(rowHeight, headerHeight, scroll.top);

  for (let r = startRow; r < endRow; r++) {
    const y = baseY + (r - startRow) * rowHeight + rowHeight / 2;
    const label = String(r + 1);
    ctx.fillText(label, columnWidths.gutter - 6, y);
  }

  // Draw horizontal gridlines inside gutter (below header)
  ctx.strokeStyle = theme.border || '#e5e5e5';
  ctx.lineWidth = theme.gridlineWidth || 0.5;
  let y = getBaseY(rowHeight, headerHeight, scroll.top);
  for (let row = visibleRange.startRow; row < visibleRange.endRow; row++) {
    const alignedY = helpers.alignY(y);
    if (alignedY > headerHeight) {
      ctx.beginPath();
      ctx.moveTo(0, alignedY);
      ctx.lineTo(columnWidths.gutter, alignedY);
      ctx.stroke();
    }
    y += rowHeight;
  }
  ctx.restore();
}

export function renderGutterHeaderOverlay(
  ctx: CanvasRenderingContext2D,
  args: DrawBaseArgs,
): void {
  const { columnWidths, headerHeight, helpers } = args;
  const theme = args.theme;
  ctx.save();
  ctx.fillStyle = theme.muted;
  ctx.fillRect(0, 0, columnWidths.gutter, headerHeight);
  ctx.fillStyle = theme.foreground;
  ctx.font = `bold ${theme.textSm * 16}px ${theme.fontSans}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('#', columnWidths.gutter / 2, headerHeight / 2);

  const headerBottom = helpers.alignY(headerHeight);
  ctx.strokeStyle = theme.border || '#e5e5e5';
  ctx.lineWidth = theme.gridlineWidth || 0.5;
  ctx.beginPath();
  ctx.moveTo(0, headerBottom);
  ctx.lineTo(columnWidths.gutter, headerBottom);
  ctx.stroke();
  ctx.restore();
}

export function renderGutterBorderOverlay(
  ctx: CanvasRenderingContext2D,
  args: DrawBaseArgs,
): void {
  const { rect, columnWidths, helpers } = args;
  ctx.save();
  const gutterRight = helpers.alignX(columnWidths.gutter);
  ctx.strokeStyle = args.theme.border || '#e5e5e5';
  ctx.lineWidth = args.theme.gridlineWidth || 0.5;
  ctx.beginPath();
  ctx.moveTo(gutterRight, 0);
  ctx.lineTo(gutterRight, rect.height);
  ctx.stroke();
  ctx.restore();
}


