import { pingMongo } from '@/lib/mongodb';
import { pingServiceLayer } from '@/lib/sapServiceLayer';
import { pingHana } from '@/lib/sapHana';
import { pingS3 } from '@/lib/s3';
import { pingSmtp } from '@/lib/email';

async function runProbe(name, probeFn) {
  const start = Date.now();
  try {
    await probeFn();
    return {
      name,
      status: 'up',
      latencyMs: Date.now() - start,
    };
  } catch (err) {
    return {
      name,
      status: 'down',
      latencyMs: Date.now() - start,
      error: err.message || 'Probe failed',
    };
  }
}

/**
 * Run all dependency health probes.
 */
export async function checkAllDependencies() {
  const [mongo, sap, hana, s3, smtp] = await Promise.all([
    runProbe('mongo', pingMongo),
    runProbe('sap', pingServiceLayer),
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
