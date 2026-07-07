import { type DragEvent, useRef, useState } from 'react';
import { Icon } from '../../../components/shared/Icon';
import { useAdminToken } from '../hooks/useAdminToken';
import { uploadImage } from '../../../lib/uploadImage';

export function ImageDropZone({
  value,
  onChange,
  label,
  folder = 'general',
}: {
  value: string;
  onChange: (v: string) => void;
  label: string;
  folder?: string;
}) {
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const getToken = useAdminToken();

  const processFile = async (file: File) => {
    if (!file.type.startsWith("image/")) return;
    setError('');
    setUploading(true);
    try {
      const token = await getToken();
      const url = await uploadImage(file, folder, token);
      onChange(url);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al subir imagen');
    } finally {
      setUploading(false);
    }
  };

  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) processFile(file);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      <span
        style={{
          fontSize: 10,
          fontFamily: '"JetBrains Mono", monospace',
          textTransform: "uppercase",
          letterSpacing: "0.12em",
          color: "var(--ink-60)",
          marginBottom: 6,
        }}
      >
        {label}
      </span>
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        onClick={() => !value && !uploading && inputRef.current?.click()}
        style={{
          border: `2px dashed ${dragging ? "var(--green)" : value ? "var(--ink-12)" : "var(--ink-20)"}`,
          borderRadius: 12,
          height: 130,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: uploading ? "wait" : value ? "default" : "pointer",
          background: dragging ? "oklch(0.97 0.02 140)" : "var(--cream-2)",
          position: "relative",
          overflow: "hidden",
          transition: "border-color 120ms, background 120ms",
        }}
      >
        {uploading ? (
          <div style={{ fontSize: 11, fontFamily: '"JetBrains Mono", monospace', color: "var(--ink-40)" }}>
            SUBIENDO…
          </div>
        ) : value ? (
          <>
            <img
              src={value}
              alt=""
              style={{
                maxWidth: "100%",
                maxHeight: "100%",
                objectFit: "contain",
                padding: 10,
              }}
            />
            <button
              onClick={(e) => {
                e.stopPropagation();
                onChange("");
              }}
              style={{
                position: "absolute",
                top: 6,
                right: 6,
                width: 22,
                height: 22,
                borderRadius: 999,
                background: "var(--ink)",
                color: "var(--cream)",
                border: "none",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                opacity: 0.75,
              }}
            >
              <Icon name="x" size={11} />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                inputRef.current?.click();
              }}
              style={{
                position: "absolute",
                bottom: 6,
                right: 6,
                padding: "3px 8px",
                borderRadius: 6,
                background: "var(--ink)",
                color: "var(--cream)",
                border: "none",
                cursor: "pointer",
                fontSize: 10,
                fontFamily: '"JetBrains Mono", monospace',
                opacity: 0.7,
              }}
            >
              cambiar
            </button>
          </>
        ) : (
          <div
            style={{
              textAlign: "center",
              color: "var(--ink-40)",
              pointerEvents: "none",
            }}
          >
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ marginBottom: 8 }}
            >
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
            <div
              style={{
                fontSize: 10,
                fontFamily: '"JetBrains Mono", monospace',
                letterSpacing: "0.08em",
              }}
            >
              ARRASTRA O HAZ CLIC
            </div>
          </div>
        )}
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          style={{ display: "none" }}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) processFile(f);
            e.target.value = "";
          }}
        />
      </div>
      {error && <div style={{ fontSize: 10, color: "var(--coral)", marginTop: 4 }}>{error}</div>}
    </div>
  );
}
