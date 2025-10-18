import { useState, useCallback } from 'react';
import type { VisibleRange } from '../types';

export function useGridVisibleRange() {
  const [visibleRange, setVisibleRange] = useState<VisibleRange>({
    startRow: 0,
    endRow: 0,
    startCol: 0,
    endCol: 0,
  });

  const updateVisibleRange = useCallback((range: VisibleRange) => {
    setVisibleRange(prev => {
      // Only update if range actually changed
      if (
        prev.startRow !== range.startRow ||
        prev.endRow !== range.endRow ||
        prev.startCol !== range.startCol ||
        prev.endCol !== range.endCol
      ) {
        return range;
      }
      return prev;
    });
  }, []);

  return {
    visibleRange,
    setVisibleRange: updateVisibleRange,
  };
}