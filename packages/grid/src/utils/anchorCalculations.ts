import type {
  AnchorRect,
  ColumnWidths,
  VisibleRange,
  SelectionRange,
  CellPosition,
  Rect,
} from '../types';
import { getSelectionBounds } from './selectionUtils';

export interface GridDimensions {
  rowHeight: number;
  headerHeight: number;
  canvasRect: Rect;
  columnWidths: ColumnWidths;
  scrollTop: number;
  scrollLeft: number;
}

export class AnchorCalculator {
  private dimensions: GridDimensions;

  constructor(dimensions: GridDimensions) {
    this.dimensions = dimensions;
  }

  public updateDimensions(dimensions: GridDimensions): void {
    this.dimensions = dimensions;
  }

  // Get the rect for a specific cell
  public getCellRect(row: number, col: number): AnchorRect | null {
    const { rowHeight, headerHeight, columnWidths, canvasRect, scrollTop, scrollLeft } = this.dimensions;

    // Check if column exists
    if (col < 0 || col >= columnWidths.columns.length) {
      return null;
    }

    // Check if row is valid
    if (row < 0) {
      return null; // Negative row doesn't make sense for cell rect
    }

    // Calculate column position
    let x = columnWidths.gutter - scrollLeft;
    for (let i = 0; i < col; i++) {
      x += columnWidths.columns[i] ?? 0;
    }

    const width = columnWidths.columns[col] ?? 0;

    // Calculate row position
    const y = headerHeight + (row * rowHeight) - scrollTop;
    const height = rowHeight;

    // Check if the cell is visible within canvas bounds
    if (x + width < 0 || x > canvasRect.width || y + height < headerHeight || y > canvasRect.height) {
      return null; // Cell is outside visible area
    }

    return {
      x: Math.max(0, x),
      y: Math.max(headerHeight, y),
      width: Math.min(width, canvasRect.width - Math.max(0, x)),
      height: Math.min(height, canvasRect.height - Math.max(headerHeight, y)),
    };
  }

  // Get the rect for an entire row
  public getRowRect(row: number): AnchorRect | null {
    const { rowHeight, headerHeight, canvasRect, scrollTop } = this.dimensions;

    if (row < 0) {
      return null; // Header row should use getHeaderRect
    }

    // Calculate row position
    const y = headerHeight + (row * rowHeight) - scrollTop;
    const height = rowHeight;

    // Check if row is visible
    if (y + height < headerHeight || y > canvasRect.height) {
      return null; // Row is outside visible area
    }

    return {
      x: 0,
      y: Math.max(headerHeight, y),
      width: canvasRect.width,
      height: Math.min(height, canvasRect.height - Math.max(headerHeight, y)),
    };
  }

  // Get the rect for an entire column
  public getColumnRect(col: number): AnchorRect | null {
    const { columnWidths, canvasRect, scrollLeft } = this.dimensions;

    // Check if column exists
    if (col < 0 || col >= columnWidths.columns.length) {
      return null;
    }

    // Calculate column position
    let x = columnWidths.gutter - scrollLeft;
    for (let i = 0; i < col; i++) {
      x += columnWidths.columns[i] ?? 0;
    }

    const width = columnWidths.columns[col] ?? 0;

    // Check if column is visible
    if (x + width < 0 || x > canvasRect.width) {
      return null; // Column is outside visible area
    }

    return {
      x: Math.max(0, x),
      y: 0, // Column spans from top (including header)
      width: Math.min(width, canvasRect.width - Math.max(0, x)),
      height: canvasRect.height,
    };
  }

  // Get the rect for the header row
  public getHeaderRect(): AnchorRect {
    const { headerHeight, canvasRect } = this.dimensions;

    return {
      x: 0,
      y: 0,
      width: canvasRect.width,
      height: headerHeight,
    };
  }

  // Get the rect for a specific header cell
  public getHeaderCellRect(col: number): AnchorRect | null {
    const { headerHeight, columnWidths, canvasRect, scrollLeft } = this.dimensions;

    // Check if column exists
    if (col < 0 || col >= columnWidths.columns.length) {
      return null;
    }

    // Calculate column position
    let x = columnWidths.gutter - scrollLeft;
    for (let i = 0; i < col; i++) {
      x += columnWidths.columns[i] ?? 0;
    }

    const width = columnWidths.columns[col] ?? 0;

    // Check if column is visible
    if (x + width < 0 || x > canvasRect.width) {
      return null; // Column is outside visible area
    }

    return {
      x: Math.max(0, x),
      y: 0,
      width: Math.min(width, canvasRect.width - Math.max(0, x)),
      height: headerHeight,
    };
  }

  // Get the rect for a selection range
  public getSelectionRect(selection: SelectionRange): AnchorRect | null {
    if (!selection) return null;

    const bounds = getSelectionBounds(selection);
    const { rowHeight, headerHeight, columnWidths, canvasRect, scrollTop, scrollLeft } = this.dimensions;

    // Calculate column bounds
    // Row selections include the gutter visually; start from x=0. Otherwise, start at gutter edge.
    let startX = selection.type === 'row' ? 0 : (columnWidths.gutter - scrollLeft);
    const maxCols = columnWidths.columns.length;
    for (let i = 0; i < bounds.startCol && i < maxCols; i++) {
      startX += columnWidths.columns[i] ?? 0;
    }

    let endX = startX;
    for (let i = bounds.startCol; i <= bounds.endCol && i < maxCols; i++) {
      endX += columnWidths.columns[i] ?? 0;
    }

    // Handle selections that extend beyond visible columns
    if (selection.type === 'row' || (selection.type === 'column' && bounds.endCol >= columnWidths.columns.length - 1)) {
      endX = canvasRect.width;
    }

    // Calculate row bounds
    let startY: number;
    let endY: number;

    if (selection.type === 'column') {
      // Column selection includes header
      startY = 0;
      endY = canvasRect.height;
    } else {
      startY = headerHeight + (bounds.startRow * rowHeight) - scrollTop;
      endY = headerHeight + ((bounds.endRow + 1) * rowHeight) - scrollTop;

      // Handle row selections that extend beyond visible area
      if (selection.type === 'row') {
        if (bounds.endRow === Number.MAX_SAFE_INTEGER) {
          endY = canvasRect.height;
        }
      }
    }

    // Clamp to canvas bounds
    const x = Math.max(0, startX);
    const y = Math.max(0, startY);
    const width = Math.max(0, Math.min(endX, canvasRect.width) - x);
    const height = Math.max(0, Math.min(endY, canvasRect.height) - y);

    // Return null if selection is completely outside canvas
    if (width <= 0 || height <= 0) {
      return null;
    }

    return { x, y, width, height };
  }

  // Get the rect for a selection range without clamping to canvas bounds.
  // Returns negative coordinates when offscreen so consumers can still
  // position overlays accurately even if selection is not visible.
  public getSelectionRectUnclamped(selection: SelectionRange): AnchorRect | null {
    if (!selection) return null;

    const bounds = getSelectionBounds(selection);
    const { rowHeight, headerHeight, columnWidths, scrollTop, scrollLeft, canvasRect } = this.dimensions;

    // Column X positions (unclamped)
    let startX = selection.type === 'row' ? 0 : (columnWidths.gutter - scrollLeft);
    const maxCols = columnWidths.columns.length;
    for (let i = 0; i < bounds.startCol && i < maxCols; i++) {
      startX += columnWidths.columns[i] ?? 0;
    }

    let endX = startX;
    for (let i = bounds.startCol; i <= bounds.endCol && i < maxCols; i++) {
      endX += columnWidths.columns[i] ?? 0;
    }
    if (selection.type === 'row' || (selection.type === 'column' && bounds.endCol >= maxCols - 1)) {
      endX = canvasRect.width; // cover full canvas width for row / full-column selections
    }

    // Row Y positions (unclamped)
    let startY: number;
    let endY: number;
    if (selection.type === 'column') {
      startY = 0;
      endY = canvasRect.height;
    } else {
      startY = headerHeight + (bounds.startRow * rowHeight) - scrollTop;
      endY = headerHeight + ((bounds.endRow + 1) * rowHeight) - scrollTop;
      if (selection.type === 'row' && bounds.endRow === Number.MAX_SAFE_INTEGER) {
        endY = canvasRect.height;
      }
    }

    const x = startX;
    const y = startY;
    const width = Math.max(0, endX - startX);
    const height = Math.max(0, endY - startY);
    return { x, y, width, height };
  }

  // Get the rect for a range of cells (useful for multi-cell selections)
  public getCellRangeRect(
    startRow: number,
    startCol: number,
    endRow: number,
    endCol: number
  ): AnchorRect | null {
    const { rowHeight, headerHeight, columnWidths, canvasRect, scrollTop, scrollLeft } = this.dimensions;

    // Normalize bounds
    const minRow = Math.min(startRow, endRow);
    const maxRow = Math.max(startRow, endRow);
    const minCol = Math.min(startCol, endCol);
    const maxCol = Math.max(startCol, endCol);

    // Validate bounds
    if (minCol < 0 || minCol >= columnWidths.columns.length ||
        maxCol < 0 || maxCol >= columnWidths.columns.length ||
        minRow < 0) {
      return null;
    }

    // Calculate column bounds
    let startX = columnWidths.gutter - scrollLeft;
    for (let i = 0; i < minCol; i++) {
      startX += columnWidths.columns[i] ?? 0;
    }

    let endX = startX;
    for (let i = minCol; i <= maxCol; i++) {
      endX += columnWidths.columns[i] ?? 0;
    }

    // Calculate row bounds
    const startY = headerHeight + (minRow * rowHeight) - scrollTop;
    const endY = headerHeight + ((maxRow + 1) * rowHeight) - scrollTop;

    // Clamp to canvas bounds
    const x = Math.max(0, startX);
    const y = Math.max(headerHeight, startY);
    const width = Math.max(0, Math.min(endX, canvasRect.width) - x);
    const height = Math.max(0, Math.min(endY, canvasRect.height) - y);

    if (width <= 0 || height <= 0) {
      return null;
    }

    return { x, y, width, height };
  }

  // Convert canvas coordinates to cell position
  public getCellFromPoint(x: number, y: number): CellPosition | null {
    const { rowHeight, headerHeight, columnWidths, scrollTop, scrollLeft } = this.dimensions;

    // Check if point is in data area (not header)
    if (y < headerHeight) {
      return null; // In header area
    }

    // Calculate row
    const row = Math.floor((y - headerHeight + scrollTop) / rowHeight);
    if (row < 0) return null;

    // Calculate column
    const adjustedX = x + scrollLeft;
    if (adjustedX < columnWidths.gutter) return null;

    let currentX = columnWidths.gutter;
    for (let col = 0; col < columnWidths.columns.length; col++) {
      const colWidth = columnWidths.columns[col] ?? 0;
      if (adjustedX >= currentX && adjustedX < currentX + colWidth) {
        return { row, col };
      }
      currentX += colWidth;
    }

    return null; // Point is beyond all columns
  }

  // Check if a point is in the gutter area (left of first column, below header)
  public isPointInGutter(x: number, y: number): boolean {
    const { headerHeight, columnWidths } = this.dimensions;
    return y >= headerHeight && x < columnWidths.gutter;
  }

  // Compute row from Y coordinate (ignores column)
  public getRowFromPoint(y: number): number | null {
    const { rowHeight, headerHeight, scrollTop } = this.dimensions;
    if (y < headerHeight) return null;
    const row = Math.floor((y - headerHeight + scrollTop) / rowHeight);
    return row < 0 ? null : row;
  }

  // Check if a point is in the header area
  public isPointInHeader(x: number, y: number): boolean {
    const { headerHeight } = this.dimensions;
    return y >= 0 && y < headerHeight;
  }

  // Get header column from point
  public getHeaderColumnFromPoint(x: number, y: number): number | null {
    if (!this.isPointInHeader(x, y)) return null;

    const { columnWidths, scrollLeft } = this.dimensions;
    const adjustedX = x + scrollLeft;

    if (adjustedX < columnWidths.gutter) return null;

    let currentX = columnWidths.gutter;
    for (let col = 0; col < columnWidths.columns.length; col++) {
      const colWidth = columnWidths.columns[col] ?? 0;
      if (adjustedX >= currentX && adjustedX < currentX + colWidth) {
        return col;
      }
      currentX += colWidth;
    }

    return null;
  }

  // Get visible cell range for the current viewport
  public getVisibleCellRange(): VisibleRange {
    const { rowHeight, headerHeight, columnWidths, canvasRect, scrollTop, scrollLeft } = this.dimensions;

    // Calculate visible rows
    const viewportTop = Math.max(0, scrollTop);
    const viewportBottom = scrollTop + canvasRect.height - headerHeight;

    const startRow = Math.max(0, Math.floor(viewportTop / rowHeight));
    const endRow = Math.ceil(viewportBottom / rowHeight);

    // Calculate visible columns
    let startCol = 0;
    let endCol = columnWidths.columns.length;

    const viewportLeft = Math.max(0, scrollLeft);
    const viewportRight = scrollLeft + canvasRect.width;

    let currentX = columnWidths.gutter;
    for (let col = 0; col < columnWidths.columns.length; col++) {
      const colWidth = columnWidths.columns[col] ?? 0;

      if (currentX + colWidth > viewportLeft && startCol === 0) {
        startCol = col;
      }

      if (currentX > viewportRight) {
        endCol = col;
        break;
      }

      currentX += colWidth;
    }

    return {
      startRow,
      endRow,
      startCol,
      endCol,
    };
  }
}
