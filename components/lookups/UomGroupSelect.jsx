'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/apiClient';

export default function UomGroupSelect({
  valueEntry,
  valueLabel,
  onSelect,
  disabled,
  placeholder = 'Select UoM group',
  inputClassName = 'input-field',
}) {
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError('');
      const { json } = await apiFetch('/api/sap/uom-groups?limit=200');
      if (cancelled) return;
      if (json.success) {
        setGroups(json.data || []);
      } else {
        setError(json.message || 'Failed to load UoM groups');
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div>
      <select
        className={`${inputClassName} w-full`}
        disabled={disabled || loading}
        value={valueEntry ?? ''}
        onChange={(e) => {
          const entry = e.target.value ? Number(e.target.value) : '';
          const row = groups.find((g) => String(g.ugpEntry) === String(entry));
          onSelect?.(entry, row?.ugpName || '');
        }}
      >
        <option value="">{loading ? 'Loading…' : placeholder}</option>
        {groups.map((g) => (
          <option key={g.ugpEntry} value={g.ugpEntry}>
            {g.ugpName || g.ugpCode || g.ugpEntry}
          </option>
        ))}
      </select>
      {error && <p className="mt-1 text-xs text-destructive">{error}</p>}
      {valueLabel && valueEntry && (
        <p className="mt-0.5 text-xs text-muted-foreground">{valueLabel}</p>
      )}
    </div>
  );
}
