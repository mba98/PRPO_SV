'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { apiFetch } from '@/lib/apiClient';
import SapLookupCombobox from './SapLookupCombobox';

let vendorListCache = null;

async function fetchVendors(query, limit = 100) {
  const params = new URLSearchParams({ limit: String(limit) });
  if (query?.trim()) {
    params.set('query', query.trim());
  }
  const { json } = await apiFetch(`/api/sap/vendors?${params}`);
  if (!json.success) {
    throw new Error(json.message || 'Failed to load vendors');
  }
  return json.data || [];
}

function vendorDisplayLabel(v) {
  return `${v.cardCode} — ${v.cardName || ''}`;
}

function VendorOptionRow({ vendor, selected, onPick }) {
  return (
    <li key={vendor.cardCode}>
      <button
        type="button"
        className={[
          'w-full px-3 py-2.5 text-start transition-colors hover:bg-primary/10',
          selected ? 'bg-primary/5' : '',
        ].join(' ')}
        onMouseDown={(e) => {
          e.preventDefault();
          onPick(vendor);
        }}
      >
        <span className="font-mono text-sm font-bold text-primary">{vendor.cardCode}</span>
        {vendor.cardName ? (
          <span className="ms-2 text-sm text-foreground">{vendor.cardName}</span>
        ) : null}
        {vendor.currency ? (
          <span className="ms-2 text-xs text-muted-foreground">{vendor.currency}</span>
        ) : null}
      </button>
    </li>
  );
}

function VendorLookupSelect({
  valueCode = '',
  valueLabel = '',
  onSelect,
  disabled = false,
  placeholder = 'Search vendor',
  emptyMessage = 'No vendors found',
  loadingMessage = 'Loading vendors…',
  failedMessage = 'Failed to load vendors',
  inputClassName = 'input w-full',
  debounceMs = 250,
  listLimit = 100,
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

  const loadVendors = useCallback(
    async (searchQuery) => {
      const trimmed = searchQuery.trim();
      setLoading(true);
      setError('');
      try {
        if (!trimmed && vendorListCache) {
          setResults(vendorListCache);
          setFetched(true);
          setLoading(false);
          return;
        }
        const items = await fetchVendors(trimmed, listLimit);
        if (!trimmed) {
          vendorListCache = items;
        }
        setResults(items);
        setFetched(true);
      } catch (err) {
        setResults([]);
        setFetched(true);
        setError(err.message || failedMessage);
      }
      setLoading(false);
    },
    [failedMessage, listLimit],
  );

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    if (disabled || !focused) return undefined;

    const trimmed = query.trim();
    if (!trimmed) {
      loadVendors('');
      return undefined;
    }

    timer.current = setTimeout(() => loadVendors(trimmed), debounceMs);
    return () => clearTimeout(timer.current);
  }, [query, focused, disabled, loadVendors, debounceMs]);

  function pick(vendor) {
    const code = vendor.cardCode;
    const label = vendorDisplayLabel(vendor);
    onSelect(code, label, vendor);
    setQuery(label);
    setFocused(false);
    setError('');
  }

  function clearSelection() {
    onSelect('', '', null);
    setQuery('');
    setResults(vendorListCache || []);
    setFetched(Boolean(vendorListCache?.length));
  }

  const showDropdown = focused && (loading || fetched || error);

  return (
    <div className="relative">
      <input
        type="text"
        className={inputClassName}
        value={query}
        disabled={disabled}
        placeholder={placeholder}
        autoComplete="off"
        onChange={(e) => {
          setQuery(e.target.value);
          if (!e.target.value) clearSelection();
        }}
        onFocus={() => setFocused(true)}
        onBlur={() => setTimeout(() => setFocused(false), 200)}
      />
      {error && (
        <p className="mt-1 text-xs text-destructive" role="alert">
          {error}
        </p>
      )}
      {showDropdown && (
        <ul
          className="absolute z-50 mt-1 max-h-60 w-full overflow-y-auto rounded-2xl border border-border bg-card py-1 shadow-xl shadow-black/5"
          role="listbox"
        >
          {loading && (
            <li className="px-3 py-2 text-xs text-muted-foreground">{loadingMessage}</li>
          )}
          {!loading && !error && results.length === 0 && (
            <li className="px-3 py-2 text-xs text-muted-foreground">{emptyMessage}</li>
          )}
          {!loading &&
            !error &&
            results.map((vendor) => (
              <VendorOptionRow
                key={vendor.cardCode}
                vendor={vendor}
                selected={valueCode === vendor.cardCode}
                onPick={pick}
              />
            ))}
        </ul>
      )}
    </div>
  );
}

export default function VendorSelect({
  valueCode,
  valueLabel,
  onSelect,
  disabled,
  placeholder = 'Search vendor',
  emptyMessage = 'No results',
  inputClassName = 'input-field',
  loadingMessage = 'Loading…',
  failedMessage = 'Failed to load vendors',
  minChars = 1,
  loadAllOnFocus = false,
  debounceMs = 250,
  listLimit = 100,
}) {
  if (loadAllOnFocus) {
    return (
      <VendorLookupSelect
        valueCode={valueCode}
        valueLabel={valueLabel}
        onSelect={onSelect}
        disabled={disabled}
        placeholder={placeholder}
        emptyMessage={emptyMessage}
        loadingMessage={loadingMessage}
        failedMessage={failedMessage}
        inputClassName={inputClassName}
        debounceMs={debounceMs}
        listLimit={listLimit}
      />
    );
  }

  return (
    <SapLookupCombobox
      endpoint="/api/sap/vendors"
      valueCode={valueCode}
      valueLabel={valueLabel}
      onSelect={(code, label) => onSelect(code, label)}
      getCode={(v) => v.cardCode}
      getLabel={vendorDisplayLabel}
      placeholder={placeholder}
      disabled={disabled}
      minChars={minChars}
      emptyMessage={emptyMessage}
      inputClassName={inputClassName}
      loadingMessage={loadingMessage}
    />
  );
}
