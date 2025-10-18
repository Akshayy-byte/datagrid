/**
 * Column width calculation utilities for the grid
 * Handles proper distribution of available canvas width among columns
 */

// Column width constants
export const MIN_COLUMN_WIDTH = 60;
export const MAX_COLUMN_WIDTH = 400;
export const DEFAULT_COLUMN_WIDTH = 120;
export const GUTTER_WIDTH = 40;

export interface ColumnWidthCalculationResult {
  columnWidths: number[];
  totalWidth: number;
  availableWidth: number;
}

export interface ColumnWidthCalculationOptions {
  canvasWidth: number;
  columnCount: number;
  existingWidths?: number[];
  minWidth?: number;
  maxWidth?: number;
  gutterWidth?: number;
  // When true (default), columns are scaled to fit available width.
  // When false, widths are strictly clamped to min/max and may overflow (scroll).
  fitToCanvas?: boolean;
}

/**
 * Calculates optimal column widths based on available canvas space
 * Distributes remaining space proportionally among columns while respecting constraints
 */
export function calculateColumnWidths({
  canvasWidth,
  columnCount,
  existingWidths = [],
  minWidth = MIN_COLUMN_WIDTH,
  maxWidth = MAX_COLUMN_WIDTH,
  gutterWidth = GUTTER_WIDTH,
  fitToCanvas = true,
}: ColumnWidthCalculationOptions): ColumnWidthCalculationResult {
  // Calculate available width for columns (canvas - gutter)
  const availableWidth = Math.max(0, canvasWidth - gutterWidth);

  if (columnCount === 0) {
    return {
      columnWidths: [],
      totalWidth: gutterWidth,
      availableWidth,
    };
  }

  // Determine a base distribution (use existing widths if provided; else equal)
  let baseColumnWidths: number[];
  if (existingWidths.length >= columnCount) {
    baseColumnWidths = existingWidths.slice(0, columnCount).map(w => Math.max(1, w));
  } else if (existingWidths.length > 0) {
    baseColumnWidths = [...existingWidths];
    while (baseColumnWidths.length < columnCount) baseColumnWidths.push(existingWidths[existingWidths.length - 1] || minWidth);
  } else {
    // For non-fit mode, prefer a stable default width per column.
    if (fitToCanvas) {
      const equal = availableWidth / columnCount || minWidth;
      baseColumnWidths = Array.from({ length: columnCount }, () => equal);
    } else {
      const equal = DEFAULT_COLUMN_WIDTH;
      baseColumnWidths = Array.from({ length: columnCount }, () => equal);
    }
  }

  // Compute working floats: scale to fit only when requested
  let workingFloats: number[];
  if (fitToCanvas) {
    const baseTotal = baseColumnWidths.reduce((sum, w) => sum + w, 0) || 1;
    const scale = availableWidth / baseTotal;
    workingFloats = baseColumnWidths.map(w => w * scale);
  } else {
    workingFloats = baseColumnWidths.slice();
  }

  // Apply clamping to floats, track if clamped
  const clampedFloats = workingFloats.map(w => Math.max(minWidth, Math.min(maxWidth, w)));

  // Convert to ints by floor; compute remainder using largest remainder method
  let ints = clampedFloats.map(w => Math.floor(w));
  let intSum = ints.reduce((s, w) => s + w, 0);
  let diff = fitToCanvas ? Math.round(availableWidth - intSum) : 0;

  if (diff !== 0) {
    // Build list of candidates with fractional parts and capacity
    const candidates = clampedFloats.map((w, i) => {
      const frac = w - Math.floor(w);
      const growRoom = maxWidth - (ints[i]!);
      const shrinkRoom = (ints[i]!) - minWidth;
      return { i, frac, growRoom, shrinkRoom };
    });

    if (diff > 0) {
      // Add pixels to the largest fractional parts where there is grow room
      const order = candidates
        .filter(c => c.growRoom > 0)
        .sort((a, b) => b.frac - a.frac || a.i - b.i);
      let k = 0;
      while (diff > 0 && order.length > 0) {
        const c = order[k % order.length]!;
        if (ints[c.i]! < maxWidth) {
          ints[c.i]! += 1; diff -= 1;
        }
        k++;
      }
    } else {
      // Remove pixels from the smallest fractional parts where there is shrink room
      const order = candidates
        .filter(c => c.shrinkRoom > 0)
        .sort((a, b) => a.frac - b.frac || a.i - b.i);
      let k = 0;
      while (diff < 0 && order.length > 0) {
        const c = order[k % order.length]!;
        if (ints[c.i]! > minWidth) {
          ints[c.i]! -= 1; diff += 1;
        }
        k++;
      }
    }
  }

  const totalWidth = ints.reduce((sum, width) => sum + width, 0) + gutterWidth;
  return {
    columnWidths: ints,
    totalWidth,
    availableWidth,
  };
}

/**
 * Calculates width for a new column being added to existing ones
 * Ensures the new column fits within available space
 */
export function calculateNewColumnWidth({
  canvasWidth,
  existingWidths,
  minWidth = MIN_COLUMN_WIDTH,
  maxWidth = MAX_COLUMN_WIDTH,
  gutterWidth = GUTTER_WIDTH,
}: Omit<ColumnWidthCalculationOptions, 'columnCount'> & {
  existingWidths: number[];
}): number {
  const availableWidth = Math.max(0, canvasWidth - gutterWidth);
  const existingTotal = existingWidths.reduce((sum, width) => sum + width, 0);
  const remainingSpace = availableWidth - existingTotal;

  if (remainingSpace >= maxWidth) {
    return maxWidth;
  } else if (remainingSpace >= minWidth) {
    return remainingSpace;
  } else {
    // Not enough space, but return minimum width anyway
    return minWidth;
  }
}
