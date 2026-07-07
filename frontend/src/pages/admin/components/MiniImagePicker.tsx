import { useRef, useState } from 'react';
import { Icon } from '../../../components/shared/Icon';
import { useAdminToken } from '../hooks/useAdminToken';
import { uploadImage } from '../../../lib/uploadImage';

export function MiniImagePicker({
  images,
  onChange,
  folder,
  max = 4,
}: {
  images: string[];
  onChange: (images: string[]) => void;
  folder: string;
  max?: number;
}) {
  const getToken = useAdminToken();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  const handleFile = async (file: File) => {
    setError('');
    setUploading(true);
    try {
      const token = await getToken();
      const url = await uploadImage(file, folder, token);
      onChange([...images, url].slice(0, max));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al subir imagen');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
        {images.map((url, i) => (
          <div key={i} style={{ position: 'relative', width: 36, height: 36 }}>
            <img
              src={url}
              alt=""
              style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 6, border: '1px solid var(--ink-12)' }}
            />
            <button
              type="button"
              onClick={() => onChange(images.filter((_, idx) => idx !== i))}
              style={{
                position: 'absolute',
                top: -5,
                right: -5,
                width: 15,
                height: 15,
                borderRadius: 999,
                background: 'var(--ink)',
                color: 'var(--cream)',
                border: 'none',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: 0,
              }}
            >
              <Icon name="x" size={8} />
            </button>
          </div>
        ))}
        {images.length < max && (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
            title="Subir imagen"
            style={{
              width: 36,
              height: 36,
              borderRadius: 6,
              border: '1px dashed var(--ink-20)',
              background: 'var(--cream-2)',
              cursor: uploading ? 'wait' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--ink-60)',
              fontSize: 10,
            }}
          >
            {uploading ? '…' : <Icon name="plus" size={14} />}
          </button>
        )}
      </div>
      {error && <div style={{ fontSize: 10, color: 'var(--coral)', marginTop: 4 }}>{error}</div>}
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        style={{ display: 'none' }}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleFile(f);
          e.target.value = '';
        }}
      />
    </div>
  );
}
