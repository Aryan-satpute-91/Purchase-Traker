import React, { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, X, FileText, Image } from 'lucide-react';
import { cn } from '@/lib/utils';

interface DroppedFile {
  file: File;
  preview: string | null;
}

interface FileDropzoneProps {
  onFiles: (files: File[]) => void;
  accept?: Record<string, string[]>;
  multiple?: boolean;
  className?: string;
  label?: string;
  sublabel?: string;
}

export function FileDropzone({
  onFiles,
  accept = { 'image/*': [], 'application/pdf': [] },
  multiple = true,
  className,
  label = 'Drop invoices, receipts, or PDFs here',
  sublabel = 'or click to browse — images & PDFs accepted',
}: FileDropzoneProps) {
  const [files, setFiles] = useState<DroppedFile[]>([]);

  const onDrop = useCallback(
    (accepted: File[]) => {
      const newFiles: DroppedFile[] = accepted.map((file) => ({
        file,
        preview: file.type.startsWith('image/') ? URL.createObjectURL(file) : null,
      }));
      setFiles((prev) => (multiple ? [...prev, ...newFiles] : newFiles));
      onFiles(accepted);
    },
    [multiple, onFiles]
  );

  const removeFile = (idx: number) => {
    setFiles((prev) => {
      const next = [...prev];
      if (next[idx].preview) URL.revokeObjectURL(next[idx].preview!);
      next.splice(idx, 1);
      return next;
    });
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept,
    multiple,
  });

  return (
    <div className={cn('space-y-3', className)}>
      <div
        {...getRootProps()}
        className={cn(
          'border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all duration-200',
          'flex flex-col items-center gap-3',
          isDragActive
            ? 'border-accent-500 bg-accent-50 scale-[1.01]'
            : 'border-surface-200 bg-surface-50 hover:border-accent-300 hover:bg-accent-50/30'
        )}
      >
        <input {...getInputProps()} />
        <div
          className={cn(
            'p-3 rounded-2xl transition-colors',
            isDragActive ? 'bg-accent-100 text-accent-600' : 'bg-surface-200 text-slate-400'
          )}
        >
          <Upload className="h-6 w-6" />
        </div>
        <div>
          <p className="text-sm font-medium text-slate-700">{label}</p>
          <p className="text-xs text-slate-400 mt-0.5">{sublabel}</p>
        </div>
      </div>

      {files.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {files.map((f, i) => (
            <div
              key={i}
              className="group relative flex items-center gap-2 pl-2 pr-8 py-1.5 bg-white border border-surface-200 rounded-xl text-xs text-slate-600 shadow-card"
            >
              {f.preview ? (
                <img src={f.preview} className="h-8 w-8 rounded-lg object-cover shrink-0" alt={f.file.name} />
              ) : (
                <div className="h-8 w-8 rounded-lg bg-surface-100 flex items-center justify-center shrink-0">
                  <FileText className="h-4 w-4 text-slate-400" />
                </div>
              )}
              <span className="max-w-[120px] truncate">{f.file.name}</span>
              <button
                onClick={(e) => { e.stopPropagation(); removeFile(i); }}
                className="absolute right-1.5 top-1/2 -translate-y-1/2 text-slate-300 hover:text-red-500 transition-colors"
                aria-label="Remove file"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
