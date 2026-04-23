import { useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { useUser, useClerk } from '@clerk/clerk-react';
import type { CartItem, OrderAddress } from '../types';
import { ProductImage } from '../components/shared/ProductImage';
import { Button } from '../components/shared/Button';
import { Icon } from '../components/shared/Icon';
import { api } from '../lib/api';
import { useAuth } from '@clerk/clerk-react';

interface CheckoutProps {
  items: CartItem[];
  onBack: () => void;
}

function Row({ k, v }: { k: ReactNode; v: ReactNode }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '5px 0', fontSize: 13, fontFamily: '"Geist", sans-serif', color: 'var(--ink-80)' }}>
      <span>{k}</span><span>{v}</span>
    </div>
  );
}

function FormInput({ label, value, onChange, placeholder, full }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; full?: boolean }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 6, gridColumn: full ? '1 / -1' : 'auto' }}>
      <span style={{ fontSize: 11, fontFamily: '"JetBrains Mono", monospace', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--ink-60)' }}>{label}</span>
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} style={{ padding: '12px 14px', border: '1px solid var(--ink-20)', borderRadius: 10, background: 'var(--cream)', fontSize: 14, fontFamily: '"Geist", sans-serif', color: 'var(--ink)', outline: 'none' }} />
    </label>
  );
}

const stepCard: CSSProperties = { background: 'var(--cream-2)', borderRadius: 20, padding: 28, marginBottom: 16, border: '1px solid var(--ink-06)', transition: 'opacity 200ms' };
const stepHeader: CSSProperties = { display: 'flex', justifyContent: 'space-between', alignItems: 'center' };
const stepNum: CSSProperties = { fontFamily: '"JetBrains Mono", monospace', fontSize: 10, color: 'var(--ink-60)', letterSpacing: '0.12em', marginBottom: 4 };
const stepTitle: CSSProperties = { fontFamily: '"Instrument Serif", serif', fontSize: 28, letterSpacing: '-0.02em', margin: 0, color: 'var(--ink)', fontWeight: 400 };
const authBtn: CSSProperties = { padding: '14px 18px', borderRadius: 12, border: '1px solid var(--ink-20)', background: 'var(--cream)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 12, fontSize: 14, fontFamily: '"Geist", sans-serif', color: 'var(--ink)', width: '100%' };

export function Checkout({ items, onBack }: CheckoutProps) {
  const { isSignedIn, user } = useUser();
  const { openSignIn } = useClerk();
  const { getToken } = useAuth();
  const [step, setStep] = useState(isSignedIn ? 2 : 1);
  const [address, setAddress] = useState<OrderAddress>({ name: '', phone: '', address: '', city: '', postal: '' });
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState('');

  const subtotal = items.reduce((s, it) => s + it.product.price * it.qty, 0);
  const shipping = subtotal > 50 ? 0 : 6.90;
  const tax = subtotal * 0.07;
  const total = subtotal + shipping + tax;

  const handlePay = async () => {
    setProcessing(true);
    setError('');
    try {
      const token = await getToken();
      const { url } = await api.checkout.createSession(
        {
          items: items.map((it) => ({ productId: it.product.id, qty: it.qty })),
          address,
        },
        token!
      );
      window.location.href = url;
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error al procesar el pago');
      setProcessing(false);
    }
  };

  return (
    <main style={{ padding: '24px 40px 0' }}>
      <button onClick={onBack} style={{ background: 'transparent', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, color: 'var(--ink-60)', fontSize: 13, marginBottom: 24, fontFamily: '"Geist", sans-serif' }}>
        <Icon name="arrow-left" size={14} /> Volver a la tienda
      </button>

      <div style={{ display: 'grid', gridTemplateColumns: '1.3fr 1fr', gap: 48, alignItems: 'start' }}>
        <div>
          <div style={{ marginBottom: 32 }}>
            <div style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'var(--ink-60)', marginBottom: 10 }}>Checkout · Paso {step} de 3</div>
            <h1 style={{ fontFamily: '"Instrument Serif", serif', fontSize: 60, letterSpacing: '-0.035em', lineHeight: 1, margin: 0, color: 'var(--ink)', fontWeight: 400 }}>Finaliza tu <em style={{ color: 'var(--green)' }}>compra</em></h1>
          </div>

          <div style={{ display: 'flex', gap: 8, marginBottom: 32 }}>
            {[1, 2, 3].map((n) => <div key={n} style={{ flex: 1, height: 4, borderRadius: 999, background: step >= n ? 'var(--green)' : 'var(--ink-06)' }} />)}
          </div>

          {/* Step 1: Auth */}
          <section style={stepCard}>
            <div style={stepHeader}>
              <div>
                <div style={stepNum}>01</div>
                <h2 style={stepTitle}>Identifícate</h2>
              </div>
              {isSignedIn && <span style={{ fontSize: 12, color: 'var(--green)', fontFamily: '"JetBrains Mono", monospace', letterSpacing: '0.06em' }}>✓ AUTENTICADO</span>}
            </div>
            {!isSignedIn ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 20 }}>
                <button style={authBtn} onClick={() => openSignIn({ redirectUrl: window.location.href })}>
                  <span style={{ width: 20, height: 20, borderRadius: 4, background: 'conic-gradient(#ea4335, #fbbc04, #34a853, #4285f4)' }} />
                  Continuar con Google
                </button>
                <button style={authBtn} onClick={() => openSignIn({ redirectUrl: window.location.href })}>
                  <span style={{ width: 20, height: 20, background: '#00a4ef', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1 }}>
                    <div style={{ background: '#f25022' }} /><div style={{ background: '#7fba00' }} />
                    <div style={{ background: '#00a4ef' }} /><div style={{ background: '#ffb900' }} />
                  </span>
                  Continuar con Microsoft
                </button>
                <button style={authBtn} onClick={() => openSignIn({ redirectUrl: window.location.href })}>
                  <Icon name="lock" size={16} /> Recibir código OTP por email
                </button>
                <div style={{ fontSize: 11, color: 'var(--ink-60)', fontFamily: '"JetBrains Mono", monospace', letterSpacing: '0.06em', marginTop: 6, textAlign: 'center' }}>AUTENTICACIÓN PROTEGIDA POR CLERK</div>
              </div>
            ) : (
              <div style={{ marginTop: 14, padding: 14, background: 'var(--cream-2)', borderRadius: 12, display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 36, height: 36, borderRadius: 999, background: 'var(--green)', color: 'var(--lime)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontFamily: '"Instrument Serif", serif' }}>
                  {user?.firstName?.[0] || 'U'}
                </div>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 500 }}>{user?.primaryEmailAddress?.emailAddress}</div>
                  <div style={{ fontSize: 11, color: 'var(--ink-60)', fontFamily: '"JetBrains Mono", monospace' }}>SESIÓN ACTIVA</div>
                </div>
              </div>
            )}
          </section>

          {/* Step 2: Address */}
          <section style={{ ...stepCard, opacity: isSignedIn ? 1 : 0.4, pointerEvents: isSignedIn ? 'auto' : 'none' }}>
            <div style={stepHeader}>
              <div>
                <div style={stepNum}>02</div>
                <h2 style={stepTitle}>Dirección de envío</h2>
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 20 }}>
              <FormInput label="Nombre completo" value={address.name} onChange={(v) => setAddress({ ...address, name: v })} placeholder="María Gómez" />
              <FormInput label="Teléfono" value={address.phone} onChange={(v) => setAddress({ ...address, phone: v })} placeholder="+1 555 000 000" />
              <FormInput label="Dirección" value={address.address} onChange={(v) => setAddress({ ...address, address: v })} placeholder="Calle, número, apto" full />
              <FormInput label="Ciudad" value={address.city} onChange={(v) => setAddress({ ...address, city: v })} placeholder="Ciudad" />
              <FormInput label="Código postal" value={address.postal} onChange={(v) => setAddress({ ...address, postal: v })} placeholder="10001" />
            </div>
            {step === 2 && (
              <Button variant="primary" onClick={() => setStep(3)} style={{ marginTop: 16 }}
                disabled={!address.name || !address.address || !address.city || !address.postal}>
                Continuar al pago
              </Button>
            )}
          </section>

          {/* Step 3: Payment */}
          <section style={{ ...stepCard, opacity: step >= 3 ? 1 : 0.4, pointerEvents: step >= 3 ? 'auto' : 'none' }}>
            <div style={stepHeader}>
              <div>
                <div style={stepNum}>03</div>
                <h2 style={stepTitle}>Método de pago</h2>
              </div>
              <span style={{ fontSize: 11, color: 'var(--ink-60)', fontFamily: '"JetBrains Mono", monospace', letterSpacing: '0.06em' }}>STRIPE CHECKOUT</span>
            </div>
            <div style={{ marginTop: 20, padding: 18, border: '1px solid var(--ink-20)', borderRadius: 14, background: 'var(--cream-2)', fontSize: 14, fontFamily: '"Geist", sans-serif', color: 'var(--ink-80)', lineHeight: 1.6 }}>
              Serás redirigido a Stripe Checkout para completar el pago de forma segura. Acepta tarjetas Visa, Mastercard, Amex y más.
            </div>
            {error && <div style={{ marginTop: 12, color: 'var(--coral)', fontSize: 13, fontFamily: '"Geist", sans-serif' }}>{error}</div>}
            <Button variant="primary" size="lg" full onClick={handlePay} style={{ marginTop: 20 }} icon={<Icon name="lock" size={14} />} disabled={processing}>
              {processing ? 'Redirigiendo a Stripe…' : `Pagar $${total.toFixed(2)}`}
            </Button>
          </section>
        </div>

        {/* Order Summary */}
        <aside style={{ position: 'sticky', top: 100, background: 'var(--cream-2)', borderRadius: 24, padding: 28, border: '1px solid var(--ink-06)' }}>
          <div style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'var(--ink-60)', marginBottom: 14 }}>Resumen de orden</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 18 }}>
            {items.map((it) => (
              <div key={it.product.id} style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <div style={{ width: 50, height: 56, background: it.product.color, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, position: 'relative' }}>
                  <ProductImage product={it.product} size="xs" />
                  <span style={{ position: 'absolute', top: -6, right: -6, width: 20, height: 20, borderRadius: 999, background: 'var(--ink)', color: 'var(--cream)', fontSize: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: '"JetBrains Mono", monospace', fontWeight: 700 }}>{it.qty}</span>
                </div>
                <div style={{ flex: 1, fontSize: 13, fontFamily: '"Geist", sans-serif' }}>
                  <div style={{ fontWeight: 500, lineHeight: 1.3 }}>{it.product.name}</div>
                  <div style={{ fontSize: 11, color: 'var(--ink-60)', fontFamily: '"JetBrains Mono", monospace' }}>{it.product.brand}</div>
                </div>
                <div style={{ fontFamily: '"Instrument Serif", serif', fontSize: 16 }}>${(it.product.price * it.qty).toFixed(2)}</div>
              </div>
            ))}
          </div>
          <div style={{ padding: '14px 0', borderTop: '1px solid var(--ink-06)' }}>
            <Row k="Subtotal" v={`$${subtotal.toFixed(2)}`} />
            <Row k="Envío" v={shipping === 0 ? 'GRATIS' : `$${shipping.toFixed(2)}`} />
            <Row k="Impuestos" v={`$${tax.toFixed(2)}`} />
          </div>
          <div style={{ padding: '14px 0', borderTop: '1px solid var(--ink-06)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <strong style={{ fontSize: 16, fontFamily: '"Geist", sans-serif' }}>Total</strong>
            <strong style={{ fontSize: 30, fontFamily: '"Instrument Serif", serif', color: 'var(--ink)', letterSpacing: '-0.02em' }}>${total.toFixed(2)}</strong>
          </div>
          <div style={{ marginTop: 16, padding: 12, background: 'var(--cream)', borderRadius: 12, display: 'flex', alignItems: 'center', gap: 10, fontSize: 12, color: 'var(--ink-80)' }}>
            <Icon name="shield" size={16} /> Pago procesado de forma segura por Stripe
          </div>
        </aside>
      </div>
    </main>
  );
}
