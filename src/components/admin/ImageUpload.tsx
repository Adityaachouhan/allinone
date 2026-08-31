import { useRef, useState, DragEvent } from 'react';
import { Upload, X } from 'lucide-react';
import { getToken } from '@/lib/api';

interface ImageUploadProps {
  value: string;
  onChange: (url: string) => void;
  label?: string;
  required?: boolean;
  /** Tailwind size classes for the preview, e.g. "h-24 w-24" or "h-24 w-full" */
  previewClass?: string;
  accept?: string;
}

export function ImageUpload({
  value,
  onChange,
  label,
  required = false,
  previewClass = 'h-24 w-24',
  accept = 'image/*',
}: ImageUploadProps) {
  const [uploading, setUploading]   = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [dragging, setDragging]     = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const uploadFile = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      setUploadError('Please select an image file (PNG, JPG, WEBP…).');
      return;
    }
    setUploading(true);
    setUploadError('');
    try {
      const fd = new FormData();
      fd.append('file', file);
      const token = getToken();
      const res = await fetch('/api/upload', {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: fd,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || `Upload failed (${res.status})`);
      onChange(data.url as string);
    } catch (e) {
      setUploadError(e instanceof Error ? e.message : 'Upload failed. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) uploadFile(file);
    e.target.value = '';          // reset so same file can be re-selected
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) uploadFile(file);
  };

  return (
    <div>
      {/* Label */}
      {label && (
        <label className="label mb-1.5 block">
          {label}{required && <span className="ml-0.5 text-error-600">*</span>}
        </label>
      )}

      {/* Drop zone */}
      <div
        onDrop={handleDrop}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onClick={() => !uploading && inputRef.current?.click()}
        className={[
          'flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed',
          'cursor-pointer transition-all duration-200 p-6 text-center select-none',
          dragging
            ? 'border-primary-500 bg-primary-50 scale-[1.01]'
            : 'border-gray-300 bg-gray-50 hover:border-primary-400 hover:bg-primary-50/50',
          uploading ? 'pointer-events-none opacity-60' : '',
        ].join(' ')}
      >
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          className="hidden"
          onChange={handleFileChange}
        />

        {uploading ? (
          /* Uploading state */
          <div className="flex flex-col items-center gap-2">
            <div className="w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-sm text-gray-500">Uploading image…</p>
          </div>
        ) : (
          /* Idle / drag state */
          <>
            <div className="rounded-full bg-primary-100 p-3.5">
              <Upload size={22} className="text-primary-600" />
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-700">
                {dragging ? 'Drop image here' : 'Click to upload or drag & drop'}
              </p>
              <p className="text-xs text-gray-400 mt-0.5">PNG, JPG, WEBP — max 5 MB</p>
            </div>
          </>
        )}
      </div>

      {/* Error */}
      {uploadError && (
        <p className="mt-1.5 flex items-center gap-1.5 text-xs text-error-600">
          <span>⚠</span> {uploadError}
        </p>
      )}

      {/* Preview */}
      {value && !uploading && (
        <div className="mt-3 relative inline-block">
          <img
            src={value}
            alt="Preview"
            className={`rounded-lg object-cover border border-gray-200 shadow-sm ${previewClass}`}
            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
          />
          <button
            type="button"
            onClick={() => onChange('')}
            title="Remove image"
            className="absolute -top-2 -right-2 rounded-full bg-error-600 hover:bg-error-700 text-white p-1 shadow-md transition-colors"
            aria-label="Remove image"
          >
            <X size={11} />
          </button>
        </div>
      )}
    </div>
  );
}
