import { useState, useRef, useCallback } from 'react';
import type { ColumnWidths } from '../types';
import { calculateNewColumnWidth, DEFAULT_COLUMN_WIDTH } from '../utils/columnWidth';

export function useGridColumnWidths(
  initialWidths: number[] = [120],
  options?: { minWidth?: number; maxWidth?: number }
) {
  const clampMin = Math.max(1, Math.floor(options?.minWidth ?? 50));
  const clampMax = Math.max(clampMin, Math.floor(options?.maxWidth ?? 500));
  const [columnWidths, setColumnWidths] = useState<ColumnWidths>(() => {
    // Use provided widths or default to single column
    const widths = initialWidths.length > 0 ? initialWidths : [120];
    const columnWidthsState = {
      gutter: 40,
      columns: widths,
      total: 40 + widths.reduce((sum, w) => sum + w, 0),
    };

    return columnWidthsState;
  });

  // Store callback ref to avoid dependency issues
  const onColumnWidthChangeRef = useRef<((index: number, width: number) => void) | undefined>();

  const resizeColumn = useCallback((index: number, width: number) => {
    setColumnWidths(prev => {

      const newColumns = [...prev.columns];
      if (index >= 0 && index < newColumns.length) {
        const oldWidth = newColumns[index];
        const constrainedWidth = Math.max(clampMin, Math.min(clampMax, width));
        newColumns[index] = constrainedWidth;

        const newColumnWidths: ColumnWidths = {
          gutter: prev.gutter,
          columns: newColumns,
          total: prev.gutter + newColumns.reduce((sum, w) => sum + w, 0),
        };


        // Call external callback if width actually changed
        if (constrainedWidth !== oldWidth) {
          setTimeout(() => {
            onColumnWidthChangeRef.current?.(index, constrainedWidth);
          }, 0);
        }

        return newColumnWidths;
      }
      return prev;
    });
  }, [clampMin, clampMax]);

  const updateColumnWidths = useCallback((widths: ColumnWidths) => {
    setColumnWidths(widths);
  }, []);

  const setGutterWidth = useCallback((gutter: number) => {
    setColumnWidths(prev => {
      const nextGutter = Math.max(24, Math.floor(gutter));
      if (prev.gutter === nextGutter) return prev;
      const next: ColumnWidths = {
        gutter: nextGutter,
        columns: prev.columns,
        total: nextGutter + prev.columns.reduce((sum, w) => sum + w, 0),
      };
      return next;
    });
  }, []);

  const setOnColumnWidthChange = useCallback((callback: (index: number, width: number) => void) => {
    onColumnWidthChangeRef.current = callback;
  }, []);

  // Ensure column widths array matches required column count
  const ensureColumnCount = useCallback((requiredCount: number) => {
    setColumnWidths(prev => {

      if (prev.columns.length >= requiredCount) {
          return prev;
      }

      // Expand to required count using proportional width calculation
      const newColumns = [...prev.columns];
      const addedColumns = [];
      while (newColumns.length < requiredCount) {
        // For now, use default width as we don't have canvas width context here
        // The main distribution happens in CanvasDataGrid.tsx
        const newWidth = DEFAULT_COLUMN_WIDTH;
        newColumns.push(newWidth);
        addedColumns.push(newWidth);
      }

      const newState = {
        gutter: prev.gutter,
        columns: newColumns,
        total: prev.gutter + newColumns.reduce((sum, w) => sum + w, 0),
      };

      return newState;
    });
  }, []);

  return {
    columnWidths,
    resizeColumn,
    updateColumnWidths,
    setOnColumnWidthChange,
    ensureColumnCount,
    setGutterWidth,
  };
}
