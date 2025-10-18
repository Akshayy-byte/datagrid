import type { DataSourceProps } from '../types';

export class DataAccess {
  private dataSource: DataSourceProps;
  private dataManager?: any;
  private getRowFast: ((row: number) => string[] | null) | null = null;

  constructor(dataSource: DataSourceProps, dataManager?: any) {
    this.dataSource = dataSource;
    this.dataManager = dataManager;
    this.bindRowAccessor();
  }

  public update(dataSource: DataSourceProps, dataManager?: any): void {
    this.dataSource = dataSource;
    this.dataManager = dataManager;
    this.bindRowAccessor();
  }

  public getRow(row: number): string[] | null {
    return this.getRowFast ? this.getRowFast(row) : null;
  }

  public getCell(row: number, col: number): string {
    if (this.dataManager && typeof this.dataManager.getCell === 'function') {
      return this.dataManager.getCell(row, col) || '';
    }
    if ((this.dataSource as any)?.mode === 'virtual') {
      return '';
    }
    const rows = (this.dataSource as any)?.rows as string[][] | undefined;
    if (Array.isArray(rows) && row >= 0 && row < rows.length) {
      const rowArr = rows[row];
      if (Array.isArray(rowArr) && col >= 0 && col < rowArr.length) {
        return rowArr[col] ?? '';
      }
    }
    return '';
  }

  public getHeaderText(col: number): string {
    const headers = (this.dataSource as any)?.headers as string[] | undefined;
    if (Array.isArray(headers) && col >= 0 && col < headers.length) {
      return headers[col] ?? `Column ${col + 1}`;
    }
    return `Column ${col + 1}`;
  }

  private bindRowAccessor(): void {
    if (this.dataManager && typeof this.dataManager.getRow === 'function') {
      this.getRowFast = (row: number) => this.dataManager.getRow(row) ?? null;
      return;
    }
    if ((this.dataSource as any) && ((this.dataSource as any).mode === 'full' || (this.dataSource as any).rows)) {
      const rows = (this.dataSource as any).rows as string[][] | undefined;
      if (Array.isArray(rows)) {
        this.getRowFast = (row: number): string[] | null => (row >= 0 && row < rows.length ? rows[row]! : null);
        return;
      }
    }
    this.getRowFast = null;
  }
}


