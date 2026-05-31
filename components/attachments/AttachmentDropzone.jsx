'use client';

import { useRef, useState } from 'react';
import { ALLOWED_MIME_TYPES_CLIENT, MAX_FILE_SIZE_BYTES } from '@/lib/attachmentClientConstants';

function formatBytes(bytes) {
  if (bytes == null) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function UploadCloudIcon({ className = '' }) {
  return (
    <svg
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      width="32"
      height="32"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M12 13v8" />
      <path d="M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242" />
      <path d="m8 17 4-4 4 4" />
    </svg>
  );
}

/**
 * @param {'staged'|'immediate'} mode
 * staged — local file list until parent submits (PR create).
 * immediate — calls onUploadFiles for each valid drop/pick (PR detail).
 */
export default function AttachmentDropzone({
  mode = 'staged',
  files = [],
  onFilesChange,
  onUploadFiles,
  dropLabel,
  dropHint,
  removeFileLabel = 'Remove',
  fileTooLargeMessage,
  fileTypeMessage,
  uploading = false,
  uploadingLabel,
  disabled = false,
}) {
  const inputRef = useRef(null);
  const [dragOver, setDragOver] = useState(false);
  const [localError, setLocalError] = useState('');
  const isImmediate = mode === 'immediate';

  const acceptAttr = ALLOWED_MIME_TYPES_CLIENT.join(',');

  async function mergeFiles(incoming) {
    if (disabled || uploading) return;
    const list = Array.from(incoming || []);
    if (!list.length) return;
    setLocalError('');
    const valid = [];

    for (const file of list) {
      if (!ALLOWED_MIME_TYPES_CLIENT.includes(file.type)) {
        setLocalError(fileTypeMessage || `File type not allowed: ${file.name}`);
        continue;
      }
      if (file.size > MAX_FILE_SIZE_BYTES) {
        setLocalError(fileTooLargeMessage || `${file.name} exceeds the 25 MB limit`);
        continue;
      }
      if (isImmediate) {
        valid.push(file);
      } else if (!files.some((f) => f.name === file.name && f.size === file.size)) {
        valid.push(file);
      }
    }

    if (!valid.length) return;

    if (isImmediate) {
      if (onUploadFiles) {
        await onUploadFiles(valid);
      }
      return;
    }

    onFilesChange([...files, ...valid]);
  }

  function removeAt(index) {
    onFilesChange(files.filter((_, i) => i !== index));
  }

  const dropzoneClass = [
    'flex cursor-pointer flex-col items-center justify-center rounded-3xl border-2 border-dashed p-5 text-center transition',
    dragOver ? 'border-primary bg-primary/10' : 'border-border bg-muted/20 hover:border-primary/50',
    disabled || uploading ? 'pointer-events-none opacity-60' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className="space-y-3">
      <div
        role="button"
        tabIndex={disabled || uploading ? -1 : 0}
        aria-disabled={disabled || uploading}
        className={dropzoneClass}
        onDragOver={(e) => {
          e.preventDefault();
          if (!disabled && !uploading) setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          mergeFiles(e.dataTransfer.files);
        }}
        onClick={() => {
          if (disabled || uploading) return;
          inputRef.current?.click();
        }}
        onKeyDown={(e) => {
          if (disabled || uploading) return;
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            inputRef.current?.click();
          }
        }}
      >
        <UploadCloudIcon className="text-primary" />
        <p className="mt-2 text-sm font-semibold text-foreground">{dropLabel}</p>
        <p className="mt-1 text-xs text-muted-foreground">{dropHint}</p>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={acceptAttr}
          className="hidden"
          disabled={disabled || uploading}
          onChange={(e) => {
            mergeFiles(e.target.files);
            e.target.value = '';
          }}
        />
      </div>
      {uploading && uploadingLabel && (
        <p className="text-center text-xs text-muted-foreground" role="status">
          {uploadingLabel}
        </p>
      )}
      {localError && (
        <p className="text-xs text-destructive" role="alert">
          {localError}
        </p>
      )}
      {!isImmediate && files.length > 0 && (
        <ul className="space-y-2">
          {files.map((file, index) => (
            <li
              key={`${file.name}-${file.size}-${index}`}
              className="flex items-center justify-between gap-2 rounded-2xl border border-border bg-muted/20 px-3 py-2 text-sm"
            >
              <div className="min-w-0">
                <p className="truncate font-medium text-foreground">{file.name}</p>
                <p className="text-xs text-muted-foreground">{formatBytes(file.size)}</p>
              </div>
              <button
                type="button"
                className="shrink-0 rounded-lg px-2 py-1 text-xs font-semibold text-destructive hover:bg-destructive/10"
                onClick={() => removeAt(index)}
              >
                {removeFileLabel}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
