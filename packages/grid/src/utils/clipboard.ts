import type { SelectionRange } from '../types';
import type { DataManager } from '../data/DataManager';

/**
 * Escapes a cell value for CSV format
 */
function escapeCsvCell(value: string): string {
  // If cell contains comma, newline, or quote, wrap in quotes and escape quotes
  if (value.includes(',') || value.includes('\n') || value.includes('"')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

/**
 * Escapes a cell value for HTML format
 */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Extracts cell data from a selection range
 */
export function extractSelectionData(
  selection: SelectionRange,
  dataManager: DataManager
): string[][] {
  const data: string[][] = [];

  if (selection.type === 'cell') {
    const minRow = Math.min(selection.start.row, selection.end.row);
    const maxRow = Math.max(selection.start.row, selection.end.row);
    const minCol = Math.min(selection.start.col, selection.end.col);
    const maxCol = Math.max(selection.start.col, selection.end.col);

    for (let row = minRow; row <= maxRow; row++) {
      const rowData: string[] = [];
      for (let col = minCol; col <= maxCol; col++) {
        rowData.push(dataManager.getCell(row, col));
      }
      data.push(rowData);
    }
  } else if (selection.type === 'row') {
    const minRow = Math.min(selection.startRow, selection.endRow);
    const maxRow = Math.max(selection.startRow, selection.endRow);
    const columnCount = dataManager.getColumnCount();

    for (let row = minRow; row <= maxRow; row++) {
      const rowData: string[] = [];
      for (let col = 0; col < columnCount; col++) {
        rowData.push(dataManager.getCell(row, col));
      }
      data.push(rowData);
    }
  } else if (selection.type === 'column') {
    const minCol = Math.min(selection.startCol, selection.endCol);
    const maxCol = Math.max(selection.startCol, selection.endCol);
    const rowCount = dataManager.getRowCount();

    for (let row = 0; row < rowCount; row++) {
      const rowData: string[] = [];
      for (let col = minCol; col <= maxCol; col++) {
        rowData.push(dataManager.getCell(row, col));
      }
      data.push(rowData);
    }
  }

  return data;
}

/**
 * Converts 2D array to CSV format
 */
export function dataToCSV(data: string[][]): string {
  return data
    .map(row => row.map(escapeCsvCell).join(','))
    .join('\n');
}

/**
 * Converts 2D array to HTML table
 */
export function dataToHTML(data: string[][]): string {
  const rows = data
    .map(row => {
      const cells = row.map(cell => `<td>${escapeHtml(cell)}</td>`).join('');
      return `<tr>${cells}</tr>`;
    })
    .join('');

  return `<table>${rows}</table>`;
}

/**
 * Copies selection to clipboard in multiple formats
 */
export async function copySelectionToClipboard(
  selection: SelectionRange | null,
  dataManager: DataManager
): Promise<boolean> {
  if (!selection) return false;

  try {
    const data = extractSelectionData(selection, dataManager);
    if (data.length === 0) return false;

    const csvText = dataToCSV(data);
    const htmlText = dataToHTML(data);

    // Use modern clipboard API with multiple formats
    await navigator.clipboard.write([
      new ClipboardItem({
        'text/html': new Blob([htmlText], { type: 'text/html' }),
        'text/plain': new Blob([csvText], { type: 'text/plain' }),
      }),
    ]);

    return true;
  } catch (error) {
    // Fallback to plain text if ClipboardItem not supported
    try {
      const data = extractSelectionData(selection, dataManager);
      const csvText = dataToCSV(data);
      await navigator.clipboard.writeText(csvText);
      return true;
    } catch {
      return false;
    }
  }
}
