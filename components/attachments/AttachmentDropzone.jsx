'use client';

import { useRef, useState } from 'react';
import { ALLOWED_MIME_TYPES_CLIENT, MAX_FILE_SIZE_BYTES } from '@/lib/attachmentClientConstants';

function formatBytes(bytes) {
  if (bytes == null) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export default function AttachmentDropzone({
  files = [],
  onFilesChange,
  dropLabel,
  dropHint,
  removeFileLabel = 'Remove',
  fileTooLargeMessage,
  fileTypeMessage,
}) {
  const inputRef = useRef(null);
  const [dragOver, setDragOver] = useState(false);
  const [localError, setLocalError] = useState('');

  const acceptAttr = ALLOWED_MIME_TYPES_CLIENT.join(',');

  function mergeFiles(incoming) {
    const list = Array.from(incoming || []);
    if (!list.length) return;
    setLocalError('');
    const next = [...files];
    for (const file of list) {
      if (!ALLOWED_MIME_TYPES_CLIENT.includes(file.type)) {
        setLocalError(fileTypeMessage || `File type not allowed: ${file.name}`);
        continue;
      }
      if (file.size > MAX_FILE_SIZE_BYTES) {
        setLocalError(fileTooLargeMessage || `${file.name} exceeds the 25 MB limit`);
        continue;
      }
      if (!next.some((f) => f.name === file.name && f.size === file.size)) {
        next.push(file);
      }
    }
    onFilesChange(next);
  }

  function removeAt(index) {
    onFilesChange(files.filter((_, i) => i !== index));
  }

  return (
    <div className="space-y-3">
      <div
        role="button"
        tabIndex={0}
        className={[
          'flex cursor-pointer flex-col items-center justify-center rounded-3xl border-2 border-dashed p-4 text-center transition-colors sm:p-5',
          dragOver
            ? 'border-primary/50 bg-primary/5'
            : 'border-border bg-muted/20 hover:border-primary/50',
        ].join(' ')}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          mergeFiles(e.dataTransfer.files);
        }}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            inputRef.current?.click();
          }
        }}
      >
        <span className="text-2xl text-primary" aria-hidden>
          ↑
        </span>
        <p className="mt-2 text-sm font-semibold text-foreground">{dropLabel}</p>
        <p className="mt-1 text-xs text-muted-foreground">{dropHint}</p>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={acceptAttr}
          className="hidden"
          onChange={(e) => {
            mergeFiles(e.target.files);
            e.target.value = '';
          }}
        />
      </div>
      {localError && (
        <p className="text-xs text-destructive" role="alert">
          {localError}
        </p>
      )}
      {files.length > 0 && (
        <ul className="space-y-2">
          {files.map((file, index) => (
            <li
              key={`${file.name}-${file.size}-${index}`}
              className="flex items-center justify-between gap-2 rounded-xl border border-border bg-card px-3 py-2 text-sm"
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
