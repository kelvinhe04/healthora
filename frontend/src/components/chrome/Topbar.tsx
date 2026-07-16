import { useTranslation } from 'react-i18next';
import { useThemeStore } from '../../store/themeStore';

export function Topbar() {
  const { t } = useTranslation();
  const theme = useThemeStore((s) => s.theme);
  const isDark = theme === 'dark';
  const msgs = t('topbar.messages', { returnObjects: true }) as string[];
  const marqueeMsgs = Array.from({ length: 3 }, () => msgs).flat();
  return (
    <div style={{ background: 'var(--ink)', color: 'var(--cream)', fontFamily: '"JetBrains Mono", monospace', fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase', padding: '10px 0', overflow: 'hidden', position: 'relative' }}>
      <style>{`
        @keyframes marquee-scroll { 0% { transform: translateX(0); } 100% { transform: translateX(-50%); } }
        .marquee-track { display: flex; width: max-content; animation: marquee-scroll 140s linear infinite; will-change: transform; }
        .marquee-track:hover { animation-play-state: paused; }
        .marquee-group { display: flex; flex-shrink: 0; }
      `}</style>
      <div className="marquee-track">
        {[0, 1].map((group) => (
          <div key={group} className="marquee-group" aria-hidden={group === 1}>
            {marqueeMsgs.map((m, i) => (
              <span key={`${group}-${i}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 24, padding: '0 40px', whiteSpace: 'nowrap' }}>
                <span style={{ width: 4, height: 4, background: isDark ? 'var(--green)' : '#CCFF00', borderRadius: 999, flexShrink: 0, boxShadow: isDark ? 'none' : '0 0 8px rgba(204, 255, 0, 0.6)' }} />
                {m}
              </span>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
