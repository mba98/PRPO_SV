import { useEffect, useRef } from 'react';

/**
 * Runs an async loader when deps change; ignores stale results after unmount or re-run.
 */
export function useAbortableLoad(loadFn, deps) {
  const loadRef = useRef(loadFn);
  loadRef.current = loadFn;

  useEffect(() => {
    let cancelled = false;

    (async () => {
      await loadRef.current(() => cancelled);
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- caller supplies stable deps
  }, deps);
}
