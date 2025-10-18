import type { AnchorRect, DrawBaseArgs, SelectionRange } from '../types';

// Pure geometry utility to compute the selection rectangle in canvas coordinates
export function computeSelectionRect(selection: SelectionRange, args: DrawBaseArgs): AnchorRect | null {
  const { rowHeight, headerHeight, rect: canvasRect, columnWidths, scroll, theme } = args;

  const type = selection.type;
  let startRow = 0,
    endRow = 0,
    startCol = 0,
    endCol = 0;
  if (type === 'cell') {
    startRow = Math.min(selection.start.row, selection.end.row);
    endRow = Math.max(selection.start.row, selection.end.row);
    startCol = Math.min(selection.start.col, selection.end.col);
    endCol = Math.max(selection.start.col, selection.end.col);
  } else if (type === 'row') {
    startRow = Math.min(selection.startRow, selection.endRow);
    endRow = Math.max(selection.startRow, selection.endRow);
    startCol = 0;
    endCol = Number.MAX_SAFE_INTEGER;
  } else {
    // column
    startRow = 0;
    endRow = Number.MAX_SAFE_INTEGER;
    startCol = Math.min(selection.startCol, selection.endCol);
    endCol = Math.max(selection.startCol, selection.endCol);
  }

  // Columns → x positions
  let startX = type === 'row' ? 0 : columnWidths.gutter - scroll.left;
  for (let c = 0; c < startCol && c < columnWidths.columns.length; c++) startX += columnWidths.columns[c] ?? 0;
  let endX = startX;
  for (let c = startCol; c <= endCol && c < columnWidths.columns.length; c++) endX += columnWidths.columns[c] ?? 0;
  if (type === 'row' || (type === 'column' && endCol >= columnWidths.columns.length - 1)) endX = canvasRect.width;

  // Rows → y positions
  let startY: number;
  let endY: number;
  if (type === 'column') {
    startY = 0;
    endY = canvasRect.height;
  } else {
    startY = headerHeight + startRow * rowHeight - scroll.top;
    endY = headerHeight + (endRow + 1) * rowHeight - scroll.top;
    if (type === 'row' && endRow === Number.MAX_SAFE_INTEGER) endY = canvasRect.height;
  }

  let x = Math.max(0, startX);
  let y = Math.max(0, startY);
  let width = Math.max(0, Math.min(endX, canvasRect.width) - x);
  let height = Math.max(0, Math.min(endY, canvasRect.height) - y);

  // Adjust to ensure border stays visible within canvas based on theme stroke width
  const strokeW = theme.selectionBorderWidth;
  if (type === 'row') {
    // Inset left by half stroke; extend to the right so outer edge can clip
    x = Math.max(strokeW / 2, x);
    width = canvasRect.width + strokeW;
    if (y <= headerHeight) {
      // get difference between y and headerHeight
      const difference = headerHeight - y;
      height = height - difference;
      y = headerHeight+(strokeW/2);
    }
  } else if (type === 'column') {
    // Inset top by half stroke; extend to the bottom so outer edge can clip
    y = Math.max(strokeW / 2, y);
    height = canvasRect.height + strokeW;
    if (x <= columnWidths.gutter) {
      // get difference between x and columnWidths.gutter
      const difference = columnWidths.gutter - x;
      width = width - difference;
      x = columnWidths.gutter+(strokeW/2);
    }
  } else if (type === 'cell') {
    if (y <= headerHeight) {
      // get difference between y and headerHeight
      const difference = headerHeight - y;
      height = height - difference;
      y = headerHeight+(strokeW/2);
    }
    if (x <= columnWidths.gutter) {
      // get difference between x and columnWidths.gutter
      const difference = columnWidths.gutter - x;
      width = width - difference;
      x = columnWidths.gutter+(strokeW/2);
    }
  }
  if (width <= 0 || height <= 0) {
    return null;
  }
  return { x, y, width, height };
}

