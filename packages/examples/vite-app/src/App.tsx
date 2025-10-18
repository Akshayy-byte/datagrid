import React, { useState, useRef } from 'react'
import {
  CanvasDataGrid,
  useGrid,
  type GridHandle,
  SELECTION_OVERRIDES,
  CELL_OVERRIDES,
} from '@coleski/datagrid'

// Simple wrapper was unused; render CanvasDataGrid directly

// Generate sample data
const generateRows = (count: number): string[][] => {
  return Array.from({ length: count }, (_, i) => {
    const date = new Date(Date.now() - Math.random() * 365 * 24 * 60 * 60 * 1000)
      .toISOString()
      .split('T')[0] as string
    const status = (Math.random() > 0.5 ? 'Active' : 'Inactive') as string
    const priority = (['Low', 'Medium', 'High'][Math.floor(Math.random() * 3)] ?? 'Low') as string
    return [
      `Item ${i + 1}`,
      `Description for item ${i + 1}`,
      (Math.random() * 1000).toFixed(2),
      date,
      status,
      priority
    ]
  })
}

const headers = ['Name', 'Description', 'Amount', 'Date', 'Status', 'Priority']

// Virtual data fetcher for large dataset example
async function fetchRows(offset: number, limit: number): Promise<string[][]> {
  // Simulate network delay
  await new Promise(resolve => setTimeout(resolve, 50))

  return Array.from({ length: limit }, (_, i) => {
    const index = offset + i
    return [
      `Virtual Item ${index + 1}`,
      `This is virtual row ${index + 1} with dynamic content`,
      (Math.random() * 10000).toFixed(2),
      new Date(Date.now() - Math.random() * 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0] as string,
      (Math.random() > 0.5 ? 'Active' : 'Inactive') as string,
      (['Low', 'Medium', 'High'][Math.floor(Math.random() * 3)] ?? 'Low') as string,
    ]
  })
}

function BasicGridExample() {
  const gridRef = useRef<GridHandle>(null)
  const { selection, clearSelection, scrollToCell, autosizeColumn } = useGrid(gridRef)

  const [rows] = useState(() => generateRows(10000))

  const formatCell = React.useCallback((value: string, _row: number, col: number) => {
    if (col === 2) {
      return {
        textAlign: 'right' as const,
        color: parseFloat(value) > 500 ? '#059669' : '#dc2626',
      }
    }
    if (col === 4) {
      return {
        textAlign: 'center' as const,
        color: value === 'Active' ? '#059669' : '#6b7280',
        background: value === 'Active' ? '#d1fae5' : '#f1f5f9',
      }
    }
    if (col === 5) {
      const colors = {
        'High': { color: '#dc2626', background: '#fee2e2' },
        'Medium': { color: '#d97706', background: '#fef3c7' },
        'Low': { color: '#059669', background: '#d1fae5' }
      }
      return {
        textAlign: 'center' as const,
        ...colors[value as keyof typeof colors]
      }
    }
    return {}
  }, [])

  const onCellClick = React.useCallback(() => { }, [])

  return (
    <div style={{ marginBottom: '48px' }}>
      <h2>Basic Grid - Full Data Mode</h2>

      <div style={{ marginBottom: '16px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
        <button onClick={() => scrollToCell(50, 2, 'center')}>Jump to Row 51</button>
        <button onClick={() => autosizeColumn(1)}>Auto-size Description</button>
        <button onClick={() => clearSelection()}>Clear Selection</button>
      </div>

      {selection && (
        <div style={{
          marginBottom: '16px',
          padding: '8px',
          background: '#f0f9ff',
          border: '1px solid #0ea5e9',
          borderRadius: '4px',
          fontSize: '14px',
          color: '#0f172a'
        }}>
          Selection: <strong>{selection.type}</strong> -
          {selection.type === 'cell'
            ? ` Row ${selection.start.row + 1}, Column ${selection.start.col + 1}`
            : selection.type === 'row'
              ? ` Rows ${selection.startRow + 1}-${selection.endRow + 1}`
              : ` Columns ${selection.startCol + 1}-${selection.endCol + 1}`
          }
        </div>
      )}

      <div style={{ position: 'relative' }}>

        <div style={{ position: 'relative', height: '400px', border: '1px solid #e2e8f0', borderRadius: '6px', overflow: 'hidden' }}>
          <CanvasDataGrid
            ref={gridRef}
            rows={rows}
            headers={headers}
            fitToCanvas={false}
            minColumnWidth={150}
            resizable
            selectionTransitionDuration={120}
            formatCell={formatCell}
            onCellClick={onCellClick}
            ariaLabel="Basic data grid example"
          />

          {/* Selection bubble menu */}
          {/*           {selection && selectionRect && (
            <div
              style={{
                position: 'absolute',
                left: selectionRect.x + selectionRect.width / 2,
                top: Math.max(8, selectionRect.y - 8),
                transform: 'translate(-50%, -100%)',
                padding: '4px 8px',
                background: '#1f2937',
                color: '#f9fafb',
                border: '1px solid #374151',
                borderRadius: '4px',
                fontSize: '12px',
                fontFamily: 'ui-monospace, monospace',
                pointerEvents: 'auto',
                zIndex: 1000,
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              <span>
                {selection.type === 'column'
                  ? `Col ${selection.startCol + 1}`
                  : selection.type === 'row'
                  ? `Row ${selection.startRow + 1}`
                  : `R${selection.start.row + 1}C${selection.start.col + 1}`
                }
              </span>
              <button
                onClick={clearSelection}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#f9fafb',
                  cursor: 'pointer',
                  padding: '0',
                  fontSize: '12px',
                }}
              >
                ✕
              </button>
            </div>
          )} */}
        </div>
      </div>
    </div>
  )
}

function DraggableColumnsExample() {
  const [rows] = useState(() => generateRows(40))
  const initialOrderRef = useRef(headers.map((_, index) => index))
  const [columnOrder, setColumnOrder] = useState(() => initialOrderRef.current.slice())

  const resetOrder = React.useCallback(() => {
    setColumnOrder(initialOrderRef.current.slice())
  }, [])

  const orderedLabels = columnOrder.map((idx) => headers[idx]).join(' → ')

  return (
    <div style={{ marginBottom: '48px' }}>
      <h2>Draggable Columns &amp; Custom Order</h2>
      <p style={{ color: '#64748b', marginTop: '-8px' }}>
        Drag any header to reorder columns. The grid keeps cell data aligned with the current order.
      </p>

      <div style={{
        marginBottom: '16px',
        padding: '12px 16px',
        border: '1px solid #e2e8f0',
        borderRadius: '6px',
        background: '#f8fafc',
        fontSize: '14px',
        display: 'flex',
        flexWrap: 'wrap',
        gap: '12px',
        alignItems: 'center',
      }}>
        <span style={{ fontWeight: 600, color: '#1f2937' }}>Current order:</span>
        <span style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace", color: '#0f172a' }}>
          {orderedLabels}
        </span>
        <button
          onClick={resetOrder}
          style={{
            marginLeft: 'auto',
            padding: '6px 12px',
            border: '1px solid #3b82f6',
            borderRadius: '4px',
            background: '#3b82f6',
            color: '#ffffff',
            cursor: 'pointer',
            fontSize: '13px',
          }}
        >
          Reset order
        </button>
      </div>

      <div style={{ position: 'relative', height: '360px', border: '1px solid #e2e8f0', borderRadius: '6px', overflow: 'hidden' }}>
        <CanvasDataGrid
          rows={rows}
          headers={headers}
          draggableColumns
          columnOrder={columnOrder}
          onColumnOrderChange={setColumnOrder}
          fitToCanvas={false}
          minColumnWidth={140}
          ariaLabel="Grid with draggable columns"
        />
      </div>
    </div>
  )
}
function VirtualGridExample() {
  const gridRef = useRef<GridHandle>(null)
  const { selection, scrollToCell } = useGrid(gridRef)

  return (
    <div style={{ marginBottom: '48px' }}>
      <h2>Virtual Grid - Large Dataset (100K rows)</h2>

      <div style={{ marginBottom: '16px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
        <button onClick={() => scrollToCell(50000, 2, 'center')}>Jump to Row 50,001</button>
        <button onClick={() => scrollToCell(99999, 0, 'center')}>Jump to Last Row</button>
        <button onClick={() => scrollToCell(0, 0, 'center')}>Jump to First Row</button>
      </div>

      {selection && (
        <div style={{
          marginBottom: '16px',
          padding: '8px',
          background: '#fef3c7',
          border: '1px solid #f59e0b',
          borderRadius: '4px',
          fontSize: '14px',
          color: '#78350f'
        }}>
          Virtual Selection: Row {selection.type === 'cell' ? selection.start.row + 1 : 'N/A'}
        </div>
      )}

      <div style={{ position: 'relative', height: '400px', border: '1px solid #e2e8f0', borderRadius: '6px', overflow: 'hidden' }}>
        <CanvasDataGrid
          ref={gridRef}
          mode="virtual"
          rowCount={100000}
          columnCount={6}
          headers={headers}
          fetchRows={fetchRows}
          pageSize={500}
          prefetch={true}
          resizable
          formatCell={(value: string, _row: number, col: number) => {
            if (col === 2) { // Amount column
              return {
                textAlign: 'right' as const,
                color: parseFloat(value || '0') > 5000 ? '#059669' : '#dc2626',
              }
            }
            return {}
          }}
          ariaLabel="Virtual scrolling data grid with 100,000 rows"
        />
      </div>

      <p style={{ marginTop: '8px', fontSize: '14px', color: '#6b7280' }}>
        Scroll through 100,000 rows with smooth virtual scrolling. Data is loaded on-demand.
      </p>
    </div>
  )
}

function CustomThemeExample() {
  const [theme, setTheme] = useState<'light' | 'dark' | 'custom'>('light')
  const [rows] = useState(() => generateRows(50))

  const themes = {
    light: undefined,
    dark: {
      background: '#0f172a',
      foreground: '#f1f5f9',
      muted: '#1e293b',
      mutedForeground: '#94a3b8',
      border: '#334155',
      accent: '#3b82f6',
      scrollbarForeground: '#64748b',
    },
    custom: {
      background: '#fef7ff',
      foreground: '#581c87',
      muted: '#f3e8ff',
      mutedForeground: '#7c3aed',
      border: '#c4b5fd',
      accent: '#8b5cf6',
      selectionFill: 'rgba(139, 92, 246, 0.15)',
      selectionBorderWidth: 3,
    }
  }

  return (
    <div style={{ marginBottom: '48px' }}>
      <h2>Custom Theming</h2>

      <div style={{ marginBottom: '16px', display: 'flex', gap: '8px' }}>
        <button
          onClick={() => setTheme('light')}
          style={{
            background: theme === 'light' ? '#3b82f6' : '#e2e8f0',
            color: theme === 'light' ? 'white' : 'black',
            border: 'none',
            padding: '4px 8px',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          Light
        </button>
        <button
          onClick={() => setTheme('dark')}
          style={{
            background: theme === 'dark' ? '#3b82f6' : '#e2e8f0',
            color: theme === 'dark' ? 'white' : 'black',
            border: 'none',
            padding: '4px 8px',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          Dark
        </button>
        <button
          onClick={() => setTheme('custom')}
          style={{
            background: theme === 'custom' ? '#3b82f6' : '#e2e8f0',
            color: theme === 'custom' ? 'white' : 'black',
            border: 'none',
            padding: '4px 8px',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          Purple
        </button>
      </div>

      <div style={{ height: '300px', border: '1px solid #e2e8f0', borderRadius: '6px', overflow: 'hidden' }}>
        <CanvasDataGrid
          rows={rows}
          headers={headers}
          theme={themes[theme]}
          selectionTransitionDuration={200}
          ariaLabel="Themed data grid example"
        />
      </div>
    </div>
  )
}

function CustomOverridesExample() {
  const [overrideType, setOverrideType] = useState<'default' | 'rounded' | 'dashed' | 'zebra' | 'frame'>('default')
  const [rows] = useState(() => generateRows(30))

  const overrides = {
    default: undefined,
    rounded: {
      drawSelection: SELECTION_OVERRIDES.roundedSelection,
    },
    dashed: {
      drawSelection: SELECTION_OVERRIDES.dashedSelection,
    },
    zebra: {
      drawCell: CELL_OVERRIDES.zebraStripes,
    },
    frame: {
      beforeRender: (ctx: CanvasRenderingContext2D, args: any) => {
        ctx.save();
        const g = ctx.createLinearGradient(0, 0, 0, args.canvasRect.height);
        g.addColorStop(0, 'rgba(59,130,246,0.05)');
        g.addColorStop(1, 'rgba(59,130,246,0)');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, args.canvasRect.width, args.canvasRect.height);
        ctx.restore();
      },
      afterRender: (ctx: CanvasRenderingContext2D, args: any) => {
        ctx.save();
        ctx.fillStyle = 'rgba(15,23,42,0.5)';
        ctx.font = '10px ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto';
        const text = `cols ${args.visibleRange.startCol}-${args.visibleRange.endCol} | rows ${args.visibleRange.startRow}-${args.visibleRange.endRow}`;
        ctx.fillText(text, 8, Math.max(10, args.headerHeight - 4));
        ctx.restore();
      },
    },
  }

  return (
    <div style={{ marginBottom: '48px' }}>
      <h2>Custom Draw Overrides</h2>

      <div style={{ marginBottom: '16px', display: 'flex', gap: '8px' }}>
        {Object.keys(overrides).map((type) => (
          <button
            key={type}
            onClick={() => setOverrideType(type as any)}
            style={{
              background: overrideType === type ? '#3b82f6' : '#e2e8f0',
              color: overrideType === type ? 'white' : 'black',
              border: 'none',
              padding: '4px 8px',
              borderRadius: '4px',
              cursor: 'pointer',
              textTransform: 'capitalize'
            }}
          >
            {type}
          </button>
        ))}
      </div>

      <div style={{ height: '300px', border: '1px solid #e2e8f0', borderRadius: '6px', overflow: 'hidden' }}>
        <CanvasDataGrid
          rows={rows}
          headers={headers}
          overrides={overrides[overrideType]}
          selectionTransitionDuration={150}
          ariaLabel="Custom draw overrides example"
        />
      </div>
    </div>
  )
}

export default function App() {
  return (
    <main style={{ padding: '24px', maxWidth: '1200px', margin: '0 auto' }}>
      <header style={{ marginBottom: '48px', textAlign: 'center' }}>
        <h1 style={{ color: '#1e293b', marginBottom: '8px' }}>@coleski/datagrid</h1>
        <p style={{ color: '#64748b', fontSize: '18px', margin: '0' }}>
          Ultra-fast canvas-based data grid for React
        </p>
      </header>

      <BasicGridExample />
      <DraggableColumnsExample />
      <VirtualGridExample />
      <CustomThemeExample />
      <CustomOverridesExample />

      <footer style={{ marginTop: '64px', padding: '24px', background: '#f8fafc', borderRadius: '8px' }}>
        <h3 style={{ marginTop: '0', color: '#1e293b' }}>Features Demonstrated</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '16px', fontSize: '14px', color: '#475569' }}>
          <ul style={{ margin: '0', paddingLeft: '20px' }}>
            <li>Full data mode (small datasets)</li>
            <li>Virtual scrolling (large datasets)</li>
            <li>Column resizing</li>
            <li>Column dragging &amp; custom ordering</li>
            <li>Cell formatting</li>
          </ul>
          <ul style={{ margin: '0', paddingLeft: '20px' }}>
            <li>Selection with smooth transitions</li>
            <li>Keyboard navigation <span style={{ fontSize: '12px', color: '#f59e0b' }}>(Coming Soon)</span></li>
            <li>Custom theming</li>
            <li>Draw overrides</li>
          </ul>
          <ul style={{ margin: '0', paddingLeft: '20px' }}>
            <li>Anchor-based overlays</li>
            <li>Imperative API (useGrid hook)</li>
            <li>Accessibility support</li>
            <li>TypeScript support</li>
          </ul>
        </div>

        <div style={{ marginTop: '24px', padding: '16px', background: '#fff', border: '1px solid #e2e8f0', borderRadius: '6px' }}>
          <h4 style={{ marginTop: '0', marginBottom: '8px', color: '#1e293b' }}>Keyboard Shortcuts <span style={{ fontSize: '12px', color: '#f59e0b', fontWeight: 'normal' }}>(Coming Soon)</span></h4>
          <div style={{ fontSize: '13px', color: '#64748b', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '8px' }}>
            <div><kbd>Arrow Keys</kbd> - Navigate cells</div>
            <div><kbd>Shift + Arrows</kbd> - Extend selection</div>
            <div><kbd>Ctrl/Cmd + A</kbd> - Select all</div>
            <div><kbd>Escape</kbd> - Clear selection</div>
            <div><kbd>Page Up/Down</kbd> - Page navigation</div>
            <div><kbd>Home/End</kbd> - Row start/end</div>
            <div><kbd>Ctrl + Home/End</kbd> - Grid start/end</div>
            <div><kbd>Tab</kbd> - Next cell</div>
          </div>
        </div>
      </footer>
    </main>
  )
}
