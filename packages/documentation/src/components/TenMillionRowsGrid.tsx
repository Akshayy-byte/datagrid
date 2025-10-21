'use client';

import React from 'react';
import { CanvasDataGrid } from '@coleski/datagrid';

const headers = ['ID A', 'ID B', 'ID C'] as const;

type Row = [string, string, string];

async function fetchRows(offset: number, limit: number): Promise<Row[]> {
  const rows: Row[] = new Array(limit);
  for (let i = 0; i < limit; i++) {
    // Only UUIDs in three columns
    rows[i] = [crypto.randomUUID(), crypto.randomUUID(), crypto.randomUUID()];
  }
  return rows;
}

export default function TenMillionRowsGrid(): React.JSX.Element {
  // Minimal wrapper: no controls/banner, just the grid

  return (
    <div style={{ height: 420 }}>
      <CanvasDataGrid
        mode="virtual"
        rowCount={10_000_000}
        columnCount={headers.length}
        headers={headers as unknown as string[]}
        fetchRows={fetchRows}
        pageSize={1000}
        prefetch
        resizable
        minColumnWidth={140}
        selectionTransitionDuration={120}
        ariaLabel="Virtual grid with 10 million rows"
      />
    </div>
  );
}


