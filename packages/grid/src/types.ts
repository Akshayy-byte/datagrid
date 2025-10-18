// ====== Selection ======

export type SelectionType = 'cell' | 'row' | 'column';

export interface CellPosition {
  row: number;
  col: number;
}

// Rectangular cell selection (start/end are inclusive, can form a rectangle).
export interface CellSelectionRange {
  type: 'cell';
  start: CellPosition;
  end: CellPosition;
}

// Row selection range (inclusive).
export interface RowSelectionRange {
  type: 'row';
  startRow: number;
  endRow: number;
}

// Column selection range (inclusive).
export interface ColumnSelectionRange {
  type: 'column';
  startCol: number;
  endCol: number;
}

export type SelectionRange =
  | CellSelectionRange
  | RowSelectionRange
  | ColumnSelectionRange;

// Selection transition state for animating between two selections
export interface SelectionTransition {
  active: boolean;
  fromSelection: SelectionRange | null;
  toSelection: SelectionRange | null;
  progress: number; // 0..1
}

// ====== Layout & View ======

export interface AnchorRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface VisibleRange {
  startRow: number; // inclusive
  endRow: number;   // exclusive
  startCol: number; // inclusive
  endCol: number;   // exclusive
}

export interface Rect {
  width: number;
  height: number;
}

export interface ColumnWidths {
  gutter: number;
  columns: number[];
  total: number;
}

// ====== Layout Overrides ======

export interface LayoutEnvironment {
  scrollTop: number;
  scrollLeft: number;
  canvasRect: Rect;
  columnWidths: ColumnWidths;
  rowHeight: number;
  headerHeight: number;
  totalRows: number;
  totalColumns: number;
  overscan?: number;
}

export interface LayoutSnapshotPublic {
  visibleRange: VisibleRange;
  xStart: number;
  xPositions: number[];
  baseY: number;
  gutter: number;
}

export interface LayoutOverrides {
  computeVisibleRange?: (env: LayoutEnvironment) => VisibleRange;
  computeLayoutSnapshot?: (env: LayoutEnvironment) => LayoutSnapshotPublic;
}

// ====== Scrollbars ======

export interface ScrollbarState {
  vertical: {
    thumbTop: number;
    thumbHeight: number;
    visible: boolean;
    hovering: boolean;
    hoveringThumb: boolean;
    dragging: boolean;
  };
  horizontal: {
    thumbLeft: number;
    thumbWidth: number;
    visible: boolean;
    hovering: boolean;
    hoveringThumb: boolean;
    dragging: boolean;
  };
}

// ====== Theme ======

export interface ThemeTokens {
  // Base
  background: string;
  foreground: string;
  muted: string;
  mutedForeground: string;
  border: string;
  accent: string;
  scrollbarForeground: string;

  // Typography
  fontMono: string;
  fontSans: string;
  textXs: number; // rem multiplier → px via base font size
  textSm: number;

  // Optional stylers
  selectionFill?: string;          // fallback derived from accent
  selectionBorder?: string;        // fallback derived from accent
  selectionBorderWidth?: number;   // default 2
  hoverRowFill?: string;           // e.g., accent + '1A'
  hoverColFill?: string;           // e.g., accent + '1A'
  gridlineWidth?: number;          // default 0.5
  resizeHandlePillWidth: number;
  resizeHandlePillHeight: number;
  resizeHandleDotRadius: number;
  resizeHandleLineColor?: string;
  resizeHandlePillFill?: string;
  resizeHandleDotColor?: string;
  resizeHandleDotOpacity?: number;
}

// Fully-resolved theme: all previously-optional values are guaranteed
export type ResolvedThemeTokens = Omit<ThemeTokens,
  'selectionFill' | 'selectionBorder' | 'selectionBorderWidth' | 'hoverRowFill' | 'hoverColFill' | 'gridlineWidth' |
  'resizeHandleLineColor' | 'resizeHandlePillFill' | 'resizeHandleDotColor' | 'resizeHandleDotOpacity'
> & {
  selectionFill: string;
  selectionBorder: string;
  selectionBorderWidth: number;
  hoverRowFill: string;
  hoverColFill: string;
  gridlineWidth: number;
  resizeHandleLineColor: string;
  resizeHandlePillFill: string;
  resizeHandleDotColor: string;
  resizeHandleDotOpacity: number;
};

// ====== Draw Overrides ======

// Helpers available to overrides, aligned with HiDPI behavior and shared caches.
export interface DrawHelpers {
  alignX(n: number): number;
  alignY(n: number): number;
  alignRect(r: AnchorRect): AnchorRect;
  alignToDevicePixelEdge(coord: number): number;
  alignRectToDevicePixels(
    x: number,
    y: number,
    width: number,
    height: number,
  ): { x: number; y: number; width: number; height: number };
  truncateText(
    ctx: CanvasRenderingContext2D,
    text: string,
    maxWidth: number
  ): { text: string; wasTruncated: boolean };
  toRgba(hexOrRgb: string, alpha: number): string;
}

export interface DrawBaseArgs {
  rect: Rect;
  theme: ResolvedThemeTokens;
  columnWidths: { gutter: number; columns: number[] };
  visibleRange: VisibleRange;
  scroll: { top: number; left: number };
  helpers: DrawHelpers;
  scrollbarState: ScrollbarState;
  rowHeight: number;
  headerHeight: number;
  // Optional state for column resize handle rendering
  resizeHandleState?: {
    visibleIndex: number; // -1 if none
    progress: number; // 0..1 animation progress
    mouseY: number; // canvas-local Y for pill position
  };
}

export interface DrawSelectionArgs extends DrawBaseArgs {
  selection: SelectionRange | null;
  selectionRect: AnchorRect | null;
}

// Public render args passed to before/after render hooks
export interface RenderArgs {
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
}

export interface DrawAPI {
  // For decorate-mode: call defaults before/after custom painting.
  drawDefault(): void;

  // For selection-split overrides (when available).
  drawDefaultBackground?(): void;
  drawDefaultBorder?(): void;
}

export interface SelectionTypeOverrides {
  background?(
    ctx: CanvasRenderingContext2D,
    args: DrawSelectionArgs,
    api: DrawAPI
  ): void;
  border?(
    ctx: CanvasRenderingContext2D,
    args: DrawSelectionArgs,
    api: DrawAPI
  ): void;
}

export interface DrawOverrides {
  // General phases (all optional; decorate or replace).
  // Called before the renderer starts a frame. Rarely needed; use with care.
  beforeRender?(
    ctx: CanvasRenderingContext2D,
    args: RenderArgs
  ): void;

  drawHeaderCell?(
    ctx: CanvasRenderingContext2D,
    args: DrawBaseArgs & {
      columnIndex: number;
      colRect: AnchorRect; // column cell rect in header row
      headerText: string;
    },
    api: DrawAPI
  ): void;

  drawCell?(
    ctx: CanvasRenderingContext2D,
    args: DrawBaseArgs & {
      row: number;
      col: number;
      cellRect: AnchorRect;
      value: string;
    },
    api: DrawAPI
  ): void;

  drawGridlines?(
    ctx: CanvasRenderingContext2D,
    args: DrawBaseArgs,
    api: DrawAPI
  ): void;

  drawScrollbars?(
    ctx: CanvasRenderingContext2D,
    args: DrawBaseArgs,
    api: DrawAPI
  ): void;

  drawResizeHandles?(
    ctx: CanvasRenderingContext2D,
    args: DrawBaseArgs,
    api: DrawAPI
  ): void;

  // Called after the renderer completes a frame. Useful for overlays.
  afterRender?(
    ctx: CanvasRenderingContext2D,
    args: RenderArgs
  ): void;

  // Selection – monolithic or split background/border.
  drawSelection?(
    ctx: CanvasRenderingContext2D,
    args: DrawSelectionArgs,
    api: DrawAPI
  ): void;

  drawSelectionBackground?(
    ctx: CanvasRenderingContext2D,
    args: DrawSelectionArgs,
    api: DrawAPI
  ): void;

  drawSelectionBorder?(
    ctx: CanvasRenderingContext2D,
    args: DrawSelectionArgs,
    api: DrawAPI
  ): void;

  // Per-type fine-grained overrides apply only for that selection type.
  selectionOverrides?: {
    cell?: SelectionTypeOverrides;
    row?: SelectionTypeOverrides;
    column?: SelectionTypeOverrides;
  };
}

// ====== Data Source ======

// Full data mode
export interface FullDataSourceProps {
  mode?: 'full';
  rows: string[][];
  headers?: string[];
}

// Virtual (paged) mode
export interface VirtualDataSourceProps {
  mode?: 'virtual';
  rowCount: number;
  columnCount: number;
  headers?: string[];
  fetchRows: (offset: number, limit: number) => Promise<string[][]>;
  pageSize?: number; // default 500
  prefetch?: boolean; // default true
}

export type DataSourceProps = FullDataSourceProps | VirtualDataSourceProps;

// ====== Formatting ======

export interface FormatCellResult {
  text?: string;
  color?: string;
  background?: string;
  textAlign?: 'left' | 'center' | 'right';
}

export type FormatCell = (
  value: string,
  row: number,
  col: number
) => Partial<FormatCellResult> | void;

// ====== Events ======

export interface CellClickInfo {
  row: number;
  col: number;
  dataCol: number;
  value: string;
}

export interface ContextMenuInfo {
  row: number | null; // null if background/context not tied to a cell
  col: number | null;
  dataCol: number | null;
  clientX: number;
  clientY: number;
}

// ====== Grid State ======

export interface GridStateSnapshot {
  selection: SelectionRange | null;
  selectionRect: AnchorRect | null; // canvas/container-relative pixels
  visibleRange: VisibleRange;
  scrollTop: number;
  scrollLeft: number;
  columnWidths: ColumnWidths;
  canvasRect: Rect;
  scrollbarState: ScrollbarState;
}

// ====== Grid Handle ======

export interface GridHandle {
  // Snapshot + subscription
  getState(): GridStateSnapshot;
  subscribe(listener: () => void): () => void;

  // Selection
  setSelection(sel: SelectionRange | null): void;
  clearSelection(): void;

  // Scrolling
  setScroll(top: number, left: number): void;
  scrollToCell(
    row: number,
    col: number,
    align?: 'nearest' | 'start' | 'center' | 'end'
  ): void;

  // Columns
  autosizeColumn(
    index: number,
    strategy?: 'sample' | 'header-only' | 'full'
  ): void;
  resizeColumn(index: number, width: number): void;

  // Anchors (canvas/container-relative rects)
  getSelectionRect(): AnchorRect | null;
  getCellRect(row: number, col: number): AnchorRect | null;
  getRowRect(row: number): AnchorRect | null;
  getColumnRect(col: number): AnchorRect | null;

  // Theme
  getTheme(): ResolvedThemeTokens;
  setTheme(partial: Partial<ResolvedThemeTokens>): void;
}

// ====== Hook ======

export interface UseGridOptions<TSlice = GridStateSnapshot> {
  selector?: (state: GridStateSnapshot) => TSlice;
  shallow?: boolean; // shallow compare for selected slice re-renders
}

export type UseGridReturn<TSlice = GridStateSnapshot> = TSlice & {
  // Bound methods for convenience
  setSelection: GridHandle['setSelection'];
  clearSelection: GridHandle['clearSelection'];
  setScroll: GridHandle['setScroll'];
  scrollToCell: GridHandle['scrollToCell'];
  autosizeColumn: GridHandle['autosizeColumn'];
  resizeColumn: GridHandle['resizeColumn'];
  getSelectionRect: GridHandle['getSelectionRect'];
  getCellRect: GridHandle['getCellRect'];
  getRowRect: GridHandle['getRowRect'];
  getColumnRect: GridHandle['getColumnRect'];
  getTheme: GridHandle['getTheme'];
  setTheme: GridHandle['setTheme'];
};

// ====== Props ======

export interface CanvasDataGridCommonProps {
  className?: string;
  style?: React.CSSProperties;

  // Canvas element props - allows passing any standard canvas attributes
  canvasProps?: React.CanvasHTMLAttributes<HTMLCanvasElement>;

  theme?: Partial<ThemeTokens>;
  overrides?: Partial<DrawOverrides>;
  // Optional hooks to override controller and layout behavior
  controllerOverrides?: ControllerOverrides;
  layoutOverrides?: LayoutOverrides;

  // Column sizing
  resizable?: boolean;
  minColumnWidth?: number; // default 50
  maxColumnWidth?: number; // default 500
  // When true (default), columns auto-fit to canvas width; when false, enforce
  // strict min/max widths and allow horizontal overflow (scroll).
  fitToCanvas?: boolean;
  defaultColumnWidths?: number[];
  columnWidths?: number[]; // controlled widths
  onColumnWidthChange?: (columnIndex: number, width: number) => void;
  frozenLeftColumns?: number; // default 0
  // When enabled, allow scrolling beyond provided data up to the configured caps
  infiniteCanvas?: boolean;
  infiniteCanvasRowCap?: number; // default 100
  infiniteCanvasColumnCap?: number; // default 50

  // Selection
  selection?: SelectionRange | null;           // controlled
  defaultSelection?: SelectionRange | null;    // uncontrolled
  onSelectionChange?: (sel: SelectionRange | null) => void;
  selectionTransitionDuration?: number;        // default ~100-150ms

  // Formatting
  formatCell?: FormatCell;

  // A11y / keyboard / events
  ariaLabel?: string;
  onCellClick?: (info: CellClickInfo) => void;
  onRowClick?: (info: { row: number }) => void;
  onColumnClick?: (info: { col: number; dataCol: number }) => void;
  onContextMenu?: (info: ContextMenuInfo, ev: MouseEvent | React.MouseEvent) => void;
  onKeyDown?: (ev: KeyboardEvent | React.KeyboardEvent, api: GridHandle, info?: { handled: boolean }) => void;

  rowHeight?: number;
  headerHeight?: number;

  // Performance tuning
  maxTextCacheSize?: number; // default 10_000

  // Column drag & order
  draggableColumns?: boolean;
  columnOrder?: number[];
  onColumnOrderChange?: (order: number[]) => void;
}

export type CanvasDataGridProps = CanvasDataGridCommonProps & DataSourceProps;

// ====== Debug & Profiling ======

// Profiling types removed

// ====== Controller Overrides ======

export interface ControllerOverrides {
  // Intercept or handle events dispatched through the controller. Return true to stop default handling.
  onEvent?: (ev: { type: string; payload: any }, state: GridStateSnapshot) => boolean | void;
  // Replace selection rect computation. Return null to clear selection rect.
  computeSelectionRect?: (
    selection: SelectionRange,
    args: {
      rowHeight: number;
      headerHeight: number;
      rect: Rect;
      columnWidths: ColumnWidths;
      scroll: { top: number; left: number };
      theme: ResolvedThemeTokens;
    }
  ) => AnchorRect | null;
}
