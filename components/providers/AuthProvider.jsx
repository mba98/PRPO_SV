'use client';

import { useEffect } from 'react';
import { initializeAuthStore, useAuthStore } from '@/stores/authStore';

export default function AuthProvider({ initialUser, children }) {
  initializeAuthStore(initialUser);

  const setUser = useAuthStore((s) => s.setUser);
  const fetchMe = useAuthStore((s) => s.fetchMe);

  useEffect(() => {
    if (initialUser) {
      const current = useAuthStore.getState().user;
      if (current?.id !== initialUser.id) {
        setUser(initialUser);
      }
    } else if (!useAuthStore.getState().user) {
      fetchMe();
    }
  }, [initialUser, setUser, fetchMe]);

  return children;
}
