/** Los 4 presets de color del picker (BannersSection.tsx) ya están pensados para funcionar con el
 * texto de tema (var(--ink)/var(--ink-60)), que se adapta solo a modo claro/oscuro. Un color
 * personalizado (picker libre) es una imagen de fondo arbitraria - si el admin elige algo muy
 * claro en modo oscuro (o muy oscuro en modo claro), ese texto de tema pierde contraste. */
const THEME_PRESET_COLORS = new Set(['var(--lime)', 'var(--green)', 'var(--coral)', 'var(--cream-2)']);

function relativeLuminance(hex: string): number | null {
  const match = /^#([0-9a-f]{6})$/i.exec(hex);
  if (!match) return null;
  const value = match[1];
  const r = parseInt(value.slice(0, 2), 16) / 255;
  const g = parseInt(value.slice(2, 4), 16) / 255;
  const b = parseInt(value.slice(4, 6), 16) / 255;
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Color de título/cuerpo a usar sobre `backgroundColor`. Para los presets del tema, usa los
 * tokens de tema de siempre (se adaptan solos). Para un color personalizado, calcula contraste
 * por luminancia y fuerza texto oscuro u oscuro claro segun haga falta. */
export function getBannerTextColors(backgroundColor?: string): { title: string; body: string } {
  if (!backgroundColor || THEME_PRESET_COLORS.has(backgroundColor)) {
    return { title: 'var(--ink)', body: 'var(--ink-60)' };
  }

  const luminance = relativeLuminance(backgroundColor);
  if (luminance === null) return { title: 'var(--ink)', body: 'var(--ink-60)' };

  return luminance > 0.55
    ? { title: '#15241c', body: 'rgba(21, 36, 28, 0.7)' }
    : { title: '#ffffff', body: 'rgba(255, 255, 255, 0.72)' };
}
