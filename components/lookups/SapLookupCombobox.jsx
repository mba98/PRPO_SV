'use client';

import { useEffect, useRef, useState } from 'react';
import { apiFetch } from '@/lib/apiClient';

/**
 * Debounced SAP/master lookup combobox (code + display label).
 * Suggestions show only when focused and query length meets minChars (minimum 1).
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
  minChars = 1,
  emptyMessage = 'No results',
  inputClassName = 'input-field',
  loadingMessage = 'Loading…',
}) {
  const [query, setQuery] = useState(valueLabel || valueCode || '');
  const [results, setResults] = useState([]);
  const [focused, setFocused] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const timer = useRef(null);
  const queryMin = Math.max(minChars, 1);

  useEffect(() => {
    setQuery(valueLabel || valueCode || '');
  }, [valueCode, valueLabel]);

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    if (disabled) return undefined;

    const trimmed = query.trim();
    if (trimmed.length < queryMin) {
      setResults([]);
      setLoading(false);
      return undefined;
    }

    timer.current = setTimeout(async () => {
      setLoading(true);
      setError('');
      const params = new URLSearchParams({ limit: '20', query: trimmed });
      const { json } = await apiFetch(`${endpoint}?${params}`);
      if (json.success) {
        setResults(json.data || []);
      } else {
        setResults([]);
        setError(json.message || 'Lookup failed');
      }
      setLoading(false);
    }, 300);

    return () => clearTimeout(timer.current);
  }, [query, endpoint, disabled, queryMin]);

  function pick(option) {
    const code = getCode(option);
    const label = getLabel(option);
    onSelect(code, label, option);
    setQuery(label);
    setFocused(false);
    setError('');
  }

  function clearSelection() {
    onSelect('', '', null);
    setQuery('');
    setResults([]);
  }

  const showDropdown =
    focused &&
    query.trim().length >= queryMin &&
    (loading || results.length > 0 || (!loading && !error));

  return (
    <div className="relative">
      <input
        type="text"
        className={inputClassName}
        value={query}
        disabled={disabled}
        placeholder={placeholder}
        onChange={(e) => {
          setQuery(e.target.value);
          if (!e.target.value) clearSelection();
        }}
        onFocus={() => setFocused(true)}
        onBlur={() => setTimeout(() => setFocused(false), 200)}
      />
      {error && <p className="mt-1 text-xs text-destructive">{error}</p>}
      {showDropdown && (
        <ul className="absolute z-20 mt-1 max-h-48 w-full overflow-auto rounded-xl border border-border bg-card shadow-lg">
          {loading && (
            <li className="px-3 py-2 text-xs text-muted-foreground">{loadingMessage}</li>
          )}
          {!loading && results.length === 0 && (
            <li className="px-3 py-2 text-xs text-muted-foreground">{emptyMessage}</li>
          )}
          {!loading &&
            results.map((opt) => {
              const code = getCode(opt);
              return (
                <li key={code}>
                  <button
                    type="button"
                    className="w-full px-3 py-2 text-start text-sm hover:bg-muted"
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
