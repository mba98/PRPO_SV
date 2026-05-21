'use client';

import { useEffect, useRef, useState } from 'react';
import { apiFetch } from '@/lib/apiClient';

export default function ItemSearchInput({ value, onSelect, disabled, onSearchError }) {
  const [query, setQuery] = useState(value?.itemCode || '');
  const [results, setResults] = useState([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const timer = useRef(null);

  useEffect(() => {
    if (value?.itemCode) setQuery(value.itemCode);
  }, [value?.itemCode]);

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    if (!query || query.length < 1) {
      setResults([]);
      setError('');
      return undefined;
    }
    timer.current = setTimeout(async () => {
      setLoading(true);
      setError('');
      const { json } = await apiFetch(`/api/sap/items/search?query=${encodeURIComponent(query)}`);
      if (json.success) {
        setResults(json.data || []);
        if ((json.data || []).length === 0) onSearchError?.(true);
        else onSearchError?.(false);
      } else {
        setResults([]);
        const msg = json.message || 'Failed to search SAP items';
        setError(msg);
        onSearchError?.(true);
      }
      setLoading(false);
      setOpen(true);
    }, 300);
    return () => clearTimeout(timer.current);
  }, [query, onSearchError]);

  function pick(item) {
    onSelect({
      itemCode: item.itemCode,
      itemName: item.itemName,
      uom: item.uom || item.purchaseUom || item.inventoryUom,
      itemGroupCode: item.itemGroupCode,
      itemGroupName: item.itemGroupName || item.itemGroup,
    });
    setQuery(item.itemCode);
    setOpen(false);
    setError('');
    onSearchError?.(false);
  }

  return (
    <div className="relative">
      <input
        type="text"
        className="input-field"
        value={query}
        disabled={disabled}
        placeholder="Search item code or name"
        onChange={(e) => setQuery(e.target.value)}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 200)}
      />
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
      {open && (results.length > 0 || loading) && (
        <ul className="absolute z-20 mt-1 max-h-48 w-full overflow-auto rounded-md border border-slate-200 bg-white shadow-lg">
          {loading && <li className="px-3 py-2 text-xs text-slate-500">Searching…</li>}
          {results.map((item) => (
            <li key={item.itemCode}>
              <button
                type="button"
                className="w-full px-3 py-2 text-left text-sm hover:bg-slate-50"
                onMouseDown={() => pick(item)}
              >
                <span className="font-medium text-slate-900">{item.itemCode}</span>
                <span className="ml-2 text-slate-600">{item.itemName}</span>
                <span className="ml-2 text-xs text-slate-400">
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
