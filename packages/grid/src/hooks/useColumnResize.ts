import { useCallback, useEffect, useRef, useState } from 'react';
import type { Dispatch, MutableRefObject, RefObject, SetStateAction } from 'react';
import type { GridHandle, SelectionRange, ThemeTokens } from '../types';
import type { ColumnResizeManager, ResizeHandle } from '../utils/columnResizing';
import { computeResizePillRect, isPointInRect } from '../utils/columnLayout';
import { clamp01 } from '../utils/math';

const RESIZE_HOVER_REVEAL_DELAY = 120;
const RESIZE_PROGRESS_STEP = 0.2;
type ResizeHandleVisibility = 'hidden' | 'pending' | 'visible' | 'disappearing' | 'active';

interface ResizeHandleVisualState {
  hoveredIndex: number;
  visibleIndex: number;
  progress: number;
  mouseY: number;
  status: ResizeHandleVisibility;
  delayId: number | null;
  rafId: number | null;
}

interface ResizeHandleController {
  state: ResizeHandleVisualState;
  showHover: (columnIndex: number, mouseY: number) => void;
  setActive: (columnIndex: number, mouseY: number) => void;
  keepVisible: (mouseY: number) => void;
  hide: (immediate?: boolean) => void;
  cancelAll: () => void;
}

function createResizeHandleController(
  resizeStateRef: MutableRefObject<{ visibleIndex: number; progress: number; mouseY: number } | null>,
  drawRef: MutableRefObject<() => void>,
): ResizeHandleController {
  const state: ResizeHandleVisualState = {
    hoveredIndex: -1,
    visibleIndex: -1,
    progress: 0,
    mouseY: 0,
    status: 'hidden',
    delayId: null,
    rafId: null,
  };

  const requestDraw = () => {
    try {
      drawRef.current();
    } catch {
      // Ignore draw errors triggered during unmount or teardown
    }
  };

  const applyState = () => {
    if (state.visibleIndex >= 0) {
      resizeStateRef.current = {
        visibleIndex: state.visibleIndex,
        progress: clamp01(state.progress),
        mouseY: state.mouseY,
      };
    } else {
      resizeStateRef.current = null;
    }
    requestDraw();
  };

  const cancelDelay = () => {
    if (state.delayId != null) {
      window.clearTimeout(state.delayId);
      state.delayId = null;
    }
  };

  const cancelAnimation = () => {
    if (state.rafId != null) {
      cancelAnimationFrame(state.rafId);
      state.rafId = null;
    }
  };

  const animateProgress = (target: number, onComplete?: () => void) => {
    cancelAnimation();
    const step = () => {
      const diff = target - state.progress;
      if (Math.abs(diff) <= RESIZE_PROGRESS_STEP) {
        state.progress = target;
        applyState();
        state.rafId = null;
        if (onComplete) onComplete();
        return;
      }
      state.progress = clamp01(state.progress + (diff > 0 ? RESIZE_PROGRESS_STEP : -RESIZE_PROGRESS_STEP));
      applyState();
      state.rafId = requestAnimationFrame(step);
    };
    state.rafId = requestAnimationFrame(step);
  };

  return {
    state,
    showHover(columnIndex: number, mouseY: number) {
      state.hoveredIndex = columnIndex;
      state.mouseY = mouseY;

      if (state.visibleIndex === columnIndex) {
        if (state.status === 'disappearing') {
          state.status = 'visible';
          animateProgress(1);
          return;
        }
        if (state.status === 'active') {
          state.status = 'visible';
        }
        if (state.progress < 1) {
          animateProgress(1);
        } else {
          applyState();
        }
        return;
      }

      cancelDelay();
      cancelAnimation();

      state.visibleIndex = -1;
      state.progress = 0;
      state.status = 'pending';
      applyState();

      state.delayId = window.setTimeout(() => {
        state.delayId = null;
        if (state.hoveredIndex !== columnIndex) {
          return;
        }
        state.visibleIndex = columnIndex;
        state.status = 'visible';
        if (state.progress <= 0) {
          state.progress = 0.01;
        }
        applyState();
        animateProgress(1);
      }, RESIZE_HOVER_REVEAL_DELAY);
    },
    setActive(columnIndex: number, mouseY: number) {
      cancelDelay();
      cancelAnimation();
      state.hoveredIndex = columnIndex;
      state.visibleIndex = columnIndex;
      state.progress = 1;
      state.mouseY = mouseY;
      state.status = 'active';
      applyState();
    },
    keepVisible(mouseY: number) {
      if (state.visibleIndex < 0) return;
      state.mouseY = mouseY;
      if (state.status === 'disappearing') {
        state.status = 'visible';
        animateProgress(1);
        return;
      }
      applyState();
    },
    hide(immediate: boolean = false) {
      cancelDelay();
      if (state.visibleIndex < 0) {
        state.hoveredIndex = -1;
        state.status = 'hidden';
        cancelAnimation();
        applyState();
        return;
      }

      if (immediate) {
        cancelAnimation();
        state.visibleIndex = -1;
        state.progress = 0;
        state.hoveredIndex = -1;
        state.status = 'hidden';
        applyState();
        return;
      }

      if (state.status === 'disappearing') {
        return;
      }

      state.status = 'disappearing';
      animateProgress(0, () => {
        if (state.status !== 'disappearing') {
          return;
        }
        state.visibleIndex = -1;
        state.progress = 0;
        state.hoveredIndex = -1;
        state.status = 'hidden';
        applyState();
      });
    },
    cancelAll() {
      cancelDelay();
      cancelAnimation();
      state.hoveredIndex = -1;
      state.visibleIndex = -1;
      state.progress = 0;
      state.status = 'hidden';
      applyState();
    },
  };
}

type GridState = ReturnType<GridHandle['getState']>;

export interface TryBeginResizeArgs {
  x: number;
  y: number;
  currentState: GridState;
  resizable: boolean;
  theme?: ThemeTokens | null;
}

export interface PointerMoveArgs {
  x: number;
  y: number;
  theme: ThemeTokens | null;
  currentState: GridState;
  resizable: boolean;
  overVerticalScrollbar: boolean;
  overHorizontalScrollbar: boolean;
}

interface UseColumnResizeParams {
  canvasRef: RefObject<HTMLCanvasElement>;
  columnResizeManagerRef: MutableRefObject<ColumnResizeManager | null>;
  handle: GridHandle;
  handleRef: MutableRefObject<GridHandle | null>;
  drawRef: MutableRefObject<() => void>;
  setHoverHighlight: (range: SelectionRange | null) => void;
  setHoveringVerticalThumb: Dispatch<SetStateAction<boolean>>;
  setHoveringHorizontalThumb: Dispatch<SetStateAction<boolean>>;
}

interface UseColumnResizeResult {
  isColumnResizing: boolean;
  resizeStateRef: MutableRefObject<{ visibleIndex: number; progress: number; mouseY: number } | null>;
  tryBeginResize: (args: TryBeginResizeArgs) => boolean;
  handlePointerMove: (args: PointerMoveArgs) => boolean;
  finishResize: () => void;
  hideHandles: (immediate?: boolean) => void;
  cancelHover: () => void;
}

export function useColumnResize(params: UseColumnResizeParams): UseColumnResizeResult {
  const {
    canvasRef,
    columnResizeManagerRef,
    handle,
    handleRef,
    drawRef,
    setHoverHighlight,
    setHoveringVerticalThumb,
    setHoveringHorizontalThumb,
  } = params;

  const [isColumnResizing, setIsColumnResizing] = useState(false);
  const resizeStateRef = useRef<{ visibleIndex: number; progress: number; mouseY: number } | null>(null);
  const controllerRef = useRef<ResizeHandleController | null>(null);
  const cacheRef = useRef<{ key: string; handles: ResizeHandle[] } | null>(null);
  const lastResizeLogRef = useRef<{ columnIndex: number; width: number } | null>(null);
  const hoveredHandleLogRef = useRef<number | null>(null);
  const updateActiveResizeRef = useRef<(x: number, y: number) => void>(() => {});

  const safeDraw = useCallback(() => {
    try {
      drawRef.current();
    } catch {
      // Ignore draw errors triggered during lifecycle edges
    }
  }, [drawRef]);

  const setCursor = useCallback((cursor: string) => {
    const canvas = canvasRef.current;
    if (canvas) {
      canvas.style.cursor = cursor;
    }
  }, [canvasRef]);

  if (!controllerRef.current) {
    controllerRef.current = createResizeHandleController(resizeStateRef, drawRef);
  }

  const updateActiveResize = useCallback((x: number, y: number) => {
    const manager = columnResizeManagerRef.current;
    if (!manager) return;
    const active = manager.getActiveResize();
    if (!active) return;
    const newWidth = manager.updateResize(x);
    if (newWidth == null) return;
    const previous = lastResizeLogRef.current;
    if (!previous || previous.columnIndex !== active.columnIndex || Math.abs(previous.width - newWidth) >= 1) {
      lastResizeLogRef.current = { columnIndex: active.columnIndex, width: newWidth };
    }
    const gridHandle = handleRef.current ?? handle;
    gridHandle?.resizeColumn(active.columnIndex, newWidth);
    controllerRef.current?.setActive(active.columnIndex, y);
  }, [columnResizeManagerRef, handle, handleRef]);

  useEffect(() => {
    updateActiveResizeRef.current = updateActiveResize;
  }, [updateActiveResize]);

  const finishResize = useCallback(() => {
    const manager = columnResizeManagerRef.current;
    if (manager && manager.isResizing()) {
      manager.endResize();
      // Controller will commit; avoid duplicate commit
    }
    controllerRef.current?.hide();
    setCursor('default');
    setIsColumnResizing(false);
    lastResizeLogRef.current = null;
    setHoverHighlight(null);
    safeDraw();
  }, [columnResizeManagerRef, handle, handleRef, safeDraw, setCursor, setHoverHighlight]);

  useEffect(() => {
    if (!isColumnResizing) return;

    const handleMove = (event: MouseEvent) => {
      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return;
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;
      updateActiveResizeRef.current(x, y);
      const manager = columnResizeManagerRef.current;
      const active = manager?.getActiveResize();
      if (active) {
        setHoverHighlight({ type: 'column', startCol: active.columnIndex, endCol: active.columnIndex });
      }
    };

    const handleUp = () => {
      finishResize();
    };

    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);

    return () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
    };
  }, [canvasRef, columnResizeManagerRef, finishResize, isColumnResizing, setHoverHighlight]);

  useEffect(() => {
    return () => {
      controllerRef.current?.cancelAll();
      cacheRef.current = null;
      hoveredHandleLogRef.current = null;
    };
  }, []);

  const tryBeginResize = useCallback(({ x, y, currentState, resizable, theme }: TryBeginResizeArgs) => {
    if (!resizable) return false;
    const manager = columnResizeManagerRef.current;
    if (!manager) return false;

    const handles = manager.getResizeHandles(
      currentState.columnWidths,
      currentState.canvasRect?.width ?? 0,
      currentState.scrollLeft ?? 0,
    ).filter((handleEntry) => handleEntry.rect.x >= currentState.columnWidths.gutter);

    const hit = manager.getHandleAtPoint(x, y, handles);
    if (!hit) {
      // Try pill hit if visible
      if (controllerRef.current && controllerRef.current.state.visibleIndex >= 0 && theme) {
        const visibleIdx = controllerRef.current.state.visibleIndex;
        const activeHandle = handles.find((h) => h.columnIndex === visibleIdx) || null;
        if (activeHandle) {
          const pillRect = computeResizePillRect(activeHandle, controllerRef.current.state, theme);
          if (isPointInRect(x, y, pillRect)) {
            const currentWidthAlt = currentState.columnWidths.columns[visibleIdx] ?? 0;
            manager.startResize(visibleIdx, x, currentWidthAlt);
            controllerRef.current.setActive(visibleIdx, y);
            lastResizeLogRef.current = { columnIndex: visibleIdx, width: currentWidthAlt };
            setIsColumnResizing(true);
            setHoverHighlight({ type: 'column', startCol: visibleIdx, endCol: visibleIdx });
            setCursor('col-resize');
            return true;
          }
        }
      }
      return false;
    }

    const currentWidth = currentState.columnWidths.columns[hit.columnIndex] ?? 0;
    manager.startResize(hit.columnIndex, x, currentWidth);
    controllerRef.current?.setActive(hit.columnIndex, y);
    lastResizeLogRef.current = { columnIndex: hit.columnIndex, width: currentWidth };
    setIsColumnResizing(true);
    setHoverHighlight({ type: 'column', startCol: hit.columnIndex, endCol: hit.columnIndex });
    setCursor('col-resize');
    return true;
  }, [columnResizeManagerRef, setCursor, setHoverHighlight]);

  const handlePointerMove = useCallback((args: PointerMoveArgs) => {
    const {
      x,
      y,
      theme,
      currentState,
      resizable,
      overVerticalScrollbar,
      overHorizontalScrollbar,
    } = args;

    const controller = controllerRef.current;
    const manager = columnResizeManagerRef.current;

    if (!controller) {
      return false;
    }

    if (manager?.isResizing()) {
      setHoveringVerticalThumb((prev) => (prev ? false : prev));
      setHoveringHorizontalThumb((prev) => (prev ? false : prev));
      updateActiveResizeRef.current(x, y);
      setHoverHighlight(null);
      setCursor('col-resize');
      return true;
    }

    if (overVerticalScrollbar || overHorizontalScrollbar) {
      controller.hide(true);
      setHoverHighlight(null);
      setCursor('default');
      return true;
    }

    if (!resizable || !manager) {
      cacheRef.current = null;
      controller.hide(true);
      setHoverHighlight(null);
      return false;
    }

    if (!theme) {
      hoveredHandleLogRef.current = null;
      controller.hide(true);
      return false;
    }

    const widthSnapshot = currentState.columnWidths;
    const scrollSnapshot = typeof currentState.scrollLeft === 'number' ? currentState.scrollLeft : 0;
    const canvasWidthSnapshot = typeof currentState.canvasRect?.width === 'number'
      ? currentState.canvasRect.width
      : 0;
    const rangeSnapshot = currentState.visibleRange;

    const cacheKey = [
      canvasWidthSnapshot,
      scrollSnapshot,
      widthSnapshot.gutter,
      rangeSnapshot?.startCol ?? -1,
      rangeSnapshot?.endCol ?? -1,
      widthSnapshot.columns.length,
      widthSnapshot.columns.join(','),
    ].join('|');

    let handles: ResizeHandle[] = [];
    let hoveredHandle: ResizeHandle | null = null;

    const cached = cacheRef.current;
    if (!cached || cached.key !== cacheKey) {
      const computedHandles = manager.getResizeHandles(
        widthSnapshot,
        canvasWidthSnapshot,
        scrollSnapshot,
      ).filter((handleEntry) => handleEntry.rect.x + handleEntry.rect.width > widthSnapshot.gutter);

      cacheRef.current = {
        key: cacheKey,
        handles: computedHandles,
      };
      handles = computedHandles;
    } else {
      handles = cached.handles;
    }

    hoveredHandle = manager.getHandleAtPoint(x, y, handles);

    let overPill = false;
    if (!hoveredHandle && controller.state.visibleIndex >= 0 && handles.length > 0) {
      const activeHandle = handles.find((h) => h.columnIndex === controller.state.visibleIndex) || null;
      if (activeHandle) {
        const currentRect = computeResizePillRect(activeHandle, controller.state, theme);
        if (isPointInRect(x, y, currentRect)) {
          overPill = true;
        } else {
          const prospectiveRect = computeResizePillRect(activeHandle, {
            ...controller.state,
            mouseY: y,
          }, theme);
          if (isPointInRect(x, y, prospectiveRect)) {
            controller.keepVisible(y);
            setCursor('col-resize');
            return true;
          }
        }
      }
    }

    if (hoveredHandle) {
      if (hoveredHandleLogRef.current !== hoveredHandle.columnIndex) {
        hoveredHandleLogRef.current = hoveredHandle.columnIndex;
      }
      controller.showHover(hoveredHandle.columnIndex, y);
      setHoverHighlight(null);
      setCursor('col-resize');
      return true;
    }

    if (overPill) {
      if (hoveredHandleLogRef.current !== controller.state.visibleIndex) {
        hoveredHandleLogRef.current = controller.state.visibleIndex;
      }
      controller.keepVisible(y);
      setHoverHighlight(null);
      setCursor('col-resize');
      return true;
    }

    if (hoveredHandleLogRef.current !== null) {
      hoveredHandleLogRef.current = null;
    }

    if (controller.state.visibleIndex >= 0) {
      controller.hide();
      setCursor('default');
    }

    return false;
  }, [
    cacheRef,
    columnResizeManagerRef,
    setCursor,
    setHoverHighlight,
    setHoveringHorizontalThumb,
    setHoveringVerticalThumb,
    updateActiveResizeRef,
  ]);

  const hideHandles = useCallback((immediate?: boolean) => {
    controllerRef.current?.hide(immediate);
  }, []);

  const cancelHover = useCallback(() => {
    controllerRef.current?.cancelAll();
    cacheRef.current = null;
    hoveredHandleLogRef.current = null;
  }, []);

  return {
    isColumnResizing,
    resizeStateRef,
    tryBeginResize,
    handlePointerMove,
    finishResize,
    hideHandles,
    cancelHover,
  };
}
