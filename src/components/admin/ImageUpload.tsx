import React, { useState, useRef } from 'react';
import { UploadCloud, X, Loader2 } from 'lucide-react';

interface Props {
  label: string;
  value: string;
  onChange: (url: string) => void;
}

export function ImageUpload({ label, value, onChange }: Props) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const fileInput = useRef<HTMLInputElement>(null);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const token = localStorage.getItem('tenant_admin_token');
    const formData = new FormData();
    formData.append('file', file);

    setUploading(true);
    setError('');
    
    try {
      const res = await fetch('/api/admin/upload', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData,
      });
      if (!res.ok) throw new Error('Upload failed');
      const data = await res.json();
      onChange(data.url);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
      if (fileInput.current) fileInput.current.value = '';
    }
  };

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      <div className="flex items-center gap-4">
        {value ? (
          <div className="relative w-20 h-20 rounded-lg border border-gray-200 overflow-hidden bg-gray-50 flex-shrink-0">
            <img src={value} alt="Uploaded" className="w-full h-full object-contain" />
            <button 
              type="button" 
              onClick={() => onChange('')} 
              className="absolute top-1 right-1 bg-black/50 text-white rounded-full p-1 hover:bg-black/70"
            >
              <X size={12} />
            </button>
          </div>
        ) : null}
        
        <div className="flex-1">
          <input
            type="file"
            accept="image/*"
            className="hidden"
            ref={fileInput}
            onChange={handleFile}
          />
          <button
            type="button"
            onClick={() => fileInput.current?.click()}
            disabled={uploading}
            className="flex items-center justify-center gap-2 w-full px-4 py-2 border-2 border-dashed border-gray-300 rounded-lg text-sm font-medium text-gray-600 hover:border-green-500 hover:text-green-600 transition-colors bg-gray-50 hover:bg-green-50 disabled:opacity-50"
          >
            {uploading ? <Loader2 size={16} className="animate-spin" /> : <UploadCloud size={16} />}
            {uploading ? 'Uploading...' : 'Choose Image'}
          </button>
          {error && <p className="text-red-500 text-xs mt-1">{error}</p>}
        </div>
      </div>
    </div>
  );
}
