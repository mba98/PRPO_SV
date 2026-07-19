'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { apiFetch } from '@/lib/apiClient';

const listCache = new Map();

function formatApiError(json, status, fallback) {
  const fieldMessages = json.errors?.map((e) => e.message).filter(Boolean);
  const parts = [
    fieldMessages?.length ? fieldMessages.join('; ') : json.message || fallback,
  ];
  if (json.error) parts.push(`(${json.error})`);
  if (status) parts.push(`[HTTP ${status}]`);
  return parts.filter(Boolean).join(' ');
}

function defaultFormat(row) {
  if (!row) return '';
  const value = row.value ?? row.code ?? '';
  const label = row.label ?? '';
  if (value && label && String(value) !== String(label)) {
    return `${value} — ${label}`;
  }
  return String(label || value || '');
}

/**
 * Searchable combobox for SAP lookups returning { value, label, code }.
 */
export default function SearchableLookup({
  endpoint,
  value = '',
  label = '',
  onSelect,
  disabled = false,
  placeholder = 'Search…',
  emptyMessage = 'No results',
  loadingMessage = 'Loading…',
  inputClassName = 'input-field',
  containerClassName = '',
  limit = 100,
  loadAllOnFocus = true,
  formatOption = defaultFormat,
  minChars = 0,
  clearSelectionOnInput = false,
}) {
  const [query, setQuery] = useState(label || (value ? String(value) : ''));
  const [results, setResults] = useState([]);
  const [focused, setFocused] = useState(false);
  const [loading, setLoading] = useState(false);
  const [fetched, setFetched] = useState(false);
  const [error, setError] = useState('');
  const timer = useRef(null);
  const requestSequence = useRef(0);
  const queryMin = Math.max(minChars, 0);
  const externalKey = `${value ?? ''}|${label ?? ''}`;

  useEffect(() => {
    if (!focused) {
      setQuery(label || (value != null && value !== '' ? String(value) : ''));
    }
  }, [externalKey, value, label, focused]);

  const loadOptions = useCallback(
    async (searchQuery) => {
      const trimmed = searchQuery.trim();
      const cacheKey = `${endpoint}|${limit}`;
      const requestId = ++requestSequence.current;
      setLoading(true);
      setError('');
      try {
        if (loadAllOnFocus && !trimmed && listCache.has(cacheKey)) {
          if (requestId !== requestSequence.current) return;
          setResults(listCache.get(cacheKey));
          setFetched(true);
          setLoading(false);
          return;
        }
        const params = new URLSearchParams({ limit: String(limit) });
        if (trimmed) params.set('query', trimmed);
        const { json, status } = await apiFetch(`${endpoint}?${params}`);
        if (requestId !== requestSequence.current) return;
        if (json.success) {
          const rows = json.data || [];
          if (loadAllOnFocus && !trimmed) {
            listCache.set(cacheKey, rows);
          }
          setResults(rows);
        } else {
          setResults([]);
          setError(formatApiError(json, status, 'Lookup failed'));
        }
        setFetched(true);
      } catch (err) {
        if (requestId !== requestSequence.current) return;
        setResults([]);
        setFetched(true);
        setError(err.message || 'Lookup failed');
      }
      if (requestId === requestSequence.current) setLoading(false);
    },
    [endpoint, limit, loadAllOnFocus],
  );

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    if (disabled || !focused) return undefined;

    const trimmed = query.trim();
    if (trimmed.length < queryMin) {
      if (loadAllOnFocus) {
        loadOptions('');
      } else {
        setResults([]);
        setFetched(false);
      }
      return undefined;
    }

    timer.current = setTimeout(() => loadOptions(trimmed), 300);
    return () => clearTimeout(timer.current);
  }, [query, focused, disabled, queryMin, loadAllOnFocus, loadOptions]);

  function pick(row) {
    const storedValue = row.value ?? row.code ?? '';
    const display = formatOption(row);
    onSelect?.(storedValue, display, row);
    setQuery(display);
    setFocused(false);
    setError('');
  }

  function clearSelection() {
    onSelect?.('', '', null);
    setQuery('');
    setResults(listCache.get(`${endpoint}|${limit}`) || []);
    setFetched(Boolean(listCache.get(`${endpoint}|${limit}`)?.length));
  }

  function closeDropdown() {
    requestSequence.current += 1;
    setFocused(false);
    setLoading(false);
  }

  const showDropdown = focused && (loading || fetched);

  return (
    <div className={['relative w-full', containerClassName].filter(Boolean).join(' ')}>
      <input
        type="text"
        className={[inputClassName, 'w-full'].filter(Boolean).join(' ')}
        value={query}
        disabled={disabled}
        placeholder={placeholder}
        onChange={(e) => {
          const nextQuery = e.target.value;
          setQuery(nextQuery);
          if (clearSelectionOnInput && value != null && value !== '') {
            onSelect?.('', '', null);
          } else if (!nextQuery) {
            clearSelection();
          }
        }}
        onFocus={() => setFocused(true)}
        onBlur={() => setTimeout(closeDropdown, 200)}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            e.preventDefault();
            closeDropdown();
          }
        }}
      />
      {error && (
        <p className="mt-1 text-xs text-destructive" role="alert">
          {error}
        </p>
      )}
      {showDropdown && (
        <ul className="absolute z-20 mt-1 max-h-56 min-w-full w-full overflow-y-auto overflow-x-auto rounded-xl border border-border bg-card py-1 shadow-lg">
          {loading && (
            <li className="px-3 py-2 text-xs text-muted-foreground">{loadingMessage}</li>
          )}
          {!loading && results.length === 0 && (
            <li className="px-3 py-2 text-xs text-muted-foreground">{emptyMessage}</li>
          )}
          {!loading &&
            results.map((row) => {
              const key = String(row.value ?? row.code ?? formatOption(row));
              const selected = value && String(row.value ?? row.code) === String(value);
              return (
                <li key={key}>
                  <button
                    type="button"
                    className={[
                      'w-full whitespace-nowrap px-3 py-2 text-start text-sm transition-colors hover:bg-muted',
                      selected ? 'font-semibold text-primary' : 'text-foreground',
                    ].join(' ')}
                    onMouseDown={() => pick(row)}
                  >
                    {formatOption(row)}
                  </button>
                </li>
              );
            })}
        </ul>
      )}
    </div>
  );
}
