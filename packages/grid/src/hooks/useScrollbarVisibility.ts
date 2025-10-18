import { useMemo } from 'react';
import type { ScrollbarState, Rect, ColumnWidths } from '../types';
import { HEADER_HEIGHT } from '../constants';

interface ScrollbarVisibilityParams {
  canvasRect: Rect;
  contentHeight: number;
  contentWidth: number;
  scrollTop: number;
  scrollLeft: number;
  totalRows?: number;
  totalColumns?: number;
  hovering?: boolean;
  dragging?: boolean;
  hoveringVerticalThumb?: boolean;
  hoveringHorizontalThumb?: boolean;
}

export function useScrollbarVisibility(params: ScrollbarVisibilityParams): ScrollbarState {
  const {
    canvasRect,
    contentHeight,
    contentWidth,
    scrollTop,
    scrollLeft,
    totalRows = 0,
    totalColumns = 0,
    hovering = false,
    dragging = false,
    hoveringVerticalThumb = false,
    hoveringHorizontalThumb = false,
  } = params;

  return useMemo(() => {
    // Calculate if scrollbars should be visible based on content overflow
    const needsVerticalScrollbar = contentHeight > canvasRect.height;
    const needsHorizontalScrollbar = contentWidth > canvasRect.width;

    // Calculate scrollbar dimensions and positions
    let verticalThumbHeight = 0;
    let verticalThumbTop = 0;
    let horizontalThumbWidth = 0;
    let horizontalThumbLeft = 0;

    // Vertical scrollbar calculations - match CSV editor pattern exactly
    if (needsVerticalScrollbar && canvasRect.height > 0 && contentHeight > 0) {
      const scrollableHeight = contentHeight - canvasRect.height;
      const scrollableCanvasHeight = canvasRect.height - HEADER_HEIGHT;
      const vRatio = scrollableCanvasHeight / (contentHeight - HEADER_HEIGHT);
      verticalThumbHeight = Math.max(20, scrollableCanvasHeight * vRatio);

      const vScrollRatio = scrollableHeight > 0 ? scrollTop / scrollableHeight : 0;
      verticalThumbTop = HEADER_HEIGHT + vScrollRatio * (scrollableCanvasHeight - verticalThumbHeight);
    }

    // Horizontal scrollbar calculations
    if (needsHorizontalScrollbar && canvasRect.width > 0 && contentWidth > 0) {
      const scrollableWidth = contentWidth - canvasRect.width;
      const thumbWidthRatio = canvasRect.width / contentWidth;
      horizontalThumbWidth = Math.max(20, canvasRect.width * thumbWidthRatio); // Min thumb size of 20px

      if (scrollableWidth > 0) {
        const scrollProgress = scrollLeft / scrollableWidth;
        const maxThumbLeft = canvasRect.width - horizontalThumbWidth;
        horizontalThumbLeft = scrollProgress * maxThumbLeft;
      }
    }

    const scrollbarState: ScrollbarState = {
      vertical: {
        thumbTop: verticalThumbTop,
        thumbHeight: verticalThumbHeight,
        visible: needsVerticalScrollbar,
        hovering: hovering,
        hoveringThumb: hoveringVerticalThumb,
        dragging: dragging,
      },
      horizontal: {
        thumbLeft: horizontalThumbLeft,
        thumbWidth: horizontalThumbWidth,
        visible: needsHorizontalScrollbar,
        hovering: hovering,
        hoveringThumb: hoveringHorizontalThumb,
        dragging: dragging,
      },
    };


    return scrollbarState;
  }, [
    canvasRect.width,
    canvasRect.height,
    contentHeight,
    contentWidth,
    scrollTop,
    scrollLeft,
    totalRows,
    totalColumns,
    hovering,
    dragging,
  ]);
}
