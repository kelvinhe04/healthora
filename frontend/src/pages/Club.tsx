import { AnimatedButton } from '../components/shared/AnimatedButton';
import { Icon } from '../components/shared/Icon';
import { useBreakpoint } from '../hooks/useBreakpoint';

type View = 'landing' | 'catalog' | 'product' | 'checkout' | 'success' | 'admin';

interface ClubProps {
  onNav: (view: View) => void;
}

export function Club({ onNav }: ClubProps) {
  const bp = useBreakpoint();
  const isMobile = bp === 'mobile';
  const isTablet = bp === 'tablet';
  const isSmall = isMobile || isTablet;
  return (
    <main style={{ padding: isMobile ? '40px 16px' : isTablet ? '48px 24px' : '60px 40px', maxWidth: 1200, margin: '0 auto' }}>
      <div style={{ textAlign: 'center', marginBottom: 56 }}>
        <div style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'var(--ink-60)', marginBottom: 12 }}>
          Club Healthora
        </div>
        <h1 style={{ fontFamily: '"Instrument Serif", serif', fontSize: isMobile ? 42 : isTablet ? 52 : 64, letterSpacing: '-0.035em', lineHeight: 1, margin: '0 0 20px', fontWeight: 400 }}>
          Unirte es <em style={{ color: 'var(--green)' }}>gratis</em> y siempre lo será.
        </h1>
        <p style={{ fontSize: 17, color: 'var(--ink-60)', maxWidth: 560, margin: '0 auto', lineHeight: 1.5 }}>
          Forma parte del club y disfruta de beneficios exclusivos en cada compra.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : isTablet ? 'repeat(2, 1fr)' : 'repeat(3, 1fr)', gap: 20, marginBottom: 64 }}>
        {[
          { icon: 'gift', title: 'Muestra premium', desc: 'Recibe 1 muestra seleccionada en órdenes mayores a $200.' },
          { icon: 'percent', title: 'Descuentos exclusivos', desc: 'Accede a ofertas solo para miembros antes que nadie.' },
          { icon: 'truck', title: 'Envío prioritario', desc: 'Tus pedidos se procesan primero, sin costo extra.' },
        ].map((b) => (
          <div key={b.title} style={{ background: 'var(--cream-2)', borderRadius: 24, padding: 32, border: '1px solid var(--ink-06)' }}>
            <div style={{ width: 52, height: 52, borderRadius: 999, background: 'var(--green)', color: 'var(--lime)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 20 }}>
              <Icon name={b.icon} size={22} />
            </div>
            <h3 style={{ fontFamily: '"Instrument Serif", serif', fontSize: 26, letterSpacing: '-0.02em', margin: '0 0 10px' }}>{b.title}</h3>
            <p style={{ fontSize: 14, color: 'var(--ink-60)', lineHeight: 1.5, margin: 0 }}>{b.desc}</p>
          </div>
        ))}
      </div>

      <div style={{ background: 'linear-gradient(120deg, oklch(0.28 0.055 155) 0%, oklch(0.32 0.06 155) 100%)', borderRadius: 28, padding: isSmall ? '40px 24px' : '64px', color: 'var(--cream)', textAlign: 'center' }}>
        <h2 style={{ fontFamily: '"Instrument Serif", serif', fontSize: 48, letterSpacing: '-0.03em', lineHeight: 1, margin: '0 0 16px', fontWeight: 400 }}>
          ¿Listo para unirte?
        </h2>
        <p style={{ fontSize: 16, opacity: 0.8, maxWidth: 400, margin: '0 auto 32px', lineHeight: 1.5 }}>
          Crea tu cuenta o inicia sesión para empezar a acumular beneficios desde tu primera compra.
        </p>
        <AnimatedButton variant="lime" size="lg" onClick={() => onNav('catalog')} icon={<Icon name="arrow-right" size={14} />} text="Comenzar ahora" />
      </div>
    </main>
  );
}
