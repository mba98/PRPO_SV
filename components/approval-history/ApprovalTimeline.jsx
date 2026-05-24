'use client';

import { useCallback, useEffect, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { apiFetch } from '@/lib/apiClient';
import {
  AnimatedEmptyState,
  AnimatedSkeletonLoader,
} from '@/components/ui';

const ACTION_TONE = {
  Created: 'bg-slate-500',
  Submitted: 'bg-slate-500',
  Updated: 'bg-amber-500',
  Approved: 'bg-emerald-500',
  Rejected: 'bg-rose-500',
  'SAP Created': 'bg-indigo-500',
  'SAP Failed': 'bg-rose-500',
  'Email Sent': 'bg-sky-500',
  'Attachment Uploaded': 'bg-violet-500',
  'Comment Added': 'bg-brand-500',
};

function dotClass(action) {
  return ACTION_TONE[action] || 'bg-slate-400';
}

export default function ApprovalTimeline({ documentType, documentId }) {
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
    return <AnimatedSkeletonLoader variant="timeline" steps={4} />;
  }

  if (error) {
    return (
      <p
        role="alert"
        className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700"
      >
        {error}
      </p>
    );
  }

  if (items.length === 0) {
    return (
      <AnimatedEmptyState
        title="No history yet"
        description="Actions on this document will appear here as a timeline."
      />
    );
  }

  const containerAnim = shouldReduceMotion
    ? {}
    : { initial: { opacity: 0 }, animate: { opacity: 1 }, transition: { duration: 0.2 } };

  return (
    <motion.section {...containerAnim} className="card">
      <ol className="relative border-l border-slate-200 pl-6">
        {items.map((h, idx) => {
          const itemAnim = shouldReduceMotion
            ? {}
            : {
                initial: { opacity: 0, y: 6 },
                animate: { opacity: 1, y: 0 },
                transition: { duration: 0.18, delay: idx * 0.03 },
              };
          return (
            <motion.li key={h.id} {...itemAnim} className="mb-6 ml-2">
              <span
                className={`absolute -left-[9px] mt-1.5 h-4 w-4 rounded-full border-2 border-white ring-2 ring-slate-100 ${dotClass(
                  h.action,
                )}`}
              />
              <p className="text-sm font-medium text-slate-900">
                {h.action}
                {h.stepName ? ` — ${h.stepName}` : ''}
              </p>
              <p className="text-xs text-slate-500">
                {h.actionBy || 'System'}
                {h.actionByRole ? ` · ${h.actionByRole}` : ''}
                {h.actionDate ? ` · ${new Date(h.actionDate).toLocaleString()}` : ''}
              </p>
              {h.comment && (
                <p className="mt-1 whitespace-pre-wrap text-sm text-slate-700">
                  {h.comment}
                </p>
              )}
              {(h.previousStatus || h.newStatus) &&
                h.previousStatus !== h.newStatus && (
                  <p className="mt-1 text-xs text-slate-400">
                    {h.previousStatus || '—'} → {h.newStatus || '—'}
                  </p>
                )}
              {h.attachments?.length > 0 && (
                <ul className="mt-2 flex flex-wrap gap-2">
                  {h.attachments.map((a) => (
                    <li
                      key={a.id}
                      className="rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-700"
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
