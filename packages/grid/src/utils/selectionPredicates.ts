import type {
  SelectionRange,
  CellSelectionRange,
  RowSelectionRange,
  ColumnSelectionRange,
} from '../types';

export function isCellSelection(selection: SelectionRange): selection is CellSelectionRange {
  return selection.type === 'cell';
}

export function isRowSelection(selection: SelectionRange): selection is RowSelectionRange {
  return selection.type === 'row';
}

export function isColumnSelection(selection: SelectionRange): selection is ColumnSelectionRange {
  return selection.type === 'column';
}

export function selectionsEqual(a: SelectionRange | null, b: SelectionRange | null): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  if (a.type !== b.type) return false;

  if (isCellSelection(a) && isCellSelection(b)) {
    return (
      a.start.row === b.start.row &&
      a.start.col === b.start.col &&
      a.end.row === b.end.row &&
      a.end.col === b.end.col
    );
  }

  if (isRowSelection(a) && isRowSelection(b)) {
    return a.startRow === b.startRow && a.endRow === b.endRow;
  }

  if (isColumnSelection(a) && isColumnSelection(b)) {
    return a.startCol === b.startCol && a.endCol === b.endCol;
  }

  return false;
}
