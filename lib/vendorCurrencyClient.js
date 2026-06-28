import { apiFetch } from '@/lib/apiClient';

export async function fetchVendorCurrencyConfig(vendorCode, options = {}) {
  const code = String(vendorCode || '').trim();
  if (!code) {
    throw new Error('Vendor code is required');
  }
  const { json } = await apiFetch(
    `/api/sap/vendors/${encodeURIComponent(code)}/currencies`,
    {
      signal: options.signal,
      dedupe: options.dedupe,
      source: options.source || 'vendor-currency-config',
    },
  );
  if (!json.success) {
    throw new Error(json.message || 'Vendor currency configuration could not be loaded from SAP');
  }
  return json.data;
}
