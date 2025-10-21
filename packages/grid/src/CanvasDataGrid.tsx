import { useEffect, useRef, useImperativeHandle, forwardRef, useMemo, useCallback, useState } from 'react';
import type {
  CanvasDataGridProps,
  GridHandle,
  SelectionRange,
} from './types';
import { useGridController } from './hooks/useGridController';
import { useGridCanvasDrawing } from './hooks/useGridCanvasDrawing';
import { DataManager } from './data/DataManager';
// AnchorCalculator is managed by controller
import { KeyboardNavigationManager, createFocusableElement } from './utils/keyboardNavigation';
import { ColumnResizeManager } from './utils/columnResizing';
import { ThemeResolver } from './themes/themeSystem';
import { calculateColumnWidths } from './utils/columnWidth';
import { isValidVisibleRange } from './utils/visibleRange';
import { ROW_HEIGHT, HEADER_HEIGHT, SCROLLBAR_WIDTH } from './constants';
import { normalizeColumnOrder } from './utils/columnLayout';
import { composeMouseHandlers } from './utils/mouse';
import { selectionsEqual } from './utils/selectionPredicates';
import { useColumnResize } from './hooks/useColumnResize';
import { copySelectionToClipboard } from './utils/clipboard';
// import { useColumnDrag } from './hooks/useColumnDrag';
// import { useScrollbarInteractions } from './hooks/useScrollbarInteractions';
import { useCanvasInteractions } from './hooks/useCanvasInteractions';

const DEFAULT_ROW_HEIGHT = ROW_HEIGHT;
const DEFAULT_HEADER_HEIGHT = HEADER_HEIGHT;

export const CanvasDataGrid = forwardRef<GridHandle, CanvasDataGridProps>((props, ref) => {
  const {
    // Data props
    mode = 'full',
    headers,

    // Styling
    className,
    style,
    canvasProps,
    theme: themeOverride,
    overrides,
    controllerOverrides,
    layoutOverrides,

    // Column sizing
    resizable = false,
    minColumnWidth = 50,
    maxColumnWidth = 500,
    fitToCanvas = false,
    defaultColumnWidths,
    columnWidths: controlledColumnWidths,
    onColumnWidthChange,
    draggableColumns = false,
    columnOrder: controlledColumnOrder,
    onColumnOrderChange,
    frozenLeftColumns: _frozenLeftColumns = 0,
    infiniteCanvas = false,
    infiniteCanvasRowCap = 100,
    infiniteCanvasColumnCap = 50,

    // Selection
    selection: controlledSelection,
    defaultSelection,
    onSelectionChange,
    selectionTransitionDuration: _selectionTransitionDuration = 150,

    // Formatting
    formatCell,

    // Dimensions
    rowHeight = DEFAULT_ROW_HEIGHT,
    headerHeight = DEFAULT_HEADER_HEIGHT,

    // Events
    ariaLabel,
    onCellClick,
    onRowClick,
    onColumnClick,
    onContextMenu,
    onKeyDown,

    // Performance
    maxTextCacheSize: _maxTextCacheSize = 10000, // TODO: Use this for text caching

  } = props;

  // Extract data source specific props based on mode
  const propRows = (props as any).rows as string[][] | undefined;
  const propRowCount = (props as any).rowCount as number | undefined;
  const propColumnCount = (props as any).columnCount as number | undefined;
  const propFetchRows = (props as any).fetchRows as ((offset: number, limit: number) => Promise<string[][]>) | undefined;
  const propPageSize = (props as any).pageSize as number | undefined;
  const propPrefetch = (props as any).prefetch as boolean | undefined;

  const isVirtualMode = mode === 'virtual';

  const virtualConfig = useMemo(() => {
    if (!isVirtualMode) return null;
    return {
      rowCount: propRowCount ?? 0,
      columnCount: propColumnCount ?? (headers?.length ?? 0),
      fetchRows: propFetchRows ?? (async () => []),
      pageSize: propPageSize ?? 500,
      prefetch: propPrefetch !== false,
    };
  }, [isVirtualMode, propRowCount, propColumnCount, propFetchRows, propPageSize, propPrefetch, headers]);

  const fullRows = useMemo(() => {
    if (isVirtualMode) return [];
    return Array.isArray(propRows) ? propRows : [];
  }, [isVirtualMode, propRows]);

  const dataSource = useMemo(() => {
    if (virtualConfig) {
      return {
        mode: 'virtual' as const,
        rowCount: virtualConfig.rowCount,
        columnCount: virtualConfig.columnCount,
        headers,
        fetchRows: virtualConfig.fetchRows,
        pageSize: virtualConfig.pageSize,
        prefetch: virtualConfig.prefetch,
      };
    }

    return {
      mode: 'full' as const,
      rows: fullRows,
      headers,
    };
  }, [virtualConfig, fullRows, headers]);

  // Refs
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const focusElementRef = useRef<HTMLElement | null>(null);
  const focusElementDestroyRef = useRef<(() => void) | null>(null);
  const handleRef = useRef<GridHandle | null>(null);
  const dataManagerRef = useRef<DataManager | null>(null);
  // AnchorCalculator ref comes from controller
  const keyboardManagerRef = useRef<KeyboardNavigationManager | null>(null);
  const columnResizeManagerRef = useRef<ColumnResizeManager | null>(null);
  const [themeResolver, setThemeResolver] = useState<ThemeResolver | null>(null);
  const [dataStats, setDataStats] = useState<{ rowCount: number; columnCount: number } | null>(null);
  const handleKeyDownRef = useRef<((event: KeyboardEvent) => void) | null>(null);

  // Local UI state
  const [hoveredCell, setHoveredCell] = useState<{ row: number; col: number } | null>(null);
  const lastMousePosRef = useRef<{ x: number; y: number } | null>(null);
  const hoverHighlightRef = useRef<SelectionRange | null>(null);
  const drawRef = useRef<() => void>(() => { });
  const setHoverHighlight = useCallback((next: SelectionRange | null) => {
    if (selectionsEqual(hoverHighlightRef.current, next)) return;
    hoverHighlightRef.current = next;
    try {
      drawRef.current();
    } catch { }
  }, []);


  useEffect(() => {
    const manager = new DataManager(dataSource, {
      cacheSize: 50,
      maxCacheAge: 5 * 60 * 1000,
    });
    dataManagerRef.current = manager;

    const applyStatsUpdate = () => {
      const stats = manager.getStats();
      setDataStats((prev) => {
        if (prev && prev.rowCount === stats.rowCount && prev.columnCount === stats.columnCount) {
          return prev;
        }
        return { rowCount: stats.rowCount, columnCount: stats.columnCount };
      });
    };

    applyStatsUpdate();

    const unsubscribe = manager.subscribe(() => {
      applyStatsUpdate();
      try {
        drawRef.current();
      } catch {
        // Ignore draw errors triggered during teardown
      }
    });

    return () => {
      unsubscribe();
      dataManagerRef.current = null;
    };
  }, []);

  if (!columnResizeManagerRef.current) {
    columnResizeManagerRef.current = new ColumnResizeManager({
      minColumnWidth,
      maxColumnWidth,
      handleWidth: 8,
      headerHeight,
    });
  }

  // Only update hoveredCell when the value actually changes to avoid re-renders
  const setHoveredCellIfChanged = useCallback((next: { row: number; col: number } | null) => {
    setHoveredCell((prev) => {
      if (prev === next) return prev;
      if (prev && next && prev.row === next.row && prev.col === next.col) return prev;
      if (!prev && !next) return prev;
      return next;
    });
  }, []);

  const actualRowCount = useMemo(() => {
    return virtualConfig ? virtualConfig.rowCount : fullRows.length;
  }, [virtualConfig, fullRows]);

  const actualColumnCount = useMemo(() => {
    if (virtualConfig) {
      return virtualConfig.columnCount;
    }
    if (fullRows.length === 0) {
      return headers?.length ?? 0;
    }
    const maxAcrossRows = fullRows.reduce((max, row) => (row.length > max ? row.length : max), 0);
    return Math.max(maxAcrossRows, headers?.length ?? 0);
  }, [virtualConfig, fullRows, headers]);

  const normalizedRowCap = Number.isFinite(infiniteCanvasRowCap)
    ? Math.max(0, Math.floor(infiniteCanvasRowCap))
    : 100;
  const normalizedColumnCap = Number.isFinite(infiniteCanvasColumnCap)
    ? Math.max(0, Math.floor(infiniteCanvasColumnCap))
    : 50;
  const supportsInfiniteCanvas = infiniteCanvas && !virtualConfig;
  const effectiveRowCount = supportsInfiniteCanvas
    ? Math.max(actualRowCount + normalizedRowCap, normalizedRowCap)
    : actualRowCount;
  const effectiveColumnCount = supportsInfiniteCanvas
    ? Math.max(actualColumnCount + normalizedColumnCap, normalizedColumnCap)
    : actualColumnCount;

  const normalizedColumnOrderFromProps = useMemo(() => {
    return normalizeColumnOrder(controlledColumnOrder, actualColumnCount);
  }, [controlledColumnOrder, actualColumnCount]);

  const isColumnOrderControlled = controlledColumnOrder !== undefined;
  const [internalColumnOrder, setInternalColumnOrder] = useState<number[]>(() => normalizedColumnOrderFromProps);
  const pendingColumnOrderRef = useRef<number[] | null>(null);

  useEffect(() => {
    if (isColumnOrderControlled) {
      setInternalColumnOrder(normalizedColumnOrderFromProps);
    }
  }, [isColumnOrderControlled, normalizedColumnOrderFromProps]);

  useEffect(() => {
    if (!isColumnOrderControlled) {
      setInternalColumnOrder(prev => normalizeColumnOrder(prev, actualColumnCount));
      pendingColumnOrderRef.current = null;
    }
  }, [isColumnOrderControlled, actualColumnCount]);

  useEffect(() => {
    if (!isColumnOrderControlled) {
      return;
    }
    const pending = pendingColumnOrderRef.current;
    if (!pending) return;
    if (pending.length !== normalizedColumnOrderFromProps.length) return;
    for (let i = 0; i < pending.length; i++) {
      if (pending[i] !== normalizedColumnOrderFromProps[i]) {
        return;
      }
    }
    pendingColumnOrderRef.current = null;
  }, [isColumnOrderControlled, normalizedColumnOrderFromProps]);

  const baseColumnOrder = isColumnOrderControlled
    ? (pendingColumnOrderRef.current ?? normalizedColumnOrderFromProps)
    : internalColumnOrder;
  // Controller fully owns column drag; legacy useColumnDrag no longer needed
  const resolvedColumnOrder = baseColumnOrder;
  const columnDragVisualRef = useRef<any>(null);


  const defaultWidthArray = useMemo(() => {
    const count = Math.max(effectiveColumnCount, 1);
    const allowAutoFit = fitToCanvas || !supportsInfiniteCanvas;
    const { columnWidths } = calculateColumnWidths({
      canvasWidth: 1150,
      columnCount: count,
      existingWidths: [],
      gutterWidth: 40,
      minWidth: minColumnWidth,
      maxWidth: maxColumnWidth,
      fitToCanvas: allowAutoFit,
    });
    return columnWidths;
  }, [effectiveColumnCount, fitToCanvas, supportsInfiniteCanvas, maxColumnWidth, minColumnWidth]);

  const baseTotalRows = actualRowCount || 100;
  const totalRowsForState = supportsInfiniteCanvas
    ? Math.max(effectiveRowCount, 1)
    : Math.max(baseTotalRows, 1);
  const totalColumnsForState = Math.max(
    supportsInfiniteCanvas ? effectiveColumnCount : actualColumnCount,
    1,
  );
  const navRowCount = Math.max(supportsInfiniteCanvas ? effectiveRowCount : actualRowCount, 1);
  const navColumnCount = Math.max(supportsInfiniteCanvas ? effectiveColumnCount : actualColumnCount, 1);
  const dataColumnCount = supportsInfiniteCanvas ? actualColumnCount : undefined;

  const {
    handle,
    scrollTop,
    scrollLeft,
    selection,
    // selectionRect is derived and used internally by renderer
    columnWidths,
    canvasRect,
    visibleRange,
    theme,
    setVisibleRange,
    setCanvasRect,
    setSelectionRect: _setSelectionRect,
    anchorCalculatorRef,
    layoutSnapshotRef,
    // controller-managed hover/drag flags
    scrollbarDragging,
    setScrollbarDragging,
    setHoveringVerticalThumb,
    setHoveringHorizontalThumb,
    setScrollbarHovering,
    hoveringVerticalThumb,
    hoveringHorizontalThumb,
    // selection transition managed by controller
    selectionTransitionRef,
    dispatchEvent,
    controllerDragVisualRef,
  } = useGridController({
    initialTheme: themeOverride,
    initialSelection: controlledSelection || defaultSelection || null,
    controlledSelection,
    onSelectionChange,
    onColumnWidthChange,
    onColumnOrderChange,
    initialColumnWidths: (controlledColumnWidths || defaultColumnWidths || defaultWidthArray),
    totalRows: totalRowsForState,
    totalColumns: totalColumnsForState,
    rowHeight,
    headerHeight,
    minColumnWidth,
    maxColumnWidth,
    fitToCanvas,
    selectionTransitionDuration: _selectionTransitionDuration,
    drawRef,
    currentColumnOrder: resolvedColumnOrder,
    setHoverHighlight,
    controllerOverrides,
    layoutOverrides,
    draggableColumns,
    resizable,
  });
  const {
    isColumnResizing,
    resizeStateRef,
    tryBeginResize,
    handlePointerMove: handleResizePointerMove,
    finishResize: finishColumnResize,
    hideHandles: hideResizeHandles,
    cancelHover: cancelResizeHover,
  } = useColumnResize({
    canvasRef,
    columnResizeManagerRef,
    handle,
    handleRef,
    drawRef,
    setHoverHighlight,
    setHoveringVerticalThumb,
    setHoveringHorizontalThumb,
  });

  useEffect(() => {
    return () => {
      cancelResizeHover();
      hoverHighlightRef.current = null;
    };
  }, [cancelResizeHover]);


  const latestColumnWidthsRef = useRef(columnWidths);
  useEffect(() => {
    latestColumnWidthsRef.current = columnWidths;
  }, [columnWidths]);

  // Legacy scrollbar interactions removed; controller owns scrolling/drag.
  const dragStateRef = useRef<{ type: 'vertical-scrollbar' | 'horizontal-scrollbar' | null; startMousePos: number; startScrollPos: number; pointerOffset: number }>({ type: null, startMousePos: 0, startScrollPos: 0, pointerOffset: 0 });

  // Manage selection transitions and trigger draw via rAF only while animating
  // selection animation handled in controller
  useEffect(() => {
    handleRef.current = handle;
  }, [handle]);

  // Column resize manager is created during render; ensure options remain current

  // Update managers when props change
  useEffect(() => {
    if (dataManagerRef.current) {
      dataManagerRef.current.updateDataSource(dataSource);
    }
  }, [dataSource]);

  // Overrides are now handled in the canvas drawing hook

  useEffect(() => {
    if (columnResizeManagerRef.current) {
      columnResizeManagerRef.current.updateOptions({
        minColumnWidth,
        maxColumnWidth,
        headerHeight,
      });
    }
  }, [minColumnWidth, maxColumnWidth, headerHeight]);

  useEffect(() => {
    if (keyboardManagerRef.current) {
      keyboardManagerRef.current.updateOptions({
        enableArrowKeys: true,
        enablePageKeys: true,
        enableHomeEndKeys: true,
        enableTabKey: true,
        enableEnterKey: true,
        enableEscapeKey: true,
        enableSelectionKeys: true,
        rowCount: navRowCount,
        columnCount: navColumnCount,
        pageSize: 10,
      });
    }
  }, [navRowCount, navColumnCount]);

  // Setup canvas dimensions and update state - use canvas dimensions, not container
  const setupCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    const rect = canvas.getBoundingClientRect();

    // Update canvas rect in state - let CanvasRenderer handle canvas setup
    setCanvasRect({ width: rect.width, height: rect.height });
  }, [handle, rowHeight, headerHeight, setCanvasRect]);

  // Ensure column widths match effective column count
  useEffect(() => {
    const currentColumnCount = columnWidths.columns.length;
    if (totalColumnsForState > currentColumnCount) {
      handle.getState();
    }
  }, [totalColumnsForState, columnWidths.columns.length, handle]);

  // Redistribute column widths when canvas size OR gutter width changes
  useEffect(() => {
    if (!canvasRect || canvasRect.width <= 0) return;
    if (!controlledColumnWidths && columnWidths.columns.length > 0) {
      // Only redistribute if we're not using controlled widths
      const currentCanvasWidth = canvasRect.width;
      const currentContentWidth = columnWidths.columns.reduce((sum, width) => sum + width, columnWidths.gutter);
      const hasSlack = currentCanvasWidth - currentContentWidth > 1;
      const shouldFitToCanvas = fitToCanvas || (!supportsInfiniteCanvas && hasSlack);
      const { columnWidths: redistributedWidths } = calculateColumnWidths({
        canvasWidth: currentCanvasWidth,
        columnCount: columnWidths.columns.length,
        existingWidths: columnWidths.columns,
        gutterWidth: columnWidths.gutter,
        minWidth: minColumnWidth,
        maxWidth: maxColumnWidth,
        fitToCanvas: shouldFitToCanvas,
      });

      // Check if redistribution would meaningfully change the widths (any pixel)
      const widthsDifferent = redistributedWidths.some((width, i) => width !== (columnWidths.columns[i] || 0));

      if (widthsDifferent) {
        // Apply redistributed widths via handle API synchronously
        for (let i = 0; i < redistributedWidths.length; i++) {
          const w = redistributedWidths[i] ?? 0;
          const current = columnWidths.columns[i] ?? 0;
          if (w !== current) {
            handle.resizeColumn(i, w);
          }
        }
      }
    }
  }, [canvasRect?.width, columnWidths.columns.length, columnWidths.gutter, controlledColumnWidths, handle, fitToCanvas, supportsInfiniteCanvas, minColumnWidth, maxColumnWidth]);

  // Get scrollbarState from composed grid state
  const gridState = handle.getState();
  // Overlay live thumb hover flags so redraws happen immediately on hover
  const effectiveScrollbarState = useMemo(() => {
    const s = gridState.scrollbarState;
    return {
      vertical: {
        ...s.vertical,
        hoveringThumb: !!hoveringVerticalThumb,
      },
      horizontal: {
        ...s.horizontal,
        hoveringThumb: !!hoveringHorizontalThumb,
      },
    } as typeof s;
  }, [gridState.scrollbarState, hoveringVerticalThumb, hoveringHorizontalThumb]);

  // Use the simple canvas drawing hook - EXACT pattern from csvEditor
  const { draw } = useGridCanvasDrawing({
    canvasRef,
    theme,
    scrollTop,
    scrollLeft,
    columnWidths,
    visibleRange,
    selection,
    canvasRect,
    hoveredCell,
    dataSource,
    formatCell,
    setVisibleRange,
    rowHeight,
    headerHeight,
    dataManager: dataManagerRef.current,
    scrollbarState: effectiveScrollbarState,
    textCacheLimit: typeof _maxTextCacheSize === 'number' ? _maxTextCacheSize : undefined,
    selectionTransitionRef,
    resizeHandleStateRef: resizeStateRef,
    hoverHighlightRef,
    totalRowsOverride: totalRowsForState,
    totalColumnsOverride: totalColumnsForState,
    dataColumnCount,
    overrides,
    columnOrder: ((handle as any)?.committedOrderRef?.current && Array.isArray((handle as any).committedOrderRef.current) && (handle as any).committedOrderRef.current.length > 0)
      ? (handle as any).committedOrderRef.current
      : resolvedColumnOrder,
    columnDragVisualRef,
    controllerDragVisualRef,
    layoutSnapshotRef,
  });

  // Use a ref so rAF loop isn't torn down when draw identity changes
  useEffect(() => {
    drawRef.current = draw;
  }, [draw]);

  useEffect(() => {
    if (!virtualConfig) return;
    const manager = dataManagerRef.current;
    if (!manager) return;
    if (!canvasRect || canvasRect.height <= 0) return;

    const rowCount = virtualConfig.rowCount;
    const columnCount = virtualConfig.columnCount;

    if (rowCount <= 0 || columnCount <= 0) return;

    const pageWindow = virtualConfig.pageSize;
    const fallbackEndRow = Math.min(rowCount, pageWindow);
    const visibleRangeValid = isValidVisibleRange(visibleRange)
      && visibleRange.endRow <= rowCount
      && visibleRange.endCol <= columnCount
      && visibleRange.endRow > visibleRange.startRow;

    const baseRange = visibleRangeValid ? visibleRange : {
      startRow: 0,
      endRow: fallbackEndRow > 0 ? fallbackEndRow : Math.min(rowCount, 1),
      startCol: 0,
      endCol: columnCount,
    };

    if (baseRange.endRow <= baseRange.startRow) {
      return;
    }

    const overscanRows = Math.max(10, Math.floor(pageWindow / 5));
    const startRow = Math.max(0, baseRange.startRow - overscanRows);
    const endRow = Math.min(rowCount, Math.max(baseRange.endRow + overscanRows, startRow + 1));

    const fetchRange = {
      startRow,
      endRow,
      startCol: 0,
      endCol: columnCount,
    };

    let cancelled = false;

    manager.ensureDataLoaded(fetchRange, {
      rowHeight,
      headerHeight,
      totalContentHeight: headerHeight + rowCount * rowHeight,
      visibleHeight: canvasRect.height,
      scrollTop,
      overscan: overscanRows,
    }).then(() => {
      if (cancelled) return;
      try {
        drawRef.current();
      } catch { }
    }).catch(() => {
      // Swallow background load errors; visible error reporting handled separately
    });

    return () => {
      cancelled = true;
    };
  }, [
    virtualConfig,
    visibleRange.startRow,
    visibleRange.endRow,
    visibleRange.startCol,
    visibleRange.endCol,
    canvasRect.height,
    rowHeight,
    headerHeight,
    scrollTop,
  ]);


  // Selection transitions handled in controller

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      // No-op: hook returns cleanup handle only when needed
    };
  }, []);

  // Setup canvas on mount and resize
  useEffect(() => {
    setupCanvas();

    // Use ResizeObserver for proper canvas resize detection
    const resizeObserver = new ResizeObserver(() => {
      setupCanvas();
    });

    if (canvasRef.current) {
      resizeObserver.observe(canvasRef.current);
    }

    // Add non-passive wheel listener to conditionally swallow scroll chaining
    const canvas = canvasRef.current;
    const wheelHandler = (e: WheelEvent) => {
      try {
        const grid = handleRef.current as any;
        if (!grid) return;
        const state = grid.getState?.() as any;
        if (!state) return;

        const deltaMode = e.deltaMode ?? 0;
        const scale = deltaMode === 1 ? 40 : (deltaMode === 2 ? (canvas?.clientWidth || 800) : 1);
        const absX = Math.abs(e.deltaX);
        const absY = Math.abs(e.deltaY);
        const dx = (e.shiftKey || absX > absY) ? (e.shiftKey ? e.deltaY : e.deltaX) * scale : 0;
        const dy = (!e.shiftKey && absY >= absX) ? (e.deltaY * scale) : 0;

        const limits = state.scrollLimits || { maxScrollTop: 0, maxScrollLeft: 0 };
        const curTop = Number(state.scrollTop || 0);
        const curLeft = Number(state.scrollLeft || 0);
        const nextTop = Math.max(0, Math.min(Number(limits.maxScrollTop || 0), curTop + (dy || 0)));
        const nextLeft = Math.max(0, Math.min(Number(limits.maxScrollLeft || 0), curLeft + (dx || 0)));
        const willScroll = (nextTop !== curTop) || (nextLeft !== curLeft);

        if (willScroll) {
          e.preventDefault();
          (dispatchEvent as any)?.({
            type: 'wheel',
            payload: {
              deltaX: e.deltaX,
              deltaY: e.deltaY,
              deltaMode,
              shiftKey: e.shiftKey,
            },
          });
        }
      } catch { }
    };
    if (canvas) {
      canvas.addEventListener('wheel', wheelHandler, { passive: false });
    }

    return () => {
      if (canvas) canvas.removeEventListener('wheel', wheelHandler as any);
      resizeObserver.disconnect();
    };
  }, [setupCanvas]);

  // AnchorCalculator is managed by controller

  // Update hovered cell/highlight while scrolling based on last known mouse position
  useEffect(() => {
    if (!anchorCalculatorRef.current) return;
    if (!canvasRect) return;
    if (isColumnResizing) return;
    const pos = lastMousePosRef.current;
    if (!pos) return;

    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    const x = pos.x;
    const y = pos.y;

    const currentState = handle.getState();
    // Column drag visuals handled entirely by controller; no local updates

    const overVScrollbar = x >= rect.width - SCROLLBAR_WIDTH && currentState?.scrollbarState?.vertical?.visible;
    const overHScrollbar = y >= rect.height - SCROLLBAR_WIDTH && currentState?.scrollbarState?.horizontal?.visible;

    // If hovering scrollbars during scroll, clear hover highlight
    if (overVScrollbar || overHScrollbar) {
      setHoveredCellIfChanged(null);
      setHoverHighlight(null);
      try { drawRef.current(); } catch { }
      return;
    }

    let highlight: SelectionRange | null = null;
    let cellPos: { row: number; col: number } | null = null;

    if (anchorCalculatorRef.current.isPointInHeader(x, y)) {
      const headerCol = anchorCalculatorRef.current.getHeaderColumnFromPoint(x, y);
      if (headerCol != null) {
        highlight = { type: 'column', startCol: headerCol, endCol: headerCol };
      }
      setHoveredCellIfChanged(null);
    } else if (anchorCalculatorRef.current.isPointInGutter?.(x, y)) {
      const rowIndex = anchorCalculatorRef.current.getRowFromPoint(y);
      if (rowIndex != null) {
        highlight = { type: 'row', startRow: rowIndex, endRow: rowIndex };
      }
      setHoveredCellIfChanged(null);
    } else {
      cellPos = anchorCalculatorRef.current.getCellFromPoint(x, y);
      if (cellPos) {
        highlight = { type: 'cell', start: cellPos, end: cellPos };
      }
      setHoveredCellIfChanged(cellPos);
    }

    setHoverHighlight(highlight);
    try { drawRef.current(); } catch { }
  }, [
    scrollTop,
    scrollLeft,
    canvasRect,
    columnWidths,
    rowHeight,
    headerHeight,
    isColumnResizing,
    handle,
    setHoveredCellIfChanged,
    setHoverHighlight,
    draggableColumns,

    setScrollbarHovering,
    setHoveringVerticalThumb,
    setHoveringHorizontalThumb,
    hoveringVerticalThumb,
    hoveringHorizontalThumb,
  ]);

  // Auto-focus the grid when a selection is made (enables keyboard shortcuts)
  useEffect(() => {
    if (selection && focusElementRef.current && typeof document !== 'undefined') {
      // Only focus if the grid doesn't already have focus to avoid loops
      if (document.activeElement !== focusElementRef.current) {
        // Use a small delay to ensure the DOM is ready and prevent event loop issues
        requestAnimationFrame(() => {
          focusElementRef.current?.focus({ preventScroll: true });
        });
      }
    }
  }, [selection]);

  // selectionRect derivation is centralized in controller

  // Controlled selection sync handled in controller

  const {
    handleMouseMove,
    handleMouseDown,
    handleMouseUp,
    handleMouseLeave,
    handleContextMenu,
  } = useCanvasInteractions({
    canvasRef,
    anchorCalculatorRef,
    dataManagerRef,
    handle,
    focusElementRef,
    keyboardManagerRef,
    draggableColumns,
    resizable,
    theme,
    onCellClick,
    onRowClick,
    onColumnClick,
    onContextMenu,
    setHoverHighlight,
    setHoveredCellIfChanged,
    setScrollbarHovering,
    setScrollbarDragging,
    scrollbarDragging,
    setHoveringVerticalThumb,
    setHoveringHorizontalThumb,
    hoveringVerticalThumb,
    hoveringHorizontalThumb,
    lastMousePosRef,
    dragStateRef,
    handleResizePointerMove,
    hideResizeHandles,
    tryBeginResize,
    finishColumnResize,
    cancelResizeHover,
    columnOrder: resolvedColumnOrder,

    scrollTop,
    scrollLeft,
    drawRef,
    onDispatchEvent: (ev) => dispatchEvent(ev as any),
    controllerDragVisualRef,
  });

  // Event handlers
  const handleKeyDown = useCallback(async (event: KeyboardEvent) => {
    try {
      (dispatchEvent as any)?.({ type: 'keyDown', payload: event });
    } catch { }
    let handled = false;
    let userInfo: { handled: boolean } | undefined;

    if (onKeyDown) {
      userInfo = { handled: false };
      onKeyDown(event as any, handle, userInfo);
    }

    const userHandled = userInfo?.handled === true;

    // Handle copy (Ctrl+C / Cmd+C)
    if (!event.defaultPrevented && !userHandled &&
        (event.key === 'c' || event.key === 'C') &&
        (event.ctrlKey || event.metaKey) && !event.shiftKey && !event.altKey) {
      const currentState = handle.getState();
      if (currentState.selection && dataManagerRef.current) {
        const success = await copySelectionToClipboard(
          currentState.selection,
          dataManagerRef.current
        );

        if (success) {
          // Visual feedback: flash selection green
          const originalTheme = handle.getTheme();
          const greenFill = 'rgba(34, 197, 94, 0.2)'; // green-500 with transparency
          const greenBorder = 'rgba(34, 197, 94, 0.8)'; // green-500 more opaque for border

          handle.setTheme({
            selectionFill: greenFill,
            selectionBorder: greenBorder
          });

          // Fade back to original after 300ms
          setTimeout(() => {
            handle.setTheme({
              selectionFill: originalTheme.selectionFill,
              selectionBorder: originalTheme.selectionBorder
            });
          }, 300);
        }

        event.preventDefault();
        handled = true;
      }
    }

    const manager = keyboardManagerRef.current;

    if (!handled && !event.defaultPrevented && !userHandled && manager) {
      const currentState = handle.getState();
      handled = manager.handleKeyDown(event, currentState.selection);
      if (handled) {
        event.preventDefault();
      }
    } else if (event.defaultPrevented || userHandled) {
      handled = true;
      if (userHandled && !event.defaultPrevented) {
        event.preventDefault();
      }
    }

    if (userInfo) {
      userInfo.handled = handled;
    }
  }, [onKeyDown, handle]);

  // Keep handleKeyDown ref up to date
  useEffect(() => {
    handleKeyDownRef.current = handleKeyDown;
  }, [handleKeyDown]);

  useEffect(() => {
    if (!containerRef.current) return;

    keyboardManagerRef.current = new KeyboardNavigationManager({
      enableArrowKeys: true,
      enablePageKeys: true,
      enableHomeEndKeys: true,
      enableTabKey: true,
      enableEnterKey: true,
      enableEscapeKey: true,
      enableSelectionKeys: true,
      rowCount: navRowCount,
      columnCount: navColumnCount,
      pageSize: 10,
    });

    keyboardManagerRef.current.setGridHandle(handle);

    if (focusElementDestroyRef.current) {
      focusElementDestroyRef.current();
      focusElementDestroyRef.current = null;
      focusElementRef.current = null;
    }

    // Create focus element with a wrapper that calls the latest handleKeyDown
    const { element, destroy } = createFocusableElement(
      containerRef.current,
      (e) => {
        handleKeyDownRef.current?.(e);
      },
      () => {
        // Check if there's an active selection
        const currentState = handleRef.current?.getState();
        return currentState?.selection != null;
      }
    );
    focusElementRef.current = element;
    focusElementDestroyRef.current = destroy;

    return () => {
      if (focusElementDestroyRef.current) {
        focusElementDestroyRef.current();
        focusElementDestroyRef.current = null;
      }
      focusElementRef.current = null;
    };
  }, []); // Empty deps - only create once on mount

  // Update keyboard manager options when they change
  useEffect(() => {
    if (keyboardManagerRef.current) {
      keyboardManagerRef.current.updateOptions({
        enableArrowKeys: true,
        enablePageKeys: true,
        enableHomeEndKeys: true,
        enableTabKey: true,
        enableEnterKey: true,
        enableEscapeKey: true,
        enableSelectionKeys: true,
        rowCount: navRowCount,
        columnCount: navColumnCount,
        pageSize: 10,
      });
      keyboardManagerRef.current.setGridHandle(handle);
      keyboardManagerRef.current.setFocusElement(focusElementRef.current);
    }
  }, [navRowCount, navColumnCount, handle]);

  useEffect(() => {
    if (themeResolver || !containerRef.current) return;
    setThemeResolver(new ThemeResolver(containerRef.current));
  }, [themeResolver]);

  // Clear selection when clicking outside the grid
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (!containerRef.current) return;

      // Check if click is outside the grid container
      if (!containerRef.current.contains(event.target as Node)) {
        handle.clearSelection();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [handle]);

  // Expose handle via ref
  useImperativeHandle(ref, () => handle, [handle]);

  // Compute effective aria label
  const effectiveAriaLabel = useMemo(() => {
    if (ariaLabel) return ariaLabel;
    if (dataStats) {
      return `Data grid with ${dataStats.rowCount} rows and ${dataStats.columnCount} columns`;
    }
    return 'Data grid';
  }, [ariaLabel, dataStats]);

  const {
    onMouseMove: canvasMouseMove,
    onMouseDown: canvasMouseDown,
    onMouseUp: canvasMouseUp,
    onMouseLeave: canvasMouseLeave,
    onContextMenu: canvasContextMenu,
    ...restCanvasProps
  } = canvasProps ?? {};

  return (
    <div
      ref={containerRef}
      className={className}
      style={{
        position: 'relative',
        width: '100%',
        height: style?.height || '100%', // Fill parent by default; allow override via style prop
        overflow: 'hidden',
        overscrollBehavior: 'contain',
        ...style,
      }}
      role="grid"
      aria-label={effectiveAriaLabel}
    >
      <canvas
        ref={canvasRef}
        style={{
          display: 'block',
          width: '100%',
          height: '100%',
        }}
        onMouseMove={composeMouseHandlers(handleMouseMove, canvasMouseMove)}
        onMouseDown={composeMouseHandlers(handleMouseDown, canvasMouseDown)}
        onMouseUp={composeMouseHandlers(handleMouseUp, canvasMouseUp)}
        onMouseLeave={composeMouseHandlers(handleMouseLeave, canvasMouseLeave)}
        onContextMenu={composeMouseHandlers(handleContextMenu, canvasContextMenu)}
        {...restCanvasProps}
      />
    </div>
  );
});

CanvasDataGrid.displayName = 'CanvasDataGrid';
