import type { ColumnWidths, VisibleRange, LayoutEnvironment, LayoutOverrides, LayoutSnapshotPublic } from '../types';
import { calculateVisibleRange } from '../utils/visibleRange';

// LayoutEnvironment type is defined in types.ts and re-used here

export function computeVisibleRange(env: LayoutEnvironment, overrides?: LayoutOverrides | null): VisibleRange {
  if (overrides?.computeVisibleRange) return overrides.computeVisibleRange(env);
  const {
    scrollTop,
    scrollLeft,
    canvasRect,
    columnWidths,
    rowHeight,
    headerHeight,
    totalRows,
    totalColumns,
    overscan = 0,
  } = env;

  return calculateVisibleRange({
    scrollTop,
    scrollLeft,
    canvasRect,
    columnWidths,
    rowHeight,
    headerHeight,
    totalRows,
    totalColumns,
    overscan,
  });
}

// Estimate a gutter width based on the number of digits in the visible row labels
export function computeGutterWidth(visibleRange: VisibleRange): number {
  const maxVisibleRowIndex = Math.max(0, visibleRange.endRow - 1);
  const startDigits = String(Math.max(1, visibleRange.startRow + 1)).length;
  const endDigits = String(Math.max(1, maxVisibleRowIndex + 1)).length;
  const digits = Math.max(startDigits, endDigits);
  const estimated = 8 + digits * 8 + 8; // px
  return Math.max(32, Math.min(128, estimated));
}

// Compute left-most x for a visible column
export function computeColumnXStart(widths: ColumnWidths, scrollLeft: number, startCol: number): number {
  let x = widths.gutter - scrollLeft;
  for (let c = 0; c < startCol && c < widths.columns.length; c++) {
    x += widths.columns[c] ?? 0;
  }
  return x;
}

// Compute x positions for all visible columns
export function computeVisibleColumnXPositions(widths: ColumnWidths, range: VisibleRange, scrollLeft: number): number[] {
  const positions: number[] = [];
  let x = computeColumnXStart(widths, scrollLeft, range.startCol);
  for (let c = range.startCol; c < range.endCol && c < widths.columns.length; c++) {
    positions.push(x);
    x += widths.columns[c] ?? 0;
  }
  return positions;
}

export function computeLayoutSnapshot(env: LayoutEnvironment, overrides?: LayoutOverrides | null): LayoutSnapshotPublic {
  if (overrides?.computeLayoutSnapshot) return overrides.computeLayoutSnapshot(env);
  const vr = computeVisibleRange(env, overrides);
  const xStart = computeColumnXStart(env.columnWidths, env.scrollLeft, vr.startCol);
  const xPositions = computeVisibleColumnXPositions(env.columnWidths, vr, env.scrollLeft);
  const baseY = env.headerHeight + vr.startRow * env.rowHeight - env.scrollTop;
  return {
    visibleRange: vr,
    xStart,
    xPositions,
    baseY,
    gutter: env.columnWidths.gutter,
  };
}


