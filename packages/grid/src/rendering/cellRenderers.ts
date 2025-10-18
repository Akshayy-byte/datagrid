import type { AnchorRect, DrawHelpers, FormatCell, ThemeTokens } from '../types';
import { RenderCaches } from './RenderCaches';

export function drawDefaultHeaderCell(
  ctx: CanvasRenderingContext2D,
  helpers: DrawHelpers,
  theme: ThemeTokens,
  args: { colRect: AnchorRect; headerText: string }
): void {
  const { colRect, headerText } = args;

  ctx.save();

  const alignedRect = helpers.alignRect(colRect);

  // Header background
  ctx.fillStyle = theme.muted;
  ctx.fillRect(alignedRect.x, alignedRect.y, alignedRect.width, alignedRect.height);

  // Header text
  if (headerText) {
    ctx.fillStyle = theme.foreground;
    ctx.font = `bold ${theme.textSm * 16}px ${theme.fontSans}`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';

    const padding = 8;
    const maxWidth = alignedRect.width - padding * 2;
    const { text } = helpers.truncateText(ctx, headerText, maxWidth);

    ctx.fillText(text, alignedRect.x + padding, alignedRect.y + alignedRect.height / 2);
  }

  ctx.restore();
}

export function drawDefaultCell(
  ctx: CanvasRenderingContext2D,
  helpers: DrawHelpers,
  theme: ThemeTokens,
  caches: RenderCaches,
  formatCell: FormatCell | undefined,
  cellArgs: { row: number; col: number; cellRect: AnchorRect; value: string }
): void {
  const { row, col, cellRect, value } = cellArgs;

  // Align to device pixels like selection highlight for consistent positioning
  const alignedRect = helpers.alignRect(cellRect);

  // Apply formatting if available
  const formatting = formatCell?.(value, row, col);

  // Fill background if specified
  if (formatting?.background) {
    caches.setFillStyle(formatting.background);
    ctx.fillRect(alignedRect.x, alignedRect.y, alignedRect.width, alignedRect.height);
  }

  // Draw text
  if (value) {
    caches.setFillStyle(formatting?.color || theme.foreground);

    const padding = 8;
    const maxWidth = alignedRect.width - padding * 2;
    let text: string;
    const key = value + '|' + maxWidth;
    if (caches.frameTextCacheByColumn && caches.frameTextCacheByColumn[col]) {
      const colCache = caches.frameTextCacheByColumn[col];
      const cached = colCache.get(key);
      if (cached) {
        text = cached.text;
      } else {
        const res = helpers.truncateText(ctx, value, maxWidth);
        text = res.text;
        colCache.set(key, res);
      }
    } else {
      text = helpers.truncateText(ctx, value, maxWidth).text;
    }

    let textX = alignedRect.x + padding;
    if (formatting?.textAlign === 'center') {
      textX = alignedRect.x + alignedRect.width / 2;
      caches.setTextAlign('center');
    } else if (formatting?.textAlign === 'right') {
      textX = alignedRect.x + alignedRect.width - padding;
      caches.setTextAlign('right');
    } else {
      caches.setTextAlign('left');
    }

    ctx.fillText(text, textX, alignedRect.y + alignedRect.height / 2);
  }
}


