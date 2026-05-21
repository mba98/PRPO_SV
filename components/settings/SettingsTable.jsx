'use client';

export default function SettingsTable({ columns, rows, emptyMessage = 'No records found.' }) {
  if (!rows?.length) {
    return (
      <p className="rounded-lg border border-dashed border-slate-200 bg-white px-4 py-8 text-center text-sm text-slate-500">
        {emptyMessage}
      </p>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
      <table className="min-w-full divide-y divide-slate-200">
        <thead className="bg-slate-50">
          <tr>
            {columns.map((col) => (
              <th
                key={col.key}
                className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600"
              >
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-200">
          {rows.map((row) => (
            <tr key={row.key} className="odd:bg-slate-50/50 hover:bg-indigo-50/50">
              {columns.map((col) => (
                <td key={col.key} className="px-4 py-3 text-sm text-slate-700">
                  {col.render ? col.render(row.data) : row.data[col.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
