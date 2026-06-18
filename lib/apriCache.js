import { cacheDeleteByPrefix } from '@/lib/memoryCache.js';

export function invalidateApriWorkflowCaches() {
  cacheDeleteByPrefix('nav-counts:');
  cacheDeleteByPrefix('approval-steps:APRI');
}
