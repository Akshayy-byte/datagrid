import type {
  ResolvedThemeTokens,
  DrawOverrides,
  VisibleRange,
  ColumnWidths,
  Rect,
  AnchorRect,
  SelectionRange,
  DrawBaseArgs,
  DrawSelectionArgs,
  DrawAPI,
  FormatCell,
  DataSourceProps,
  ScrollbarState,
  SelectionTransition,
  RenderArgs,
} from '../types';
import { createDrawHelpers } from '../utils/drawHelpers';
import { computeSelectionRect } from '../utils/selectionRect';
import { getColumnRightEdgeX } from '../utils/columnGeometry';
import { drawDefaultGridlines as drawDefaultGridlinesExt, drawHeaderGridlines as drawHeaderGridlinesExt } from './gridlines';
import { CanvasSurface } from './CanvasSurface';
import { RenderCaches } from './RenderCaches';
import { LayoutMemo } from './LayoutMemo';
import { drawDefaultCell as drawDefaultCellExt, drawDefaultHeaderCell as drawDefaultHeaderCellExt } from './cellRenderers';
import { renderSelection as renderSelectionExt } from './selection';
import { renderAnimatedSelection as renderAnimatedSelectionExt } from './selectionAnimation';
import { renderGutter as renderGutterExt, renderGutterBorderOverlay as renderGutterBorderOverlayExt, renderGutterHeaderOverlay as renderGutterHeaderOverlayExt } from './gutter';
import { renderScrollbars as renderScrollbarsExt } from './scrollbars';
import { renderResizeHandles as renderResizeHandlesExt } from './resizeHandles';
import { DataAccess } from './DataAccess';

export interface CanvasRendererOptions {
  canvas: HTMLCanvasElement;
  theme: ResolvedThemeTokens;
  overrides?: Partial<DrawOverrides>;
  formatCell?: FormatCell;
  dataSource: DataSourceProps;
  frozenLeftColumns?: number;
  onCanvasRectChange?: (rect: Rect) => void;
  dataManager?: any; // Will be properly typed when we integrate DataManager
  textCacheLimit?: number;
  dataColumnCount?: number;
}

export class CanvasRenderer {
  private surface: CanvasSurface;
  private theme: ResolvedThemeTokens;
  private overrides: Partial<DrawOverrides>;
  private formatCell?: FormatCell;
  private dataSource: DataSourceProps;
  private helpers: ReturnType<typeof createDrawHelpers>;
  private dataManager?: any;
  // Cached context state and per-frame caches
  private caches: RenderCaches;
  // Layout memoization
  private layoutMemo: LayoutMemo;
  private dataAccess: DataAccess;
  private dataColumnCount?: number;
  // moved to DataAccess

  constructor(options: CanvasRendererOptions) {
    this.surface = new CanvasSurface(options.canvas, options.onCanvasRectChange);
    this.theme = options.theme;
    this.overrides = options.overrides || {};
    this.formatCell = options.formatCell;
    this.dataSource = options.dataSource;
    this.dataManager = options.dataManager;
    this.helpers = createDrawHelpers(this.surface.ctx, this.surface.devicePixelRatio, {
      textCacheLimit: options.textCacheLimit,
    });
    this.caches = new RenderCaches(this.surface.ctx);
    this.layoutMemo = new LayoutMemo();
    this.dataAccess = new DataAccess(this.dataSource, this.dataManager);
    this.dataColumnCount = options.dataColumnCount;

    // data access handles its own binding
    this.surface.setupCanvas();
  }

  private setupCanvas(): void { this.surface.setupCanvas(); }

  private ensureCanvasSetup(canvasRect: Rect): void { this.surface.ensureCanvasSetup(canvasRect); }

  public updateTheme(theme: ResolvedThemeTokens): void {
    this.theme = theme;
  }

  public updateOverrides(overrides: Partial<DrawOverrides>): void {
    this.overrides = overrides;
  }

  public updateDataSource(dataSource: DataSourceProps): void {
    this.dataSource = dataSource;
    this.dataAccess.update(this.dataSource, this.dataManager);
  }

  public setDataColumnCount(count?: number): void {
    this.dataColumnCount = count;
  }

  public render(renderArgs: {
    visibleRange: VisibleRange;
    columnWidths: ColumnWidths;
    scroll: { top: number; left: number };
    columnOrder?: number[];
    selection?: SelectionRange | null;
    canvasRect: Rect;
    hoveredCell?: { row: number; col: number } | null;
    scrollbarState: ScrollbarState;
    rowHeight: number;
    headerHeight: number;
    selectionTransition?: SelectionTransition | null;
    resizeHandleState?: { visibleIndex: number; progress: number; mouseY: number } | undefined;
    hoverHighlight?: SelectionRange | null;
    dataColumnCount?: number;
    draggedColumn?: { dataColumnIndex: number; visibleIndex: number; opacity: number; x: number; width: number } | null;
    columnPositions?: number[] | null;
    layout: { baseY: number; xPositions: number[] };
  }): [] {
    const ctx = this.surface.ctx;
    const { visibleRange, columnWidths, scroll, selection, canvasRect, hoveredCell, scrollbarState } = renderArgs;
    const selectionTransition = renderArgs.selectionTransition || null;
    const columnOrder = renderArgs.columnOrder;
    const draggedColumn = renderArgs.draggedColumn ?? null;
    const columnPositions = renderArgs.columnPositions ?? null;

    const stages: [] = [];

    // Guard against invalid canvas dimensions
    if (!canvasRect || canvasRect.width <= 0 || canvasRect.height <= 0) {
      return stages;
    }


    // Ensure canvas is properly set up for current dimensions
    this.ensureCanvasSetup(canvasRect);

    // Optional before-render hook for advanced overlays or background
    try {
      if (this.overrides.beforeRender) {
        this.overrides.beforeRender(ctx, renderArgs as unknown as RenderArgs);
      }
    } catch {}

    try {
      // Clear canvas
      ctx.save();
      ctx.fillStyle = this.theme.background;
      ctx.fillRect(0, 0, canvasRect.width, canvasRect.height);
      ctx.restore();

      // Set up clipping region to prevent any content from rendering outside canvas bounds
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, 0, canvasRect.width, canvasRect.height);
      ctx.clip();

      // Create base drawing args
      const baseArgs: DrawBaseArgs = {
        rect: canvasRect,
        theme: this.theme,
        columnWidths,
        visibleRange,
        scroll,
        helpers: this.helpers,
        scrollbarState,
        rowHeight: renderArgs.rowHeight,
        headerHeight: renderArgs.headerHeight,
      };
      // Prepare per-frame caches and context state
      this.caches.beginFrame(this.theme, columnWidths.columns.length);

      const hoverHighlight = renderArgs.hoverHighlight || null;

      // 1. Body rows and cell text
      this.renderCells(baseArgs, hoveredCell ?? null, renderArgs.layout, columnOrder, draggedColumn, columnPositions);

      // 2. Hover highlight overlay (beneath gridlines)
      this.renderHoverHighlight(baseArgs, hoverHighlight);

      // 3. Gridlines/borders as the last step before selection & handles
      this.renderGridlines(baseArgs);

      // 4. Selection UNDER header (cells only). Row selection is deferred to draw over gutter.
      let drewAnimated = false;
      if (selectionTransition && selectionTransition.active && selectionTransition.toSelection && selectionTransition.toSelection.type === 'cell') {
        drewAnimated = this.renderAnimatedSelection(baseArgs, selectionTransition);
      }
      if (!drewAnimated && selection && selection.type === 'cell') {
        const selectionRect = computeSelectionRect(selection, baseArgs);
        if (selectionRect) this.renderSelection({ ...baseArgs, selection, selectionRect });
      }

      // 5. Header row
      const dataColumnCount = renderArgs.dataColumnCount ?? this.dataColumnCount ?? columnWidths.columns.length;
      this.renderHeader(baseArgs, dataColumnCount, hoverHighlight, renderArgs.layout, columnOrder, draggedColumn, columnPositions);

      // 6. Header gridlines over header (verticals within header + bottom border)
      this.renderHeaderGridlines(baseArgs);

      // 7. Selection (column) OVER header
      drewAnimated = false;
      if (selectionTransition && selectionTransition.active && selectionTransition.toSelection && selectionTransition.toSelection.type === 'column') {
        drewAnimated = this.renderAnimatedSelection(baseArgs, selectionTransition);
      }
      if (!drewAnimated && selection && selection.type === 'column') {
        const selectionRect = computeSelectionRect(selection, baseArgs);
        if (selectionRect) this.renderSelection({ ...baseArgs, selection, selectionRect });
      }


      // 8. Gutter overlays (body below header)
      this.renderGutter(baseArgs); // body area (below header)

      // 9. Gutter border BEFORE row selection so selection overlays it
      this.renderGutterBorderOverlay(baseArgs);

      // 10. Row selection OVER gutter (but below headers)
      drewAnimated = false;
      if (selectionTransition && selectionTransition.active && selectionTransition.toSelection && selectionTransition.toSelection.type === 'row') {
        drewAnimated = this.renderAnimatedSelection(baseArgs, selectionTransition);
      }
      if (!drewAnimated && selection && selection.type === 'row') {
        const selectionRect = computeSelectionRect(selection, baseArgs);
        if (selectionRect) this.renderSelection({ ...baseArgs, selection, selectionRect });
      }

      // 11. Re-draw main header and its gridlines to ensure headers sit above row selections
      if (selection && selection.type === 'row') {
        this.renderHeader(baseArgs, dataColumnCount, hoverHighlight, renderArgs.layout, columnOrder, draggedColumn, columnPositions);
        this.renderHeaderGridlines(baseArgs);
      }

      // 12. Gutter header on top to ensure selection never covers gutter header
      this.renderGutterHeaderOverlay(baseArgs);

      // 13. Drag handles (resize)
      this.renderResizeHandles({ ...baseArgs, resizeHandleState: renderArgs.resizeHandleState });

      // 14. Scrollbars on top-most
      this.renderScrollbars(baseArgs);

      // Restore clipping
      ctx.restore();

      // End render

    } catch (_error) {
      // Swallow render errors; clear canvas to avoid leaving stale content

      // Ensure canvas transform is correct for error recovery
      this.ensureCanvasSetup(canvasRect);

      // Draw error state instead of leaving canvas white
      ctx.save();
      ctx.fillStyle = this.theme.background;
      ctx.fillRect(0, 0, canvasRect.width, canvasRect.height);

      ctx.fillStyle = this.theme.foreground;
      ctx.font = `${this.theme.textSm * 16}px ${this.theme.fontSans}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('Render Error', canvasRect.width / 2, canvasRect.height / 2);
      ctx.restore();
    } finally {
      // no-op
    }

    // Optional after-render hook
    try {
      if (this.overrides.afterRender) {
        this.overrides.afterRender(ctx, renderArgs as unknown as RenderArgs);
      }
    } catch {}

    // Clear per-frame caches
    this.caches.endFrame();

    return stages;
  }

  private renderGutter(args: DrawBaseArgs): void {
    renderGutterExt(this.surface.ctx, args, (rh, hh, st) => this.layoutMemo.getBaseY(rh, hh, st));
  }

  // Removed separate renderRowSelectionGutterOverlay; handled within renderGutter and clipped under header

  private renderGutterHeaderOverlay(args: DrawBaseArgs): void {
    renderGutterHeaderOverlayExt(this.surface.ctx, args);
  }

  private renderGutterBorderOverlay(args: DrawBaseArgs): void {
    renderGutterBorderOverlayExt(this.surface.ctx, args);
  }

  // removed sticky overlay (handled by gridlines ordering)

  private renderGridlines(args: DrawBaseArgs): void {
    const ctx = this.surface.ctx;
    if (this.overrides.drawGridlines) {
      const api: DrawAPI = { drawDefault: () => this.drawDefaultGridlines(args) };
      this.overrides.drawGridlines(ctx, args, api);
    } else {
      this.drawDefaultGridlines(args);
    }
  }

  private renderHeaderGridlines(args: DrawBaseArgs): void {
    drawHeaderGridlinesExt(this.surface.ctx, args);
  }

  private drawDefaultGridlines(args: DrawBaseArgs): void {
    drawDefaultGridlinesExt(this.surface.ctx, args);
  }

  private renderCells(
    args: DrawBaseArgs,
    _hoveredCell: { row: number; col: number } | null,
    layout: { baseY: number; xPositions: number[] },
    columnOrder?: number[],
    draggedColumn?: { dataColumnIndex: number; visibleIndex: number; opacity: number; x: number; width: number } | null,
    columnPositions?: number[] | null,
  ): void {
    const { visibleRange, columnWidths } = args;
    const rowHeightVal = args.rowHeight;
    const ctx = this.surface.ctx;
    const dragVisibleIndex = draggedColumn ? draggedColumn.visibleIndex : -1;
    const dragAlpha = draggedColumn ? Math.max(0, Math.min(1, draggedColumn.opacity)) : 1;

    // Calculate base Y position with fractional scroll offset for smooth scrolling
    const y0 = layout.baseY;
    // Reduced log noise: rely on consolidated [Grid Render] debug above

    // Precompute starting x for first visible column including fractional horizontal offset
    const xPositions = layout.xPositions;
    // Avoid noisy logs during scroll; remove or guard if needed

    {
      for (let row = visibleRange.startRow; row < visibleRange.endRow; row++) {
        const y = y0 + (row - visibleRange.startRow) * rowHeightVal;

        for (let col = visibleRange.startCol; col < visibleRange.endCol && col < columnWidths.columns.length; col++) {
          const dataColIndex = columnOrder && columnOrder.length > 0 ? (columnOrder[col] ?? col) : col;
          const baseX = columnPositions
            ? (columnPositions[col] ?? (xPositions[col - visibleRange.startCol] ?? xPositions[0] ?? 0))
            : (xPositions[col - visibleRange.startCol] ?? xPositions[0] ?? 0);
          const cellRect: AnchorRect = {
            x: baseX,
            y,
            width: columnWidths.columns[col] ?? 0,
            height: rowHeightVal,
          };

          // Prefer fast accessor when available
          let value: string;
          const rowValues = this.dataAccess.getRow(row);
          if (rowValues && dataColIndex < rowValues.length && dataColIndex >= 0) {
            value = rowValues[dataColIndex] || '';
          } else {
            value = this.dataAccess.getCell(row, dataColIndex);
          }

          const applyDragOpacity = draggedColumn && col === dragVisibleIndex;
          if (applyDragOpacity && draggedColumn) {
            cellRect.x = draggedColumn.x;
            ctx.save();
            ctx.globalAlpha = dragAlpha;
          }

          if (this.overrides.drawCell) {
            const api: DrawAPI = {
              drawDefault: () => this.drawDefaultCell(args, { row, col, cellRect, value }),
            };
            this.overrides.drawCell(this.surface.ctx, { ...args, row, col, cellRect, value }, api);
          } else {
            this.drawDefaultCell(args, { row, col, cellRect, value });
          }

          if (applyDragOpacity) {
            ctx.restore();
          }
        }
      }
    }

  }

  private drawDefaultCell(args: DrawBaseArgs, cellArgs: { row: number; col: number; cellRect: AnchorRect; value: string }): void {
    drawDefaultCellExt(this.surface.ctx, this.helpers, args.theme, this.caches, this.formatCell, cellArgs);
  }

  private renderHeader(
    args: DrawBaseArgs,
    dataColumnCount: number,
    hoverHighlight: SelectionRange | null,
    layout: { baseY: number; xPositions: number[] },
    columnOrder?: number[],
    draggedColumn?: { dataColumnIndex: number; visibleIndex: number; opacity: number; x: number; width: number } | null,
    columnPositions?: number[] | null,
  ): void {
    const { visibleRange, columnWidths, rect } = args;
    const headerHeightVal = args.headerHeight;
    const ctx = this.surface.ctx;
    const dragVisibleIndex = draggedColumn ? draggedColumn.visibleIndex : -1;
    const dragAlpha = draggedColumn ? Math.max(0, Math.min(1, draggedColumn.opacity)) : 1;

    // Ensure header background extends across the full canvas width, even for synthetic columns
    ctx.save();
    ctx.fillStyle = this.theme.muted;
    ctx.fillRect(0, 0, rect.width, headerHeightVal);
    ctx.restore();

    const hoveredColumnRange = hoverHighlight && hoverHighlight.type === 'column'
      ? {
          start: Math.min(hoverHighlight.startCol, hoverHighlight.endCol),
          end: Math.max(hoverHighlight.startCol, hoverHighlight.endCol),
        }
      : null;

    // Starting x for header cells accounts for fractional horizontal scroll
    let x = layout.xPositions?.[0] ?? 0;

    for (let col = visibleRange.startCol; col < visibleRange.endCol && col < columnWidths.columns.length; col++) {
      const columnX = columnPositions ? (columnPositions[col] ?? x) : x;
      const colRect: AnchorRect = {
        x: columnX,
        y: 0,
        width: columnWidths.columns[col] ?? 0,
        height: headerHeightVal,
      };

      const alignedRect = this.helpers.alignRect(colRect);
      const isHoveredColumn = hoveredColumnRange ? col >= hoveredColumnRange.start && col <= hoveredColumnRange.end : false;
      const dataColIndex = columnOrder && columnOrder.length > 0 ? (columnOrder[col] ?? col) : col;
      const headerText = col < dataColumnCount ? this.dataAccess.getHeaderText(dataColIndex) : '';

      const applyDragOpacity = draggedColumn && col === dragVisibleIndex;
      if (applyDragOpacity && draggedColumn) {
        alignedRect.x = draggedColumn.x;
        colRect.x = draggedColumn.x;
        ctx.save();
        ctx.globalAlpha = dragAlpha;
      }

      if (col < dataColumnCount) {
        if (this.overrides.drawHeaderCell) {
          const api: DrawAPI = {
            drawDefault: () => this.drawDefaultHeaderCell(args, { columnIndex: col, colRect, headerText }),
          };
          this.overrides.drawHeaderCell(ctx, { ...args, columnIndex: col, colRect, headerText }, api);
          if (isHoveredColumn) {
            ctx.save();
            ctx.globalAlpha = 0.4;
            ctx.fillStyle = this.getHoverFill('column');
            ctx.fillRect(alignedRect.x, alignedRect.y, alignedRect.width, alignedRect.height);
            ctx.restore();
          }
        } else {
          ctx.save();
          ctx.fillStyle = isHoveredColumn ? this.getHoverFill('column') : this.theme.muted;
          ctx.fillRect(alignedRect.x, alignedRect.y, alignedRect.width, alignedRect.height);
          if (headerText) {
            ctx.fillStyle = this.theme.foreground;
            ctx.font = `bold ${this.theme.textSm * 16}px ${this.theme.fontSans}`;
            ctx.textAlign = 'left';
            ctx.textBaseline = 'middle';
            const padding = 8;
            const maxWidth = alignedRect.width - padding * 2;
            const { text } = this.helpers.truncateText(ctx, headerText, maxWidth);
            ctx.fillText(text, alignedRect.x + padding, alignedRect.y + alignedRect.height / 2);
          }
          ctx.restore();
        }
      } else {
        ctx.save();
        ctx.fillStyle = isHoveredColumn ? this.getHoverFill('column') : this.theme.muted;
        ctx.fillRect(alignedRect.x, alignedRect.y, alignedRect.width, alignedRect.height);
        ctx.restore();
      }

      if (applyDragOpacity) {
        ctx.restore();
      }
      x += columnWidths.columns[col] ?? 0;
    }
  }

  private renderHoverHighlight(args: DrawBaseArgs, highlight: SelectionRange | null): void {
    if (!highlight) return;

    const rect = computeSelectionRect(highlight, args);
    if (!rect) return;

    let { x, y, width, height } = rect;
    const canvasWidth = args.rect.width;
    const canvasHeight = args.rect.height;

    x = Math.max(0, x);
    y = Math.max(0, y);
    width = Math.max(0, Math.min(width, canvasWidth - x));
    height = Math.max(0, Math.min(height, canvasHeight - y));

    if (highlight.type === 'column') {
      const minY = args.headerHeight;
      if (y < minY) {
        const delta = minY - y;
        y = minY;
        height = Math.max(0, height - delta);
      }
    }

    if (width <= 0 || height <= 0) return;

    const ctx = this.surface.ctx;
    ctx.save();
    ctx.fillStyle = this.getHoverFill(highlight.type);
    ctx.fillRect(x, y, width, height);
    ctx.restore();
  }

  private getHoverFill(type: SelectionRange['type']): string {
    const accent = this.theme.accent || '#2563eb';
    switch (type) {
      case 'row':
        return this.theme.hoverRowFill || this.helpers.toRgba(accent, 0.08);
      case 'column':
        return this.theme.hoverColFill || this.helpers.toRgba(accent, 0.06);
      case 'cell':
      default:
        return this.helpers.toRgba(accent, 0.1);
    }
  }

  private drawDefaultHeaderCell(_args: DrawBaseArgs, headerArgs: { columnIndex: number; colRect: AnchorRect; headerText: string }): void {
    drawDefaultHeaderCellExt(this.surface.ctx, this.helpers, this.theme, { colRect: headerArgs.colRect, headerText: headerArgs.headerText });
  }

  private renderSelection(args: DrawSelectionArgs): void {
    renderSelectionExt(this.surface.ctx, args, { drawSelection: this.overrides.drawSelection });
  }

  private renderAnimatedSelection(baseArgs: DrawBaseArgs, transition: import('../types').SelectionTransition): boolean {
    return renderAnimatedSelectionExt(
      this.surface.ctx,
      baseArgs,
      transition,
      (sel, a) => computeSelectionRect(sel, a),
      this.overrides,
    );
  }

  private renderScrollbars(args: DrawBaseArgs): void {
    renderScrollbarsExt(this.surface.ctx, args);
  }

  private renderResizeHandles(args: DrawBaseArgs & { resizeHandleState?: { visibleIndex: number; progress: number; mouseY: number } }): void {
    if (this.overrides.drawResizeHandles) {
      const api: DrawAPI = { drawDefault: () => this.renderResizeHandlesDefault(args) } as any;
      this.overrides.drawResizeHandles(this.surface.ctx, args, api);
      return;
    }
    this.renderResizeHandlesDefault(args);
  }


  private renderResizeHandlesDefault(args: DrawBaseArgs & { resizeHandleState?: { visibleIndex: number; progress: number; mouseY: number } }): void {
    renderResizeHandlesExt(
      this.surface.ctx,
      args,
      (cw, left, idx) => getColumnRightEdgeX(cw as any, left, idx),
      (c, a) => this.helpers.toRgba(c, a),
      (n) => this.helpers.alignToDevicePixelEdge(n),
    );
  }

  public resize(): void {
    this.setupCanvas();
  }


}
