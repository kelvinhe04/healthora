const cols = [
  { title: 'Comprar', items: ['Vitaminas', 'Medicamentos', 'Cuidado personal', 'Bebé', 'Skincare', 'Fitness', 'Fragancias'] },
  { title: 'Ayuda', items: ['Contacto', 'Preguntas frecuentes', 'Envíos', 'Devoluciones', 'Estado de mi orden'] },
  { title: 'Legal', items: ['Términos y condiciones', 'Política de privacidad', 'Política de medicamentos', 'Cookies'] },
];

const socials = [
  { label: 'Instagram', id: 'instagram' },
  { label: 'X', id: 'x' },
  { label: 'Facebook', id: 'facebook' },
  { label: 'TikTok', id: 'tiktok' },
];

export function Footer() {
  return (
    <footer style={{ background: 'var(--green)', color: 'var(--cream)', padding: '64px 40px 32px', borderRadius: '32px 32px 0 0', marginTop: 80 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1.4fr repeat(3, 1fr) 1.4fr', gap: 48, marginBottom: 64 }}>
        <div>
          <div style={{ fontFamily: '"Instrument Serif", serif', fontSize: 48, letterSpacing: '-0.03em', lineHeight: 0.95, marginBottom: 20 }}>Healthora</div>
          <p style={{ fontSize: 14, lineHeight: 1.55, opacity: 0.72, maxWidth: 260, fontFamily: '"Geist", sans-serif' }}>Tu farmacia online para salud, cuidado personal, belleza y bienestar.</p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 22 }}>
            {socials.map((social) => (
              <a
                key={social.id}
                href="#"
                onClick={(e) => e.preventDefault()}
                aria-label={social.label}
                style={{ width: 38, height: 38, borderRadius: 999, border: '1px solid rgba(255,255,255,0.16)', background: 'rgba(255,255,255,0.06)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: 'white', transition: 'transform 180ms ease, background 180ms ease' }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-2px)';
                  e.currentTarget.style.background = 'rgba(255,255,255,0.12)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.background = 'rgba(255,255,255,0.06)';
                }}
              >
                <SocialIcon name={social.id} />
              </a>
            ))}
          </div>
        </div>
        {cols.map((col) => (
          <div key={col.title}>
            <div style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.12em', opacity: 0.6, marginBottom: 20 }}>{col.title}</div>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
              {col.items.map((item) => <li key={item} style={{ fontSize: 14, fontFamily: '"Geist", sans-serif', opacity: 0.88, cursor: 'pointer' }}>{item}</li>)}
            </ul>
          </div>
        ))}
        <div>
          <div style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.12em', opacity: 0.6, marginBottom: 20 }}>Newsletter</div>
          <p style={{ fontSize: 14, lineHeight: 1.55, opacity: 0.88, marginBottom: 18, fontFamily: '"Geist", sans-serif' }}>Recibe ofertas, lanzamientos y consejos de bienestar.</p>
          <div style={{ display: 'flex', background: 'rgba(255,255,255,0.1)', borderRadius: 999, padding: 4, alignItems: 'center' }}>
            <input placeholder="tu@email.com" style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', color: 'var(--cream)', padding: '10px 16px', fontSize: 13, fontFamily: '"Geist", sans-serif' }} />
            <button style={{ background: 'var(--lime)', color: 'var(--ink)', border: 'none', padding: '10px 18px', borderRadius: 999, cursor: 'pointer', fontFamily: '"Geist", sans-serif', fontSize: 13, fontWeight: 500 }}>Suscribirme</button>
          </div>
        </div>
      </div>
      <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontFamily: '"JetBrains Mono", monospace', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.12em', opacity: 0.6 }}>
        <span>© 2026 Healthora · Farmacia digital</span>
        <span>Pagos seguros · Visa · Mastercard · Amex · Stripe</span>
      </div>
    </footer>
  );
}

function SocialIcon({ name }: { name: string }) {
  const common = { width: 16, height: 16, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, 'aria-hidden': true };

  switch (name) {
    case 'instagram':
      return <svg {...common}><rect x="3.5" y="3.5" width="17" height="17" rx="5" /><circle cx="12" cy="12" r="4" /><circle cx="17.4" cy="6.6" r="0.9" fill="currentColor" stroke="none" /></svg>;
    case 'x':
      return <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M18.9 2H22l-6.76 7.73L23.2 22h-6.23l-4.88-7.39L5.62 22H2.5l7.24-8.28L2.1 2h6.39l4.41 6.71L18.9 2Zm-1.09 18h1.72L7.56 3.9H5.72Z" /></svg>;
    case 'facebook':
      return <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M13.64 22v-8.03h2.69l.4-3.13h-3.09V8.84c0-.9.25-1.52 1.55-1.52H16.8V4.53c-.28-.04-1.22-.12-2.32-.12-2.29 0-3.86 1.4-3.86 3.98v2.45H8v3.13h2.62V22h3.02Z" /></svg>;
    case 'tiktok':
      return <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M15.86 3c.2 1.68 1.15 3.2 2.64 4.12.86.54 1.73.8 2.5.88v3.08a8.4 8.4 0 0 1-5.14-1.67v6.28a5.7 5.7 0 1 1-5.7-5.7c.34 0 .6.03.96.1v3.15a2.7 2.7 0 1 0 1.6 2.45V3h3.14Z" /></svg>;
    default:
      return null;
  }
}
