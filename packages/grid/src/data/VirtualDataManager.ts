import type { VirtualDataSourceProps, VisibleRange } from '../types';

export interface DataPage {
  offset: number;
  limit: number;
  data: string[][];
  timestamp: number;
  isLoading: boolean;
  error?: Error;
}

export interface VirtualScrollMetrics {
  rowHeight: number;
  headerHeight: number;
  totalContentHeight: number;
  visibleHeight: number;
  scrollTop: number;
  overscan: number; // Number of extra rows to render outside viewport
}

export class VirtualDataManager {
  private dataSource: VirtualDataSourceProps;
  private pages = new Map<number, DataPage>();
  private loadingPages = new Set<number>();
  private listeners = new Set<() => void>();
  private prefetchEnabled: boolean;
  private cacheSize: number;
  private maxCacheAge: number;

  constructor(
    dataSource: VirtualDataSourceProps,
    options: {
      cacheSize?: number;
      maxCacheAge?: number; // in milliseconds
    } = {}
  ) {
    this.dataSource = dataSource;
    this.prefetchEnabled = dataSource.prefetch !== false;
    this.cacheSize = options.cacheSize || 50; // pages
    this.maxCacheAge = options.maxCacheAge || 5 * 60 * 1000; // 5 minutes
  }

  public updateDataSource(dataSource: VirtualDataSourceProps): void {
    this.dataSource = dataSource;
    this.prefetchEnabled = dataSource.prefetch !== false;
    this.clearCache();
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

  public calculateVisibleRange(metrics: VirtualScrollMetrics): VisibleRange {
    const { rowHeight, headerHeight, scrollTop, overscan } = metrics;
    const { rowCount, columnCount } = this.dataSource;

    // Calculate visible rows
    const viewportTop = Math.max(0, scrollTop - headerHeight);
    const viewportHeight = metrics.visibleHeight - headerHeight;

    const startRowFloat = viewportTop / rowHeight;
    const endRowFloat = (viewportTop + viewportHeight) / rowHeight;

    // Add overscan
    const startRow = Math.max(0, Math.floor(startRowFloat) - overscan);
    const endRow = Math.min(rowCount, Math.ceil(endRowFloat) + overscan);

    return {
      startRow,
      endRow,
      startCol: 0, // For now, assume all columns are visible
      endCol: columnCount,
    };
  }

  public async ensureDataLoaded(visibleRange: VisibleRange): Promise<void> {
    const { pageSize = 500 } = this.dataSource;
    const startPage = Math.floor(visibleRange.startRow / pageSize);
    const endPage = Math.floor((visibleRange.endRow - 1) / pageSize);

    const loadPromises: Promise<void>[] = [];

    // Load required pages
    for (let pageIndex = startPage; pageIndex <= endPage; pageIndex++) {
      if (!this.hasPage(pageIndex) && !this.loadingPages.has(pageIndex)) {
        loadPromises.push(this.loadPage(pageIndex));
      }
    }

    // Prefetch adjacent pages if enabled
    if (this.prefetchEnabled) {
      const prefetchPages = [startPage - 1, endPage + 1];
      for (const pageIndex of prefetchPages) {
        if (pageIndex >= 0 &&
            pageIndex < Math.ceil(this.dataSource.rowCount / pageSize) &&
            !this.hasPage(pageIndex) &&
            !this.loadingPages.has(pageIndex)) {
          // Don't await prefetch - load in background
          this.loadPage(pageIndex).catch(() => {
            // Ignore prefetch errors
          });
        }
      }
    }

    // Wait for required pages to load
    if (loadPromises.length > 0) {
      await Promise.allSettled(loadPromises);
      this.notifyListeners();
    }
  }

  private async loadPage(pageIndex: number): Promise<void> {
    const { pageSize = 500, fetchRows } = this.dataSource;
    const offset = pageIndex * pageSize;
    const limit = Math.min(pageSize, this.dataSource.rowCount - offset);

    if (limit <= 0) return;

    this.loadingPages.add(pageIndex);

    const page: DataPage = {
      offset,
      limit,
      data: [],
      timestamp: Date.now(),
      isLoading: true,
    };

    this.pages.set(pageIndex, page);

    try {
      const data = await fetchRows(offset, limit);

      page.data = data;
      page.isLoading = false;
      page.timestamp = Date.now();

      this.loadingPages.delete(pageIndex);

      // Clean up cache if it's getting too large
      this.cleanupCache();

    } catch (error) {
      page.error = error instanceof Error ? error : new Error(String(error));
      page.isLoading = false;
      this.loadingPages.delete(pageIndex);
    }
  }

  private hasPage(pageIndex: number): boolean {
    const page = this.pages.get(pageIndex);
    return page !== undefined && !page.isLoading && !page.error;
  }

  public getCell(row: number, col: number): string | null {
    const { pageSize = 500 } = this.dataSource;
    const pageIndex = Math.floor(row / pageSize);
    const rowInPage = row % pageSize;

    const page = this.pages.get(pageIndex);

    if (!page || page.isLoading || page.error) {
      return null; // Data not available yet
    }

    if (rowInPage >= page.data.length || col >= page.data[rowInPage]?.length) {
      return null;
    }

    return page.data[rowInPage][col] || '';
  }

  // Fast row accessor used by renderer to avoid per-cell page math
  public getRow(row: number): string[] | null {
    const { pageSize = 500 } = this.dataSource;
    const pageIndex = Math.floor(row / pageSize);
    const rowInPage = row % pageSize;

    const page = this.pages.get(pageIndex);
    if (!page || page.isLoading || page.error) return null;
    if (rowInPage >= page.data.length) return null;
    return page.data[rowInPage] || null;
  }

  public isLoading(visibleRange: VisibleRange): boolean {
    const { pageSize = 500 } = this.dataSource;
    const startPage = Math.floor(visibleRange.startRow / pageSize);
    const endPage = Math.floor((visibleRange.endRow - 1) / pageSize);

    for (let pageIndex = startPage; pageIndex <= endPage; pageIndex++) {
      if (this.loadingPages.has(pageIndex)) {
        return true;
      }

      const page = this.pages.get(pageIndex);
      if (!page || page.isLoading) {
        return true;
      }
    }

    return false;
  }

  public hasError(visibleRange: VisibleRange): Error | null {
    const { pageSize = 500 } = this.dataSource;
    const startPage = Math.floor(visibleRange.startRow / pageSize);
    const endPage = Math.floor((visibleRange.endRow - 1) / pageSize);

    for (let pageIndex = startPage; pageIndex <= endPage; pageIndex++) {
      const page = this.pages.get(pageIndex);
      if (page?.error) {
        return page.error;
      }
    }

    return null;
  }

  private cleanupCache(): void {
    const pageEntries = Array.from(this.pages.entries());

    // Sort by timestamp (oldest first)
    pageEntries.sort(([, a], [, b]) => a.timestamp - b.timestamp);

    // Remove oldest pages if cache is too large
    while (pageEntries.length > this.cacheSize) {
      const [pageIndex] = pageEntries.shift()!;
      this.pages.delete(pageIndex);
    }

    // Remove pages older than maxCacheAge
    const now = Date.now();
    for (const [pageIndex, page] of this.pages) {
      if (now - page.timestamp > this.maxCacheAge) {
        this.pages.delete(pageIndex);
      }
    }
  }

  public clearCache(): void {
    this.pages.clear();
    this.loadingPages.clear();
  }

  public getStats() {
    return {
      totalPages: Math.ceil(this.dataSource.rowCount / (this.dataSource.pageSize || 500)),
      loadedPages: this.pages.size,
      loadingPages: this.loadingPages.size,
      cacheSize: this.cacheSize,
      prefetchEnabled: this.prefetchEnabled,
    };
  }
}

// Utility function to calculate total content height for virtual scrolling
export function calculateVirtualScrollHeight(
  rowCount: number,
  rowHeight: number,
  headerHeight: number
): number {
  return headerHeight + (rowCount * rowHeight);
}

// Utility to calculate scroll metrics
export function calculateScrollMetrics(
  canvasHeight: number,
  contentHeight: number,
  scrollTop: number,
  rowHeight: number,
  headerHeight: number,
  overscan: number = 5
): VirtualScrollMetrics {
  return {
    rowHeight,
    headerHeight,
    totalContentHeight: contentHeight,
    visibleHeight: canvasHeight,
    scrollTop: Math.max(0, Math.min(scrollTop, contentHeight - canvasHeight)),
    overscan,
  };
}
