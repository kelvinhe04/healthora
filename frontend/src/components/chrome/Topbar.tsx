const msgs = [
  'Envío gratis en compras mayores a $50',
  'Obtén muestras gratis en órdenes seleccionadas',
  'Nuevos clientes: 15% con código BIENVENIDA',
  'Envío gratis en compras mayores a $50',
  'Obtén muestras gratis en órdenes seleccionadas',
  'Nuevos clientes: 15% con código BIENVENIDA',
];

export function Topbar() {
  return (
    <div style={{ background: 'var(--ink)', color: 'var(--cream)', fontFamily: '"JetBrains Mono", monospace', fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase', padding: '10px 0', overflow: 'hidden', position: 'relative' }}>
      <style>{`
        @keyframes marquee-scroll { 0% { transform: translateX(0); } 100% { transform: translateX(-50%); } }
        .marquee-track { display: flex; width: max-content; animation: marquee-scroll 28s linear infinite; }
        .marquee-track:hover { animation-play-state: paused; }
      `}</style>
      <div className="marquee-track">
        {msgs.map((m, i) => (
          <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 24, padding: '0 40px', whiteSpace: 'nowrap' }}>
            <span style={{ width: 4, height: 4, background: 'var(--lime)', borderRadius: 999, flexShrink: 0 }} />
            {m}
          </span>
        ))}
      </div>
    </div>
  );
}
