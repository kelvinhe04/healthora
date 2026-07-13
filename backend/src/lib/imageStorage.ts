import { randomUUID } from 'crypto';
import { uploadToCloudinary } from './cloudinaryUpload';

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

/** Shared by the admin multipart upload route, el upload de fotos de devolucion, y la MCP tool de
 * imagen de variante - todos terminan con bytes crudos + un mime type por el momento en que llegan
 * aca, solo difiere el transporte. */
export async function saveImageFile(buffer: Uint8Array, mimeType: string, folder: string): Promise<string> {
  const ext = ALLOWED_MIME_TO_EXT[mimeType];
  if (!ext) throw new Error('Formato no soportado. Usa JPEG, PNG o WEBP.');
  if (buffer.byteLength > MAX_IMAGE_SIZE) throw new Error('La imagen no puede pesar más de 5MB.');

  const safeFolder = slugifyFolder(folder);
  const publicId = `healthora/uploads/products/${safeFolder}/${randomUUID()}`;

  const result = await uploadToCloudinary(buffer, { publicId, mimeType });
  return result.secure_url;
}
