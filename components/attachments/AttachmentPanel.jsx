'use client';

import { useCallback, useEffect, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { apiFetch } from '@/lib/apiClient';
import { uploadAttachmentFile } from '@/lib/uploadClient';
import { PortalLoader } from '@/components/ui';
import AttachmentDropzone from '@/components/attachments/AttachmentDropzone';
import { ALLOWED_MIME_TYPES_CLIENT, MAX_FILE_SIZE_BYTES } from '@/lib/attachmentClientConstants';
import { useI18n } from '@/lib/hooks/useI18n';
import { formatDateTime } from '@/lib/formatDate';
import { resolveAttachmentDisplayName } from '@/lib/attachmentDisplayName';

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

function FileDocIcon({ className = '' }) {
  return (
    <svg
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" />
      <path d="M14 2v4a2 2 0 0 0 2 2h4" />
    </svg>
  );
}

export default function AttachmentPanel({
  documentType,
  documentId,
  canUpload = true,
  approvalStep,
}) {
  const { common, attachments: att, pr, locale } = useI18n();
  const shouldReduceMotion = useReducedMotion();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [listVersion, setListVersion] = useState(0);

  const resolvedDocId = documentId ? String(documentId) : '';

  const load = useCallback(async () => {
    if (!documentType || !resolvedDocId) {
      setLoading(false);
      setItems([]);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const { json } = await apiFetch(
        `/api/attachments/${encodeURIComponent(documentType)}/${encodeURIComponent(resolvedDocId)}`,
      );
      if (json.success) {
        setItems(Array.isArray(json.data) ? json.data : []);
      } else {
        setError(json.message || 'Failed to load attachments');
        setItems([]);
      }
    } catch (err) {
      setError(err.message || 'Failed to load attachments');
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [documentType, resolvedDocId]);

  useEffect(() => {
    load();
  }, [load, listVersion]);

  const handleFiles = useCallback(
    async (fileList) => {
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
            documentId: resolvedDocId,
            file,
            approvalStep,
          });
        }
        setListVersion((v) => v + 1);
        await load();
      } catch (err) {
        setError(err.message || att.uploadFailed);
      } finally {
        setUploading(false);
      }
    },
    [approvalStep, att.uploadFailed, documentType, load, resolvedDocId],
  );

  const listAnimation = shouldReduceMotion
    ? {}
    : {
        initial: { opacity: 0 },
        animate: { opacity: 1 },
        transition: { duration: 0.18 },
      };

  return (
    <section className="space-y-4 rounded-3xl border border-border bg-card p-4 shadow-xl shadow-black/5 sm:p-5">
      <header>
        <h2 className="text-lg font-bold text-foreground">{common.attachments}</h2>
        <p className="text-xs text-muted-foreground">
          {loading ? '…' : items.length} · {common.attachmentsHint}
        </p>
      </header>

      {error && (
        <p
          role="alert"
          className="rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
        >
          {error}
        </p>
      )}

      {loading ? (
        <div className="flex min-h-[180px] items-center justify-center">
          <PortalLoader />
        </div>
      ) : (
        <>
          {canUpload && (
            <AttachmentDropzone
              mode="immediate"
              onUploadFiles={handleFiles}
              dropLabel={att.dragTitle}
              dropHint={att.dragHint}
              fileTooLargeMessage={pr.create.fileTooLarge}
              fileTypeMessage={pr.create.fileTypeNotAllowed}
              uploading={uploading}
              uploadingLabel={att.uploading}
              disabled={!resolvedDocId}
            />
          )}

          {items.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border bg-muted/10 px-4 py-6 text-center">
              <p className="text-sm font-semibold text-foreground">{att.noAttachmentsTitle}</p>
              <p className="mt-1 text-xs text-muted-foreground">{att.noAttachmentsDescription}</p>
            </div>
          ) : (
            <motion.ul {...listAnimation} className="space-y-2">
              {items.map((file) => {
                const displayName = resolveAttachmentDisplayName(file, {
                  fallbackLabel: att.fallbackFileName,
                });
                return (
                <li
                  key={file.id}
                  className="flex flex-col gap-3 rounded-2xl border border-border bg-muted/20 p-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="flex min-w-0 flex-1 items-start gap-3">
                    <span className="mt-0.5 shrink-0 text-primary">
                      <FileDocIcon />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p
                        dir="auto"
                        className="break-words text-sm font-medium text-foreground"
                      >
                        {displayName}
                      </p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {(fileExtension(displayName) || file.fileType || '—').toUpperCase()} ·{' '}
                        {formatBytes(file.fileSize)}
                      </p>
                      {(file.uploadedBy || file.uploadedAt) && (
                        <p className="mt-1 text-xs text-muted-foreground">
                          {file.uploadedBy && (
                            <span>
                              {att.uploadedBy} {file.uploadedBy}
                            </span>
                          )}
                          {file.uploadedBy && file.uploadedAt && ' · '}
                          {file.uploadedAt && (
                            <span>
                              {att.uploadedAt} {formatDateTime(file.uploadedAt, locale)}
                            </span>
                          )}
                        </p>
                      )}
                    </div>
                  </div>
                  <a
                    href={file.downloadUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex shrink-0 items-center justify-center rounded-xl px-3 py-2 text-sm font-semibold text-primary transition hover:bg-primary/10"
                  >
                    {att.open}
                  </a>
                </li>
              );
              })}
            </motion.ul>
          )}
        </>
      )}
    </section>
  );
}
