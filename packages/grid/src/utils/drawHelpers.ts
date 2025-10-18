import type { DrawHelpers, AnchorRect } from '../types';

export function createDrawHelpers(
  _ctx: CanvasRenderingContext2D,
  devicePixelRatio: number = window.devicePixelRatio || 1,
  options?: { textCacheLimit?: number }
): DrawHelpers {
  const textCache = new Map<string, { width: number; text: string; wasTruncated: boolean }>();
  const cacheLimit = Math.max(0, options?.textCacheLimit ?? 0);

  const helpers = {
    alignX(n: number): number {
      return Math.round(n * devicePixelRatio) / devicePixelRatio;
    },

    alignY(n: number): number {
      return Math.round(n * devicePixelRatio) / devicePixelRatio;
    },

    alignRect(r: AnchorRect): AnchorRect {
      return {
        x: helpers.alignX(r.x),
        y: helpers.alignY(r.y),
        width: helpers.alignX(r.width),
        height: helpers.alignY(r.height),
      };
    },

    // Device pixel alignment utilities from CSV editor
    alignToDevicePixelEdge(coord: number): number {
      return Math.round(coord);
    },

    alignRectToDevicePixels(
      x: number,
      y: number,
      width: number,
      height: number,
    ): { x: number; y: number; width: number; height: number } {
      const alignedX = helpers.alignToDevicePixelEdge(x);
      const alignedY = helpers.alignToDevicePixelEdge(y);
      const alignedRight = helpers.alignToDevicePixelEdge(x + width);
      const alignedBottom = helpers.alignToDevicePixelEdge(y + height);
      return {
        x: alignedX,
        y: alignedY,
        width: alignedRight - alignedX,
        height: alignedBottom - alignedY,
      };
    },

    truncateText(
      ctx: CanvasRenderingContext2D,
      text: string,
      maxWidth: number
    ): { text: string; wasTruncated: boolean } {
      if (maxWidth <= 0) return { text: '', wasTruncated: text.length > 0 };

      // Fast-path heuristic: avoid measureText when obviously unnecessary.
      // Estimate average character width (~0.55 of font size). This is crude but effective.
      // We derive font size from ctx.font if possible, else assume 14px.
      const fontStr: string = typeof (ctx as any).font === 'string' ? (ctx as any).font : '';
      const fontMatch = /([0-9]+)px/.exec(fontStr);
      let px = 14;
      if (fontMatch && typeof fontMatch[1] === 'string') {
        px = parseInt(fontMatch[1], 10) || 14;
      }
      const approxCharWidth = px * 0.55;
      if (text.length * approxCharWidth <= maxWidth) {
        return { text, wasTruncated: false };
      }

      // Create cache key
      const cacheKey = `${text}:${maxWidth}:${fontStr}`;
      const cached = textCache.get(cacheKey);
      if (cached) {
        return { text: cached.text, wasTruncated: cached.wasTruncated };
      }

      const ellipsis = '...';
      const ellipsisWidth = ctx.measureText(ellipsis).width;
      const textWidth = ctx.measureText(text).width;

      if (textWidth <= maxWidth) {
        const result = { text, wasTruncated: false };
        textCache.set(cacheKey, { ...result, width: textWidth });
        if (cacheLimit > 0 && textCache.size > cacheLimit) {
          // Evict LRU (first inserted)
          const firstKey = textCache.keys().next().value as string | undefined;
          if (firstKey !== undefined) textCache.delete(firstKey);
        }
        return result;
      }

      if (maxWidth <= ellipsisWidth) {
        const result = { text: '', wasTruncated: true };
        textCache.set(cacheKey, { ...result, width: 0 });
        if (cacheLimit > 0 && textCache.size > cacheLimit) {
          const firstKey = textCache.keys().next().value as string | undefined;
          if (firstKey !== undefined) textCache.delete(firstKey);
        }
        return result;
      }

      const availableWidth = maxWidth - ellipsisWidth;
      let truncated = text;
      // Keep textWidth for potential future use; not needed after heuristic

      // Binary search for optimal truncation point
      let left = 0;
      let right = text.length;

      while (left < right) {
        const mid = Math.floor((left + right + 1) / 2);
        const candidate = text.slice(0, mid);
        const candidateWidth = ctx.measureText(candidate).width;

        if (candidateWidth <= availableWidth) {
          left = mid;
        } else {
          right = mid - 1;
        }
      }

      truncated = text.slice(0, left);
      const result = { text: truncated + ellipsis, wasTruncated: true };
      textCache.set(cacheKey, { ...result, width: availableWidth + ellipsisWidth });
      if (cacheLimit > 0 && textCache.size > cacheLimit) {
        const firstKey = textCache.keys().next().value as string | undefined;
        if (firstKey !== undefined) textCache.delete(firstKey);
      }
      return result;
    },

    toRgba(hexOrRgb: string, alpha: number): string {
      // Handle hex colors
      if (hexOrRgb.startsWith('#')) {
        const hex = hexOrRgb.slice(1);
        const r = parseInt(hex.slice(0, 2), 16);
        const g = parseInt(hex.slice(2, 4), 16);
        const b = parseInt(hex.slice(4, 6), 16);
        return `rgba(${r}, ${g}, ${b}, ${alpha})`;
      }

      // Handle rgb/rgba colors
      if (hexOrRgb.startsWith('rgb')) {
        const match = hexOrRgb.match(/\d+/g);
        if (match && match.length >= 3) {
          return `rgba(${match[0]}, ${match[1]}, ${match[2]}, ${alpha})`;
        }
      }

      // Fallback: assume it's a named color and convert to rgba
      const canvas = document.createElement('canvas');
      const tempCtx = canvas.getContext('2d')!;
      tempCtx.fillStyle = hexOrRgb;
      const computed = tempCtx.fillStyle;

      if (computed.startsWith('#')) {
        return helpers.toRgba(computed, alpha);
      }

      return `rgba(128, 128, 128, ${alpha})`; // Gray fallback
    },
  };

  return helpers;
}
