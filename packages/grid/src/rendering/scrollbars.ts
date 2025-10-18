import type { DrawBaseArgs } from '../types';
import { SCROLLBAR_WIDTH } from '../constants';

export function renderScrollbars(ctx: CanvasRenderingContext2D, args: DrawBaseArgs): void {
  const { rect, theme, scrollbarState, helpers, headerHeight } = args;
  if (!scrollbarState) return;

  const drawScrollbar = (
    type: 'vertical' | 'horizontal',
    x: number,
    y: number,
    width: number,
    height: number,
    thumbPos: number,
    thumbSize: number,
    hovering: boolean,
  ) => {
    const opacity = hovering ? 0.5 : 0.3;
    ctx.fillStyle =
      theme.scrollbarForeground +
      Math.round(opacity * 255)
        .toString(16)
        .padStart(2, '0');

    if (type === 'vertical') {
      const thumbRect = helpers.alignRectToDevicePixels(
        x + 1,
        y + thumbPos,
        width - 1,
        thumbSize,
      );
      ctx.fillRect(thumbRect.x, thumbRect.y, thumbRect.width, thumbRect.height);
    } else {
      const thumbRect = helpers.alignRectToDevicePixels(
        x + thumbPos,
        y + 1,
        thumbSize,
        height - 1,
      );
      ctx.fillRect(thumbRect.x, thumbRect.y, thumbRect.width, thumbRect.height);
    }
  };

  const showVertical = scrollbarState.vertical.visible && (scrollbarState.vertical.hovering || scrollbarState.vertical.dragging);
  if (showVertical) {
    drawScrollbar(
      'vertical',
      rect.width - SCROLLBAR_WIDTH,
      headerHeight,
      SCROLLBAR_WIDTH,
      rect.height - headerHeight,
      scrollbarState.vertical.thumbTop - headerHeight,
      scrollbarState.vertical.thumbHeight,
      scrollbarState.vertical.hoveringThumb,
    );
  }

  const showHorizontal = scrollbarState.horizontal.visible && (scrollbarState.horizontal.hovering || scrollbarState.horizontal.dragging);
  if (showHorizontal) {
    drawScrollbar(
      'horizontal',
      0,
      rect.height - SCROLLBAR_WIDTH,
      rect.width,
      SCROLLBAR_WIDTH,
      scrollbarState.horizontal.thumbLeft,
      scrollbarState.horizontal.thumbWidth,
      scrollbarState.horizontal.hoveringThumb,
    );
  }
}


