import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { MutableRefObject } from 'react';
import type {
  GridHandle,
  SelectionRange,
  ThemeTokens,
  SelectionTransition,
} from '../types';
import { useComposedGridState } from './useComposedGridState';
import { computeVisibleRange, computeLayoutSnapshot } from '../layout/LayoutEngine';
import { AnchorCalculator } from '../utils/anchorCalculations';
import { computeSelectionRect as computeSelectionRectGeom } from '../utils/selectionRect';
import { selectionsEqual } from '../utils/selectionPredicates';
import { SCROLLBAR_WIDTH, HEADER_HEIGHT } from '../constants';
import { ColumnResizeManager } from '../utils/columnResizing';
import { computeColumnPositions } from '../utils/columnLayout';

export interface UseGridControllerParams {
  initialTheme?: Partial<ThemeTokens>;
  initialSelection?: SelectionRange | null;
  controlledSelection?: SelectionRange | null | undefined;
  onSelectionChange?: (sel: SelectionRange | null) => void;
  onColumnWidthChange?: (col: number, width: number) => void;
  onColumnOrderChange?: (order: number[]) => void;
  initialColumnWidths?: number[];
  totalRows: number;
  totalColumns: number;
  rowHeight: number;
  headerHeight: number;
  minColumnWidth: number;
  maxColumnWidth: number;
  fitToCanvas: boolean;
  selectionTransitionDuration: number;
  drawRef?: MutableRefObject<() => void>;
  setHoverHighlight?: (sel: SelectionRange | null) => void;
  currentColumnOrder?: number[];
  // New override hooks
  controllerOverrides?: import('../types').ControllerOverrides | null;
  layoutOverrides?: import('../types').LayoutOverrides | null;
  // Feature gates
  draggableColumns?: boolean;
  resizable?: boolean;
}

export function useGridController(params: UseGridControllerParams) {
  const {
    initialTheme = {},
    initialSelection = null,
    controlledSelection,
    onSelectionChange,
    onColumnWidthChange,
    initialColumnWidths,
    totalRows,
    totalColumns,
    rowHeight,
    headerHeight,
    minColumnWidth,
    maxColumnWidth,
    fitToCanvas,
    selectionTransitionDuration,
    drawRef,
    controllerOverrides = null,
    layoutOverrides = null,
    draggableColumns = false,
    resizable = false,
  } = params;

  // UI hover/drag flags moved under controller
  const [scrollbarHovering, setScrollbarHovering] = useState(false);
  const [scrollbarDragging, setScrollbarDragging] = useState(false);
  const [hoveringVerticalThumb, setHoveringVerticalThumb] = useState(false);
  const [hoveringHorizontalThumb, setHoveringHorizontalThumb] = useState(false);

  // Compose grid state with controller-owned hover flags
  const composed = useComposedGridState({
    initialTheme,
    initialSelection,
    initialColumnWidths: initialColumnWidths ?? [120],
    onSelectionChange,
    onColumnWidthChange,
    totalRows,
    totalColumns,
    rowHeight,
    headerHeight,
    scrollbarHovering,
    scrollbarDragging,
    scrollbarHoveringVerticalThumb: hoveringVerticalThumb,
    scrollbarHoveringHorizontalThumb: hoveringHorizontalThumb,
    minColumnWidth,
    maxColumnWidth,
    fitToCanvas,
    themeResolver: null,
  });
  // Centralize visibleRange computation (single source-of-truth)
  useEffect(() => {
    const env = {
      scrollTop: composed.scrollTop,
      scrollLeft: composed.scrollLeft,
      canvasRect: composed.canvasRect,
      columnWidths: composed.columnWidths,
      rowHeight,
      headerHeight,
      totalRows,
      totalColumns,
      overscan: 0,
    } as const;
    const vr = computeVisibleRange(env, layoutOverrides ?? undefined);
    // Prepare layout snapshot for renderer consumption
    layoutSnapshotRef.current = computeLayoutSnapshot(env, layoutOverrides ?? undefined);
    // Only update when different to avoid loops
    const cur = composed.visibleRange;
    if (
      vr.startRow !== cur.startRow ||
      vr.endRow !== cur.endRow ||
      vr.startCol !== cur.startCol ||
      vr.endCol !== cur.endCol
    ) {
      composed.setVisibleRange(vr);
    }
  }, [
    composed.scrollTop,
    composed.scrollLeft,
    composed.canvasRect.width,
    composed.canvasRect.height,
    composed.columnWidths.gutter,
    composed.columnWidths.total,
    composed.columnWidths.columns,
    rowHeight,
    headerHeight,
    totalRows,
    totalColumns,
    composed.visibleRange,
    composed.setVisibleRange,
    layoutOverrides,
  ]);

  // Centralize selectionRect derivation based on current selection and dimensions (use selectionRect.ts)
  useEffect(() => {
    // Keep AnchorCalculator updated for hit-testing only
    if (!anchorCalculatorRef.current) {
      anchorCalculatorRef.current = new AnchorCalculator({
        rowHeight,
        headerHeight,
        canvasRect: composed.canvasRect,
        columnWidths: composed.columnWidths,
        scrollTop: composed.scrollTop,
        scrollLeft: composed.scrollLeft,
      });
    } else {
      anchorCalculatorRef.current.updateDimensions({
        rowHeight,
        headerHeight,
        canvasRect: composed.canvasRect,
        columnWidths: composed.columnWidths,
        scrollTop: composed.scrollTop,
        scrollLeft: composed.scrollLeft,
      });
    }

    const sel = composed.selection as any;
    const rect = sel
      ? (controllerOverrides?.computeSelectionRect
          ? controllerOverrides.computeSelectionRect(sel, {
              rowHeight,
              headerHeight,
              rect: composed.canvasRect as any,
              columnWidths: composed.columnWidths as any,
              scroll: { top: composed.scrollTop, left: composed.scrollLeft },
              theme: composed.theme as any,
            })
          : computeSelectionRectGeom(sel, {
              rowHeight,
              headerHeight,
              rect: composed.canvasRect as any,
              columnWidths: composed.columnWidths as any,
              scroll: { top: composed.scrollTop, left: composed.scrollLeft },
              theme: composed.theme as any,
            } as any))
      : null;
    const cur = composed.selectionRect;
    const changed = (cur == null && rect != null) || (cur != null && rect == null) ||
      (cur != null && rect != null && (cur.x !== rect.x || cur.y !== rect.y || cur.width !== rect.width || cur.height !== rect.height));
    if (changed) {
      composed.setSelectionRect(rect);
    }
  }, [
    composed.selection,
    composed.canvasRect.width,
    composed.canvasRect.height,
    composed.columnWidths.gutter,
    composed.columnWidths.total,
    composed.columnWidths.columns,
    composed.scrollTop,
    composed.scrollLeft,
    composed.theme,
    rowHeight,
    headerHeight,
  ]);


  const handleRef = useRef<GridHandle | null>(null);
  useEffect(() => {
    handleRef.current = composed.handle;
  }, [composed.handle]);

  // Controlled selection sync
  useEffect(() => {
    if (controlledSelection === undefined) return;
    const nextSel = controlledSelection ?? null;
    const currentSel = composed.handle.getState().selection ?? null;
    const equal = JSON.stringify(nextSel) === JSON.stringify(currentSel);
    if (!equal) {
      composed.handle.setSelection(nextSel);
    }
  }, [controlledSelection, composed.handle]);

  // Selection transition rAF moved under controller
  const lastSelectionRef = useRef(composed.selection);
  const selectionTransitionRef = useRef<SelectionTransition | null>(null);
  const selectionAnimationRef = useRef<number | null>(null);
  const anchorCalculatorRef = useRef<AnchorCalculator | null>(null);
  const layoutSnapshotRef = useRef<ReturnType<typeof computeLayoutSnapshot> | null>(null);
  const hoverHighlightRef = useRef<SelectionRange | null>(null);
  const columnDragRef = useRef<{
    status: 'idle' | 'pending' | 'dragging';
    startX: number;
    startY: number;
    startVisibleIndex: number;
    initialOrder?: number[];
    draggedDataIndex?: number;
    previewOrder?: number[];
    selectedDataIndices?: number[] | null;
    pointerOffsetX?: number;
    currentPointerX?: number;
  } | null>(null);
  const currentOrderRef = useRef<number[]>([]);
  const columnDragVisualRef = useRef<{ order: number[]; draggedColumn: { dataColumnIndex: number; visibleIndex: number; opacity: number; x: number; width: number } | null; positions: number[] | null; positionsByDataIndex?: Map<number, number> } | null>(null);
  const committedOrderRef = useRef<number[] | null>(null);
  // Persisted controller-managed drag/resize state
  const scrollbarDragRef = useRef<{ type: null | 'vertical' | 'horizontal'; pointerOffset: number }>({ type: null, pointerOffset: 0 });
  const resizeMgrRef = useRef<ColumnResizeManager>(new ColumnResizeManager({ minColumnWidth, maxColumnWidth, handleWidth: 8, headerHeight }));
  const resizeActiveRef = useRef<{ active: boolean }>({ active: false });
  const windowPointerUpHandlerRef = useRef<((e: PointerEvent) => void) | null>(null);
  const dragPulseRafRef = useRef<number | null>(null);

  useEffect(() => {
    resizeMgrRef.current.updateOptions({ minColumnWidth, maxColumnWidth, headerHeight });
  }, [minColumnWidth, maxColumnWidth, headerHeight]);

  const ensureGlobalPointerUp = useCallback((dispatch: (ev: GridEvent) => void) => {
    if (windowPointerUpHandlerRef.current) return;
    const handler = (e: PointerEvent) => { try {
      // Swallow to avoid text selection or unintended interactions while dragging
      e.preventDefault();
      dispatch({ type: 'pointerUp', payload: { nativeEvent: e } });
    } catch {} };
    window.addEventListener('pointerup', handler);
    window.addEventListener('mouseup', handler as any);
    windowPointerUpHandlerRef.current = handler;
  }, []);

  const clearGlobalPointerUp = useCallback(() => {
    if (!windowPointerUpHandlerRef.current) return;
    window.removeEventListener('pointerup', windowPointerUpHandlerRef.current);
    window.removeEventListener('mouseup', windowPointerUpHandlerRef.current as any);
    windowPointerUpHandlerRef.current = null;
  }, []);

  const startDragPulse = useCallback(() => {
    if (dragPulseRafRef.current) return;
    const tick = () => {
      const now = performance.now();
      const alpha = 0.35 + 0.2 * Math.sin(now / 300);
      if (columnDragVisualRef.current && columnDragVisualRef.current.draggedColumn) {
        columnDragVisualRef.current.draggedColumn.opacity = alpha;
      }
      try { drawRef?.current?.(); } catch {}
      dragPulseRafRef.current = requestAnimationFrame(tick);
    };
    dragPulseRafRef.current = requestAnimationFrame(tick);
  }, [drawRef]);

  const stopDragPulse = useCallback(() => {
    if (dragPulseRafRef.current) {
      cancelAnimationFrame(dragPulseRafRef.current);
      dragPulseRafRef.current = null;
    }
  }, []);
  useEffect(() => {
    const expected = committedOrderRef.current;
    if (!expected) return;
    if (Array.isArray(params.currentColumnOrder) && params.currentColumnOrder.length === expected.length) {
      let equal = true;
      for (let i = 0; i < expected.length; i++) {
        if (params.currentColumnOrder[i] !== expected[i]) { equal = false; break; }
      }
      if (equal) {
        try { console.debug?.('[GridDrag] parent acknowledged order', expected); } catch {}
        committedOrderRef.current = null;
      }
    }
  }, [params.currentColumnOrder]);
  useEffect(() => {
    const count = composed.columnWidths?.columns?.length ?? 0;
    if (Array.isArray(params.currentColumnOrder) && params.currentColumnOrder.length === count) {
      currentOrderRef.current = params.currentColumnOrder.slice();
    } else {
      currentOrderRef.current = Array.from({ length: count }, (_, i) => i);
    }
  }, [params.currentColumnOrder, composed.columnWidths?.columns?.length]);
  const setHoverHighlightLocal = useCallback((next: SelectionRange | null) => {
    const prev = hoverHighlightRef.current;
    if (selectionsEqual(prev, next)) return;
    hoverHighlightRef.current = next;
    try { drawRef?.current?.(); } catch {}
    if (typeof params.setHoverHighlight === 'function') params.setHoverHighlight(next);
  }, [drawRef, params.setHoverHighlight]);

  type GridEvent = {
    type: 'pointerMove' | 'pointerDown' | 'pointerUp' | 'pointerLeave' | 'contextMenu' | 'keyDown' | 'wheel';
    payload: any;
  };
  const eventHandlersRef = useRef(new Set<(ev: GridEvent, state: ReturnType<typeof composed.handle.getState>) => boolean | void>());
  const addEventHandler = useCallback((handler: (ev: GridEvent, state: ReturnType<typeof composed.handle.getState>) => boolean | void) => {
    eventHandlersRef.current.add(handler);
    return () => {
      eventHandlersRef.current.delete(handler);
    };
  }, []);
  const dispatchEvent = useCallback((ev: GridEvent): boolean => {
    let handled = false;
    const state = composed.handle.getState();
    // External override can intercept
    try {
      const res = params.controllerOverrides?.onEvent?.(ev as any, state as any);
      if (res === true) handled = true;
    } catch {}
    // Built-in wheel handling for smooth accumulative scrolling
    if (ev.type === 'wheel') {
      const { deltaX, deltaY, deltaMode, shiftKey } = ev.payload || {};
      const scale = deltaMode === 1 ? 40 : (deltaMode === 2 ? (composed.canvasRect.width || 800) : 1);
      const absX = Math.abs(deltaX || 0);
      const absY = Math.abs(deltaY || 0);
      const dx = (shiftKey || absX > absY) ? (shiftKey ? deltaY : deltaX) * scale : 0;
      const dy = (!shiftKey && absY >= absX) ? (deltaY * scale) : 0;
      const nextLeft = Math.max(0, (state.scrollLeft ?? 0) + (dx || 0));
      const nextTop = Math.max(0, (state.scrollTop ?? 0) + (dy || 0));
      // Avoid redundant setScroll if values won't change
      if (nextLeft !== (state.scrollLeft ?? 0) || nextTop !== (state.scrollTop ?? 0)) {
        composed.handle.setScroll(nextTop, nextLeft);
        handled = true;
      }
    }
    // Scrollbar drag state (controller-managed)
    if (ev.type === 'pointerDown') {
      const { x, y, nativeEvent } = ev.payload || {};
      const vertical = state.scrollbarState?.vertical;
      const horizontal = state.scrollbarState?.horizontal;
      if (vertical?.visible && x >= (composed.canvasRect.width - SCROLLBAR_WIDTH)) {
        const inThumb = typeof vertical.thumbTop === 'number' && typeof vertical.thumbHeight === 'number'
          ? (y >= vertical.thumbTop && y <= vertical.thumbTop + vertical.thumbHeight)
          : false;
        try { nativeEvent?.preventDefault?.(); } catch {}
        handled = true; // Always swallow clicks in scrollbar track
        if (inThumb) {
          const pointerOffset = y - (vertical.thumbTop ?? 0);
          scrollbarDragRef.current.type = 'vertical';
          scrollbarDragRef.current.pointerOffset = pointerOffset;
          setScrollbarDragging(true);
          ensureGlobalPointerUp(dispatchEvent);
        }
      } else if (horizontal?.visible && y >= (composed.canvasRect.height - SCROLLBAR_WIDTH)) {
        const inThumb = typeof horizontal.thumbLeft === 'number' && typeof horizontal.thumbWidth === 'number'
          ? (x >= horizontal.thumbLeft && x <= horizontal.thumbLeft + horizontal.thumbWidth)
          : false;
        try { nativeEvent?.preventDefault?.(); } catch {}
        handled = true; // Always swallow clicks in scrollbar track
        if (inThumb) {
          const pointerOffset = x - (horizontal.thumbLeft ?? 0);
          scrollbarDragRef.current.type = 'horizontal';
          scrollbarDragRef.current.pointerOffset = pointerOffset;
          setScrollbarDragging(true);
          ensureGlobalPointerUp(dispatchEvent);
        }
      }
    }
    if (ev.type === 'pointerMove' && scrollbarDragRef.current.type) {
      const { x, y, nativeEvent } = ev.payload || {};
      const vertical = state.scrollbarState?.vertical;
      const horizontal = state.scrollbarState?.horizontal;
      if (scrollbarDragRef.current.type === 'vertical' && vertical?.visible) {
        const contentHeight = Math.max(1, composed.canvasRect.height - HEADER_HEIGHT - (horizontal?.visible ? SCROLLBAR_WIDTH : 0));
        const travel = Math.max(1, contentHeight - (vertical.thumbHeight ?? 0));
        const thumbTop = Math.max(0, Math.min(travel, (y - HEADER_HEIGHT - scrollbarDragRef.current.pointerOffset)));
        const ratio = travel <= 0 ? 0 : thumbTop / travel;
        const maxScrollTop = Math.max(0, totalRows * rowHeight + HEADER_HEIGHT - composed.canvasRect.height);
        const newScrollTop = ratio * maxScrollTop;
        composed.handle.setScroll(newScrollTop, state.scrollLeft ?? 0);
        try { nativeEvent?.preventDefault?.(); } catch {}
        handled = true;
      } else if (scrollbarDragRef.current.type === 'horizontal' && horizontal?.visible) {
        const contentWidth = Math.max(1, composed.canvasRect.width - (state.scrollbarState?.vertical?.visible ? SCROLLBAR_WIDTH : 0));
        const travel = Math.max(1, contentWidth - (horizontal.thumbWidth ?? 0));
        const thumbLeft = Math.max(0, Math.min(travel, (x - scrollbarDragRef.current.pointerOffset)));
        const ratio = travel <= 0 ? 0 : thumbLeft / travel;
        const maxScrollLeft = Math.max(0, (state.columnWidths?.total ?? 0) - composed.canvasRect.width);
        const newScrollLeft = ratio * maxScrollLeft;
        composed.handle.setScroll(state.scrollTop ?? 0, newScrollLeft);
        try { nativeEvent?.preventDefault?.(); } catch {}
        handled = true;
      }
    }
    if (ev.type === 'pointerUp') {
      if (scrollbarDragRef.current.type) {
        scrollbarDragRef.current.type = null;
        scrollbarDragRef.current.pointerOffset = 0;
        setScrollbarDragging(false);
      }
      clearGlobalPointerUp();
    }
    // Column resizing (controller-managed)
    const resizeMgr: ColumnResizeManager = resizeMgrRef.current;
    const resizeActive = resizeActiveRef.current;
    if (ev.type === 'pointerDown') {
      const { x, y, nativeEvent } = ev.payload || {};
      if (resizable) {
        const handles = resizeMgr.getResizeHandles(
        state.columnWidths,
        state.canvasRect?.width ?? 0,
        state.scrollLeft ?? 0,
        ).filter((h: any) => h.rect.x >= (state.columnWidths?.gutter ?? 0));
        const hit = resizeMgr.getHandleAtPoint(x, y, handles);
        if (hit) {
          const currentWidth = state.columnWidths.columns[hit.columnIndex] ?? 0;
          resizeMgr.startResize(hit.columnIndex, x, currentWidth);
          resizeActive.active = true;
          try { nativeEvent?.preventDefault?.(); } catch {}
          handled = true;
          ensureGlobalPointerUp(dispatchEvent);
        }
      }
    }
    if (ev.type === 'pointerMove' && resizeActive.active) {
      const { x } = ev.payload || {};
      const newWidth = resizeMgr.updateResize(x);
      if (typeof newWidth === 'number') {
        composed.handle.resizeColumn(resizeMgr.getActiveResize()?.columnIndex ?? 0, newWidth);
      }
      handled = true;
    }
    if (ev.type === 'pointerUp' && resizeActive.active) {
      const result = resizeMgr.endResize();
      if (result) {
        composed.handle.resizeColumn(result.columnIndex, result.newWidth);
      }
      resizeActive.active = false;
      handled = true;
    }
    if (ev.type === 'pointerDown') {
      const { x, y, nativeEvent } = ev.payload || {};
      if (!anchorCalculatorRef.current) {
        // no anchor calc yet
      } else if (!nativeEvent || !nativeEvent.defaultPrevented) {
        if (anchorCalculatorRef.current.isPointInHeader(x, y)) {
          const col = anchorCalculatorRef.current.getHeaderColumnFromPoint(x, y);
          if (col != null) {
            composed.handle.setSelection({ type: 'column', startCol: col, endCol: col } as SelectionRange);
            if (draggableColumns) {
              // prime controller-side drag tracking
              let pointerOffsetX = 0;
              try {
                const headerRect = (anchorCalculatorRef.current as any).getHeaderCellRect?.(col);
                if (headerRect) pointerOffsetX = x - headerRect.x;
              } catch {}
              columnDragRef.current = { status: 'pending', startX: x, startY: y, startVisibleIndex: col, pointerOffsetX, currentPointerX: x };
              // ensure we catch mouseup even if pointer leaves the canvas before crossing threshold
              ensureGlobalPointerUp(dispatchEvent);
            }
          }
        } else if ((anchorCalculatorRef.current as any).isPointInGutter?.(x, y)) {
          const row = anchorCalculatorRef.current.getRowFromPoint(y);
          if (row != null && row >= 0) {
            composed.handle.setSelection({ type: 'row', startRow: row, endRow: row } as SelectionRange);
          }
        } else {
          const cell = anchorCalculatorRef.current.getCellFromPoint(x, y);
          if (cell) {
            composed.handle.setSelection({ type: 'cell', start: cell, end: cell } as SelectionRange);
          }
        }
      }
    }
    if (ev.type === 'pointerMove' && draggableColumns && columnDragRef.current) {
      const { x, y } = ev.payload || {};
      const s = columnDragRef.current;
      if (s.status === 'pending') {
        const dx = Math.abs(x - s.startX);
        const dy = Math.abs(y - s.startY);
        if (Math.max(dx, dy) >= 4) {
          s.status = 'dragging';
          // Snapshot initial order and dragged data index at drag start
          const widths = state.columnWidths;
          const count = widths?.columns?.length ?? 0;
          const snapshotOrder = (count > 0 && Array.isArray(currentOrderRef.current) && currentOrderRef.current.length === count)
            ? currentOrderRef.current.slice()
            : Array.from({ length: count }, (_, i) => i);
          s.initialOrder = snapshotOrder;
          s.draggedDataIndex = snapshotOrder[s.startVisibleIndex] ?? s.startVisibleIndex;
          ensureGlobalPointerUp(dispatchEvent);
          startDragPulse();
          try {
            const sel = composed.handle.getState().selection as any;
            const selInfo = sel && sel.type === 'column' ? { startCol: sel.startCol, endCol: sel.endCol } : null;
            if (selInfo) {
              const start = Math.max(0, Math.min(selInfo.startCol, selInfo.endCol));
              const end = Math.min(snapshotOrder.length - 1, Math.max(selInfo.startCol, selInfo.endCol));
              const selectedData: number[] = [];
              for (let i = start; i <= end; i++) {
                const d = snapshotOrder[i];
                if (typeof d === 'number' && Number.isFinite(d)) selectedData.push(d);
              }
              s.selectedDataIndices = selectedData;
            } else {
              s.selectedDataIndices = null;
            }
          } catch {}
        }
      }
      if (s.status === 'dragging') {
        const widths = state.columnWidths;
        const count = widths?.columns?.length ?? 0;
        s.currentPointerX = x;
        // Determine drop index by visible midpoints; allow inserting AFTER last column
        let boundary = (widths?.gutter ?? 0) - (state.scrollLeft ?? 0);
        let dropIndex = count; // default to after last
        for (let i = 0; i < count; i++) {
          const w = widths.columns[i] ?? 0;
          const mid = boundary + w / 2;
          if (x < mid) { dropIndex = i; break; }
          boundary += w;
        }
        const initial = (Array.isArray(s.initialOrder) && s.initialOrder.length === count)
          ? s.initialOrder
          : Array.from({ length: count }, (_ ,i) => i);
        const clampedDrop = Math.max(0, Math.min(count, dropIndex));
        const movingFrom = s.startVisibleIndex;
        const movingData = initial[movingFrom] ?? movingFrom;
        const base: number[] = [];
        for (let i = 0; i < count; i++) {
          if (i !== movingFrom) base.push(initial[i] ?? i);
        }
        let insertIndex = clampedDrop;
        if (movingFrom < clampedDrop) insertIndex = Math.max(0, Math.min(base.length, clampedDrop - 1));
        else insertIndex = Math.max(0, Math.min(base.length, clampedDrop));
        base.splice(insertIndex, 0, movingData);
        s.previewOrder = base;

        // Compute positions using identical logic to legacy path
        const widthByDataIndex = new Map<number, number>();
        for (let vis = 0; vis < count; vis++) {
          const dataIdx = initial[vis] ?? vis;
          const w = widths.columns[vis] ?? 0;
          widthByDataIndex.set(dataIdx, w);
        }
        const gutterWidth = widths.gutter ?? 0;
        const scrollLeftSnapshot = state.scrollLeft ?? 0;
        const positionsMap = computeColumnPositions(s.previewOrder, widthByDataIndex, gutterWidth, scrollLeftSnapshot);
        const positions: number[] = new Array(count).fill(0);
        const prevVisual = columnDragVisualRef.current;
        const prevByData = prevVisual?.positionsByDataIndex;
        for (let vis = 0; vis < s.previewOrder.length; vis++) {
          const dataIdx = s.previewOrder[vis];
          const targetX = typeof dataIdx === 'number' ? (positionsMap.get(dataIdx) ?? 0) : 0;
          let baseX = targetX;
          if (prevByData && typeof dataIdx === 'number') {
            const prev = prevByData.get(dataIdx);
            if (typeof prev === 'number' && !Number.isNaN(prev)) baseX = prev;
          }
          // Easing for non-dragged columns
          const interpolated = baseX + (targetX - baseX) * 0.25;
          positions[vis] = interpolated;
        }

        const draggedDataIndex = (typeof s.draggedDataIndex === 'number') ? s.draggedDataIndex : (initial[s.startVisibleIndex] ?? s.startVisibleIndex);
        const draggedVisibleIndex = s.previewOrder.indexOf(draggedDataIndex);
        const draggedWidth = widthByDataIndex.get(draggedDataIndex) ?? 0;
        // Make dragged column follow pointer, clamped between neighbors
        let draggedX = draggedVisibleIndex >= 0 ? (positions[draggedVisibleIndex] ?? (gutterWidth - scrollLeftSnapshot)) : (gutterWidth - scrollLeftSnapshot);
        if (typeof s.pointerOffsetX === 'number' && typeof s.currentPointerX === 'number') {
          const baseStart = gutterWidth - scrollLeftSnapshot;
          const prevDataIndex = draggedVisibleIndex > 0 ? s.previewOrder[draggedVisibleIndex - 1] : undefined;
          const nextDataIndex = draggedVisibleIndex < s.previewOrder.length - 1 ? s.previewOrder[draggedVisibleIndex + 1] : undefined;
          const prevRight = typeof prevDataIndex === 'number'
            ? ((positionsMap.get(prevDataIndex) ?? baseStart) + (widthByDataIndex.get(prevDataIndex) ?? 0))
            : baseStart;
        const nextLeft = typeof nextDataIndex === 'number'
            ? (positionsMap.get(nextDataIndex) ?? (draggedX + draggedWidth))
            : (draggedX + draggedWidth);
          const pointerLeft = s.currentPointerX - s.pointerOffsetX;
          draggedX = Math.max(prevRight, Math.min(nextLeft - draggedWidth, pointerLeft));
          // Override dragged column position so it follows pointer regardless of easing
          if (draggedVisibleIndex >= 0) positions[draggedVisibleIndex] = draggedX;
        }

        // Keep column selection following dragged column like legacy syncColumnSelectionForOrder
        if (Array.isArray(s.selectedDataIndices) && s.selectedDataIndices.length > 0) {
          const mapped: number[] = [];
          for (const d of s.selectedDataIndices) {
            const idx = s.previewOrder.indexOf(d);
            if (idx >= 0) mapped.push(idx);
          }
          if (mapped.length > 0) {
            const newStart = Math.min(...mapped);
            const newEnd = Math.max(...mapped);
            const curSel = composed.handle.getState().selection as any;
            const needsUpdate = !curSel || curSel.type !== 'column' || curSel.startCol !== newStart || curSel.endCol !== newEnd;
            if (needsUpdate) {
              composed.handle.setSelection({ type: 'column', startCol: newStart, endCol: newEnd } as SelectionRange);
            }
          }
        }


        const positionsByDataIndex = new Map<number, number>();
        for (let i = 0; i < s.previewOrder.length; i++) {
          const d = s.previewOrder[i];
          if (typeof d === 'number') positionsByDataIndex.set(d, positions[i] ?? 0);
        }
        columnDragVisualRef.current = {
          order: s.previewOrder.slice(),
          draggedColumn: {
            dataColumnIndex: draggedDataIndex,
            visibleIndex: draggedVisibleIndex >= 0 ? draggedVisibleIndex : s.startVisibleIndex,
            opacity: 0.35,
            x: draggedX,
            width: draggedWidth,
          },
          positions,
          positionsByDataIndex,
        };
        // no-op: preview logging removed
        try { drawRef?.current?.(); } catch {}
      }
    }
    // Keyboard navigation is now handled by KeyboardNavigationManager in CanvasDataGrid.tsx
    // This old implementation has been removed to prevent duplicate handling
    if (ev.type === 'pointerUp') {
      const drag = columnDragRef.current;
      if (draggableColumns && drag && drag.status === 'dragging' && Array.isArray(drag.previewOrder) && typeof params.onColumnOrderChange === 'function') {
        const committed = drag.previewOrder.slice();
        committedOrderRef.current = committed;
        // no-op: commit logging removed
        try { params.onColumnOrderChange(committed); } catch {}
        (currentOrderRef as any).current = drag.previewOrder.slice();

        // Remap column selection to follow the moved data columns using snapshot from drag start
        try {
          // Use initial order snapshot to interpret selection during drag
          const selectedData = Array.isArray(drag.selectedDataIndices) ? drag.selectedDataIndices : [];
          const mappedVisible: number[] = [];
          for (const d of selectedData) {
            const idx = committed.indexOf(d);
            if (idx >= 0) mappedVisible.push(idx);
          }
          if (mappedVisible.length > 0) {
            const newStart = Math.min(...mappedVisible);
            const newEnd = Math.max(...mappedVisible);
            composed.handle.setSelection({ type: 'column', startCol: newStart, endCol: newEnd } as SelectionRange);
            // no-op: finish logging removed
          } else {
            // no-op
          }
        } catch {}
      }
      columnDragRef.current = null;
      columnDragVisualRef.current = null;
      stopDragPulse();
    }
    eventHandlersRef.current.forEach((fn) => {
      if (handled) return;
      try {
        const res = fn(ev, state);
        if (res === true) handled = true;
      } catch {}
    });
    return handled;
  }, [composed.handle]);

  // Default hover handling
  useEffect(() => {
    const remove = addEventHandler((ev) => {
      if (!anchorCalculatorRef.current) return false;
      if (ev.type === 'pointerMove') {
        const { x, y } = ev.payload || {};
        let highlight: SelectionRange | null = null;
        if (anchorCalculatorRef.current.isPointInHeader(x, y)) {
          const headerCol = anchorCalculatorRef.current.getHeaderColumnFromPoint(x, y);
          if (headerCol != null) highlight = { type: 'column', startCol: headerCol, endCol: headerCol } as SelectionRange;
        } else if ((anchorCalculatorRef.current as any).isPointInGutter?.(x, y)) {
          const rowIndex = anchorCalculatorRef.current.getRowFromPoint(y);
          if (rowIndex != null) highlight = { type: 'row', startRow: rowIndex, endRow: rowIndex } as SelectionRange;
        } else {
          const cell = anchorCalculatorRef.current.getCellFromPoint(x, y);
          if (cell) highlight = { type: 'cell', start: cell, end: cell } as SelectionRange;
        }
        setHoverHighlightLocal(highlight);
        return false;
      }
      if (ev.type === 'pointerLeave') {
        setHoverHighlightLocal(null);
        return false;
      }
      return false;
    });
    return () => { remove(); };
  }, [addEventHandler, setHoverHighlightLocal]);

  useEffect(() => {
    const prev = lastSelectionRef.current;
    const next = composed.selection;
    lastSelectionRef.current = next;
    if (prev === next) return;
    const duration = Math.max(0, Math.min(1000, selectionTransitionDuration));
    if (!duration || !prev || !next) {
      selectionTransitionRef.current = null;
      return;
    }
    const start = performance.now();
    selectionTransitionRef.current = {
      active: true,
      fromSelection: prev,
      toSelection: next,
      progress: 0,
    };
    try { drawRef?.current?.(); } catch {}
    const tick = () => {
      const now = performance.now();
      const t = Math.max(0, Math.min(1, (now - start) / duration));
      if (selectionTransitionRef.current) {
        selectionTransitionRef.current.progress = t;
        selectionTransitionRef.current.active = t < 1;
      }
      try { drawRef?.current?.(); } catch {}
      if (t < 1) {
        selectionAnimationRef.current = requestAnimationFrame(tick);
      } else {
        selectionTransitionRef.current = null;
        try { drawRef?.current?.(); } catch {}
      }
    };
    if (selectionAnimationRef.current) cancelAnimationFrame(selectionAnimationRef.current);
    selectionAnimationRef.current = requestAnimationFrame(tick);
    return () => {
      if (selectionAnimationRef.current) cancelAnimationFrame(selectionAnimationRef.current);
    };
  }, [composed.selection, selectionTransitionDuration, drawRef]);

  // Public controller API
  return useMemo(() => ({
    // Grid handle and slices
    handle: composed.handle,
    scrollTop: composed.scrollTop,
    scrollLeft: composed.scrollLeft,
    selection: composed.selection,
    selectionRect: composed.selectionRect,
    columnWidths: composed.columnWidths,
    canvasRect: composed.canvasRect,
    visibleRange: composed.visibleRange,
    theme: composed.theme,
    setVisibleRange: composed.setVisibleRange,
    setCanvasRect: composed.setCanvasRect,
    setSelectionRect: composed.setSelectionRect,
    // Anchor calculator (hit-testing + rects)
    anchorCalculatorRef,
    layoutSnapshotRef,
    controllerDragVisualRef: columnDragVisualRef,
    committedOrderRef,

    // Hover/drag flags
    scrollbarHovering,
    setScrollbarHovering,
    scrollbarDragging,
    setScrollbarDragging,
    hoveringVerticalThumb,
    setHoveringVerticalThumb,
    hoveringHorizontalThumb,
    setHoveringHorizontalThumb,

    // Selection transition state
    selectionTransitionRef,
    selectionAnimationRef,

    // Events API
    dispatchEvent,
    addEventHandler,
  }), [
    composed.handle,
    composed.scrollTop,
    composed.scrollLeft,
    composed.selection,
    composed.selectionRect,
    composed.columnWidths,
    composed.canvasRect,
    composed.visibleRange,
    composed.theme,
    composed.setVisibleRange,
    composed.setCanvasRect,
    composed.setSelectionRect,
    // refs are stable and excluded from deps on purpose
    scrollbarHovering,
    scrollbarDragging,
    hoveringVerticalThumb,
    hoveringHorizontalThumb,
  ]);
}


