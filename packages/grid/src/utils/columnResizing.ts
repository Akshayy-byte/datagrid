import type { ColumnWidths, AnchorRect } from '../types';

const RESIZE_DEBUG_ENABLED = (() => {
  const globalAny = typeof globalThis !== 'undefined' ? (globalThis as any) : undefined;
  if (globalAny && typeof globalAny.__GRID_RESIZE_DEBUG__ === 'boolean') {
    return Boolean(globalAny.__GRID_RESIZE_DEBUG__);
  }
  const envValue = globalAny?.process?.env?.GRID_RESIZE_DEBUG;
  if (typeof envValue === 'string') {
    return envValue !== 'false';
  }
  return true;
})();

function debugResize(message: string, details?: Record<string, unknown>): void {
  if (!RESIZE_DEBUG_ENABLED) return;
  if (details) {
    console.debug(`[grid:resize] ${message}`, details);
  } else {
    console.debug(`[grid:resize] ${message}`);
  }
}

export interface ResizeHandle {
  columnIndex: number;
  x: number;
  rect: AnchorRect;
  isActive: boolean;
}

export interface ColumnResizeOptions {
  minColumnWidth: number;
  maxColumnWidth: number;
  handleWidth: number;
  headerHeight: number;
}

export class ColumnResizeManager {
  private options: ColumnResizeOptions;
  private activeResize: {
    columnIndex: number;
    startX: number;
    startWidth: number;
    currentWidth: number;
  } | null = null;

  constructor(options: Partial<ColumnResizeOptions> = {}) {
    this.options = {
      minColumnWidth: 50,
      maxColumnWidth: 500,
      handleWidth: 8,
      headerHeight: 36,
      ...options,
    };
  }

  public updateOptions(options: Partial<ColumnResizeOptions>): void {
    this.options = { ...this.options, ...options };
  }

  public getResizeHandles(columnWidths: ColumnWidths, canvasWidth: number, scrollLeft: number = 0): ResizeHandle[] {
    const handles: ResizeHandle[] = [];
    const { handleWidth, headerHeight } = this.options;

    let x = columnWidths.gutter;

    for (let i = 0; i < columnWidths.columns.length; i++) {
      x += columnWidths.columns[i] ?? 0;

      const screenX = x - scrollLeft;

      // Don't create handles that never reach the canvas viewport
      if (screenX >= canvasWidth + handleWidth / 2) {
        break;
      }

      const handleRect: AnchorRect = {
        // Convert to screen space by subtracting horizontal scroll
        x: screenX - handleWidth / 2,
        y: 0,
        width: handleWidth,
        height: headerHeight,
      };

      // Skip handles that land inside the gutter area (left of content) after scrolling
      if (handleRect.x + handleRect.width <= 0) {
        continue;
      }

      handles.push({
        columnIndex: i,
        x,
        rect: handleRect,
        isActive: this.activeResize?.columnIndex === i,
      });
    }

    return handles;
  }

  public getHandleAtPoint(x: number, _y: number, handles: ResizeHandle[]): ResizeHandle | null {
    // Consider sash anywhere vertically; hit-test only on X range
    return handles.find(handle =>
      x >= handle.rect.x &&
      x <= handle.rect.x + handle.rect.width
    ) || null;
  }

  public startResize(columnIndex: number, startX: number, currentWidth: number): void {
    this.activeResize = {
      columnIndex,
      startX,
      startWidth: currentWidth,
      currentWidth,
    };
    debugResize('ColumnResizeManager.startResize', {
      columnIndex,
      startX,
      startWidth: currentWidth,
    });
  }

  public updateResize(currentX: number): number | null {
    if (!this.activeResize) return null;

    const deltaX = currentX - this.activeResize.startX;
    const newWidth = this.activeResize.startWidth + deltaX;
    const clampedWidth = Math.max(
      this.options.minColumnWidth,
      Math.min(this.options.maxColumnWidth, newWidth)
    );

    const previousWidth = this.activeResize.currentWidth;
    this.activeResize.currentWidth = clampedWidth;
    if (previousWidth !== clampedWidth) {
      debugResize('ColumnResizeManager.updateResize', {
        columnIndex: this.activeResize.columnIndex,
        pointerX: currentX,
        startX: this.activeResize.startX,
        startWidth: this.activeResize.startWidth,
        previousWidth,
        clampedWidth,
      });
    }
    return clampedWidth;
  }

  public endResize(): { columnIndex: number; newWidth: number } | null {
    if (!this.activeResize) return null;

    const result = {
      columnIndex: this.activeResize.columnIndex,
      newWidth: this.activeResize.currentWidth,
    };

    debugResize('ColumnResizeManager.endResize', result);
    this.activeResize = null;
    return result;
  }

  public cancelResize(): void {
    if (this.activeResize) {
      debugResize('ColumnResizeManager.cancelResize', {
        columnIndex: this.activeResize.columnIndex,
      });
    }
    this.activeResize = null;
  }

  public isResizing(): boolean {
    return this.activeResize !== null;
  }

  public getActiveResize() {
    return this.activeResize;
  }

  // Calculate new column widths after a resize
  public calculateNewColumnWidths(
    columnWidths: ColumnWidths,
    columnIndex: number,
    newWidth: number
  ): ColumnWidths {
    const newColumns = [...columnWidths.columns];
    newColumns[columnIndex] = newWidth;

    return {
      ...columnWidths,
      columns: newColumns,
      total: columnWidths.gutter + newColumns.reduce((sum, width) => sum + width, 0),
    };
  }

  // Auto-size a column based on content
  public calculateAutoSize(
    ctx: CanvasRenderingContext2D,
    _columnIndex: number,
    values: string[],
    headerText: string,
    strategy: 'sample' | 'header-only' | 'full' = 'sample'
  ): number {
    ctx.save();

    let maxWidth = 0;
    const padding = 16; // 8px on each side

    // Always measure header text
    if (headerText) {
      ctx.font = `bold 14px ui-sans-serif, system-ui, sans-serif`;
      const headerWidth = ctx.measureText(headerText).width;
      maxWidth = Math.max(maxWidth, headerWidth + padding);
    }

    // Measure content based on strategy
    if (strategy !== 'header-only' && values.length > 0) {
      ctx.font = `14px ui-sans-serif, system-ui, sans-serif`;

      let samplesToMeasure = values;
      if (strategy === 'sample' && values.length > 100) {
        // Sample first 50 and last 50 items for performance
        samplesToMeasure = [
          ...values.slice(0, 50),
          ...values.slice(-50),
        ];
      }

      for (const value of samplesToMeasure) {
        if (value) {
          const textWidth = ctx.measureText(value).width;
          maxWidth = Math.max(maxWidth, textWidth + padding);
        }
      }
    }

    ctx.restore();

    // Apply constraints
    return Math.max(
      this.options.minColumnWidth,
      Math.min(this.options.maxColumnWidth, maxWidth || this.options.minColumnWidth)
    );
  }
}

// Utility functions for column operations
export function getColumnFromX(x: number, columnWidths: ColumnWidths): number | null {
  if (x < columnWidths.gutter) return null;

  let currentX = columnWidths.gutter;

  for (let col = 0; col < columnWidths.columns.length; col++) {
    const colWidth = columnWidths.columns[col] ?? 0;
    if (x >= currentX && x < currentX + colWidth) {
      return col;
    }
    currentX += colWidth;
  }

  return null;
}

export function getColumnBounds(
  columnIndex: number,
  columnWidths: ColumnWidths
): { start: number; end: number; width: number } | null {
  if (columnIndex < 0 || columnIndex >= columnWidths.columns.length) {
    return null;
  }

  let start = columnWidths.gutter;

  for (let i = 0; i < columnIndex; i++) {
    start += columnWidths.columns[i] ?? 0;
  }

  const width = columnWidths.columns[columnIndex] ?? 0;

  return {
    start,
    end: start + width,
    width,
  };
}

// Cursor utilities for resize handles
export function getResizeCursor(): string {
  return 'col-resize';
}

export function getDefaultCursor(): string {
  return 'default';
}
