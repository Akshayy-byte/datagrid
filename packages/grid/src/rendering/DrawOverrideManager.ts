import type {
  DrawOverrides,
  DrawAPI,
  DrawBaseArgs,
  DrawSelectionArgs,
} from '../types';

// Enhanced DrawAPI implementation with more granular control
export class DrawAPIImpl implements DrawAPI {
  private defaultFunction: () => void;
  private defaultBackgroundFunction?: () => void;
  private defaultBorderFunction?: () => void;

  constructor(
    defaultFunction: () => void,
    defaultBackgroundFunction?: () => void,
    defaultBorderFunction?: () => void
  ) {
    this.defaultFunction = defaultFunction;
    this.defaultBackgroundFunction = defaultBackgroundFunction;
    this.defaultBorderFunction = defaultBorderFunction;
  }

  drawDefault(): void {
    this.defaultFunction();
  }

  drawDefaultBackground?(): void {
    this.defaultBackgroundFunction?.();
  }

  drawDefaultBorder?(): void {
    this.defaultBorderFunction?.();
  }
}

// Manager for handling draw overrides with proper layering and fallbacks
export class DrawOverrideManager {
  private overrides: Partial<DrawOverrides>;

  constructor(overrides: Partial<DrawOverrides> = {}) {
    this.overrides = overrides;
  }

  public updateOverrides(overrides: Partial<DrawOverrides>): void {
    this.overrides = overrides;
  }

  // Header cell drawing with override support
  public drawHeaderCell(
    ctx: CanvasRenderingContext2D,
    args: DrawBaseArgs & {
      columnIndex: number;
      colRect: { x: number; y: number; width: number; height: number };
      headerText: string;
    },
    defaultDrawer: (
      ctx: CanvasRenderingContext2D,
      args: DrawBaseArgs & {
        columnIndex: number;
        colRect: { x: number; y: number; width: number; height: number };
        headerText: string;
      }
    ) => void
  ): void {
    if (this.overrides.drawHeaderCell) {
      const api = new DrawAPIImpl(() => defaultDrawer(ctx, args));
      this.overrides.drawHeaderCell(ctx, args, api);
    } else {
      defaultDrawer(ctx, args);
    }
  }

  // Cell drawing with override support
  public drawCell(
    ctx: CanvasRenderingContext2D,
    args: DrawBaseArgs & {
      row: number;
      col: number;
      cellRect: { x: number; y: number; width: number; height: number };
      value: string;
    },
    defaultDrawer: (
      ctx: CanvasRenderingContext2D,
      args: DrawBaseArgs & {
        row: number;
        col: number;
        cellRect: { x: number; y: number; width: number; height: number };
        value: string;
      }
    ) => void
  ): void {
    if (this.overrides.drawCell) {
      const api = new DrawAPIImpl(() => defaultDrawer(ctx, args));
      this.overrides.drawCell(ctx, args, api);
    } else {
      defaultDrawer(ctx, args);
    }
  }

  // Gridlines drawing with override support
  public drawGridlines(
    ctx: CanvasRenderingContext2D,
    args: DrawBaseArgs,
    defaultDrawer: (ctx: CanvasRenderingContext2D, args: DrawBaseArgs) => void
  ): void {
    if (this.overrides.drawGridlines) {
      const api = new DrawAPIImpl(() => defaultDrawer(ctx, args));
      this.overrides.drawGridlines(ctx, args, api);
    } else {
      defaultDrawer(ctx, args);
    }
  }

  // Scrollbars drawing with override support
  public drawScrollbars(
    ctx: CanvasRenderingContext2D,
    args: DrawBaseArgs,
    defaultDrawer: (ctx: CanvasRenderingContext2D, args: DrawBaseArgs) => void
  ): void {
    if (this.overrides.drawScrollbars) {
      const api = new DrawAPIImpl(() => defaultDrawer(ctx, args));
      this.overrides.drawScrollbars(ctx, args, api);
    } else {
      defaultDrawer(ctx, args);
    }
  }

  // Resize handles drawing with override support
  public drawResizeHandles(
    ctx: CanvasRenderingContext2D,
    args: DrawBaseArgs,
    defaultDrawer: (ctx: CanvasRenderingContext2D, args: DrawBaseArgs) => void
  ): void {
    if (this.overrides.drawResizeHandles) {
      const api = new DrawAPIImpl(() => defaultDrawer(ctx, args));
      this.overrides.drawResizeHandles(ctx, args, api);
    } else {
      defaultDrawer(ctx, args);
    }
  }

  // Selection drawing with sophisticated override handling
  public drawSelection(
    ctx: CanvasRenderingContext2D,
    args: DrawSelectionArgs,
    defaultDrawer: (ctx: CanvasRenderingContext2D, args: DrawSelectionArgs) => void,
    defaultBackgroundDrawer: (ctx: CanvasRenderingContext2D, args: DrawSelectionArgs) => void,
    defaultBorderDrawer: (ctx: CanvasRenderingContext2D, args: DrawSelectionArgs) => void
  ): void {
    const { selection } = args;
    
    if (!selection) return;

    // Check for selection-type-specific overrides first
    const typeOverrides = this.overrides.selectionOverrides?.[selection.type];
    
    // Handle monolithic selection override
    if (this.overrides.drawSelection) {
      const api = new DrawAPIImpl(
        () => defaultDrawer(ctx, args),
        () => defaultBackgroundDrawer(ctx, args),
        () => defaultBorderDrawer(ctx, args)
      );
      this.overrides.drawSelection(ctx, args, api);
      return;
    }

    // Handle split background/border overrides
    const hasBackgroundOverride = 
      this.overrides.drawSelectionBackground || 
      typeOverrides?.background;
    const hasBorderOverride = 
      this.overrides.drawSelectionBorder || 
      typeOverrides?.border;

    // Draw background
    if (hasBackgroundOverride) {
      if (typeOverrides?.background) {
        const api = new DrawAPIImpl(() => defaultBackgroundDrawer(ctx, args));
        typeOverrides.background(ctx, args, api);
      } else if (this.overrides.drawSelectionBackground) {
        const api = new DrawAPIImpl(() => defaultBackgroundDrawer(ctx, args));
        this.overrides.drawSelectionBackground(ctx, args, api);
      }
    } else {
      defaultBackgroundDrawer(ctx, args);
    }

    // Draw border
    if (hasBorderOverride) {
      if (typeOverrides?.border) {
        const api = new DrawAPIImpl(() => defaultBorderDrawer(ctx, args));
        typeOverrides.border(ctx, args, api);
      } else if (this.overrides.drawSelectionBorder) {
        const api = new DrawAPIImpl(() => defaultBorderDrawer(ctx, args));
        this.overrides.drawSelectionBorder(ctx, args, api);
      }
    } else {
      defaultBorderDrawer(ctx, args);
    }
  }
}

// Utility functions for common drawing patterns

export function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number
): void {
  if (radius <= 0) {
    ctx.rect(x, y, width, height);
    return;
  }

  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

export function drawGradient(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  startColor: string,
  endColor: string,
  direction: 'horizontal' | 'vertical' = 'vertical'
): void {
  const gradient = direction === 'horizontal'
    ? ctx.createLinearGradient(x, y, x + width, y)
    : ctx.createLinearGradient(x, y, x, y + height);
  
  gradient.addColorStop(0, startColor);
  gradient.addColorStop(1, endColor);
  
  ctx.fillStyle = gradient;
  ctx.fillRect(x, y, width, height);
}

export function drawShadow(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  color: string = 'rgba(0, 0, 0, 0.1)',
  blur: number = 4,
  offsetX: number = 0,
  offsetY: number = 2
): void {
  ctx.save();
  ctx.shadowColor = color;
  ctx.shadowBlur = blur;
  ctx.shadowOffsetX = offsetX;
  ctx.shadowOffsetY = offsetY;
  ctx.fillRect(x, y, width, height);
  ctx.restore();
}

// Common override patterns that users can easily adopt

export const SELECTION_OVERRIDES = {
  // Rounded selection
  roundedSelection: (
    ctx: CanvasRenderingContext2D,
    args: DrawSelectionArgs,
    _api: DrawAPI
  ) => {
    if (!args.selectionRect) return;
    
    const { x, y, width, height } = args.selectionRect;
    const radius = 4;
    
    ctx.save();
    
    // Background
    ctx.fillStyle = args.theme.selectionFill;
    drawRoundedRect(ctx, x, y, width, height, radius);
    ctx.fill();
    
    // Border
    ctx.strokeStyle = args.theme.selectionBorder;
    ctx.lineWidth = args.theme.selectionBorderWidth;
    drawRoundedRect(ctx, x, y, width, height, radius);
    ctx.stroke();
    
    ctx.restore();
  },

  // Dashed border selection
  dashedSelection: (
    ctx: CanvasRenderingContext2D,
    args: DrawSelectionArgs,
    api: DrawAPI
  ) => {
    if (!args.selectionRect) return;
    
    // Draw default background
    api.drawDefaultBackground?.();
    
    // Custom dashed border
    const { x, y, width, height } = args.selectionRect;
    
    ctx.save();
    ctx.setLineDash([6, 4]);
    ctx.strokeStyle = args.theme.selectionBorder;
    ctx.lineWidth = args.theme.selectionBorderWidth;
    ctx.strokeRect(x, y, width, height);
    ctx.restore();
  },

  // Gradient selection
  gradientSelection: (
    ctx: CanvasRenderingContext2D,
    args: DrawSelectionArgs,
    _api: DrawAPI
  ) => {
    if (!args.selectionRect) return;
    
    const { x, y, width, height } = args.selectionRect;
    const accent = args.theme.accent;
    
    ctx.save();
    
    // Gradient background
    drawGradient(
      ctx,
      x, y, width, height,
      args.helpers.toRgba(accent, 0.05),
      args.helpers.toRgba(accent, 0.15),
      'vertical'
    );
    
    // Solid border
    ctx.strokeStyle = accent;
    ctx.lineWidth = args.theme.selectionBorderWidth;
    ctx.strokeRect(x, y, width, height);
    
    ctx.restore();
  },
};

export const CELL_OVERRIDES = {
  // Zebra striping
  zebraStripes: (
    ctx: CanvasRenderingContext2D,
    args: DrawBaseArgs & {
      row: number;
      col: number;
      cellRect: { x: number; y: number; width: number; height: number };
      value: string;
    },
    api: DrawAPI
  ) => {
    const { row, cellRect, theme } = args;
    
    // Add alternating row background
    if (row % 2 === 0) {
      ctx.save();
      ctx.fillStyle = theme.muted;
      ctx.fillRect(cellRect.x, cellRect.y, cellRect.width, cellRect.height);
      ctx.restore();
    }
    
    // Draw default cell content
    api.drawDefault();
  },
};
