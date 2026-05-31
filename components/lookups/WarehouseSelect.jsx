'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { apiFetch } from '@/lib/apiClient';

let warehouseListCache = null;

async function fetchWarehouses(query, limit = 50) {
  const params = new URLSearchParams({ limit: String(limit) });
  if (query?.trim()) {
    params.set('query', query.trim());
  }
  const { json } = await apiFetch(`/api/sap/warehouses?${params}`);
  if (!json.success) {
    throw new Error(json.message || 'Failed to load warehouses');
  }
  return json.data || [];
}

export default function WarehouseSelect({
  valueCode = '',
  valueLabel = '',
  onSelect,
  disabled = false,
  placeholder = 'Search warehouse',
  emptyMessage = 'No warehouses found',
  inputClassName = 'input-field',
  loadingMessage = 'Loading…',
}) {
  const [query, setQuery] = useState(valueLabel || valueCode || '');
  const [results, setResults] = useState([]);
  const [focused, setFocused] = useState(false);
  const [loading, setLoading] = useState(false);
  const [fetched, setFetched] = useState(false);
  const [error, setError] = useState('');
  const timer = useRef(null);

  useEffect(() => {
    setQuery(valueLabel || valueCode || '');
  }, [valueCode, valueLabel]);

  const loadWarehouses = useCallback(async (searchQuery) => {
    const trimmed = searchQuery.trim();
    setLoading(true);
    setError('');
    try {
      if (!trimmed && warehouseListCache) {
        setResults(warehouseListCache);
        setFetched(true);
        setLoading(false);
        return;
      }
      const items = await fetchWarehouses(trimmed);
      if (!trimmed) {
        warehouseListCache = items;
      }
      setResults(items);
      setFetched(true);
    } catch (err) {
      setResults([]);
      setFetched(true);
      setError(err.message || 'Failed to load warehouses');
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    if (disabled || !focused) return undefined;

    const trimmed = query.trim();
    if (!trimmed) {
      loadWarehouses('');
      return undefined;
    }

    timer.current = setTimeout(() => loadWarehouses(trimmed), 300);
    return () => clearTimeout(timer.current);
  }, [query, focused, disabled, loadWarehouses]);

  function pick(warehouse) {
    const code = warehouse.warehouseCode;
    const label = `${warehouse.warehouseCode} — ${warehouse.warehouseName || ''}`;
    onSelect(code, label, warehouse);
    setQuery(label);
    setFocused(false);
    setError('');
  }

  function clearSelection() {
    onSelect('', '', null);
    setQuery('');
    setResults(warehouseListCache || []);
    setFetched(Boolean(warehouseListCache?.length));
  }

  const showDropdown = focused && (loading || fetched);

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
        <ul className="absolute z-20 mt-1 max-h-56 w-full overflow-y-auto rounded-2xl border border-border bg-card py-1 shadow-xl">
          {loading && (
            <li className="px-3 py-2 text-xs text-muted-foreground">{loadingMessage}</li>
          )}
          {!loading && results.length === 0 && (
            <li className="px-3 py-2 text-xs text-muted-foreground">{emptyMessage}</li>
          )}
          {!loading &&
            results.map((warehouse) => {
              const code = warehouse.warehouseCode;
              const selected = valueCode && code === valueCode;
              return (
                <li key={code}>
                  <button
                    type="button"
                    className={[
                      'w-full px-3 py-2 text-start text-sm transition-colors hover:bg-primary/10',
                      selected ? 'font-semibold text-primary' : 'text-foreground',
                    ].join(' ')}
                    onMouseDown={() => pick(warehouse)}
                  >
                    {warehouse.warehouseCode} — {warehouse.warehouseName || ''}
                  </button>
                </li>
              );
            })}
        </ul>
      )}
    </div>
  );
}
