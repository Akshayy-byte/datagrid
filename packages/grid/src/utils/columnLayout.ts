import type { ThemeTokens } from '../types';
import type { ResizeHandle } from './columnResizing';
import { clamp01 } from './math';

export const RESIZE_PILL_WIDTH_BASE = 0.8;
export const RESIZE_PILL_HEIGHT_BASE = 0.9;

export interface ResizeHandleDrawingState {
  progress: number;
  mouseY: number;
}

export function computeResizePillRect(
  handle: ResizeHandle,
  state: ResizeHandleDrawingState,
  theme: ThemeTokens,
): { x: number; y: number; width: number; height: number } {
  const widthMultiplier = RESIZE_PILL_WIDTH_BASE + 0.2 * clamp01(state.progress);
  const heightMultiplier = RESIZE_PILL_HEIGHT_BASE + 0.1 * clamp01(state.progress);
  const pillWidth = theme.resizeHandlePillWidth * widthMultiplier;
  const pillHeight = theme.resizeHandlePillHeight * heightMultiplier;
  const screenX = handle.rect.x + handle.rect.width / 2;
  return {
    x: screenX - pillWidth / 2,
    y: state.mouseY - pillHeight / 2,
    width: pillWidth,
    height: pillHeight,
  };
}

export function isPointInRect(
  x: number,
  y: number,
  rect: { x: number; y: number; width: number; height: number },
): boolean {
  return x >= rect.x && x <= rect.x + rect.width && y >= rect.y && y <= rect.y + rect.height;
}

export function rectEquals(
  a: { x: number; y: number; width: number; height: number } | null | undefined,
  b: { x: number; y: number; width: number; height: number } | null | undefined,
): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  return a.x === b.x && a.y === b.y && a.width === b.width && a.height === b.height;
}

export function normalizeColumnOrder(order: readonly number[] | undefined | null, columnCount: number): number[] {
  const count = Math.max(0, columnCount | 0);
  if (count === 0) return [];
  const seen = new Set<number>();
  const normalized: number[] = [];

  if (Array.isArray(order)) {
    for (const raw of order) {
      if (typeof raw !== 'number' || Number.isNaN(raw)) continue;
      const idx = Math.trunc(raw);
      if (idx < 0 || idx >= count) continue;
      if (seen.has(idx)) continue;
      seen.add(idx);
      normalized.push(idx);
    }
  }

  for (let i = 0; i < count; i++) {
    if (!seen.has(i)) {
      normalized.push(i);
    }
  }

  return normalized;
}

export function moveArrayItem<T>(values: readonly T[], fromIndex: number, toIndex: number): T[] {
  const length = values.length;
  if (length === 0) return [];
  const clampedFrom = Math.max(0, Math.min(length - 1, fromIndex));
  const clampedTo = Math.max(0, Math.min(length - 1, toIndex));
  if (clampedFrom === clampedTo) {
    return values.slice();
  }
  const next = values.slice();
  const removed = next.splice(clampedFrom, 1);
  if (removed.length === 0) {
    return values.slice();
  }
  const item = removed[0]!;
  next.splice(clampedTo, 0, item);
  return next;
}

export function arraysEqual(a: readonly number[], b: readonly number[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

export function computeColumnPositions(
  order: readonly number[],
  widthByDataIndex: Map<number, number>,
  gutterWidth: number | undefined,
  scrollLeft: number | undefined,
): Map<number, number> {
  const positions = new Map<number, number>();
  const gutter = gutterWidth ?? 0;
  const scrollValue = scrollLeft ?? 0;
  let x = gutter - scrollValue;
  for (let i = 0; i < order.length; i++) {
    const dataIndex = order[i];
    if (typeof dataIndex !== 'number' || Number.isNaN(dataIndex)) {
      continue;
    }
    positions.set(dataIndex, x);
    const width = getColumnWidth(widthByDataIndex, dataIndex);
    x += width;
  }
  return positions;
}

export function getColumnWidth(widthByDataIndex: Map<number, number>, dataIndex: number | undefined): number {
  if (typeof dataIndex !== 'number' || Number.isNaN(dataIndex)) return 0;
  return widthByDataIndex.get(dataIndex) ?? 0;
}
