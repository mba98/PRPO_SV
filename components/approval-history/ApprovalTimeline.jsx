'use client';

import { useCallback, useEffect, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { apiFetch } from '@/lib/apiClient';
import { AnimatedEmptyState, PortalLoader } from '@/components/ui';
import { useI18n } from '@/lib/hooks/useI18n';

const ACTION_TONE = {
  Created: 'bg-muted0',
  Submitted: 'bg-muted0',
  Updated: 'bg-amber-500',
  Approved: 'bg-emerald-500',
  Rejected: 'border border-destructive/30 bg-destructive/100',
  'SAP Created': 'bg-indigo-500',
  'SAP Failed': 'border border-destructive/30 bg-destructive/100',
  'Email Sent': 'bg-sky-500',
  'Attachment Uploaded': 'bg-violet-500',
  'Comment Added': 'bg-brand-500',
};

const ACTION_I18N_KEY = {
  Created: 'created',
  Submitted: 'submitted',
  Updated: 'updated',
  Approved: 'approved',
  Rejected: 'rejected',
  'SAP Created': 'sapCreated',
  'SAP Failed': 'sapFailed',
  'Email Sent': 'emailSent',
  'Attachment Uploaded': 'attachmentUploaded',
  'Comment Added': 'commentAdded',
};

function dotClass(action) {
  return ACTION_TONE[action] || 'bg-muted-foreground';
}

function historyActionLabel(action, historyDict) {
  const key = ACTION_I18N_KEY[action];
  if (key && historyDict[key]) return historyDict[key];
  return action;
}

export default function ApprovalTimeline({ documentType, documentId }) {
  const { history: historyI18n, isRtl } = useI18n();
  const shouldReduceMotion = useReducedMotion();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!documentType || !documentId) return;
    setLoading(true);
    setError('');
    const { json } = await apiFetch(
      `/api/approval-history/${encodeURIComponent(documentType)}/${encodeURIComponent(documentId)}`,
    );
    if (json.success) {
      setItems(json.data);
    } else {
      setError(json.message || 'Failed to load history');
    }
    setLoading(false);
  }, [documentType, documentId]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return (
      <div className="flex min-h-[180px] items-center justify-center">
        <PortalLoader />
      </div>
    );
  }

  if (error) {
    return (
      <p
        role="alert"
        className="rounded-md border border-rose-200 border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
      >
        {error}
      </p>
    );
  }

  if (items.length === 0) {
    return (
      <AnimatedEmptyState
        title={historyI18n.emptyTitle}
        description={historyI18n.emptyDescription}
      />
    );
  }

  const containerAnim = shouldReduceMotion
    ? {}
    : { initial: { opacity: 0 }, animate: { opacity: 1 }, transition: { duration: 0.2 } };

  const linePos = isRtl ? 'right-[18px]' : 'left-[18px]';
  const dotPos = isRtl ? 'right-[12px]' : 'left-[12px]';
  const itemPad = isRtl ? 'pr-10 text-start' : 'pl-10 text-start';

  return (
    <motion.section {...containerAnim} className="card">
      <ol className="relative">
        <span
          aria-hidden
          className={`absolute top-0 bottom-0 w-px bg-border ${linePos}`}
        />
        {items.map((h, idx) => {
          const itemAnim = shouldReduceMotion
            ? {}
            : {
                initial: { opacity: 0, y: 6 },
                animate: { opacity: 1, y: 0 },
                transition: { duration: 0.18, delay: idx * 0.03 },
              };
          return (
            <motion.li key={h.id} {...itemAnim} className={`relative mb-6 last:mb-0 ${itemPad}`}>
              <span
                className={`absolute ${dotPos} mt-1.5 h-4 w-4 rounded-full border-2 border-background ring-4 ring-background ${dotClass(
                  h.action,
                )}`}
              />
              <p className="text-sm font-medium text-foreground">
                {historyActionLabel(h.action, historyI18n)}
                {h.stepName ? ` — ${h.stepName}` : ''}
              </p>
              <p className="text-xs text-muted-foreground">
                {h.actionBy || 'System'}
                {h.actionByRole ? ` · ${h.actionByRole}` : ''}
                {h.actionDate ? ` · ${new Date(h.actionDate).toLocaleString()}` : ''}
              </p>
              {h.comment && (
                <p className="mt-1 whitespace-pre-wrap text-sm text-foreground">{h.comment}</p>
              )}
              {(h.previousStatus || h.newStatus) && h.previousStatus !== h.newStatus && (
                <p className="mt-1 text-xs text-muted-foreground">
                  {h.previousStatus || '—'} → {h.newStatus || '—'}
                </p>
              )}
              {h.attachments?.length > 0 && (
                <ul className="mt-2 flex flex-wrap gap-2">
                  {h.attachments.map((a) => (
                    <li
                      key={a.id}
                      className="rounded bg-muted px-2 py-0.5 text-xs text-foreground"
                      dir="auto"
                    >
                      {a.fileName}
                    </li>
                  ))}
                </ul>
              )}
            </motion.li>
          );
        })}
      </ol>
    </motion.section>
  );
}
