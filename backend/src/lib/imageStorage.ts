import { randomUUID } from 'crypto';
import { getPublicBackendUrl } from './appEnv';

const ALLOWED_MIME_TO_EXT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

export const MAX_IMAGE_SIZE = 5 * 1024 * 1024;

export function slugifyFolder(value: string): string {
  return (
    value
      .trim()
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-]/g, '')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 80) || 'misc'
  );
}

/** Shared by the admin multipart upload route and the MCP base64 upload tool - both end up with
 * raw bytes + a mime type by the time they get here, just via different transports. */
export async function saveImageFile(buffer: Uint8Array, mimeType: string, folder: string): Promise<string> {
  const ext = ALLOWED_MIME_TO_EXT[mimeType];
  if (!ext) throw new Error('Formato no soportado. Usa JPEG, PNG o WEBP.');
  if (buffer.byteLength > MAX_IMAGE_SIZE) throw new Error('La imagen no puede pesar más de 5MB.');

  const safeFolder = slugifyFolder(folder);
  const filename = `${randomUUID()}.${ext}`;
  const relativePath = `products/${safeFolder}/${filename}`;
  const diskPath = `./uploads/${relativePath}`;

  await Bun.write(diskPath, buffer);
  return `${getPublicBackendUrl()}/uploads/${relativePath}`;
}
