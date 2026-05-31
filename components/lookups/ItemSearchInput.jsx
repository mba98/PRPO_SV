'use client';

import { useEffect, useRef, useState } from 'react';
import { apiFetch } from '@/lib/apiClient';

export default function ItemSearchInput({
  value,
  onSelect,
  disabled,
  onSearchError,
  placeholder = 'Search item code or name',
  searchingLabel = 'Searching…',
  noResultsMessage = 'No results',
  inputClassName = 'input-field',
}) {
  const [query, setQuery] = useState(value?.itemCode || '');
  const [results, setResults] = useState([]);
  const [focused, setFocused] = useState(false);
  const [loading, setLoading] = useState(false);
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
      setError('');
      onSearchError?.(false);
      return undefined;
    }
    timer.current = setTimeout(async () => {
      setLoading(true);
      setError('');
      const { json } = await apiFetch(`/api/sap/items/search?query=${encodeURIComponent(trimmed)}`);
      if (json.success) {
        setResults(json.data || []);
        onSearchError?.((json.data || []).length === 0);
      } else {
        setResults([]);
        const msg = json.message || 'Failed to search SAP items';
        setError(msg);
        onSearchError?.(true);
      }
      setLoading(false);
    }, 300);
    return () => clearTimeout(timer.current);
  }, [query, onSearchError]);

  function pick(item) {
    const uomCode = item.uomCode || item.uom || item.purchaseUom || item.inventoryUom;
    onSelect({
      itemCode: item.itemCode,
      itemName: item.itemName,
      uom: item.uom || item.purchaseUom || item.inventoryUom,
      uomCode,
      itemGroupCode: item.itemGroupCode,
      itemGroupName: item.itemGroupName || item.itemGroup,
    });
    setQuery(item.itemCode);
    setFocused(false);
    setError('');
    onSearchError?.(false);
  }

  const showDropdown =
    focused && query.trim().length >= 1 && (loading || results.length > 0 || (!loading && !error));

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
      {error && <p className="mt-1 text-xs text-destructive">{error}</p>}
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
                <span className="ms-2 text-xs text-muted-foreground">
                  {item.uom}
                  {(item.itemGroupName || item.itemGroup) &&
                    ` · ${item.itemGroupName || item.itemGroup}`}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
