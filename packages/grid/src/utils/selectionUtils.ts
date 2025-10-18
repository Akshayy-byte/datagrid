import type {
  SelectionRange,
  CellPosition,
  AnchorRect,
  VisibleRange,
  ColumnWidths,
} from '../types';

export function isSelectionEqual(a: SelectionRange | null, b: SelectionRange | null): boolean {
  if (a === b) return true;
  if (!a || !b) return false;

  if (a.type !== b.type) return false;

  switch (a.type) {
    case 'cell':
      return (
        a.start.row === (b as typeof a).start.row &&
        a.start.col === (b as typeof a).start.col &&
        a.end.row === (b as typeof a).end.row &&
        a.end.col === (b as typeof a).end.col
      );
    case 'row':
      return (
        a.startRow === (b as typeof a).startRow &&
        a.endRow === (b as typeof a).endRow
      );
    case 'column':
      return (
        a.startCol === (b as typeof a).startCol &&
        a.endCol === (b as typeof a).endCol
      );
    default:
      return false;
  }
}

export function getSelectionBounds(selection: SelectionRange): {
  startRow: number;
  endRow: number;
  startCol: number;
  endCol: number;
} {
  switch (selection.type) {
    case 'cell':
      return {
        startRow: Math.min(selection.start.row, selection.end.row),
        endRow: Math.max(selection.start.row, selection.end.row),
        startCol: Math.min(selection.start.col, selection.end.col),
        endCol: Math.max(selection.start.col, selection.end.col),
      };
    case 'row':
      return {
        startRow: Math.min(selection.startRow, selection.endRow),
        endRow: Math.max(selection.startRow, selection.endRow),
        startCol: 0,
        endCol: Number.MAX_SAFE_INTEGER, // Covers all columns
      };
    case 'column':
      return {
        startRow: 0,
        endRow: Number.MAX_SAFE_INTEGER, // Covers all rows
        startCol: Math.min(selection.startCol, selection.endCol),
        endCol: Math.max(selection.startCol, selection.endCol),
      };
  }
}

export function calculateSelectionRect(
  selection: SelectionRange | null,
  columnWidths: ColumnWidths,
  visibleRange: VisibleRange,
  rowHeight: number,
  headerHeight: number,
  canvasWidth: number,
  canvasHeight: number
): AnchorRect | null {
  if (!selection) return null;

  const bounds = getSelectionBounds(selection);

  // Calculate column positions
  let startX = columnWidths.gutter;
  let endX = startX;

  // Find start column X
  for (let col = 0; col < bounds.startCol && col < columnWidths.columns.length; col++) {
    startX += columnWidths.columns[col];
  }

  // Find end column X
  endX = startX;
  for (let col = bounds.startCol; col <= bounds.endCol && col < columnWidths.columns.length; col++) {
    endX += columnWidths.columns[col];
  }

  // Handle column selections that extend beyond visible columns
  if (selection.type === 'column' && bounds.endCol >= columnWidths.columns.length - 1) {
    endX = canvasWidth;
  }

  // Calculate row positions
  let startY = headerHeight;
  let endY = startY;

  if (selection.type === 'column') {
    // Column selection covers header too
    startY = 0;
    endY = canvasHeight;
  } else {
    // Find start row Y
    if (bounds.startRow > 0) {
      startY += bounds.startRow * rowHeight;
    }

    // Find end row Y
    endY = startY + (bounds.endRow - bounds.startRow + 1) * rowHeight;

    // Handle row selections that extend beyond visible area
    if (selection.type === 'row') {
      endY = Math.max(endY, canvasHeight);
    }
  }

  return {
    x: Math.max(0, startX),
    y: Math.max(0, startY),
    width: Math.max(0, Math.min(endX, canvasWidth) - Math.max(0, startX)),
    height: Math.max(0, Math.min(endY, canvasHeight) - Math.max(0, startY)),
  };
}

export function expandSelectionToRange(
  startCell: CellPosition,
  endCell: CellPosition,
  selectionType: 'cell' | 'row' | 'column' = 'cell'
): SelectionRange {
  switch (selectionType) {
    case 'row':
      return {
        type: 'row',
        startRow: Math.min(startCell.row, endCell.row),
        endRow: Math.max(startCell.row, endCell.row),
      };
    case 'column':
      return {
        type: 'column',
        startCol: Math.min(startCell.col, endCell.col),
        endCol: Math.max(startCell.col, endCell.col),
      };
    case 'cell':
    default:
      return {
        type: 'cell',
        start: startCell,
        end: endCell,
      };
  }
}

export function getCellFromPoint(
  x: number,
  y: number,
  columnWidths: ColumnWidths,
  rowHeight: number,
  headerHeight: number
): { row: number; col: number } | null {
  // Check if in header
  if (y < headerHeight) {
    const col = getColumnFromX(x, columnWidths);
    return col !== null ? { row: -1, col } : null; // -1 indicates header row
  }

  // Calculate row
  const row = Math.floor((y - headerHeight) / rowHeight);
  if (row < 0) return null;

  // Calculate column
  const col = getColumnFromX(x, columnWidths);
  if (col === null) return null;

  return { row, col };
}

function getColumnFromX(x: number, columnWidths: ColumnWidths): number | null {
  if (x < columnWidths.gutter) return null;

  let currentX = columnWidths.gutter;

  for (let col = 0; col < columnWidths.columns.length; col++) {
    const colWidth = columnWidths.columns[col];
    if (x >= currentX && x < currentX + colWidth) {
      return col;
    }
    currentX += colWidth;
  }

  return null;
}

// Animation utilities
export interface SelectionAnimation {
  from: AnchorRect | null;
  to: AnchorRect | null;
  startTime: number;
  duration: number;
}

export function createSelectionAnimation(
  from: AnchorRect | null,
  to: AnchorRect | null,
  duration: number = 150
): SelectionAnimation {
  return {
    from,
    to,
    startTime: Date.now(),
    duration,
  };
}

export function interpolateRect(
  from: AnchorRect | null,
  to: AnchorRect | null,
  progress: number
): AnchorRect | null {
  if (!from && !to) return null;
  if (!from) return to;
  if (!to) return from;

  // Ease-out function
  const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);
  const t = easeOut(Math.max(0, Math.min(1, progress)));

  return {
    x: from.x + (to.x - from.x) * t,
    y: from.y + (to.y - from.y) * t,
    width: from.width + (to.width - from.width) * t,
    height: from.height + (to.height - from.height) * t,
  };
}

export function getAnimationProgress(animation: SelectionAnimation): number {
  const elapsed = Date.now() - animation.startTime;
  return elapsed / animation.duration;
}
