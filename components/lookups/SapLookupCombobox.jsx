'use client';

import { useEffect, useRef, useState } from 'react';
import { apiFetch } from '@/lib/apiClient';

/**
 * Debounced SAP/master lookup combobox (code + display label).
 */
export default function SapLookupCombobox({
  endpoint,
  valueCode = '',
  valueLabel = '',
  onSelect,
  getCode,
  getLabel,
  placeholder = 'Search…',
  disabled = false,
  minChars = 0,
  emptyMessage = 'No results',
}) {
  const [query, setQuery] = useState(valueLabel || valueCode || '');
  const [results, setResults] = useState([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const timer = useRef(null);

  useEffect(() => {
    setQuery(valueLabel || valueCode || '');
  }, [valueCode, valueLabel]);

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    if (disabled) return undefined;

    const run = async () => {
      setLoading(true);
      setError('');
      const params = new URLSearchParams({ limit: '20' });
      if (query.trim()) params.set('query', query.trim());
      const { json } = await apiFetch(`${endpoint}?${params}`);
      if (json.success) {
        setResults(json.data || []);
      } else {
        setResults([]);
        setError(json.message || 'Lookup failed');
      }
      setLoading(false);
      setOpen(true);
    };

    if (minChars > 0 && query.trim().length < minChars) {
      setResults([]);
      return undefined;
    }

    timer.current = setTimeout(run, 300);
    return () => clearTimeout(timer.current);
  }, [query, endpoint, disabled, minChars]);

  function pick(option) {
    const code = getCode(option);
    const label = getLabel(option);
    onSelect(code, label, option);
    setQuery(label);
    setOpen(false);
    setError('');
  }

  function clearSelection() {
    onSelect('', '', null);
    setQuery('');
    setResults([]);
  }

  return (
    <div className="relative">
      <input
        type="text"
        className="input-field"
        value={query}
        disabled={disabled}
        placeholder={placeholder}
        onChange={(e) => {
          setQuery(e.target.value);
          if (!e.target.value) clearSelection();
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 200)}
      />
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
      {open && (loading || results.length > 0 || (query && !loading)) && (
        <ul className="absolute z-20 mt-1 max-h-48 w-full overflow-auto rounded-md border border-slate-200 bg-white shadow-lg">
          {loading && <li className="px-3 py-2 text-xs text-slate-500">Loading…</li>}
          {!loading && results.length === 0 && (
            <li className="px-3 py-2 text-xs text-slate-500">{emptyMessage}</li>
          )}
          {!loading &&
            results.map((opt) => {
              const code = getCode(opt);
              return (
                <li key={code}>
                  <button
                    type="button"
                    className="w-full px-3 py-2 text-left text-sm hover:bg-slate-50"
                    onMouseDown={() => pick(opt)}
                  >
                    {getLabel(opt)}
                  </button>
                </li>
              );
            })}
        </ul>
      )}
    </div>
  );
}
