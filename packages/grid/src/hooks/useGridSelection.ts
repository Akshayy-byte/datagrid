import { useState, useRef, useCallback } from 'react';
import type { SelectionRange, AnchorRect } from '../types';

export function useGridSelection() {
  const [selection, setSelection] = useState<SelectionRange | null>(null);
  const [selectionRect, setSelectionRect] = useState<AnchorRect | null>(null);

  // Store callback ref to avoid dependency issues
  const onSelectionChangeRef = useRef<((sel: SelectionRange | null) => void) | undefined>();

  const setSelectionStable = useCallback((sel: SelectionRange | null) => {
    setSelection(prev => {
      if (prev !== sel) {
        // Call external callback if provided
        setTimeout(() => {
          onSelectionChangeRef.current?.(sel);
        }, 0);
      }
      return sel;
    });
  }, []);

  const clearSelection = useCallback(() => {
    setSelectionStable(null);
    setSelectionRect(null);
  }, [setSelectionStable]);

  const setOnSelectionChange = useCallback((callback: (sel: SelectionRange | null) => void) => {
    onSelectionChangeRef.current = callback;
  }, []);

  return {
    selection,
    selectionRect,
    setSelection: setSelectionStable,
    setSelectionRect,
    clearSelection,
    setOnSelectionChange,
  };
}
