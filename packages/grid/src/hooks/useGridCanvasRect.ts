import { useState, useCallback } from 'react';
import type { Rect } from '../types';

export function useGridCanvasRect() {
  const [canvasRect, setCanvasRect] = useState<Rect>({ width: 0, height: 0 });

  const updateCanvasRect = useCallback((rect: Rect) => {
    setCanvasRect(prev => {
      // Only update if dimensions actually changed
      if (prev.width !== rect.width || prev.height !== rect.height) {
        return rect;
      }
      return prev;
    });
  }, []);

  return {
    canvasRect,
    setCanvasRect: updateCanvasRect,
  };
}