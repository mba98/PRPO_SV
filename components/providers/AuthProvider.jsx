'use client';

import { useEffect } from 'react';
import { useAuthStore } from '@/stores/authStore';

export default function AuthProvider({ initialUser, children }) {
  const setUser = useAuthStore((s) => s.setUser);
  const fetchMe = useAuthStore((s) => s.fetchMe);

  useEffect(() => {
    if (initialUser) {
      setUser(initialUser);
    } else {
      fetchMe();
    }
  }, [initialUser, setUser, fetchMe]);

  return children;
}
