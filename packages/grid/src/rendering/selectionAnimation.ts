import type { DrawBaseArgs, DrawSelectionArgs, DrawOverrides } from '../types';
import { renderSelection } from './selection';

export function renderAnimatedSelection(
  ctx: CanvasRenderingContext2D,
  baseArgs: DrawBaseArgs,
  transition: import('../types').SelectionTransition,
  computeSelectionRect: (sel: import('../types').SelectionRange, args: DrawBaseArgs) => { x: number; y: number; width: number; height: number } | null,
  overrides?: Partial<DrawOverrides>,
): boolean {
  if (!transition || !transition.active || !transition.fromSelection || !transition.toSelection) return false;
  const fromRect = computeSelectionRect(transition.fromSelection, baseArgs);
  const toRect = computeSelectionRect(transition.toSelection, baseArgs);
  if (!fromRect || !toRect) return false;

  const t = Math.max(0, Math.min(1, transition.progress));
  const x = fromRect.x + (toRect.x - fromRect.x) * t;
  const y = fromRect.y + (toRect.y - fromRect.y) * t;
  const w = fromRect.width + (toRect.width - fromRect.width) * t;
  const h = fromRect.height + (toRect.height - fromRect.height) * t;

  ctx.save();
  const selectionRect = baseArgs.helpers.alignRect({ x, y, width: w, height: h });
  const args: DrawSelectionArgs = {
    ...baseArgs,
    selection: transition.toSelection,
    selectionRect,
  };

  renderSelection(ctx, args, { drawSelection: overrides?.drawSelection });
  ctx.restore();
  return true;
}
