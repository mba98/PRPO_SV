'use client';

import { useEffect } from 'react';
import { initializeAuthStore, useAuthStore } from '@/stores/authStore';

export default function AuthProvider({ initialUser, children }) {
  initializeAuthStore(initialUser);

  const fetchMe = useAuthStore((s) => s.fetchMe);

  // Refresh permissions from DB without blocking UI when layout already seeded user.
  useEffect(() => {
    fetchMe({ background: Boolean(initialUser) });
  }, [fetchMe, initialUser]);

  return children;
}
