const cloudName = (import.meta.env.VITE_CLOUDINARY_CLOUD_NAME as string | undefined)?.trim();

function isCloudinaryEnabled(): boolean {
  if (!cloudName) return false;
  if (/replace|example|your[-_]?cloud/i.test(cloudName)) return false;
  return cloudName.length >= 2;
}

const widthBySize = {
  xs: 120,
  sm: 240,
  md: 440,
  lg: 1040,
  tile: 560,
} as const;

export type ImageSizeKey = keyof typeof widthBySize;

const responsiveWidthsBySize: Record<ImageSizeKey, number[]> = {
  xs: [80, 120, 180],
  sm: [160, 240, 360],
  md: [320, 440, 640],
  lg: [640, 1040, 1440],
  tile: [320, 560, 840],
};

const sizesBySize: Record<ImageSizeKey, string> = {
  xs: '60px',
  sm: '120px',
  md: '220px',
  lg: '(max-width: 768px) 100vw, 520px',
  tile: '(max-width: 768px) 50vw, (max-width: 1100px) 50vw, 33vw',
};

export function imageWidthForSize(size: ImageSizeKey): number {
  return widthBySize[size];
}

export function imageSizesForSize(size: ImageSizeKey): string {
  return sizesBySize[size];
}

const OWN_UPLOAD_URL_RE = /^https:\/\/res\.cloudinary\.com\/([^/]+)\/image\/upload\//;

/** CDN fetch transform via Cloudinary. Sin cloud name devuelve la URL original. */
export function optimizeImageUrl(url: string, width = 800): string {
  if (!url || !isCloudinaryEnabled()) return url;

  // Imagen ya subida/migrada a nuestra propia cuenta: insertar la transformacion directo en la
  // delivery URL (mas barato que un fetch transform, y evita servir el original a tamaño completo).
  const ownMatch = url.match(OWN_UPLOAD_URL_RE);
  if (ownMatch) {
    if (ownMatch[1] !== cloudName) return url;
    return url.replace(OWN_UPLOAD_URL_RE, (prefix) => `${prefix}f_auto,q_auto:good,w_${width}/`);
  }

  // Cloudinary fetch exige URL absoluta; el catálogo usa rutas /products/...
  let absolute = url;
  if (url.startsWith('/')) {
    if (typeof window === 'undefined') return url;
    absolute = `${window.location.origin}${url}`;
  }
  if (!/^https?:\/\//i.test(absolute)) return url;

  const encoded = encodeURIComponent(absolute);
  return `https://res.cloudinary.com/${cloudName}/image/fetch/f_auto,q_auto:good,w_${width}/${encoded}`;
}

export function responsiveImageSrcSet(url: string, size: ImageSizeKey): string | undefined {
  if (!url || !isCloudinaryEnabled()) return undefined;

  const candidates = responsiveWidthsBySize[size];
  const srcSet = candidates
    .map((width) => {
      const optimized = optimizeImageUrl(url, width);
      return optimized === url ? null : `${optimized} ${width}w`;
    })
    .filter((candidate): candidate is string => Boolean(candidate));

  return srcSet.length ? srcSet.join(', ') : undefined;
}

export function isCloudinaryActive(): boolean {
  return isCloudinaryEnabled();
}
