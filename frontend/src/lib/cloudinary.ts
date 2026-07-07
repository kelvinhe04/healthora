const cloudName = (import.meta.env.VITE_CLOUDINARY_CLOUD_NAME as string | undefined)?.trim();

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
  if (!url || !cloudName) return url;
  if (url.includes('res.cloudinary.com')) return url;
  const encoded = encodeURIComponent(url);
  return `https://res.cloudinary.com/${cloudName}/image/fetch/f_auto,q_auto:good,w_${width}/${encoded}`;
}
