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

export function imageWidthForSize(size: ImageSizeKey): number {
  return widthBySize[size];
}

/** CDN fetch transform via Cloudinary. Sin cloud name devuelve la URL original. */
export function optimizeImageUrl(url: string, width = 800): string {
  if (!url || !isCloudinaryEnabled()) return url;
  if (url.includes('res.cloudinary.com')) return url;

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

export function isCloudinaryActive(): boolean {
  return isCloudinaryEnabled();
}
