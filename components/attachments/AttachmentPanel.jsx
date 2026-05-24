'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { apiFetch } from '@/lib/apiClient';
import { uploadAttachmentFile } from '@/lib/uploadClient';
import {
  AnimatedEmptyState,
  AnimatedSkeletonLoader,
} from '@/components/ui';
import { ALLOWED_MIME_TYPES_CLIENT, MAX_FILE_SIZE_BYTES } from '@/lib/attachmentClientConstants';

function formatBytes(bytes) {
  if (bytes == null) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function fileExtension(name) {
  if (!name) return '';
  const dot = name.lastIndexOf('.');
  if (dot <= 0) return '';
  return name.slice(dot + 1).toLowerCase();
}

export default function AttachmentPanel({
  documentType,
  documentId,
  canUpload = true,
  approvalStep,
  emptyTitle = 'No files attached',
  emptyDescription = 'Upload PDFs, images, or Office files (up to 25 MB).',
}) {
  const shouldReduceMotion = useReducedMotion();
  const inputRef = useRef(null);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!documentType || !documentId) return;
    setLoading(true);
    setError('');
    const { json } = await apiFetch(
      `/api/attachments/${encodeURIComponent(documentType)}/${encodeURIComponent(documentId)}`,
    );
    if (json.success) {
      setItems(json.data);
    } else {
      setError(json.message || 'Failed to load attachments');
    }
    setLoading(false);
  }, [documentType, documentId]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleFiles(fileList) {
    const files = Array.from(fileList || []);
    if (!files.length) return;
    setError('');
    setUploading(true);
    try {
      for (const file of files) {
        if (!ALLOWED_MIME_TYPES_CLIENT.includes(file.type)) {
          throw new Error(`File type not allowed: ${file.name}`);
        }
        if (file.size > MAX_FILE_SIZE_BYTES) {
          throw new Error(`${file.name} exceeds the 25 MB limit`);
        }
        await uploadAttachmentFile({
          documentType,
          documentId,
          file,
          approvalStep,
        });
      }
      await load();
    } catch (err) {
      setError(err.message || 'Upload failed');
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  function onPickFiles(e) {
    handleFiles(e.target.files);
  }

  const acceptAttr = ALLOWED_MIME_TYPES_CLIENT.join(',');

  const listAnimation = shouldReduceMotion
    ? {}
    : {
        initial: { opacity: 0 },
        animate: { opacity: 1 },
        transition: { duration: 0.18 },
      };

  return (
    <section className="card space-y-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Attachments</h2>
          <p className="text-xs text-slate-500">
            {items.length} file{items.length === 1 ? '' : 's'} · max 25 MB each
          </p>
        </div>
        {canUpload && (
          <div className="flex items-center gap-2">
            <input
              ref={inputRef}
              type="file"
              multiple
              accept={acceptAttr}
              className="hidden"
              onChange={onPickFiles}
            />
            <button
              type="button"
              className="btn-primary text-sm"
              onClick={() => inputRef.current?.click()}
              disabled={uploading}
            >
              {uploading ? 'Uploading…' : 'Upload file'}
            </button>
          </div>
        )}
      </header>

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
          title={emptyTitle}
          description={canUpload ? emptyDescription : 'No files attached yet.'}
        />
      ) : (
        <motion.ul
          {...listAnimation}
          className="divide-y divide-slate-100 overflow-hidden rounded-md border border-slate-200 bg-white"
        >
          {items.map((file) => (
            <li
              key={file.id}
              className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-slate-900">
                  {file.fileName}
                </p>
                <p className="mt-0.5 text-xs text-slate-500">
                  {fileExtension(file.fileName).toUpperCase() || file.fileType} ·{' '}
                  {formatBytes(file.fileSize)}
                  {file.uploadedBy ? ` · ${file.uploadedBy}` : ''}
                  {file.uploadedAt
                    ? ` · ${new Date(file.uploadedAt).toLocaleString()}`
                    : ''}
                </p>
              </div>
              <a
                href={file.downloadUrl}
                target="_blank"
                rel="noreferrer"
                className="btn-secondary text-xs"
              >
                Download
              </a>
            </li>
          ))}
        </motion.ul>
      )}
    </section>
  );
}
