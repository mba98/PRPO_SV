'use client';

import { useEffect, useRef, useState } from 'react';
import { apiFetch } from '@/lib/apiClient';

function warehouseLabel(code, name) {
  if (!code) return '';
  return name ? `${code} — ${name}` : code;
}

export default function ItemSearchInput({
  value,
  onSelect,
  disabled,
  onSearchError,
  placeholder = 'Search item code or name',
  searchingLabel = 'Searching…',
  noResultsMessage = 'No matching items found',
  createNewLabel = 'Create New Item',
  canCreateNew = false,
  onCreateNew,
  inputClassName = 'input-field',
}) {
  const [query, setQuery] = useState(value?.itemCode || '');
  const [results, setResults] = useState([]);
  const [focused, setFocused] = useState(false);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState('');
  const timer = useRef(null);

  useEffect(() => {
    if (value?.itemCode) setQuery(value.itemCode);
  }, [value?.itemCode]);

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    const trimmed = query.trim();
    if (trimmed.length < 1) {
      setResults([]);
      setLoading(false);
      setSearched(false);
      setError('');
      onSearchError?.(false);
      return undefined;
    }
    timer.current = setTimeout(async () => {
      setLoading(true);
      setError('');
      const { json, status } = await apiFetch(`/api/sap/items/search?query=${encodeURIComponent(trimmed)}`);
      if (json.success) {
        const rows = json.data || [];
        setResults(rows);
        setSearched(true);
        onSearchError?.(rows.length === 0);
      } else {
        setResults([]);
        setSearched(true);
        const fieldMessages = json.errors?.map((e) => e.message).filter(Boolean);
        const msg = fieldMessages?.length
          ? fieldMessages.join('; ')
          : json.message || 'Failed to search SAP items';
        setError(status ? `${msg} [HTTP ${status}]` : msg);
        onSearchError?.(true);
      }
      setLoading(false);
    }, 300);
    return () => clearTimeout(timer.current);
  }, [query, onSearchError]);

  async function pick(item) {
    setLoading(true);
    setError('');
    const { json, status } = await apiFetch(
      `/api/sap/items/${encodeURIComponent(item.itemCode)}/details`,
    );
    setLoading(false);

    if (json.success && json.data) {
      const d = json.data;
      onSelect({
        itemCode: d.itemCode || item.itemCode,
        itemName: d.itemName || item.itemName,
        ugpEntry: d.uomGroupEntry ?? item.ugpEntry,
        ugpName: d.uomGroupName || '',
        warehouseCode: d.warehouseCode || item.defaultWarehouse || '',
        warehouseLabel: warehouseLabel(d.warehouseCode, d.warehouseName),
        estimatedUnitPrice:
          d.price != null && d.price !== '' ? String(d.price) : '',
        itemGroupCode: d.itemGroupCode ?? item.itemGroupCode,
        itemGroupName: d.itemGroupName || item.itemGroupName || item.itemGroup,
      });
    } else {
      const msg = json.message || 'Failed to load item details';
      setError(status ? `${msg} [HTTP ${status}]` : msg);
      onSelect({
        itemCode: item.itemCode,
        itemName: item.itemName,
        ugpEntry: item.ugpEntry,
        warehouseCode: item.defaultWarehouse || item.warehouseCode || '',
        warehouseLabel: warehouseLabel(item.defaultWarehouse || item.warehouseCode, ''),
        itemGroupCode: item.itemGroupCode,
        itemGroupName: item.itemGroupName || item.itemGroup,
      });
    }
    setQuery(item.itemCode);
    setFocused(false);
    setSearched(false);
    onSearchError?.(false);
  }

  function handleCreateNew() {
    setFocused(false);
    setSearched(false);
    onCreateNew?.();
  }

  const showDropdown =
    focused && query.trim().length >= 1 && (loading || searched);

  const showCreateOption =
    canCreateNew && !loading && searched && results.length === 0 && !error;

  return (
    <div className="relative">
      <input
        type="text"
        className={inputClassName}
        value={query}
        disabled={disabled}
        placeholder={placeholder}
        onChange={(e) => setQuery(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setTimeout(() => setFocused(false), 200)}
      />
      {error && <p className="mt-1 text-xs text-destructive" role="alert">{error}</p>}
      {showDropdown && (
        <ul className="absolute z-20 mt-1 max-h-48 w-full overflow-auto rounded-xl border border-border bg-card shadow-lg">
          {loading && (
            <li className="px-3 py-2 text-xs text-muted-foreground">{searchingLabel}</li>
          )}
          {!loading && results.length === 0 && (
            <li className="px-3 py-2 text-xs text-muted-foreground">{noResultsMessage}</li>
          )}
          {results.map((item) => (
            <li key={item.itemCode}>
              <button
                type="button"
                className="w-full px-3 py-2 text-start text-sm hover:bg-muted"
                onMouseDown={() => pick(item)}
              >
                <span className="font-medium text-foreground">{item.itemCode}</span>
                <span className="ms-2 text-muted-foreground">{item.itemName}</span>
                {(item.itemGroupName || item.itemGroup) && (
                  <span className="ms-2 text-xs text-muted-foreground">
                    · {item.itemGroupName || item.itemGroup}
                  </span>
                )}
              </button>
            </li>
          ))}
          {showCreateOption && (
            <li className="border-t border-border">
              <button
                type="button"
                className="flex w-full items-center gap-2 px-3 py-2.5 text-start text-sm font-semibold text-primary hover:bg-primary/10"
                onMouseDown={handleCreateNew}
              >
                <span aria-hidden>+</span>
                {createNewLabel}
              </button>
            </li>
          )}
        </ul>
      )}
    </div>
  );
}
