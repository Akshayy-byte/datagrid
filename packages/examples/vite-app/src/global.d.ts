declare module '@parlanceis/grid' {
  import * as React from 'react'
  export const CanvasDataGrid: React.ComponentType<any>
  export function useGrid<T = any>(ref: React.RefObject<any>, options?: any): any
  export type GridHandle = any
  export const SELECTION_OVERRIDES: any
  export const CELL_OVERRIDES: any
  export function useGridDebug(options?: any): any
}

