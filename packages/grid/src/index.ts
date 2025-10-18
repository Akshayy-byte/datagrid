// Main exports
export { CanvasDataGrid } from './CanvasDataGrid';
export { Grid, type GridProps } from './Grid';
export { default } from './Grid';

// Hook exports
export { useGrid } from './hooks/useGrid';
export type { UseGridOptions, UseGridReturn } from './types';

// Type exports
export type {
  // Core types
  GridHandle,
  GridStateSnapshot,
  SelectionRange,
  CellPosition,
  AnchorRect,
  VisibleRange,
  ThemeTokens,

  // Selection types
  SelectionType,
  CellSelectionRange,
  RowSelectionRange,
  ColumnSelectionRange,

  // Data source types
  DataSourceProps,
  FullDataSourceProps,
  VirtualDataSourceProps,

  // Event types
  CellClickInfo,
  ContextMenuInfo,

  // Formatting types
  FormatCell,
  FormatCellResult,

  // Draw override types
  DrawOverrides,
  DrawHelpers,
  DrawAPI,

  // Component props
  CanvasDataGridProps,
  CanvasDataGridCommonProps,
} from './types';

// Theme exports
export {
  DEFAULT_THEME_TOKENS,
  LIGHT_THEME,
  DARK_THEME,
  ThemeResolver,
  setCSSVariables,
} from './themes/themeSystem';

// Utility exports for advanced usage
export { SELECTION_OVERRIDES, CELL_OVERRIDES } from './rendering/DrawOverrideManager';
