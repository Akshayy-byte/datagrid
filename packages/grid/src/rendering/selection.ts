import type { DrawAPI, DrawSelectionArgs } from '../types';

export function drawDefaultSelectionBackground(ctx: CanvasRenderingContext2D, args: DrawSelectionArgs): void {
  const { theme, selection, selectionRect, helpers } = args;
  if (!selection || !selectionRect) return;
  ctx.save();
  const fill = theme.selectionFill;
  ctx.fillStyle = fill;
  const alignedRect = helpers.alignRect(selectionRect);
  ctx.fillRect(alignedRect.x, alignedRect.y, alignedRect.width, alignedRect.height);
  ctx.restore();
}

export function drawDefaultSelectionBorder(ctx: CanvasRenderingContext2D, args: DrawSelectionArgs): void {
  const { theme, selection, selectionRect, helpers } = args;
  if (!selection || !selectionRect) return;
  ctx.save();
  const borderColor = theme.selectionBorder;
  const borderWidth = theme.selectionBorderWidth;
  ctx.strokeStyle = borderColor;
  ctx.lineWidth = borderWidth;
  const alignedRect = helpers.alignRect(selectionRect);
  ctx.strokeRect(alignedRect.x, alignedRect.y, alignedRect.width, alignedRect.height);
  ctx.restore();
}

export function drawDefaultSelection(ctx: CanvasRenderingContext2D, args: DrawSelectionArgs): void {
  drawDefaultSelectionBackground(ctx, args);
  drawDefaultSelectionBorder(ctx, args);
}

export function renderSelection(
  ctx: CanvasRenderingContext2D,
  args: DrawSelectionArgs,
  overrides: Partial<{
    drawSelection: (ctx: CanvasRenderingContext2D, args: DrawSelectionArgs, api: DrawAPI) => void;
  }>,
): void {
  if (!args.selection || !args.selectionRect) return;
  if (overrides.drawSelection) {
    const api: DrawAPI = {
      drawDefault: () => drawDefaultSelection(ctx, args),
      drawDefaultBackground: () => drawDefaultSelectionBackground(ctx, args),
      drawDefaultBorder: () => drawDefaultSelectionBorder(ctx, args),
    };
    overrides.drawSelection(ctx, args, api);
  } else {
    drawDefaultSelection(ctx, args);
  }
}

