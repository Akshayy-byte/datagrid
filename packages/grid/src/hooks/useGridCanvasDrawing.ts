import { useCallback, useRef, useEffect } from "react";
import type {
  ColumnWidths,
  SelectionRange,
  VisibleRange,
  Rect,
  ResolvedThemeTokens,
  DataSourceProps,
  FormatCell,
  ScrollbarState,
  SelectionTransition,
  DrawOverrides,
} from '../types';
import { CanvasRenderer } from '../rendering/CanvasRenderer';
import { computeVisibleColumnXPositions } from '../layout/LayoutEngine';
import { isValidVisibleRange } from '../utils/visibleRange';

const EMPTY_OVERRIDES: Partial<DrawOverrides> = {};

interface UseGridCanvasDrawingProps {
  canvasRef: React.RefObject<HTMLCanvasElement>;
  theme: ResolvedThemeTokens;
  scrollTop: number;
  scrollLeft: number;
  columnWidths: ColumnWidths;
  visibleRange: VisibleRange;
  selection: SelectionRange | null;
  canvasRect: Rect;
  hoveredCell: { row: number; col: number } | null;
  dataSource: DataSourceProps;
  formatCell?: FormatCell;
  setVisibleRange: (range: VisibleRange) => void;
  dataManager?: any;
  scrollbarState: ScrollbarState;
  rowHeight: number;
  headerHeight: number;
  textCacheLimit?: number;
  selectionTransitionRef?: React.RefObject<SelectionTransition | null | undefined>;
  resizeHandleStateRef?: React.RefObject<{ visibleIndex: number; progress: number; mouseY: number } | null>;
  hoverHighlightRef?: React.RefObject<SelectionRange | null>;
  totalRowsOverride?: number;
  totalColumnsOverride?: number;
  dataColumnCount?: number;
  overrides?: Partial<DrawOverrides>;
  columnOrder: number[];
  columnDragVisualRef?: React.RefObject<{
    order: number[];
    draggedColumn: { dataColumnIndex: number; visibleIndex: number; opacity: number; x: number; width: number } | null;
    positions: number[] | null;
  } | null>;
  layoutSnapshotRef?: React.RefObject<{ baseY: number; xPositions: number[] } | null>;
  controllerDragVisualRef?: React.RefObject<{
    order: number[];
    draggedColumn: { dataColumnIndex: number; visibleIndex: number; opacity: number; x: number; width: number } | null;
    positions: number[] | null;
  } | null>;
}

export function useGridCanvasDrawing({
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
  dataManager,
  scrollbarState,
  rowHeight,
  headerHeight,
  textCacheLimit,
  selectionTransitionRef,
  resizeHandleStateRef,
  hoverHighlightRef,
  totalRowsOverride,
  totalColumnsOverride,
  dataColumnCount,
  overrides,
  columnOrder,
  columnDragVisualRef,
  layoutSnapshotRef,
  controllerDragVisualRef,
}: UseGridCanvasDrawingProps) {
  const effectiveOverrides = overrides ?? EMPTY_OVERRIDES;
  // Performance refs
  const animationFrameRef = useRef<number | null>(null);
  const rendererRef = useRef<CanvasRenderer | null>(null);


  // Draw function with all state as dependencies - visibleRange now provided by controller/layout
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !theme || canvasRect.width <= 0 || canvasRect.height <= 0) {
      // Skip noisy logs; this can occur during initial mount/resize
      return;
    }

    // Calculate data source metrics
    // totals unused here; rely on provided visibleRange

    const time = (_name: string, fn: () => any): any => fn();

    // Use provided visibleRange from controller/layout
    const renderVisibleRange = isValidVisibleRange(visibleRange) ? visibleRange : visibleRange;


    // Initialize or update renderer
    time('rendererSetup', () => {
      if (!rendererRef.current) {
        rendererRef.current = new CanvasRenderer({
          canvas,
          theme,
          overrides: effectiveOverrides,
          dataSource,
          formatCell,
          dataManager,
          textCacheLimit,
          dataColumnCount,
          onCanvasRectChange: () => {
            // This will be called when canvas is resized, causing a re-render
          },
        });
      } else {
        rendererRef.current.updateTheme(theme);
        rendererRef.current.updateOverrides(effectiveOverrides);
        rendererRef.current.updateDataSource(dataSource);
        rendererRef.current.setDataColumnCount(dataColumnCount);
      }
    });

    // Render the grid; selection rect will be computed inside the renderer to match
    // the exact frame's layout and scroll values used for drawing
    const layoutForFrame = (() => {
      const provided = layoutSnapshotRef?.current;
      if (provided) return provided;
      const baseY = headerHeight + renderVisibleRange.startRow * rowHeight - scrollTop;
      const xPositions = computeVisibleColumnXPositions(columnWidths as any, renderVisibleRange, scrollLeft);
      return { baseY, xPositions };
    })();

    const dragVisual = (controllerDragVisualRef?.current ?? columnDragVisualRef?.current) || null;
    const orderForFrame = dragVisual?.order ?? columnOrder;
    rendererRef.current!.render({
      visibleRange: renderVisibleRange,
      columnWidths,
      scroll: { top: scrollTop, left: scrollLeft },
      columnOrder: orderForFrame,
      selection,
      canvasRect,
      hoveredCell,
      scrollbarState,
      rowHeight,
      headerHeight,
      selectionTransition: selectionTransitionRef?.current || { active: false, fromSelection: null, toSelection: null, progress: 0 },
      resizeHandleState: resizeHandleStateRef?.current || undefined,
      hoverHighlight: hoverHighlightRef?.current || null,
      dataColumnCount,
      draggedColumn: dragVisual?.draggedColumn ?? null,
      columnPositions: dragVisual?.positions ?? null,
      layout: layoutForFrame,
    });

  }, [
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
    dataManager,
    scrollbarState,
    rowHeight,
    headerHeight,
    resizeHandleStateRef,
    hoverHighlightRef,
    totalRowsOverride,
    totalColumnsOverride,
    dataColumnCount,
    effectiveOverrides,
    columnOrder,
    columnDragVisualRef,
    controllerDragVisualRef,
    layoutSnapshotRef,
  ]);

  // EXACT pattern from csvEditor - useEffect that depends on [draw]
  useEffect(() => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
    animationFrameRef.current = requestAnimationFrame(draw);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [draw]);

  // Cleanup function
  const cleanup = useCallback(() => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    rendererRef.current = null;
  }, []);

  return {
    draw,
    cleanup,
  };
}
