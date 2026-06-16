'use client';

import { create } from 'zustand';
import {
  getEffectivePermissions,
  userHasAnyEffectivePermission,
  userHasEffectivePermission,
} from '@/lib/effectivePermissions';
import { clearPortalDocumentCache } from '@/lib/documentClientCache';

export const useAuthStore = create((set, get) => ({
  user: null,
  loading: true,
  error: null,

  setUser: (user) => set({ user, loading: false, error: null }),

  fetchMe: async ({ background = false } = {}) => {
    if (!background) {
      set({ loading: true, error: null });
    }
    try {
      const res = await fetch('/api/auth/me', { credentials: 'include' });
      const json = await res.json();
      if (!json.success) {
        set({ user: null, loading: false, error: json.message });
        clearPortalDocumentCache();
        return null;
      }
      const prev = get().user;
      const nextUser = json.data.user;
      if (
        prev?.id !== nextUser?.id ||
        !permissionsEqual(prev?.permissions, nextUser?.permissions)
      ) {
        clearPortalDocumentCache();
      }
      set({ user: nextUser, loading: false, error: null });
      return nextUser;
    } catch (err) {
      set({ user: null, loading: false, error: err.message });
      return null;
    }
  },

  logout: async () => {
    await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
    clearPortalDocumentCache();
    set({ user: null, loading: false, error: null });
  },

  hasPermission: (permission) => {
    const { user } = get();
    return userHasEffectivePermission(user, permission);
  },

  hasAnyPermission: (permissions) => {
    const { user } = get();
    if (!permissions?.length) return true;
    return userHasAnyEffectivePermission(user, permissions);
  },

  getEffectivePermissions: () => getEffectivePermissions(get().user),
}));

function permissionsEqual(a = [], b = []) {
  if (a.length !== b.length) return false;
  const sortedA = [...a].sort();
  const sortedB = [...b].sort();
  return sortedA.every((perm, index) => perm === sortedB[index]);
}

/**
 * Seed the auth store from the server layout before client hydration.
 * AuthProvider then calls fetchMe() to load the latest role permissions from DB.
 */
export function initializeAuthStore(user) {
  if (!user) return;
  const state = useAuthStore.getState();
  if (state.user?.id !== user.id) {
    clearPortalDocumentCache();
  } else if (!permissionsEqual(state.user?.permissions, user.permissions)) {
    clearPortalDocumentCache();
  } else if (
    state.user?.id === user.id &&
    permissionsEqual(state.user?.permissions, user.permissions)
  ) {
    return;
  }
  useAuthStore.setState({ user, loading: false, error: null });
}
