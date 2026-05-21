'use client';

import { create } from 'zustand';

export const useAuthStore = create((set, get) => ({
  user: null,
  loading: true,
  error: null,

  setUser: (user) => set({ user, loading: false, error: null }),

  fetchMe: async () => {
    set({ loading: true, error: null });
    try {
      const res = await fetch('/api/auth/me', { credentials: 'include' });
      const json = await res.json();
      if (!json.success) {
        set({ user: null, loading: false, error: json.message });
        return null;
      }
      set({ user: json.data.user, loading: false, error: null });
      return json.data.user;
    } catch (err) {
      set({ user: null, loading: false, error: err.message });
      return null;
    }
  },

  logout: async () => {
    await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
    set({ user: null, loading: false, error: null });
  },

  hasPermission: (permission) => {
    const { user } = get();
    return user?.permissions?.includes(permission) ?? false;
  },

  hasAnyPermission: (permissions) => {
    const { user } = get();
    if (!permissions?.length) return true;
    return permissions.some((p) => user?.permissions?.includes(p));
  },
}));
