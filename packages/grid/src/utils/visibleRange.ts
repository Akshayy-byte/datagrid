import type { VisibleRange, Rect, ColumnWidths } from '../types';

export interface VisibleRangeCalculationOptions {
  scrollTop: number;
  scrollLeft: number;
  canvasRect: Rect;
  columnWidths: ColumnWidths;
  rowHeight: number;
  headerHeight: number;
  totalRows: number;
  totalColumns: number;
  overscan?: number; // applies to horizontal columns (left/right) in this calculator
}

export function calculateVisibleRange(options: VisibleRangeCalculationOptions): VisibleRange {
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
  } = options;


  // Guard against invalid canvas dimensions
  if (canvasRect.width <= 0 || canvasRect.height <= 0) {
    return { startRow: 0, endRow: 0, startCol: 0, endCol: 0 };
  }

  // Debug noise reduction: visible range is summarized in renderer logs

  // Calculate visible rows - match CSV editor pattern exactly
  const startRow = Math.floor(scrollTop / rowHeight);
  const endRow = Math.min(
    totalRows,
    Math.ceil((scrollTop + canvasRect.height - headerHeight) / rowHeight) + 1,
  );

  // Calculate visible columns (similar to computeVisibleCols from CSV editor)
  let startCol = 0;
  let endCol = totalColumns; // Default to showing all columns
  let currentX = columnWidths.gutter; // Start after gutter

  // Find start column (treat boundary as still within the left column to keep continuity)
  for (let col = 0; col < totalColumns && col < columnWidths.columns.length; col++) {
    const colWidth = columnWidths.columns[col] ?? 0;
    const colEndX = currentX + colWidth;

    if (colEndX >= scrollLeft) {
      startCol = col;
      break;
    }
    currentX += colWidth;
  }

  // Find end column (no overscan, matching CSV editor)
  const rightEdge = scrollLeft + canvasRect.width;
  currentX = columnWidths.gutter;

  for (let col = 0; col < totalColumns && col < columnWidths.columns.length; col++) {
    const colWidth = columnWidths.columns[col] ?? 0;
    currentX += colWidth;

    if (currentX >= rightEdge) {
      endCol = Math.min(totalColumns, col + 1);
      break;
    }
  }

  // Ensure we show all available columns if we have fewer column widths than total columns
  endCol = Math.min(totalColumns, Math.max(endCol, columnWidths.columns.length));

  // Apply horizontal overscan symmetrically to reduce edge snapping perception
  if (overscan > 0) {
    const leftOverscan = Math.min(overscan, startCol);
    const rightOverscan = Math.min(overscan, totalColumns - endCol);
    startCol = startCol - leftOverscan;
    endCol = endCol + rightOverscan;
  }

  const result = {
    startRow,
    endRow,
    startCol,
    endCol,
  };


  return result;
}

export function isValidVisibleRange(range: VisibleRange): boolean {
  return (
    range.startRow >= 0 &&
    range.endRow > range.startRow &&
    range.startCol >= 0 &&
    range.endCol > range.startCol
  );
}
