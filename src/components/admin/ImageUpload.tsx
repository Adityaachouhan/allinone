import { useRef, useState, DragEvent } from 'react';
import { Upload, Link, X, Image as ImageIcon } from 'lucide-react';
import { getToken } from '@/lib/api';

interface ImageUploadProps {
  value: string;
  onChange: (url: string) => void;
  label?: string;
  required?: boolean;
  previewClass?: string;   // e.g. "h-24 w-24" or "h-24 w-full"
  accept?: string;
  placeholder?: string;
}

type Tab = 'upload' | 'url';

export function ImageUpload({
  value,
  onChange,
  label = 'Image',
  required = false,
  previewClass = 'h-24 w-24',
  accept = 'image/*',
  placeholder = 'https://…',
}: ImageUploadProps) {
  const [tab, setTab] = useState<Tab>('upload');
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const uploadFile = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      setUploadError('Please select an image file.');
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
      setUploadError(e instanceof Error ? e.message : 'Upload failed.');
    } finally {
      setUploading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) uploadFile(file);
    e.target.value = '';
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) uploadFile(file);
  };

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragging(true);
  };

  const handleDragLeave = () => setDragging(false);

  return (
    <div>
      {label && (
        <label className="label mb-1 block">
          {label} {required && <span className="text-error-600">*</span>}
        </label>
      )}

      {/* Tabs */}
      <div className="flex rounded-lg border border-gray-200 overflow-hidden mb-2 w-fit">
        <button
          type="button"
          onClick={() => setTab('upload')}
          className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-colors ${
            tab === 'upload'
              ? 'bg-primary-600 text-white'
              : 'bg-white text-gray-600 hover:bg-gray-50'
          }`}
        >
          <Upload size={12} /> Upload File
        </button>
        <button
          type="button"
          onClick={() => setTab('url')}
          className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-colors ${
            tab === 'url'
              ? 'bg-primary-600 text-white'
              : 'bg-white text-gray-600 hover:bg-gray-50'
          }`}
        >
          <Link size={12} /> Image URL
        </button>
      </div>

      {tab === 'upload' ? (
        <div
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onClick={() => !uploading && inputRef.current?.click()}
          className={`flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed cursor-pointer transition-colors p-5 text-center ${
            dragging
              ? 'border-primary-500 bg-primary-50'
              : 'border-gray-300 bg-gray-50 hover:border-primary-400 hover:bg-primary-50/40'
          } ${uploading ? 'opacity-60 pointer-events-none' : ''}`}
        >
          <input
            ref={inputRef}
            type="file"
            accept={accept}
            className="hidden"
            onChange={handleFileChange}
          />
          {uploading ? (
            <div className="flex flex-col items-center gap-2">
              <div className="w-6 h-6 border-2 border-primary-600 border-t-transparent rounded-full animate-spin" />
              <p className="text-xs text-gray-500">Uploading…</p>
            </div>
          ) : (
            <>
              <div className="rounded-full bg-primary-100 p-3">
                <ImageIcon size={20} className="text-primary-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-700">
                  {dragging ? 'Drop to upload' : 'Click or drag & drop'}
                </p>
                <p className="text-xs text-gray-400 mt-0.5">PNG, JPG, WEBP up to 5 MB</p>
              </div>
            </>
          )}
        </div>
      ) : (
        <input
          type="url"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="input"
          placeholder={placeholder}
        />
      )}

      {uploadError && (
        <p className="mt-1 text-xs text-error-600">{uploadError}</p>
      )}

      {/* Preview */}
      {value && (
        <div className="mt-2 relative inline-block">
          <img
            src={value}
            alt="Preview"
            className={`rounded object-cover ${previewClass}`}
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = 'none';
            }}
          />
          <button
            type="button"
            onClick={() => onChange('')}
            className="absolute -top-1.5 -right-1.5 rounded-full bg-error-600 text-white p-0.5 shadow"
            aria-label="Remove image"
          >
            <X size={10} />
          </button>
        </div>
      )}
    </div>
  );
}
