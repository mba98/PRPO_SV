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
      const { json, status } = await apiFetch('/api/sap/uom-groups?limit=100');
      if (cancelled) return;
      if (json.success) {
        setGroups(json.data || []);
      } else {
        const fieldMessages = json.errors?.map((e) => e.message).filter(Boolean);
        const parts = [
          fieldMessages?.length ? fieldMessages.join('; ') : json.message || 'Failed to load UoM groups',
        ];
        if (json.error) parts.push(`(${json.error})`);
        if (status) parts.push(`[HTTP ${status}]`);
        setError(parts.filter(Boolean).join(' '));
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
          const row = groups.find((g) => String(g.value) === String(entry));
          onSelect?.(entry, row);
        }}
      >
        <option value="">{loading ? 'Loading…' : placeholder}</option>
        {groups.map((g) => (
          <option key={g.value} value={g.value}>
            {g.label || g.code || g.value}
          </option>
        ))}
      </select>
      {error && (
        <p className="mt-1 text-xs text-destructive" role="alert">
          {error}
        </p>
      )}
      {valueLabel && valueEntry && !error && (
        <p className="mt-0.5 text-xs text-muted-foreground">{valueLabel}</p>
      )}
    </div>
  );
}
