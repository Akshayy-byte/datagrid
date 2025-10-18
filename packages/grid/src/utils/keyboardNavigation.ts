import type {
  SelectionRange,
  CellPosition,
  GridHandle,
} from '../types';
import { expandSelectionToRange } from './selectionUtils';

export interface KeyboardNavigationOptions {
  enableArrowKeys: boolean;
  enablePageKeys: boolean;
  enableHomeEndKeys: boolean;
  enableTabKey: boolean;
  enableEnterKey: boolean;
  enableEscapeKey: boolean;
  enableSelectionKeys: boolean; // Shift+arrows, Ctrl+A, etc.
  rowCount: number;
  columnCount: number;
  pageSize?: number; // For Page Up/Down
}

export interface KeyboardNavigationState {
  focusedCell: CellPosition | null;
  selectionAnchor: CellPosition | null; // For range selections with Shift
}

export class KeyboardNavigationManager {
  private options: KeyboardNavigationOptions;
  private state: KeyboardNavigationState;
  private gridHandle: GridHandle | null = null;

  constructor(options: KeyboardNavigationOptions) {
    this.options = options;
    this.state = {
      focusedCell: null,
      selectionAnchor: null,
    };
  }

  public updateOptions(options: Partial<KeyboardNavigationOptions>): void {
    this.options = { ...this.options, ...options };
  }

  public setGridHandle(handle: GridHandle): void {
    this.gridHandle = handle;
  }

  public handleKeyDown(
    event: KeyboardEvent | React.KeyboardEvent,
    currentSelection: SelectionRange | null
  ): boolean {
    if (!this.gridHandle) return false;

    const { key, shiftKey, ctrlKey, metaKey } = event;
    const modifierKey = ctrlKey || metaKey;

    // Initialize focused cell if not set
    if (!this.state.focusedCell) {
      this.state.focusedCell = this.getInitialFocusCell(currentSelection);
    }

    // Handle different key types
    switch (key) {
      // Arrow keys
      case 'ArrowUp':
        if (this.options.enableArrowKeys) {
          this.handleArrowKey('up', shiftKey, modifierKey);
          return true;
        }
        break;

      case 'ArrowDown':
        if (this.options.enableArrowKeys) {
          this.handleArrowKey('down', shiftKey, modifierKey);
          return true;
        }
        break;

      case 'ArrowLeft':
        if (this.options.enableArrowKeys) {
          this.handleArrowKey('left', shiftKey, modifierKey);
          return true;
        }
        break;

      case 'ArrowRight':
        if (this.options.enableArrowKeys) {
          this.handleArrowKey('right', shiftKey, modifierKey);
          return true;
        }
        break;

      // Page navigation
      case 'PageUp':
        if (this.options.enablePageKeys) {
          this.handlePageKey('up', shiftKey);
          return true;
        }
        break;

      case 'PageDown':
        if (this.options.enablePageKeys) {
          this.handlePageKey('down', shiftKey);
          return true;
        }
        break;

      // Home/End keys
      case 'Home':
        if (this.options.enableHomeEndKeys) {
          this.handleHomeEnd('home', shiftKey, modifierKey);
          return true;
        }
        break;

      case 'End':
        if (this.options.enableHomeEndKeys) {
          this.handleHomeEnd('end', shiftKey, modifierKey);
          return true;
        }
        break;

      // Tab navigation
      case 'Tab':
        if (this.options.enableTabKey) {
          this.handleTab(shiftKey);
          return true;
        }
        break;

      // Enter key
      case 'Enter':
        if (this.options.enableEnterKey) {
          this.handleEnter(shiftKey);
          return true;
        }
        break;

      // Escape key
      case 'Escape':
        if (this.options.enableEscapeKey) {
          this.handleEscape();
          return true;
        }
        break;

      // Select all
      case 'a':
      case 'A':
        if (this.options.enableSelectionKeys && modifierKey) {
          this.handleSelectAll();
          return true;
        }
        break;

      default:
        return false;
    }

    return false;
  }

  private getInitialFocusCell(selection: SelectionRange | null): CellPosition {
    if (selection?.type === 'cell') {
      return selection.start;
    } else if (selection?.type === 'row') {
      return { row: selection.startRow, col: 0 };
    } else if (selection?.type === 'column') {
      return { row: 0, col: selection.startCol };
    }
    return { row: 0, col: 0 };
  }

  private handleArrowKey(
    direction: 'up' | 'down' | 'left' | 'right',
    shiftKey: boolean,
    modifierKey: boolean
  ): void {
    if (!this.state.focusedCell || !this.gridHandle) return;

    let newCell = { ...this.state.focusedCell };

    // Calculate movement with bounds checking
    switch (direction) {
      case 'up':
        if (modifierKey) {
          newCell.row = 0; // Ctrl+Up: go to first row
        } else {
          newCell.row = Math.max(0, newCell.row - 1);
        }
        break;

      case 'down':
        if (modifierKey) {
          newCell.row = this.options.rowCount - 1; // Ctrl+Down: go to last row
        } else {
          newCell.row = Math.min(this.options.rowCount - 1, newCell.row + 1);
        }
        break;

      case 'left':
        if (modifierKey) {
          newCell.col = 0; // Ctrl+Left: go to first column
        } else {
          newCell.col = Math.max(0, newCell.col - 1);
        }
        break;

      case 'right':
        if (modifierKey) {
          newCell.col = this.options.columnCount - 1; // Ctrl+Right: go to last column
        } else {
          newCell.col = Math.min(this.options.columnCount - 1, newCell.col + 1);
        }
        break;
    }

    // Update selection based on Shift key
    if (shiftKey && this.options.enableSelectionKeys) {
      // Extend selection
      if (!this.state.selectionAnchor) {
        this.state.selectionAnchor = this.state.focusedCell;
      }

      const selection = expandSelectionToRange(
        this.state.selectionAnchor,
        newCell,
        'cell'
      );

      this.gridHandle.setSelection(selection);
    } else {
      // Single cell selection
      this.state.selectionAnchor = null;
      this.gridHandle.setSelection({
        type: 'cell',
        start: newCell,
        end: newCell,
      });
    }

    this.state.focusedCell = newCell;

    // Scroll to ensure cell is visible
    this.gridHandle.scrollToCell(newCell.row, newCell.col, 'nearest');
  }

  private handlePageKey(direction: 'up' | 'down', shiftKey: boolean): void {
    if (!this.state.focusedCell || !this.gridHandle) return;

    const pageSize = this.options.pageSize || 10;
    let newCell = { ...this.state.focusedCell };

    if (direction === 'up') {
      newCell.row = Math.max(0, newCell.row - pageSize);
    } else {
      newCell.row = Math.min(this.options.rowCount - 1, newCell.row + pageSize);
    }

    // Handle selection extension with Shift
    if (shiftKey && this.options.enableSelectionKeys) {
      if (!this.state.selectionAnchor) {
        this.state.selectionAnchor = this.state.focusedCell;
      }
      
      const selection = expandSelectionToRange(
        this.state.selectionAnchor,
        newCell,
        'cell'
      );
      
      this.gridHandle.setSelection(selection);
    } else {
      this.state.selectionAnchor = null;
      this.gridHandle.setSelection({
        type: 'cell',
        start: newCell,
        end: newCell,
      });
    }

    this.state.focusedCell = newCell;
    this.gridHandle.scrollToCell(newCell.row, newCell.col, 'center');
  }

  private handleHomeEnd(
    key: 'home' | 'end',
    shiftKey: boolean,
    modifierKey: boolean
  ): void {
    if (!this.state.focusedCell || !this.gridHandle) return;

    let newCell = { ...this.state.focusedCell };

    if (modifierKey) {
      // Ctrl+Home/End: go to document start/end
      if (key === 'home') {
        newCell = { row: 0, col: 0 };
      } else {
        newCell = { row: this.options.rowCount - 1, col: this.options.columnCount - 1 };
      }
    } else {
      // Home/End: go to row start/end
      if (key === 'home') {
        newCell.col = 0;
      } else {
        newCell.col = this.options.columnCount - 1;
      }
    }

    // Handle selection extension with Shift
    if (shiftKey && this.options.enableSelectionKeys) {
      if (!this.state.selectionAnchor) {
        this.state.selectionAnchor = this.state.focusedCell;
      }
      
      const selection = expandSelectionToRange(
        this.state.selectionAnchor,
        newCell,
        'cell'
      );
      
      this.gridHandle.setSelection(selection);
    } else {
      this.state.selectionAnchor = null;
      this.gridHandle.setSelection({
        type: 'cell',
        start: newCell,
        end: newCell,
      });
    }

    this.state.focusedCell = newCell;
    
    const align = modifierKey ? 'center' : 'nearest';
    this.gridHandle.scrollToCell(newCell.row, newCell.col, align);
  }

  private handleTab(shiftKey: boolean): void {
    if (!this.state.focusedCell || !this.gridHandle) return;

    let newCell = { ...this.state.focusedCell };

    if (shiftKey) {
      // Shift+Tab: move to previous cell
      newCell.col--;
      if (newCell.col < 0 && newCell.row > 0) {
        newCell.col = this.options.columnCount - 1;
        newCell.row--;
      }
      newCell.col = Math.max(0, newCell.col);
      newCell.row = Math.max(0, newCell.row);
    } else {
      // Tab: move to next cell
      newCell.col++;
      if (newCell.col >= this.options.columnCount && newCell.row < this.options.rowCount - 1) {
        newCell.col = 0;
        newCell.row++;
      }
      newCell.col = Math.min(this.options.columnCount - 1, newCell.col);
      newCell.row = Math.min(this.options.rowCount - 1, newCell.row);
    }

    // Tab always moves to single cell
    this.state.selectionAnchor = null;
    this.gridHandle.setSelection({
      type: 'cell',
      start: newCell,
      end: newCell,
    });

    this.state.focusedCell = newCell;
    this.gridHandle.scrollToCell(newCell.row, newCell.col, 'nearest');
  }

  private handleEnter(shiftKey: boolean): void {
    if (!this.state.focusedCell || !this.gridHandle) return;

    let newCell = { ...this.state.focusedCell };

    if (shiftKey) {
      // Shift+Enter: move up
      newCell.row = Math.max(0, newCell.row - 1);
    } else {
      // Enter: move down
      newCell.row = Math.min(this.options.rowCount - 1, newCell.row + 1);
    }

    // Enter always moves to single cell
    this.state.selectionAnchor = null;
    this.gridHandle.setSelection({
      type: 'cell',
      start: newCell,
      end: newCell,
    });

    this.state.focusedCell = newCell;
    this.gridHandle.scrollToCell(newCell.row, newCell.col, 'nearest');
  }

  private handleEscape(): void {
    if (!this.gridHandle) return;

    // Clear selection and reset anchor
    this.state.selectionAnchor = null;
    this.gridHandle.clearSelection();
  }

  private handleSelectAll(): void {
    if (!this.gridHandle) return;

    // Select all cells
    this.gridHandle.setSelection({
      type: 'cell',
      start: { row: 0, col: 0 },
      end: { row: this.options.rowCount - 1, col: this.options.columnCount - 1 },
    });

    // Update state
    this.state.focusedCell = { row: 0, col: 0 };
    this.state.selectionAnchor = { row: 0, col: 0 };
  }

  // Public methods for external control
  public focusCell(row: number, col: number, scrollIntoView: boolean = true): void {
    if (!this.gridHandle) return;

    const clampedRow = Math.max(0, Math.min(this.options.rowCount - 1, row));
    const clampedCol = Math.max(0, Math.min(this.options.columnCount - 1, col));

    this.state.focusedCell = { row: clampedRow, col: clampedCol };
    this.state.selectionAnchor = null;

    this.gridHandle.setSelection({
      type: 'cell',
      start: this.state.focusedCell,
      end: this.state.focusedCell,
    });

    if (scrollIntoView) {
      this.gridHandle.scrollToCell(clampedRow, clampedCol, 'nearest');
    }
  }

  public getFocusedCell(): CellPosition | null {
    return this.state.focusedCell;
  }

  public clearFocus(): void {
    this.state.focusedCell = null;
    this.state.selectionAnchor = null;
  }
}

// Accessibility helpers
export function getAriaLabel(
  row: number,
  col: number,
  value: string,
  columnHeaders?: string[]
): string {
  const columnName = columnHeaders?.[col] || `Column ${col + 1}`;
  const rowNumber = row + 1;
  
  if (value) {
    return `${columnName}, Row ${rowNumber}: ${value}`;
  } else {
    return `${columnName}, Row ${rowNumber}: empty`;
  }
}

export function getGridAriaLabel(
  rowCount: number,
  columnCount: number,
  description?: string
): string {
  const baseLabel = `Data grid with ${rowCount} rows and ${columnCount} columns`;
  return description ? `${description}. ${baseLabel}` : baseLabel;
}

// Focus management utilities
export function createFocusableElement(
  container: HTMLElement,
  onKeyDown: (event: KeyboardEvent) => void
): HTMLElement {
  const focusElement = document.createElement('div');
  focusElement.tabIndex = 0;
  focusElement.style.position = 'absolute';
  focusElement.style.left = '0';
  focusElement.style.top = '0';
  focusElement.style.width = '100%';
  focusElement.style.height = '100%';
  focusElement.style.opacity = '0';
  focusElement.style.outline = 'none';
  focusElement.style.pointerEvents = 'none';
  focusElement.setAttribute('role', 'grid');
  focusElement.setAttribute('aria-label', 'Data grid');

  focusElement.addEventListener('keydown', onKeyDown);

  container.appendChild(focusElement);
  return focusElement;
}