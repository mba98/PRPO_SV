'use client';

import { useEffect, useRef, useState } from 'react';
import { apiFetch } from '@/lib/apiClient';

function warehouseLabel(code, name) {
  const c = code != null ? String(code).trim() : '';
  if (!c) return '';
  const n = name != null ? String(name).trim() : '';
  return n ? `${c} — ${n}` : c;
}

function buildWarehouseFields(d, item) {
  const code = (d?.warehouseCode || item?.warehouseCode || item?.defaultWarehouse || '')
    .toString()
    .trim();
  if (!code) {
    return {};
  }
  const label =
    (d?.warehouseLabel || '').trim() ||
    warehouseLabel(d?.warehouseCode || code, d?.warehouseName || item?.warehouseName) ||
    code;
  return {
    warehouseCode: code,
    warehouseName: (d?.warehouseName || item?.warehouseName || '').toString().trim(),
    warehouseLabel: label,
  };
}

function ItemDetailSpinner() {
  return (
    <span
      className="inline-block h-3.5 w-3.5 shrink-0 animate-spin rounded-full border-2 border-primary border-t-transparent"
      aria-hidden
    />
  );
}

export default function ItemSearchInput({
  value,
  onSelect,
  disabled,
  onSearchError,
  onDetailLoadingChange,
  placeholder = 'Search item code or name',
  searchingLabel = 'Searching…',
  loadingItemDetailsLabel = 'Loading item details…',
  noResultsMessage = 'No matching items found',
  createNewLabel = 'Create New Item',
  canCreateNew = false,
  onCreateNew,
  inputClassName = 'input-field',
}) {
  const [query, setQuery] = useState(value?.itemCode || '');
  const [results, setResults] = useState([]);
  const [focused, setFocused] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState('');
  const timer = useRef(null);

  useEffect(() => {
    if (value?.itemCode) setQuery(value.itemCode);
  }, [value?.itemCode]);

  useEffect(() => {
    onDetailLoadingChange?.(detailLoading);
  }, [detailLoading, onDetailLoadingChange]);

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    const trimmed = query.trim();
    if (trimmed.length < 1) {
      setResults([]);
      setSearchLoading(false);
      setSearched(false);
      setError('');
      onSearchError?.(false);
      return undefined;
    }
    timer.current = setTimeout(async () => {
      setSearchLoading(true);
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
      setSearchLoading(false);
    }, 300);
    return () => clearTimeout(timer.current);
  }, [query, onSearchError]);

  function emitSelection(item, d) {
    const warehouse = buildWarehouseFields(d, item);
    const ugpEntry = d?.uomGroupEntry ?? d?.ugpEntry ?? item.ugpEntry ?? '';
    const ugpName = d?.uomGroupName || d?.uom || '';
    const selection = {
      itemCode: (d?.itemCode || item.itemCode || '').trim(),
      itemName: d?.itemName || item.itemName || '',
      ugpEntry,
      ugpName,
      estimatedUnitPrice:
        d?.price != null && d?.price !== '' ? String(d.price) : '',
      itemGroupCode: d?.itemGroupCode ?? item.itemGroupCode,
      itemGroupName: d?.itemGroupName || item.itemGroupName || item.itemGroup,
      ...warehouse,
    };

    console.log('[item-select] selected item', item);
    console.log('[item-select] returned warehouse', {
      warehouseCode: d?.warehouseCode,
      warehouseName: d?.warehouseName,
      warehouseLabel: d?.warehouseLabel,
    });
    console.log('[item-select] assigned warehouse', warehouse);

    onSelect(selection);
  }

  async function pick(item) {
    setDetailLoading(true);
    setError('');
    try {
      const { json, status } = await apiFetch(
        `/api/sap/items/${encodeURIComponent(item.itemCode)}/details`,
      );

      if (json.success && json.data) {
        emitSelection(item, json.data);
      } else {
        const msg = json.message || 'Failed to load item details';
        setError(status ? `${msg} [HTTP ${status}]` : msg);
        emitSelection(item, null);
      }
      setQuery(item.itemCode);
      setFocused(false);
      setSearched(false);
      onSearchError?.(false);
    } finally {
      setDetailLoading(false);
    }
  }

  function handleCreateNew() {
    setFocused(false);
    setSearched(false);
    onCreateNew?.();
  }

  const showDropdown =
    focused && query.trim().length >= 1 && (searchLoading || searched);

  const showCreateOption =
    canCreateNew && !searchLoading && searched && results.length === 0 && !error;

  const inputDisabled = disabled || detailLoading;

  return (
    <div className="relative">
      <div className="relative flex items-center gap-2">
        <input
          type="text"
          className={[inputClassName, 'w-full'].filter(Boolean).join(' ')}
          value={query}
          disabled={inputDisabled}
          placeholder={placeholder}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setTimeout(() => setFocused(false), 200)}
          aria-busy={detailLoading}
        />
        {detailLoading && (
          <span className="pointer-events-none absolute end-2 top-1/2 flex -translate-y-1/2 items-center gap-1.5 text-xs text-muted-foreground">
            <ItemDetailSpinner />
          </span>
        )}
      </div>
      {detailLoading && (
        <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground" role="status">
          <ItemDetailSpinner />
          {loadingItemDetailsLabel}
        </p>
      )}
      {error && <p className="mt-1 text-xs text-destructive" role="alert">{error}</p>}
      {showDropdown && (
        <ul className="absolute z-20 mt-1 max-h-48 w-full overflow-auto rounded-xl border border-border bg-card shadow-lg">
          {searchLoading && (
            <li className="px-3 py-2 text-xs text-muted-foreground">{searchingLabel}</li>
          )}
          {!searchLoading && results.length === 0 && (
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
