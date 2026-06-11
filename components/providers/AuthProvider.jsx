'use client';

import { useEffect } from 'react';
import { initializeAuthStore, useAuthStore } from '@/stores/authStore';

export default function AuthProvider({ initialUser, children }) {
  initializeAuthStore(initialUser);

  const fetchMe = useAuthStore((s) => s.fetchMe);

  // Always reload permissions from DB (role changes apply without a new login).
  useEffect(() => {
    fetchMe();
  }, [fetchMe]);

  return children;
}
