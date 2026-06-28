import { apiFetch } from '@/lib/apiClient';

export async function fetchVendorCurrencyConfig(vendorCode) {
  const code = String(vendorCode || '').trim();
  if (!code) {
    throw new Error('Vendor code is required');
  }
  const { json } = await apiFetch(
    `/api/sap/vendors/${encodeURIComponent(code)}/currencies`,
  );
  if (!json.success) {
    throw new Error(json.message || 'Vendor currency configuration could not be loaded from SAP');
  }
  return json.data;
}
