import type { ColumnWidths, VisibleRange } from '../types';

// Gutter offset with horizontal scroll applied
export function getGutterOffset(columnWidths: ColumnWidths, scrollLeft: number): number {
  return columnWidths.gutter - scrollLeft;
}

// X at the left edge of a given start column (accounts for gutter and scroll)
export function getXStartForCol(
  columnWidths: ColumnWidths,
  scrollLeft: number,
  startCol: number,
): number {
  let x = getGutterOffset(columnWidths, scrollLeft);
  const max = Math.min(startCol, columnWidths.columns.length);
  for (let c = 0; c < max; c++) {
    x += columnWidths.columns[c] ?? 0;
  }
  return x;
}

// X positions for visible columns [startCol, endCol)
export function getXPositionsForVisibleColumns(
  columnWidths: ColumnWidths,
  visibleRange: VisibleRange,
  scrollLeft: number,
): number[] {
  const startCol = visibleRange.startCol;
  const endCol = Math.min(visibleRange.endCol, columnWidths.columns.length);
  const positions = new Array(Math.max(0, endCol - startCol));
  let x = getXStartForCol(columnWidths, scrollLeft, startCol);
  for (let col = startCol; col < endCol; col++) {
    positions[col - startCol] = x;
    x += columnWidths.columns[col] ?? 0;
  }
  return positions;
}

// Right edge X for a given column index (i.e., edge after column index)
export function getColumnRightEdgeX(
  columnWidths: ColumnWidths,
  scrollLeft: number,
  columnIndex: number,
): number {
  let x = getGutterOffset(columnWidths, scrollLeft);
  const max = Math.min(columnIndex, columnWidths.columns.length - 1);
  for (let i = 0; i <= max && i < columnWidths.columns.length; i++) {
    x += columnWidths.columns[i] ?? 0;
  }
  return x;
}


