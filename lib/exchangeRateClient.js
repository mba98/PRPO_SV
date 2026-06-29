import { apiFetch } from '@/lib/apiClient';

export async function fetchSapExchangeRate(currency, date, options = {}) {
  const code = String(currency || '').trim();
  const rateDate = String(date || '').trim();
  if (!code || !rateDate) {
    throw new Error('Currency and document date are required');
  }
  const params = new URLSearchParams({ currency: code, date: rateDate });
  const { json } = await apiFetch(`/api/sap/exchange-rates?${params}`, {
    signal: options.signal,
    dedupe: options.dedupe,
    source: options.source || 'sap-exchange-rate',
  });
  if (!json.success) {
    throw new Error(
      json.message ||
        'No SAP exchange rate is configured for the selected currency and document date.',
    );
  }
  return json.data;
}
