import { z } from 'zod';
import { withAuth } from '@/lib/auth';
import { jsonError, jsonSuccessCached } from '@/lib/apiHelpers';
import { sapLookupFailureResponse } from '@/lib/sapLookupApi';
import {
  getSapExchangeRate,
  SAP_EXCHANGE_RATE_NOT_FOUND_CODE,
  SAP_EXCHANGE_RATE_NOT_FOUND_MESSAGE,
} from '@/lib/sap/exchangeRates.js';
import { normalizeExchangeRateDate } from '@/lib/poExchangeRateUtils.js';
import { normalizeCurrencyCode } from '@/lib/sap/currencyTokens.js';

const PERMS = ['pr.create', 'pr.approve.whs', 'pr.approve.pm', 'po.create', 'view.all'];

const exchangeRateQuerySchema = z.object({
  currency: z.string().min(1).max(10),
  date: z.string().min(1).max(30),
});

async function getHandler(request) {
  const { searchParams } = new URL(request.url);
  let parsed;
  try {
    parsed = exchangeRateQuerySchema.parse({
      currency: searchParams.get('currency') ?? '',
      date: searchParams.get('date') ?? '',
    });
  } catch {
    return jsonError('Currency and document date are required', 'INVALID_QUERY', 400);
  }

  const currency = normalizeCurrencyCode(parsed.currency);
  const date = normalizeExchangeRateDate(parsed.date);
  if (!currency || !date) {
    return jsonError('Currency and document date are required', 'INVALID_QUERY', 400);
  }

  try {
    const data = await getSapExchangeRate(currency, date);
    return jsonSuccessCached({
      currency: data.currency,
      date: data.date,
      rate: data.rate,
      source: data.source === 'SAP_SERVICE_LAYER' || data.source === 'SAP_HANA_ORTT' ? 'SAP' : data.source,
    });
  } catch (err) {
    if (err?.code === SAP_EXCHANGE_RATE_NOT_FOUND_CODE) {
      return jsonError(SAP_EXCHANGE_RATE_NOT_FOUND_MESSAGE, SAP_EXCHANGE_RATE_NOT_FOUND_CODE, 404);
    }
    return sapLookupFailureResponse(
      'sap/exchange-rates',
      err,
      err?.message || 'Failed to load exchange rate from SAP.',
    );
  }
}

export const GET = withAuth(getHandler, PERMS);
