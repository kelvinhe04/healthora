import { createHash } from 'node:crypto';

export interface CloudinaryUploadResult {
  secure_url: string;
}

function sign(params: Record<string, string | number>, apiSecret: string): string {
  const toSign = Object.keys(params)
    .sort()
    .map((key) => `${key}=${params[key]}`)
    .join('&');
  return createHash('sha1').update(`${toSign}${apiSecret}`).digest('hex');
}

interface CloudinaryConfig {
  cloudName: string;
  apiKey: string;
  apiSecret: string;
}

export function getCloudinaryConfig(): CloudinaryConfig {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME?.trim();
  const apiKey = process.env.CLOUDINARY_API_KEY?.trim();
  const apiSecret = process.env.CLOUDINARY_API_SECRET?.trim();
  if (!cloudName || !apiKey || !apiSecret) {
    throw new Error(
      'Cloudinary no esta configurado. Definí CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY y CLOUDINARY_API_SECRET.',
    );
  }
  return { cloudName, apiKey, apiSecret };
}

/** Upload firmado directo via REST (multipart/form-data + firma SHA1) - el SDK oficial
 * `cloudinary` deja de firmar las requests despues del primer upload exitoso bajo Bun
 * (reproducido con concurrencia 1 y 8, con y sin delay entre llamadas; un POST firmado a mano
 * con curl no tiene el problema, asi que el bug es del SDK/runtime, no de la cuenta). */
export async function uploadToCloudinary(
  buffer: Uint8Array,
  opts: { publicId: string; mimeType: string },
): Promise<CloudinaryUploadResult> {
  const { cloudName, apiKey, apiSecret } = getCloudinaryConfig();

  const timestamp = Math.floor(Date.now() / 1000);
  const signature = sign({ overwrite: 'true', public_id: opts.publicId, timestamp }, apiSecret);

  const form = new FormData();
  form.append('file', new Blob([buffer], { type: opts.mimeType }), 'upload');
  form.append('public_id', opts.publicId);
  form.append('overwrite', 'true');
  form.append('api_key', apiKey);
  form.append('timestamp', String(timestamp));
  form.append('signature', signature);

  const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
    method: 'POST',
    body: form,
  });
  const json = await res.json();
  if (!res.ok) {
    throw new Error(json?.error?.message || `Error subiendo a Cloudinary (HTTP ${res.status})`);
  }
  return json as CloudinaryUploadResult;
}
