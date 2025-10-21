import { useMemo, useRef, useEffect } from 'react';
import { AnchorCalculator } from '../utils/anchorCalculations';
import type { GridHandle, GridStateSnapshot, ThemeTokens, ResolvedThemeTokens, SelectionRange } from '../types';
import { useGridScrolling } from './useGridScrolling';
import { useGridSelection } from './useGridSelection';
import { useGridColumnWidths } from './useGridColumnWidths';
import { useGridCanvasRect } from './useGridCanvasRect';
import { useGridVisibleRange } from './useGridVisibleRange';
import { useGridTheme } from './useGridTheme';
import { useScrollbarVisibility } from './useScrollbarVisibility';
import { HEADER_HEIGHT } from '../constants';
import { calculateColumnWidths } from '../utils/columnWidth';
import { computeGutterWidth } from '../layout/LayoutEngine';
import type { ThemeResolver } from '../themes/themeSystem';

export interface ComposedGridStateOptions {
  initialTheme?: Partial<ThemeTokens>;
  initialSelection?: SelectionRange | null;
  initialColumnWidths?: number[];
  onSelectionChange?: (sel: SelectionRange | null) => void;
  onColumnWidthChange?: (columnIndex: number, width: number) => void;
  // For scrollbar visibility calculations
  totalRows?: number;
  totalColumns?: number;
  rowHeight?: number;
  headerHeight?: number;
  scrollbarHovering?: boolean;
  scrollbarDragging?: boolean;
  scrollbarHoveringVerticalThumb?: boolean;
  scrollbarHoveringHorizontalThumb?: boolean;
  // Column sizing behavior
  minColumnWidth?: number;
  maxColumnWidth?: number;
  fitToCanvas?: boolean;
  themeResolver?: ThemeResolver | null;
}

// Helper: Check if an item (row/column) is fully visible in viewport
function isItemFullyVisible(
  itemStart: number,
  itemEnd: number,
  viewportStart: number,
  viewportEnd: number
): boolean {
  return itemStart >= viewportStart && itemEnd <= viewportEnd;
}

// Helper: Calculate scroll position to bring item into view
function calculateScrollPosition(
  itemStart: number,
  itemEnd: number,
  viewportStart: number,
  viewportEnd: number,
  currentScroll: number,
  viewportSize: number,
  offset: number,
  align: 'nearest' | 'start' | 'center' | 'end'
): number {
  const itemSize = itemEnd - itemStart;
  const contentSize = viewportSize - offset;

  if (align === 'center') {
    return itemStart - offset - (contentSize - itemSize) / 2;
  } else if (align === 'start') {
    return itemStart - offset;
  } else if (align === 'end') {
    return itemEnd - viewportSize;
  } else { // 'nearest'
    if (itemStart < viewportStart) {
      return itemStart - offset;
    } else if (itemEnd > viewportEnd) {
      return itemEnd - viewportSize;
    }
  }
  return currentScroll;
}

export function useComposedGridState(options: ComposedGridStateOptions = {}) {
  const scrollingRef = useRef(false);
  const scrollRafRef = useRef<number | null>(null);
  const {
    initialTheme = {},
    initialSelection = null,
    initialColumnWidths = [120], // Single default - actual widths should be calculated by caller
    onSelectionChange,
    onColumnWidthChange,
    totalRows = 100, // Default values for content size calculation
    totalColumns = 6,
    rowHeight = 32,
    headerHeight = HEADER_HEIGHT,
    scrollbarHovering = false,
    scrollbarDragging = false,
    scrollbarHoveringVerticalThumb = false,
    scrollbarHoveringHorizontalThumb = false,
    minColumnWidth = 50,
    maxColumnWidth = 500,
    fitToCanvas = false,
    themeResolver = null,
  } = options;

  // Individual state hooks
  const selection = useGridSelection();
  // Synchronous selection ref to avoid async setState gaps
  const selectionRef = useRef<SelectionRange | null>(selection.selection);
  useEffect(() => {
    selectionRef.current = selection.selection;
  }, [selection.selection]);

  // Keep last stable selectionRect to avoid transient nulls during coupled updates
  const lastSelectionRectRef = useRef<import('../types').AnchorRect | null>(null);
  const columnWidths = useGridColumnWidths(initialColumnWidths, {
    minWidth: minColumnWidth,
    maxWidth: maxColumnWidth,
  });
  const ensureColumnCount = columnWidths.ensureColumnCount;
  useEffect(() => {
    ensureColumnCount(Math.max(1, totalColumns));
  }, [ensureColumnCount, totalColumns]);
  const canvasRect = useGridCanvasRect();
  const visibleRange = useGridVisibleRange();
  const theme = useGridTheme({ initialTheme, resolver: themeResolver });

  // Scrolling with limits based on content size
  const scrolling = useGridScrolling({
    totalRows,
    columnWidths: columnWidths.columnWidths,
    canvasRect: canvasRect.canvasRect,
    rowHeight,
    headerHeight,
  });

  // Dynamic scrollbar state calculation based on content overflow
  const scrollbarState = useScrollbarVisibility({
    canvasRect: canvasRect.canvasRect,
    // Include header height so content height matches scroll limit calculations
    contentHeight: totalRows * rowHeight + headerHeight,
    contentWidth: columnWidths.columnWidths.total,
    scrollTop: scrolling.scrollTop,
    scrollLeft: scrolling.scrollLeft,
    totalRows,
    totalColumns,
    hovering: scrollbarHovering,
    dragging: scrollbarDragging,
    hoveringVerticalThumb: scrollbarHoveringVerticalThumb,
    hoveringHorizontalThumb: scrollbarHoveringHorizontalThumb,
  });


  // Set up external callbacks
  if (onSelectionChange) selection.setOnSelectionChange(onSelectionChange);
  if (onColumnWidthChange) columnWidths.setOnColumnWidthChange(onColumnWidthChange);

  // Set initial selection
  if (initialSelection && !selection.selection) {
    selection.setSelection(initialSelection);
  }

  // Coupled update: compute gutter and redistribute columns atomically per frame
  useEffect(() => {
    const vr = visibleRange.visibleRange;
    const canvasW = canvasRect.canvasRect.width;
    if (canvasW <= 0) return;

    // Determine dynamic gutter width using layout engine helper
    const nextGutter = computeGutterWidth(vr);

    const current = columnWidths.columnWidths;
    const currentCols = current.columns;

    // Recompute columns for the new gutter, preserving proportional widths
    const { columnWidths: redistributed } = calculateColumnWidths({
      canvasWidth: canvasW,
      columnCount: currentCols.length,
      existingWidths: currentCols,
      gutterWidth: nextGutter,
      minWidth: minColumnWidth,
      maxWidth: maxColumnWidth,
      fitToCanvas,
    });

    // Build next state and update only if anything changed
    const next = {
      gutter: nextGutter,
      columns: redistributed,
      total: nextGutter + redistributed.reduce((s, w) => s + w, 0),
    };

    const gutterChanged = current.gutter !== next.gutter;
    const columnsChanged =
      currentCols.length !== next.columns.length ||
      currentCols.some((w, i) => w !== (next.columns[i] ?? 0));

    if (gutterChanged || columnsChanged) {
      columnWidths.updateColumnWidths(next as any);
    }
  }, [visibleRange.visibleRange, canvasRect.canvasRect.width, columnWidths]);

  // Subscriptions for external consumers (e.g., useGrid)
  const listenersRef = useRef(new Set<() => void>());
  const notifySubscribers = useMemo(() => {
    return () => {
      listenersRef.current.forEach((listener) => {
        try {
          listener();
        } catch {
          // no-op
        }
      });
    };
  }, []);

  // Compose GridHandle interface
  const handle = useMemo<GridHandle>(() => ({
    getState(): GridStateSnapshot & { scrollLimits: any } {
      return {
        selection: selectionRef.current,
        selectionRect: selection.selectionRect,
        visibleRange: visibleRange.visibleRange,
        scrollTop: scrolling.scrollTop,
        scrollLeft: scrolling.scrollLeft,
        columnWidths: columnWidths.columnWidths,
        canvasRect: canvasRect.canvasRect,
        scrollbarState: scrollbarState,
        scrollLimits: scrolling.scrollLimits,
      } as any;
    },

    subscribe(listener: () => void): () => void {
      listenersRef.current.add(listener);
      // Immediately emit current state once upon subscribe to sync consumers
      try { listener(); } catch {}
      return () => {
        listenersRef.current.delete(listener);
      };
    },

    setSelection(sel: SelectionRange | null): void {
      selectionRef.current = sel;
      selection.setSelection(sel);
      // Push notification immediately to keep external consumers reactive
      notifySubscribers();
    },

    clearSelection(): void {
      selectionRef.current = null;
      selection.clearSelection();
    },

    setScroll(top: number, left: number): void {
      scrolling.setScroll(top, left);
      // Defer notify to next frame so getState sees committed scrollTop
      requestAnimationFrame(() => {
        notifySubscribers();
      });
    },

    scrollToCell(
      row: number,
      col: number,
      align: 'nearest' | 'start' | 'center' | 'end' = 'nearest'
    ): void {
      // Prevent re-entrant calls during scroll animation
      if (scrollingRef.current) return;

      const state = this.getState();
      const { canvasRect, scrollTop, scrollLeft, columnWidths } = state;

      // Clamp to valid bounds
      const clampedRow = Math.max(0, Math.min(totalRows - 1, row));
      const clampedCol = Math.max(0, Math.min(totalColumns - 1, col));

      // Calculate row boundaries in document coordinates
      const rowTop = headerHeight + clampedRow * rowHeight;
      const rowBottom = rowTop + rowHeight;

      // Calculate viewport boundaries (accounting for fixed header)
      const viewportTop = scrollTop + headerHeight;
      const viewportBottom = scrollTop + canvasRect.height;

      // Determine if scrolling is needed for row
      const rowVisible = isItemFullyVisible(rowTop, rowBottom, viewportTop, viewportBottom);
      const newScrollTop = rowVisible
        ? scrollTop
        : calculateScrollPosition(
            rowTop,
            rowBottom,
            viewportTop,
            viewportBottom,
            scrollTop,
            canvasRect.height,
            headerHeight,
            align
          );

      // Calculate column boundaries in document coordinates
      let colLeft = columnWidths.gutter;
      for (let i = 0; i < clampedCol && i < columnWidths.columns.length; i++) {
        colLeft += columnWidths.columns[i] || 0;
      }
      const colRight = colLeft + (columnWidths.columns[clampedCol] || 0);

      // Calculate viewport boundaries (accounting for gutter)
      const viewportLeft = scrollLeft + columnWidths.gutter;
      const viewportRight = scrollLeft + canvasRect.width;

      // Determine if scrolling is needed for column
      const colVisible = isItemFullyVisible(colLeft, colRight, viewportLeft, viewportRight);
      const newScrollLeft = colVisible
        ? scrollLeft
        : calculateScrollPosition(
            colLeft,
            colRight,
            viewportLeft,
            viewportRight,
            scrollLeft,
            canvasRect.width,
            columnWidths.gutter,
            align
          );

      // Apply scroll if position changed
      if (newScrollTop !== scrollTop || newScrollLeft !== scrollLeft) {
        scrollingRef.current = true;
        this.setScroll(newScrollTop, newScrollLeft);

        // Clear guard on next animation frame
        if (scrollRafRef.current !== null) {
          cancelAnimationFrame(scrollRafRef.current);
        }
        scrollRafRef.current = requestAnimationFrame(() => {
          scrollingRef.current = false;
          scrollRafRef.current = null;
        });
      }
    },

    autosizeColumn(
      _index: number,
      _strategy: 'sample' | 'header-only' | 'full' = 'sample'
    ): void {
      // TODO: Implement column autosizing
    },

    resizeColumn(index: number, width: number): void {
      columnWidths.resizeColumn(index, width);
      notifySubscribers();
    },

    getSelectionRect(): import('../types').AnchorRect | null {
      return selection.selectionRect;
    },

    getCellRect(_row: number, _col: number): import('../types').AnchorRect | null {
      const calc = new AnchorCalculator({
        rowHeight,
        headerHeight,
        canvasRect: canvasRect.canvasRect,
        columnWidths: columnWidths.columnWidths,
        scrollTop: scrolling.scrollTop,
        scrollLeft: scrolling.scrollLeft,
      });
      return calc.getCellRect(_row, _col);
    },

    getRowRect(_row: number): import('../types').AnchorRect | null {
      const calc = new AnchorCalculator({
        rowHeight,
        headerHeight,
        canvasRect: canvasRect.canvasRect,
        columnWidths: columnWidths.columnWidths,
        scrollTop: scrolling.scrollTop,
        scrollLeft: scrolling.scrollLeft,
      });
      return calc.getRowRect(_row);
    },

    getColumnRect(_col: number): import('../types').AnchorRect | null {
      const calc = new AnchorCalculator({
        rowHeight,
        headerHeight,
        canvasRect: canvasRect.canvasRect,
        columnWidths: columnWidths.columnWidths,
        scrollTop: scrolling.scrollTop,
        scrollLeft: scrolling.scrollLeft,
      });
      return calc.getColumnRect(_col);
    },

    getTheme(): ResolvedThemeTokens { return theme.theme; },

    setTheme(partial: Partial<ResolvedThemeTokens>): void {
      theme.setTheme(partial);
      notifySubscribers();
    },
  }), [
    selection,
    visibleRange,
    scrolling,
    columnWidths,
    canvasRect,
    theme,
  ]);

  // Notify subscribers whenever state slices used by getState() change
  useEffect(() => {
    notifySubscribers();
  }, [
    selection.selection,
    selection.selectionRect,
    visibleRange.visibleRange,
    scrolling.scrollTop,
    scrolling.scrollLeft,
    // Column widths and totals
    columnWidths.columnWidths.gutter,
    columnWidths.columnWidths.total,
    columnWidths.columnWidths.columns,
    // Canvas rect
    canvasRect.canvasRect.width,
    canvasRect.canvasRect.height,
    // Scrollbar state object changes
    scrollbarState,
    notifySubscribers,
  ]);

  return {
    handle,
    // Individual state values for direct use in draw function
    scrollTop: scrolling.scrollTop,
    scrollLeft: scrolling.scrollLeft,
    selection: selection.selection,
    selectionRect: selection.selectionRect,
    columnWidths: columnWidths.columnWidths,
    canvasRect: canvasRect.canvasRect,
    visibleRange: visibleRange.visibleRange,
    theme: theme.theme,
    // State setters for canvas operations
    setVisibleRange: visibleRange.setVisibleRange,
    setCanvasRect: canvasRect.setCanvasRect,
    setSelectionRect: selection.setSelectionRect,
  };
}
