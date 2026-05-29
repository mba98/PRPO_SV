'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import EmailLogsManager from '@/components/settings/EmailLogsManager';
import SapIntegrationLogsManager from '@/components/settings/SapIntegrationLogsManager';

const TABS = [
  { id: 'email', label: 'Email logs' },
  { id: 'sap', label: 'SAP integration logs' },
];

export default function SystemLogsManager() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const log = searchParams.get('log') || 'email';

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-1 rounded-lg border border-border bg-muted p-1">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => router.push(`/settings/system-logs?log=${t.id}`)}
            className={`rounded-md px-3 py-1.5 text-sm font-medium ${
              log === t.id ? 'bg-card text-primary shadow-sm' : 'text-muted-foreground'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
      {log === 'sap' ? <SapIntegrationLogsManager /> : <EmailLogsManager />}
    </div>
  );
}
