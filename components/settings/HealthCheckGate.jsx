'use client';

import { useAuthStore } from '@/stores/authStore';
import HealthCheckPanel from './HealthCheckPanel';

export default function HealthCheckGate() {
  const hasPermission = useAuthStore((s) => s.hasPermission('admin.settings'));

  if (!hasPermission) {
    return null;
  }

  return <HealthCheckPanel />;
}
