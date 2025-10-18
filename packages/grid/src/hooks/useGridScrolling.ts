import { useState, useRef, useCallback, useMemo, useEffect } from 'react';
import type { ColumnWidths, Rect } from '../types';
import { ROW_HEIGHT, HEADER_HEIGHT } from '../constants';

export interface ScrollState {
  scrollTop: number;
  scrollLeft: number;
}

export interface ScrollLimits {
  maxScrollTop: number;
  maxScrollLeft: number;
  contentHeight: number;
  contentWidth: number;
  canvasHeight: number;
  canvasWidth: number;
}

interface UseGridScrollingOptions {
  totalRows: number;
  columnWidths: ColumnWidths;
  canvasRect: Rect;
  rowHeight?: number;
  headerHeight?: number;
}

export function useGridScrolling(options?: UseGridScrollingOptions) {
  const [scrollTop, setScrollTop] = useState(0);
  const [scrollLeft, setScrollLeft] = useState(0);
  const scrollTopRef = useRef(0);
  const scrollLeftRef = useRef(0);

  // Calculate scroll limits when options are provided
  const scrollLimits = useMemo((): ScrollLimits | null => {
    if (!options) return null;

    const { totalRows, columnWidths, canvasRect } = options;
    const { width: canvasWidth, height: canvasHeight } = canvasRect;

    const effectiveRowHeight = options.rowHeight ?? ROW_HEIGHT;
    const effectiveHeaderHeight = options.headerHeight ?? HEADER_HEIGHT;
    const contentHeight = totalRows * effectiveRowHeight + effectiveHeaderHeight;
    const contentWidth = columnWidths.total;

    // Scroll limits: how far we can scroll before running out of content
    const maxScrollTop = Math.max(0, contentHeight - canvasHeight);
    const maxScrollLeft = Math.max(0, contentWidth - canvasWidth);


    return {
      maxScrollTop,
      maxScrollLeft,
      contentHeight,
      contentWidth,
      canvasHeight,
      canvasWidth,
    };
  }, [
    options?.totalRows,
    options?.columnWidths?.total,
    options?.columnWidths?.gutter,
    options?.columnWidths?.columns,
    options?.canvasRect?.width,
    options?.canvasRect?.height,
    options?.rowHeight,
    options?.headerHeight,
  ]);

  // Stable setters with limit clamping
  const maxScrollTop = scrollLimits?.maxScrollTop ?? Infinity;
  const setScrollTopStable = useCallback((value: number | ((prev: number) => number)) => {
    const nextValue = typeof value === 'function' ? value : () => value;
    setScrollTop(prev => {
      const next = nextValue(prev);
      const clamped = Math.max(0, Math.min(next, maxScrollTop));
      scrollTopRef.current = clamped;
      return clamped;
    });
  }, [maxScrollTop]);

  const maxScrollLeft = scrollLimits?.maxScrollLeft ?? Infinity;
  const setScrollLeftStable = useCallback((value: number | ((prev: number) => number)) => {
    const nextValue = typeof value === 'function' ? value : () => value;
    setScrollLeft(prev => {
      const next = nextValue(prev);
      const clamped = Math.max(0, Math.min(next, maxScrollLeft));
      scrollLeftRef.current = clamped;
      return clamped;
    });
  }, [maxScrollLeft]);

  const setScroll = useCallback((top: number, left: number) => {
    setScrollTopStable(top);
    setScrollLeftStable(left);
  }, [setScrollTopStable, setScrollLeftStable]);

  useEffect(() => {
    if (!scrollLimits) {
      return;
    }
    setScrollTopStable(prev => Math.min(prev, scrollLimits.maxScrollTop));
    setScrollLeftStable(prev => Math.min(prev, scrollLimits.maxScrollLeft));
  }, [scrollLimits?.maxScrollTop, scrollLimits?.maxScrollLeft, setScrollTopStable, setScrollLeftStable]);

  return {
    scrollTop,
    scrollLeft,
    scrollTopRef,
    scrollLeftRef,
    scrollLimits,
    setScrollTop: setScrollTopStable,
    setScrollLeft: setScrollLeftStable,
    setScroll,
  };
}
