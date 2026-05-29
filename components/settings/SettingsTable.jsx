'use client';

import { AnimatedTableContainer } from '@/components/ui';

export default function SettingsTable({ columns, rows, emptyMessage = 'No records found.' }) {
  if (!rows?.length) {
    return (
      <p className="rounded-3xl border border-dashed border-border bg-card px-4 py-8 text-center text-sm text-muted-foreground">
        {emptyMessage}
      </p>
    );
  }

  return (
    <AnimatedTableContainer>
      <table className="data-table">
        <thead>
          <tr>
            {columns.map((col) => (
              <th key={col.key}>{col.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.key}>
              {columns.map((col) => (
                <td key={col.key}>
                  {col.render ? col.render(row.data) : row.data[col.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </AnimatedTableContainer>
  );
}
