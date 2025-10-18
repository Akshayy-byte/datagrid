import { useEffect, useRef, useState, useMemo } from 'react';
import type {
  GridHandle,
  GridStateSnapshot,
  UseGridOptions,
  UseGridReturn,
} from '../types';

function shallowEqual<T>(a: T, b: T): boolean {
  if (a === b) return true;

  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) {
    return false;
  }

  const keysA = Object.keys(a as object);
  const keysB = Object.keys(b as object);

  if (keysA.length !== keysB.length) return false;

  for (const key of keysA) {
    if (!keysB.includes(key)) return false;
    if ((a as any)[key] !== (b as any)[key]) return false;
  }

  return true;
}

export function useGrid<TSlice = GridStateSnapshot>(
  ref: React.RefObject<GridHandle> | GridHandle | null,
  options: UseGridOptions<TSlice> = {}
): UseGridReturn<TSlice> {
  const { selector, shallow = false } = options;

  // Resolve handle, even if ref.current is set after first render
  const [handle, setHandle] = useState<GridHandle | null>(() => {
    if (!ref) return null;
    if ('current' in ref) return ref.current;
    return ref;
  });

  useEffect(() => {
    let raf: number | null = null;
    const resolve = () => {
      const next = !ref
        ? null
        : ('current' in ref)
        ? ref.current
        : ref;
      if (next !== handle) {
        setHandle(next);
      }
      if (!next) {
        raf = requestAnimationFrame(resolve);
      }
    };
    resolve();
    return () => { if (raf) cancelAnimationFrame(raf); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ref]);

  // Default selector returns the full state
  const defaultSelector = useMemo(() => (state: GridStateSnapshot) => state as TSlice, []);
  const actualSelector = selector || defaultSelector;

  // Track the selected slice of state
  const [selectedState, setSelectedState] = useState<TSlice>(() => {
    if (!handle) {
      // Return a default state shape when handle is null
      return {
        selection: null,
        selectionRect: null,
        visibleRange: { startRow: 0, endRow: 0, startCol: 0, endCol: 0 },
        scrollTop: 0,
        scrollLeft: 0,
        columnWidths: { gutter: 40, columns: [120], total: 160 },
        canvasRect: { width: 0, height: 0 },
        scrollbarState: { vertical: { thumbTop: 0, thumbHeight: 0, visible: false, hovering: false, hoveringThumb: false, dragging: false }, horizontal: { thumbLeft: 0, thumbWidth: 0, visible: false, hovering: false, hoveringThumb: false, dragging: false } },
      } as TSlice;
    }
    return actualSelector(handle.getState());
  });

  // Previous selected state for shallow comparison
  const prevSelectedRef = useRef<TSlice>(selectedState);

  useEffect(() => {
    if (!handle) return;

    const unsubscribe = handle.subscribe(() => {
      const newState = handle.getState();
      const newSelected = actualSelector(newState);

      // Compare with previous state
      const shouldUpdate = shallow
        ? !shallowEqual(newSelected, prevSelectedRef.current)
        : newSelected !== prevSelectedRef.current;

      if (shouldUpdate) {
        prevSelectedRef.current = newSelected;
        setSelectedState(newSelected);
      }
    });

    // Initialize with current state
    const initialState = actualSelector(handle.getState());
    if (shallow ? !shallowEqual(initialState, prevSelectedRef.current) : initialState !== prevSelectedRef.current) {
      prevSelectedRef.current = initialState;
      setSelectedState(initialState);
    }

    return unsubscribe;
  }, [handle, actualSelector, shallow]);

  // Bound methods for convenience
  const boundMethods = useMemo(() => {
    if (!handle) {
      // Return no-op functions when handle is null
      const noop = () => {};
      const noopWithResult = () => null;
      return {
        setSelection: noop,
        clearSelection: noop,
        setScroll: noop,
        scrollToCell: noop,
        autosizeColumn: noop,
        resizeColumn: noop,
        getSelectionRect: noopWithResult,
        getCellRect: noopWithResult,
        getRowRect: noopWithResult,
        getColumnRect: noopWithResult,
        getTheme: () => ({
          background: '#ffffff',
          foreground: '#000000',
          muted: '#f5f5f5',
          mutedForeground: '#737373',
          border: '#e5e5e5',
          accent: '#2563eb',
          scrollbarForeground: '#d4d4d8',
          fontMono: 'ui-monospace, "SF Mono", Consolas, monospace',
          fontSans: 'ui-sans-serif, system-ui, sans-serif',
          textXs: 0.75,
          textSm: 0.875,
          selectionBorderWidth: 2,
          gridlineWidth: 0.5,
          resizeHandlePillWidth: 18,
          resizeHandlePillHeight: 36,
          resizeHandleDotRadius: 2.5,
        }),
        setTheme: noop,
      };
    }

    return {
      setSelection: handle.setSelection.bind(handle),
      clearSelection: handle.clearSelection.bind(handle),
      setScroll: handle.setScroll.bind(handle),
      scrollToCell: handle.scrollToCell.bind(handle),
      autosizeColumn: handle.autosizeColumn.bind(handle),
      resizeColumn: handle.resizeColumn.bind(handle),
      getSelectionRect: handle.getSelectionRect.bind(handle),
      getCellRect: handle.getCellRect.bind(handle),
      getRowRect: handle.getRowRect.bind(handle),
      getColumnRect: handle.getColumnRect.bind(handle),
      getTheme: handle.getTheme.bind(handle),
      setTheme: handle.setTheme.bind(handle),
    };
  }, [handle]);

  return {
    ...selectedState,
    ...boundMethods,
  } as UseGridReturn<TSlice>;
}
