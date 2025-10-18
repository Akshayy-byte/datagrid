import { useCallback, useMemo, useRef, useState } from 'react';
import type {
  GridStateSnapshot,
  GridHandle,
  SelectionRange,
  AnchorRect,
  VisibleRange,
  ColumnWidths,
  Rect,
  ResolvedThemeTokens,
  ScrollbarState,
} from '../types';

export interface GridStateOptions {
  initialTheme?: Partial<ResolvedThemeTokens>;
  initialSelection?: SelectionRange | null;
  initialColumnWidths?: number[];
  onSelectionChange?: (sel: SelectionRange | null) => void;
  onColumnWidthChange?: (columnIndex: number, width: number) => void;
}

// Internal state interface
interface InternalGridState {
  selection: SelectionRange | null;
  selectionRect: AnchorRect | null;
  visibleRange: VisibleRange;
  scrollTop: number;
  scrollLeft: number;
  columnWidths: ColumnWidths;
  canvasRect: Rect;
  theme: ResolvedThemeTokens;
  scrollbarState: ScrollbarState;
}

import { DEFAULT_THEME_TOKENS } from '../themes/themeSystem';

// Default scrollbar state
const DEFAULT_SCROLLBAR_STATE: ScrollbarState = {
  vertical: {
    thumbTop: 0,
    thumbHeight: 0,
    visible: false,
    hovering: false,
    hoveringThumb: false,
    dragging: false,
  },
  horizontal: {
    thumbLeft: 0,
    thumbWidth: 0,
    visible: false,
    hovering: false,
    hoveringThumb: false,
    dragging: false,
  },
};

export function useGridState(options: GridStateOptions = {}) {
  const {
    initialTheme = {},
    initialSelection = null,
    initialColumnWidths = [],
    onSelectionChange,
    onColumnWidthChange,
  } = options;

  // Internal state
  const [state, setState] = useState<InternalGridState>(() => {
    const initialState = {
      selection: initialSelection,
      selectionRect: null,
      visibleRange: { startRow: 0, endRow: 0, startCol: 0, endCol: 0 },
      scrollTop: 0,
      scrollLeft: 0,
      columnWidths: {
        gutter: 40,
        columns: initialColumnWidths.length > 0 ? initialColumnWidths : [120],
        total: 0,
      },
      canvasRect: { width: 0, height: 0 },
      theme: { ...DEFAULT_THEME_TOKENS, ...initialTheme } as ResolvedThemeTokens,
      scrollbarState: { ...DEFAULT_SCROLLBAR_STATE },
    };

    // logging removed

    return initialState;
  });

  // Listeners for state changes with debouncing
  const listenersRef = useRef<Set<() => void>>(new Set());
  const notifyTimeoutRef = useRef<number | null>(null);

  // Store callbacks in refs to avoid dependency issues
  const onSelectionChangeRef = useRef(onSelectionChange);
  const onColumnWidthChangeRef = useRef(onColumnWidthChange);

  // Update refs when callbacks change
  onSelectionChangeRef.current = onSelectionChange;
  onColumnWidthChangeRef.current = onColumnWidthChange;

  // Previous state ref for change detection
  const prevStateRef = useRef<InternalGridState | null>(null);

  // Debounced notify listeners to prevent notification storms
  const notifyListeners = useCallback(() => {
    if (notifyTimeoutRef.current) {
      clearTimeout(notifyTimeoutRef.current);
    }
    notifyTimeoutRef.current = window.setTimeout(() => {
      listenersRef.current.forEach(listener => listener());
    }, 0); // Use setTimeout to avoid calling during render
  }, []);

  // Update state with change detection and safe notifications
  const updateState = useCallback((updater: (prev: InternalGridState) => InternalGridState) => {
    setState(prev => {
      const newState = updater(prev);
      const prevState = prevStateRef.current;

      // Only proceed if state actually changed
      let hasChanges = false;
      if (!prevState) {
        hasChanges = true;
      } else {
        // Check for meaningful changes
        if (
          newState.selection !== prev.selection ||
          newState.visibleRange !== prev.visibleRange ||
          newState.scrollTop !== prev.scrollTop ||
          newState.scrollLeft !== prev.scrollLeft ||
          newState.columnWidths !== prev.columnWidths ||
          newState.canvasRect !== prev.canvasRect
        ) {
          hasChanges = true;
        }
      }

      // Call external callbacks if values actually changed
      if (newState.selection !== prev.selection) {
        setTimeout(() => {
          onSelectionChangeRef.current?.(newState.selection);
        }, 0);
      }

      // Store current state for next comparison
      prevStateRef.current = newState;

      // Notify listeners only if there are actual changes
      if (hasChanges) {
        notifyListeners();
      }

      return newState;
    });
  }, [notifyListeners]);

  // GridHandle implementation
  const handle = useMemo<GridHandle>(() => ({
    getState(): GridStateSnapshot {
      const snapshot = {
        selection: state.selection,
        selectionRect: state.selectionRect,
        visibleRange: state.visibleRange,
        scrollTop: state.scrollTop,
        scrollLeft: state.scrollLeft,
        columnWidths: state.columnWidths,
        canvasRect: state.canvasRect,
        scrollbarState: state.scrollbarState,
      };

      // logging removed

      return snapshot;
    },

    subscribe(listener: () => void): () => void {
      listenersRef.current.add(listener);
      return () => {
        listenersRef.current.delete(listener);
      };
    },

    setSelection(sel: SelectionRange | null): void {
      updateState(prev => ({ ...prev, selection: sel }));
    },

    clearSelection(): void {
      updateState(prev => ({ ...prev, selection: null, selectionRect: null }));
    },

    setScroll(top: number, left: number): void {
      updateState(prev => ({
        ...prev,
        scrollTop: Math.max(0, top),
        scrollLeft: Math.max(0, left),
      }));
    },

    scrollToCell(
      _row: number,
      _col: number,
      _align: 'nearest' | 'start' | 'center' | 'end' = 'nearest'
    ): void {
      // TODO: Implement based on visible range and cell dimensions
      // logging removed
    },

    autosizeColumn(
      _index: number,
      _strategy: 'sample' | 'header-only' | 'full' = 'sample'
    ): void {
      // TODO: Implement column autosizing
      // logging removed
    },

    resizeColumn(index: number, width: number): void {
      updateState(prev => {
        const newColumns = [...prev.columnWidths.columns];
        if (index >= 0 && index < newColumns.length) {
          const oldWidth = newColumns[index];
          const nextWidth = Math.max(50, Math.min(500, width));
          newColumns[index] = nextWidth; // Apply min/max constraints

          const newColumnWidths = {
            ...prev.columnWidths,
            columns: newColumns,
            total: prev.columnWidths.gutter + newColumns.reduce((sum, w) => sum + w, 0),
          };

          // Call external callback using setTimeout to avoid calling during render
          if (newColumns[index] !== oldWidth) {
            setTimeout(() => {
              onColumnWidthChangeRef.current?.(index, nextWidth);
            }, 0);
          }

          return {
            ...prev,
            columnWidths: newColumnWidths,
          };
        }
        return prev;
      });
    },

    getSelectionRect(): AnchorRect | null {
      return state.selectionRect;
    },

    getCellRect(_row: number, _col: number): AnchorRect | null {
      // TODO: Calculate cell rect based on current state
      // logging removed
      return null;
    },

    getRowRect(_row: number): AnchorRect | null {
      // TODO: Calculate row rect based on current state
      // logging removed
      return null;
    },

    getColumnRect(_col: number): AnchorRect | null {
      // TODO: Calculate column rect based on current state
      // logging removed
      return null;
    },

    getTheme(): ResolvedThemeTokens {
      return state.theme;
    },

    setTheme(partial: Partial<ResolvedThemeTokens>): void {
      updateState(prev => ({
        ...prev,
        theme: { ...prev.theme, ...partial } as ResolvedThemeTokens,
      }));
    },
  }), [state, updateState]);

  // Internal state updaters for canvas operations
  const setVisibleRange = useCallback((visibleRange: VisibleRange) => {
    updateState(prev => ({ ...prev, visibleRange }));
  }, [updateState]);

  const setCanvasRect = useCallback((canvasRect: Rect) => {
    updateState(prev => ({ ...prev, canvasRect }));
  }, [updateState]);

  const setSelectionRect = useCallback((selectionRect: AnchorRect | null) => {
    updateState(prev => ({ ...prev, selectionRect }));
  }, [updateState]);

  const setColumnWidths = useCallback((columnWidths: ColumnWidths) => {
    updateState(prev => ({ ...prev, columnWidths }));
  }, [updateState]);

  const setScrollbarState = useCallback((scrollbarState: ScrollbarState | ((prev: ScrollbarState) => ScrollbarState)) => {
    updateState(prev => {
      const nextScrollbarState = typeof scrollbarState === 'function' ? scrollbarState(prev.scrollbarState) : scrollbarState;

      // logging removed

      return { ...prev, scrollbarState: nextScrollbarState };
    });
  }, [updateState]);

  return {
    handle,
    state,
    // Internal updaters for canvas operations
    setVisibleRange,
    setCanvasRect,
    setSelectionRect,
    setColumnWidths,
    setScrollbarState,
  };
}
