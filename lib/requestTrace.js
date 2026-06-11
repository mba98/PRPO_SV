import { AsyncLocalStorage } from 'node:async_hooks';
import { randomBytes } from 'node:crypto';
import { isPerfLogEnabled } from '@/lib/perfLog.js';

const traceStore = new AsyncLocalStorage();

export function runWithRequestTrace(label, fn) {
  const enabled = isPerfLogEnabled();
  if (!enabled) return fn();

  const id = randomBytes(3).toString('hex');
  const startedAt = performance.now();
  const marks = {};

  const trace = {
    id,
    label,
    mark(phase) {
      marks[phase] = Math.round(performance.now() - startedAt);
    },
    end(extra = '') {
      const total = Math.round(performance.now() - startedAt);
      const phases = Object.entries(marks)
        .map(([k, v]) => `${k} ${v}ms`)
        .join(', ');
      console.log(
        `[req ${id}] ${label} total ${total}ms${phases ? ` | ${phases}` : ''}${extra ? ` | ${extra}` : ''}`,
      );
    },
  };

  return traceStore.run(trace, fn);
}

export function getRequestTrace() {
  return traceStore.getStore() || null;
}

export function traceMark(phase) {
  getRequestTrace()?.mark(phase);
}

export function traceEnd(extra) {
  getRequestTrace()?.end(extra);
}
