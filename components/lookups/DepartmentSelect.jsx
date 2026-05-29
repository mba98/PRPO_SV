'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/apiClient';

export default function DepartmentSelect({ value, onChange, disabled, locked }) {
  const [options, setOptions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { json } = await apiFetch('/api/lookups/departments');
      if (json.success) setOptions(json.data || []);
      else setError(json.message || 'Failed to load departments');
      setLoading(false);
    })();
  }, []);

  if (locked && value) {
    return (
      <input className="input-field mt-1 bg-muted" type="text" value={value} readOnly disabled />
    );
  }

  return (
    <div>
      <select
        className="input-field mt-1"
        required
        value={value}
        disabled={disabled || loading}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">{loading ? 'Loading…' : 'Select department'}</option>
        {options.map((d) => (
          <option key={d.code} value={d.code}>
            {d.name}
          </option>
        ))}
      </select>
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}
