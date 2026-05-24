'use client';

import { useCallback, useEffect, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { apiFetch } from '@/lib/apiClient';
import {
  AnimatedEmptyState,
  AnimatedSkeletonLoader,
} from '@/components/ui';

const COMMENT_MAX_LENGTH = 2000;

export default function CommentsPanel({
  documentType,
  documentId,
  canPost = true,
}) {
  const shouldReduceMotion = useReducedMotion();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [text, setText] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    if (!documentType || !documentId) return;
    setLoading(true);
    setError('');
    const { json } = await apiFetch(
      `/api/comments/${encodeURIComponent(documentType)}/${encodeURIComponent(documentId)}`,
    );
    if (json.success) {
      setItems(json.data);
    } else {
      setError(json.message || 'Failed to load comments');
    }
    setLoading(false);
  }, [documentType, documentId]);

  useEffect(() => {
    load();
  }, [load]);

  async function submit(e) {
    e.preventDefault();
    const trimmed = text.trim();
    if (!trimmed || submitting) return;
    setSubmitting(true);
    setError('');
    const { json } = await apiFetch('/api/comments', {
      method: 'POST',
      body: JSON.stringify({
        documentType,
        documentId,
        comment: trimmed,
      }),
    });
    setSubmitting(false);
    if (json.success) {
      setText('');
      await load();
    } else {
      setError(json.message || 'Failed to post comment');
    }
  }

  const listAnim = shouldReduceMotion
    ? {}
    : {
        initial: { opacity: 0 },
        animate: { opacity: 1 },
        transition: { duration: 0.18 },
      };

  const remaining = COMMENT_MAX_LENGTH - text.length;
  const isOverLimit = remaining < 0;

  return (
    <section className="card space-y-4">
      <header className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Comments</h2>
          <p className="text-xs text-slate-500">
            {items.length} comment{items.length === 1 ? '' : 's'}
          </p>
        </div>
      </header>

      {canPost && (
        <form onSubmit={submit} className="space-y-2">
          <label className="sr-only" htmlFor="new-comment">
            Add a comment
          </label>
          <textarea
            id="new-comment"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Add a comment…"
            rows={3}
            maxLength={COMMENT_MAX_LENGTH + 100}
            className="input mt-1 w-full"
            disabled={submitting}
          />
          <div className="flex items-center justify-between">
            <span
              className={`text-xs ${
                isOverLimit ? 'text-rose-600' : 'text-slate-500'
              }`}
            >
              {text.length}/{COMMENT_MAX_LENGTH}
            </span>
            <button
              type="submit"
              className="btn-primary text-sm"
              disabled={submitting || !text.trim() || isOverLimit}
            >
              {submitting ? 'Posting…' : 'Post comment'}
            </button>
          </div>
        </form>
      )}

      {error && (
        <p
          role="alert"
          className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700"
        >
          {error}
        </p>
      )}

      {loading ? (
        <AnimatedSkeletonLoader rows={3} />
      ) : items.length === 0 ? (
        <AnimatedEmptyState
          title="No comments yet"
          description={
            canPost
              ? 'Start the conversation by adding a comment above.'
              : 'No comments have been posted on this document.'
          }
        />
      ) : (
        <motion.ul {...listAnim} className="space-y-3">
          {items.map((c) => (
            <li
              key={c.id}
              className="rounded-md border border-slate-200 bg-white px-4 py-3"
            >
              <p className="whitespace-pre-wrap text-sm text-slate-900">
                {c.comment}
              </p>
              <p className="mt-2 text-xs text-slate-500">
                {c.postedBy || 'Unknown'} ·{' '}
                {c.postedAt ? new Date(c.postedAt).toLocaleString() : '—'}
              </p>
              {c.attachments?.length > 0 && (
                <ul className="mt-2 flex flex-wrap gap-2">
                  {c.attachments.map((a) => (
                    <li
                      key={a.id}
                      className="rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-700"
                    >
                      {a.fileName}
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </motion.ul>
      )}
    </section>
  );
}
