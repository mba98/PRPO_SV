import { pingMongo } from '@/lib/mongodb';
import { probeServiceLayer, getSapConfig } from '@/lib/sapServiceLayer';
import { pingHana } from '@/lib/sapHana';
import { pingS3 } from '@/lib/s3';
import { pingSmtp } from '@/lib/email';
import { getSapErrorMessage } from '@/lib/sap/sapErrors.js';

async function runProbe(name, probeFn) {
  const start = Date.now();
  try {
    const data = await probeFn();
    const latencyMs = Date.now() - start;
    return {
      name,
      status: 'up',
      latencyMs,
      ...(data && typeof data === 'object' ? data : {}),
    };
  } catch (err) {
    const latencyMs = Date.now() - start;
    const error = getSapErrorMessage(err) || err.message || 'Probe failed';
    const meta = name === 'sap' ? { host: getSapConfig().host, companyDb: getSapConfig().companyDb } : {};
    return {
      name,
      status: 'down',
      latencyMs,
      error,
      ...meta,
    };
  }
}

/**
 * Run all dependency health probes.
 */
export async function checkAllDependencies() {
  const [mongo, sap, hana, s3, smtp] = await Promise.all([
    runProbe('mongo', pingMongo),
    runProbe('sap', probeServiceLayer),
    runProbe('hana', pingHana),
    runProbe('s3', pingS3),
    runProbe('smtp', pingSmtp),
  ]);

  const dependencies = { mongo, sap, hana, s3, smtp };
  const allUp = Object.values(dependencies).every((d) => d.status === 'up');

  return {
    success: allUp,
    dependencies,
    checkedAt: new Date().toISOString(),
  };
}
