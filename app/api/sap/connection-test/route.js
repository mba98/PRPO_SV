import { withAuth } from '@/lib/auth';
import { probeServiceLayer } from '@/lib/sapServiceLayer';
import { jsonSuccess, jsonError, handleServiceError } from '@/lib/apiHelpers';
import { getSapErrorMessage } from '@/lib/sap/sapErrors.js';

async function postHandler() {
  try {
    const data = await probeServiceLayer();
    return jsonSuccess({
      companyDb: data.companyDb,
      serviceLayerReachable: data.serviceLayerReachable,
      latencyMs: data.latencyMs,
      host: data.host,
    });
  } catch (err) {
    const message = getSapErrorMessage(err);
    return jsonError(message, err.code || 'SAP_CONNECTION_FAILED', 503);
  }
}

export const POST = withAuth(postHandler, ['admin.settings']);
export const GET = POST;
