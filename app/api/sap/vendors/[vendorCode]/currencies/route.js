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
        { code: 'NO_CURRENCIES', message: 'No currencies are configured for this Vendor' },
        'No currencies are configured for this Vendor',
      );
    }
    return jsonSuccessCached({
      vendorCode: config.vendorCode,
      vendorName: config.vendorName,
      currencyMode: config.currencyMode,
      currency: config.currency,
      defaultCurrency: config.defaultCurrency,
      allowedCurrencies: (config.allowedCurrencies || []).map(({ code, name }) => ({
        code,
        name: name || code,
      })),
    });
  } catch (err) {
    const message =
      err?.code === 'NO_CURRENCIES'
        ? 'No currencies are configured for this Vendor'
        : err?.message || 'Vendor currency configuration could not be loaded from SAP';
    return sapLookupFailureResponse('sap/vendors/currencies', err, message);
  }
}

export const GET = withAuth(getHandler, PERMS);
