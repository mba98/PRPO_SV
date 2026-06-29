import { withAuth } from '@/lib/auth';
import { jsonSuccessCached } from '@/lib/apiHelpers';
import { sapLookupFailureResponse } from '@/lib/sapLookupApi';
import { getVendorCurrencyConfig } from '@/lib/sap/vendorCurrencies.js';

const PERMS = ['pr.create', 'pr.approve.whs', 'pr.approve.pm', 'po.create', 'view.all'];

async function getHandler(_request, { params }) {
  const vendorCode = String(params.vendorCode || '').trim();
  if (!vendorCode) {
    return sapLookupFailureResponse(
      'sap/vendors/currencies',
      { message: 'Vendor code is required' },
      'Vendor code is required',
    );
  }

  try {
    const config = await getVendorCurrencyConfig(vendorCode);
    if (config?.error === 'NO_CURRENCIES') {
      return sapLookupFailureResponse(
        'sap/vendors/currencies',
        { code: 'NO_CURRENCIES', message: 'Failed to load Vendor currencies from SAP.' },
        'Failed to load Vendor currencies from SAP.',
      );
    }
    return jsonSuccessCached({
      vendorCode: config.vendorCode,
      vendorName: config.vendorName,
      currencyMode: config.currencyMode,
      bpCurrency: config.bpCurrency ?? config.currency ?? null,
      currency: config.currency ?? config.bpCurrency ?? null,
      defaultCurrency: config.defaultCurrency,
      companyLocalCurrency: config.companyLocalCurrency || null,
      companySystemCurrency: config.companySystemCurrency || null,
      allowedCurrencies: (config.allowedCurrencies || []).map(({ code, name, sources }) => ({
        code,
        name: name || code,
        sources: sources || [],
      })),
    });
  } catch (err) {
    const message = err?.message || 'Failed to load Vendor currencies from SAP.';
    return sapLookupFailureResponse('sap/vendors/currencies', err, message);
  }
}

export const GET = withAuth(getHandler, PERMS);
