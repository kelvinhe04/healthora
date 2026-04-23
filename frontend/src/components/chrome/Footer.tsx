const cols = [
  { title: 'Comprar', items: ['Vitaminas', 'Medicamentos', 'Cuidado personal', 'Bebé', 'Skincare', 'Fitness', 'Fragancias'] },
  { title: 'Ayuda', items: ['Contacto', 'Preguntas frecuentes', 'Envíos', 'Devoluciones', 'Estado de mi orden'] },
  { title: 'Legal', items: ['Términos y condiciones', 'Política de privacidad', 'Política de medicamentos', 'Cookies'] },
];

export function Footer() {
  return (
    <footer style={{ background: 'var(--green)', color: 'var(--cream)', padding: '64px 40px 32px', borderRadius: '32px 32px 0 0', marginTop: 80 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1.4fr repeat(3, 1fr) 1.4fr', gap: 48, marginBottom: 64 }}>
        <div>
          <div style={{ fontFamily: '"Instrument Serif", serif', fontSize: 48, letterSpacing: '-0.03em', lineHeight: 0.95, marginBottom: 20 }}>Healthora</div>
          <p style={{ fontSize: 14, lineHeight: 1.55, opacity: 0.72, maxWidth: 260, fontFamily: '"Geist", sans-serif' }}>Tu farmacia online para salud, cuidado personal, belleza y bienestar.</p>
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
