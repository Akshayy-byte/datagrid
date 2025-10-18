import type { DataSourceProps, FullDataSourceProps, VirtualDataSourceProps, VisibleRange } from '../types';
import { VirtualDataManager, type VirtualScrollMetrics } from './VirtualDataManager';

export interface DataManagerOptions {
  cacheSize?: number;
  maxCacheAge?: number;
}

export class DataManager {
  private dataSource: DataSourceProps;
  private virtualManager: VirtualDataManager | null = null;
  private listeners = new Set<() => void>();

  constructor(dataSource: DataSourceProps, options: DataManagerOptions = {}) {
    this.dataSource = dataSource;

    if (dataSource.mode === 'virtual') {
      this.virtualManager = new VirtualDataManager(dataSource, options);
      this.virtualManager.subscribe(() => this.notifyListeners());
    }
  }

  public updateDataSource(dataSource: DataSourceProps): void {
    this.dataSource = dataSource;

    if (dataSource.mode === 'virtual') {
      if (this.virtualManager) {
        this.virtualManager.updateDataSource(dataSource);
      } else {
        this.virtualManager = new VirtualDataManager(dataSource);
        this.virtualManager.subscribe(() => this.notifyListeners());
      }
    } else {
      this.virtualManager = null;
    }

    this.notifyListeners();
  }

  public subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notifyListeners(): void {
    this.listeners.forEach(listener => listener());
  }

  public isVirtual(): boolean {
    return this.dataSource.mode === 'virtual';
  }

  public getRowCount(): number {
    if (this.dataSource.mode === 'virtual') {
      return this.dataSource.rowCount;
    } else {
      return this.dataSource.rows.length;
    }
  }

  public getColumnCount(): number {
    if (this.dataSource.mode === 'virtual') {
      return this.dataSource.columnCount;
    } else {
      if (this.dataSource.rows.length === 0) return 0;
      return Math.max(...this.dataSource.rows.map(row => row.length));
    }
  }

  public getHeaders(): string[] {
    const headers = this.dataSource.headers || [];
    const columnCount = this.getColumnCount();

    // Fill in default headers if needed
    const result = [...headers];
    for (let i = headers.length; i < columnCount; i++) {
      result.push(`Column ${i + 1}`);
    }

    return result.slice(0, columnCount);
  }

  public getCell(row: number, col: number): string {
    if (this.dataSource.mode === 'virtual') {
      if (!this.virtualManager) return '';
      return this.virtualManager.getCell(row, col) || '';
    } else {
      // Full data mode
      if (row < 0 || row >= this.dataSource.rows.length) return '';
      if (col < 0 || col >= this.dataSource.rows[row].length) return '';
      return this.dataSource.rows[row][col] || '';
    }
  }

  // Fast row accessor for rendering
  public getRow(row: number): string[] | null {
    if (this.dataSource.mode === 'virtual') {
      if (!this.virtualManager) return null;
      return this.virtualManager.getRow(row);
    } else {
      if (row < 0 || row >= this.dataSource.rows.length) return null;
      return this.dataSource.rows[row];
    }
  }

  // Get multiple cells for a range (optimized for rendering)
  public getCells(visibleRange: VisibleRange): Map<string, string> {
    const cellMap = new Map<string, string>();

    for (let row = visibleRange.startRow; row < visibleRange.endRow; row++) {
      for (let col = visibleRange.startCol; col < visibleRange.endCol; col++) {
        const key = `${row},${col}`;
        const value = this.getCell(row, col);
        cellMap.set(key, value);
      }
    }

    return cellMap;
  }

  // Get all values for a column (useful for auto-sizing)
  public getColumnValues(columnIndex: number, strategy: 'all' | 'sample' | 'visible' = 'sample', visibleRange?: VisibleRange): string[] {
    const rowCount = this.getRowCount();
    const values: string[] = [];

    if (this.dataSource.mode === 'full') {
      // Full data mode - can access all data directly
      const rows = strategy === 'visible' && visibleRange
        ? this.dataSource.rows.slice(visibleRange.startRow, visibleRange.endRow)
        : strategy === 'sample' && rowCount > 1000
        ? [
            ...this.dataSource.rows.slice(0, 100),
            ...this.dataSource.rows.slice(-100)
          ]
        : this.dataSource.rows;

      return rows
        .map(row => row[columnIndex] || '')
        .filter(value => value.length > 0);
    } else {
      // Virtual mode - can only get currently loaded data
      if (strategy === 'visible' && visibleRange) {
        for (let row = visibleRange.startRow; row < visibleRange.endRow; row++) {
          const value = this.getCell(row, columnIndex);
          if (value) values.push(value);
        }
      } else {
        // For virtual mode, we can only work with loaded data.

        // Sample from what's available
        const sampleSize = Math.min(100, rowCount);
        const step = Math.max(1, Math.floor(rowCount / sampleSize));

        for (let i = 0; i < rowCount; i += step) {
          const value = this.getCell(i, columnIndex);
          if (value) values.push(value);
          if (values.length >= sampleSize) break;
        }
      }

      return values;
    }
  }

  // Virtual scrolling specific methods
  public async ensureDataLoaded(visibleRange: VisibleRange, metrics: VirtualScrollMetrics): Promise<void> {
    if (this.dataSource.mode === 'virtual' && this.virtualManager) {
      await this.virtualManager.ensureDataLoaded(visibleRange);
    }
  }

  public calculateVisibleRange(metrics: VirtualScrollMetrics): VisibleRange {
    if (this.dataSource.mode === 'virtual' && this.virtualManager) {
      return this.virtualManager.calculateVisibleRange(metrics);
    } else {
      // Full data mode - calculate visible range based on scroll position
      const { rowHeight, headerHeight, scrollTop, visibleHeight, overscan } = metrics;
      const rowCount = this.getRowCount();
      const columnCount = this.getColumnCount();

      const viewportTop = Math.max(0, scrollTop - headerHeight);
      const viewportHeight = visibleHeight - headerHeight;

      const startRowFloat = viewportTop / rowHeight;
      const endRowFloat = (viewportTop + viewportHeight) / rowHeight;

      const startRow = Math.max(0, Math.floor(startRowFloat) - overscan);
      const endRow = Math.min(rowCount, Math.ceil(endRowFloat) + overscan);

      return {
        startRow,
        endRow,
        startCol: 0,
        endCol: columnCount,
      };
    }
  }

  public isLoading(visibleRange: VisibleRange): boolean {
    if (this.dataSource.mode === 'virtual' && this.virtualManager) {
      return this.virtualManager.isLoading(visibleRange);
    }
    return false; // Full data is always loaded
  }

  public hasError(visibleRange: VisibleRange): Error | null {
    if (this.dataSource.mode === 'virtual' && this.virtualManager) {
      return this.virtualManager.hasError(visibleRange);
    }
    return null; // Full data doesn't have loading errors
  }

  public getStats() {
    const baseStats = {
      mode: this.dataSource.mode || 'full',
      rowCount: this.getRowCount(),
      columnCount: this.getColumnCount(),
    };

    if (this.virtualManager) {
      return {
        ...baseStats,
        ...this.virtualManager.getStats(),
      };
    }

    return baseStats;
  }

  public clearCache(): void {
    if (this.virtualManager) {
      this.virtualManager.clearCache();
    }
  }
}
