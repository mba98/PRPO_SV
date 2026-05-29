'use client';

import { useMemo } from 'react';
import { useAuthStore } from '@/stores/authStore';
import { getEffectivePermissions } from '@/lib/effectivePermissions';

/**
 * Stable effective permissions for client components (avoids zustand selector returning new arrays).
 */
export function useEffectivePermissions() {
  const user = useAuthStore((s) => s.user);
  return useMemo(() => getEffectivePermissions(user), [user]);
}
