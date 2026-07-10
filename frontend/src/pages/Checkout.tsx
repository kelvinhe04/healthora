import { useCallback, useEffect, useId, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { useUser } from '@clerk/clerk-react';
import { useBreakpoint } from '../hooks/useBreakpoint';
import type { CartItem, OrderAddress, SavedAddress } from '../types';
import { ProductImage } from '../components/shared/ProductImage';
import { AnimatedButton } from '../components/shared/AnimatedButton';
import { Icon } from '../components/shared/Icon';
import { SignInModal } from '../components/chrome/SignInModal';
import { api } from '../lib/api';
import { useAuth } from '@clerk/clerk-react';
import { canApplyPromotion, getAvailablePromotionCodes, getPromotion, normalizePromotionCode } from '../lib/promotions';
import { useCartStore } from '../store/cartStore';
import { getE2EAuthToken, getE2EUser } from '../lib/e2eAuth';
import { resolveShipping, SHIPPING_METHOD_OPTIONS, type ShippingMethod } from '../lib/shipping';
import { formatPanamaPhone } from '../lib/phone';

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

function FormInput({ label, value, onChange, placeholder, full, required }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; full?: boolean; required?: boolean }) {
  const id = useId();
  return (
    <label htmlFor={id} style={{ display: 'flex', flexDirection: 'column', gap: 6, gridColumn: full ? '1 / -1' : 'auto' }}>
      <span style={{ fontSize: 11, fontFamily: '"JetBrains Mono", monospace', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--ink-60)' }}>
        {label} {required && <span style={{ color: 'var(--coral)' }}>*</span>}
      </span>
      <input id={id} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} required={required} autoComplete={label === 'Nombre' ? 'name' : label === 'Teléfono' ? 'tel' : label === 'Ciudad' ? 'address-level2' : label === 'Código postal' ? 'postal-code' : label === 'Dirección' ? 'street-address' : undefined} style={{ padding: '12px 14px', border: '1px solid var(--ink-20)', borderRadius: 10, background: 'var(--cream)', fontSize: 14, fontFamily: '"Geist", sans-serif', color: 'var(--ink)', outline: 'none' }} />
    </label>
  );
}

const stepCard = (compact: boolean): CSSProperties => ({ background: 'var(--cream-2)', borderRadius: compact ? 16 : 20, padding: compact ? '20px 16px' : 28, marginBottom: 16, border: '1px solid var(--ink-06)', transition: 'opacity 200ms' });
const stepHeader: CSSProperties = { display: 'flex', justifyContent: 'space-between', alignItems: 'center' };
const stepNum: CSSProperties = { fontFamily: '"JetBrains Mono", monospace', fontSize: 10, color: 'var(--ink-60)', letterSpacing: '0.12em', marginBottom: 4 };
const stepTitle: CSSProperties = { fontFamily: '"Instrument Serif", serif', fontSize: 28, letterSpacing: '-0.02em', margin: 0, color: 'var(--ink)', fontWeight: 400 };
const authBtn: CSSProperties = { padding: '14px 18px', borderRadius: 12, border: '1px solid var(--ink-20)', background: 'var(--cream)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 12, fontSize: 14, fontFamily: '"Geist", sans-serif', color: 'var(--ink)', width: '100%', transition: 'all 0.2s ease' };
const authLogoWrap: CSSProperties = { width: 28, height: 28, borderRadius: 8, background: 'white', border: '1px solid var(--ink-06)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: '0 6px 14px -12px rgba(0,0,0,0.24)', transition: 'transform 0.2s ease' };
const authLogoImg: CSSProperties = { width: 18, height: 18, display: 'block' };

function AuthButton({ onClick, icon, text }: { onClick: () => void; icon: ReactNode; text: string }) {
  return (
    <button
      onClick={onClick}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = 'translateY(-2px)';
        e.currentTarget.style.borderColor = 'var(--green)';
        e.currentTarget.style.boxShadow = '0 8px 24px -12px rgba(0,0,0,0.15)';
        const iconWrap = e.currentTarget.querySelector('span');
        if (iconWrap) iconWrap.style.transform = 'scale(1.1) rotate(-5deg)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = 'translateY(0)';
        e.currentTarget.style.borderColor = 'var(--ink-20)';
        e.currentTarget.style.boxShadow = 'none';
        const iconWrap = e.currentTarget.querySelector('span');
        if (iconWrap) iconWrap.style.transform = 'scale(1) rotate(0deg)';
      }}
      style={authBtn}
    >
      <span style={authLogoWrap}>{icon}</span>
      {text}
    </button>
  );
}

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

export function Checkout({ items, onBack }: CheckoutProps) {
  const bp = useBreakpoint();
  const isMobile = bp === 'mobile';
  const isTablet = bp === 'tablet';
  const isSmall = isMobile || isTablet;
  const { isSignedIn: clerkIsSignedIn, user: clerkUser } = useUser();
  const freeSample = useCartStore((s) => s.freeSample);
  const { getToken } = useAuth();
  const e2eUser = getE2EUser();
  const isSignedIn = Boolean(clerkIsSignedIn || e2eUser);
  const user = e2eUser ?? clerkUser;
  const getEffectiveToken = useCallback(async () => getE2EAuthToken() ?? getToken(), [getToken]);
  const [step, setStep] = useState(isSignedIn ? 2 : 1);
  const [showSignInModal, setShowSignInModal] = useState(false);

  useEffect(() => {
    if (isSignedIn && step === 1) {
      setStep(2);
    }
  }, [isSignedIn, step]);

  const [address, setAddress] = useState<OrderAddress>({ name: '', phone: '', address: '', city: '', postal: '' });
  const [shippingMethod, setShippingMethod] = useState<ShippingMethod>('delivery');
  const [savedAddresses, setSavedAddresses] = useState<SavedAddress[]>([]);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState('');
  const [addressError, setAddressError] = useState('');
  const [promoInput, setPromoInput] = useState('');
  const [appliedPromoCode, setAppliedPromoCode] = useState('');
  const [promoError, setPromoError] = useState('');
  const [hasPaidOrders, setHasPaidOrders] = useState(false);

  const isAddressValid = address.name.trim() && address.phone.trim()
    && (shippingMethod === 'pickup' || (address.address.trim() && address.city.trim() && address.postal.trim()));

  useEffect(() => {
    if (!isSignedIn) return;

    let cancelled = false;

    const loadSavedAddresses = async () => {
      try {
        const token = await getEffectiveToken();
        if (!token) return;
        const addresses = await api.account.addresses.list(token);
        if (cancelled) return;
        setSavedAddresses(addresses);

        const primaryAddress = addresses.find((entry) => entry.isDefault) || addresses[0];
        if (!primaryAddress) return;

        setAddress((current) => current.name || current.phone || current.address || current.city || current.postal
          ? current
          : {
              name: primaryAddress.name,
              phone: primaryAddress.phone,
              address: primaryAddress.address,
              city: primaryAddress.city,
              postal: primaryAddress.postal,
            });
      } catch (loadError) {
        console.error('Failed to load saved addresses', loadError);
      }
    };

    void loadSavedAddresses();

    return () => {
      cancelled = true;
    };
  }, [getEffectiveToken, isSignedIn]);

  useEffect(() => {
    if (!isSignedIn) {
      setHasPaidOrders(false);
      return;
    }

    let cancelled = false;

    const loadOrderEligibility = async () => {
      try {
        const token = await getEffectiveToken();
        if (!token) return;
        const orders = await api.orders.list(token);
        if (cancelled) return;
        const hasPaid = orders.some((order) => order.paymentStatus === 'paid' || order.status === 'paid');
        setHasPaidOrders(hasPaid);
        if (hasPaid && appliedPromoCode === 'BIENVENIDA') {
          setAppliedPromoCode('');
          setPromoInput('');
        }
      } catch (loadError) {
        console.error('Failed to load order eligibility', loadError);
      }
    };

    void loadOrderEligibility();

    return () => {
      cancelled = true;
    };
  }, [appliedPromoCode, getEffectiveToken, isSignedIn]);

  const subtotal = roundMoney(items.reduce((s, it) => s + (it.variant?.price ?? it.product.price) * it.qty, 0));
  const appliedPromo = appliedPromoCode ? getPromotion(appliedPromoCode, items) : null;
  const discountAmount = appliedPromo?.discountAmount ?? 0;
  const discountedSubtotal = roundMoney(Math.max(0, subtotal - discountAmount));
  const shippingResolved = resolveShipping(shippingMethod, discountedSubtotal);
  const shipping = shippingResolved.cost;
  const tax = roundMoney(discountedSubtotal * 0.07);
  const total = roundMoney(discountedSubtotal + shipping + tax);

  const handleApplyPromo = (code = promoInput) => {
    const normalizedCode = normalizePromotionCode(code);
    const promotion = getPromotion(normalizedCode, items);

    if (!normalizedCode) {
      setPromoError('Ingresa un código de descuento.');
      return;
    }

    if (!promotion) {
      setAppliedPromoCode('');
      setPromoError('Código inválido o sin productos elegibles.');
      return;
    }

    setAppliedPromoCode(promotion.code);
    setPromoInput(promotion.code);
    setPromoError('');
  };

  const handleRemovePromo = () => {
    setAppliedPromoCode('');
    setPromoInput('');
    setPromoError('');
  };

  const handlePay = async () => {
    if (!isAddressValid) {
      setAddressError('Por favor completa todos los campos requeridos');
      return;
    }
    setProcessing(true);
    setError('');
    try {
      const token = await getEffectiveToken();
      const { url } = await api.checkout.createSession(
        {
          items: items.map((it) => ({
            productId: it.product.id,
            qty: it.qty,
            ...(it.variant?.id ? { variantId: it.variant.id } : {}),
          })),
          address,
          promoCode: appliedPromo?.code,
          freeSampleId: freeSample?.id,
          shippingMethod,
        },
        token!
      );
      window.location.href = url;
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Error al procesar el pago';
      if (appliedPromo) setPromoError(message);
      setError(message);
      setProcessing(false);
    }
  };

  return (
    <div style={{ padding: isMobile ? '20px 16px 0' : isTablet ? '24px 24px 0' : '24px 40px 0' }}>
      <button type="button" onClick={onBack} aria-label="Volver a la tienda" style={{ background: 'transparent', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, color: 'var(--ink-60)', fontSize: 13, marginBottom: 24, fontFamily: '"Geist", sans-serif' }}>
        <Icon name="arrow-left" size={14} /> Volver a la tienda
      </button>

      <div style={{ display: 'grid', gridTemplateColumns: isSmall ? '1fr' : '1.3fr 1fr', gap: isSmall ? 24 : 48, alignItems: 'start' }}>
        <div>
          <div style={{ marginBottom: 32 }}>
            <div style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'var(--ink-60)', marginBottom: 10 }}>Checkout · Paso {step} de 3</div>
            <h1 style={{ fontFamily: '"Instrument Serif", serif', fontSize: isMobile ? 40 : isTablet ? 50 : 60, letterSpacing: '-0.035em', lineHeight: 1, margin: 0, color: 'var(--ink)', fontWeight: 400 }}>Finaliza tu <em style={{ color: 'var(--green)' }}>compra</em></h1>
          </div>

          <div
            role="progressbar"
            aria-label="Progreso del checkout"
            aria-valuemin={1}
            aria-valuemax={3}
            aria-valuenow={step}
            style={{ display: 'flex', gap: 8, marginBottom: 32 }}
          >
            {[1, 2, 3].map((n) => <div key={n} style={{ flex: 1, height: 4, borderRadius: 999, background: step >= n ? 'var(--green)' : 'var(--ink-06)' }} />)}
          </div>

          {/* Step 1: Auth */}
          <section style={stepCard(isMobile)}>
            <div style={stepHeader}>
              <div>
                <div style={stepNum}>01</div>
                <h2 style={stepTitle}>Identifícate</h2>
              </div>
              {isSignedIn && <span style={{ fontSize: 12, color: 'var(--green)', fontFamily: '"JetBrains Mono", monospace', letterSpacing: '0.06em' }}>✓ AUTENTICADO</span>}
            </div>
            {!isSignedIn ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 20 }}>
                <AuthButton 
                  onClick={() => setShowSignInModal(true)} 
                  icon={<img src="/brands/google.svg" alt="Google" style={authLogoImg} />} 
                  text="Continuar con Google" 
                />
                <AuthButton 
                  onClick={() => setShowSignInModal(true)} 
                  icon={<img src="/brands/microsoft.svg" alt="Microsoft" style={authLogoImg} />} 
                  text="Continuar con Microsoft" 
                />
                <AuthButton 
                  onClick={() => setShowSignInModal(true)} 
                  icon={<Icon name="lock" size={16} />} 
                  text="Recibir código OTP por email" 
                />
                <div style={{ fontSize: 11, color: 'var(--ink-60)', fontFamily: '"JetBrains Mono", monospace', letterSpacing: '0.06em', marginTop: 6, textAlign: 'center' }}>AUTENTICACIÓN PROTEGIDA POR CLERK</div>
              </div>
            ) : (
              <div style={{ marginTop: 16, padding: 16, background: 'var(--cream)', border: '1px solid var(--ink-06)', borderRadius: 12, display: 'flex', alignItems: 'center', gap: 14 }}>
                {user?.imageUrl ? (
                  <img src={user.imageUrl} alt={user?.fullName || 'Usuario'} style={{ width: 40, height: 40, borderRadius: 999, objectFit: 'cover' }} />
                ) : (
                  <div style={{ width: 40, height: 40, borderRadius: 999, background: 'var(--green)', color: 'var(--lime)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontFamily: '"Instrument Serif", serif' }}>
                    {user?.firstName?.[0] || user?.primaryEmailAddress?.emailAddress?.[0]?.toUpperCase() || 'U'}
                  </div>
                )}
                <div>
                  <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--ink)' }}>{user?.fullName || user?.primaryEmailAddress?.emailAddress}</div>
                  <div style={{ fontSize: 11, color: 'var(--ink-60)', fontFamily: '"JetBrains Mono", monospace', marginTop: 2 }}>SESIÓN ACTIVA</div>
                </div>
              </div>
            )}
          </section>

          {/* Step 2: Address */}
          <section style={{ ...stepCard(isMobile), opacity: isSignedIn ? 1 : 0.4, pointerEvents: isSignedIn ? 'auto' : 'none' }}>
            <div style={stepHeader}>
              <div>
                <div style={stepNum}>02</div>
                <h2 style={stepTitle}>{shippingMethod === 'pickup' ? 'Tus datos' : 'Dirección de envío'}</h2>
              </div>
            </div>

            <div style={{ marginTop: 20 }}>
              <span style={{ fontSize: 11, fontFamily: '"JetBrains Mono", monospace', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--ink-60)' }}>Entrega</span>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
                {SHIPPING_METHOD_OPTIONS.map((option) => {
                  const resolved = resolveShipping(option.value, discountedSubtotal);
                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setShippingMethod(option.value)}
                      style={{
                        border: shippingMethod === option.value ? '1px solid var(--green)' : '1px solid var(--ink-20)',
                        background: shippingMethod === option.value ? 'var(--ink-06)' : 'var(--cream)',
                        borderRadius: 12,
                        padding: '10px 14px',
                        cursor: 'pointer',
                        textAlign: 'left',
                        fontFamily: '"Geist", sans-serif',
                      }}
                    >
                      <div style={{ fontSize: 13, color: 'var(--ink)' }}>{option.label} <span style={{ color: 'var(--ink-60)' }}>· {resolved.eta}</span></div>
                      <div style={{ fontSize: 12, color: 'var(--green)', marginTop: 2 }}>{resolved.cost === 0 ? 'GRATIS' : `$${resolved.cost.toFixed(2)}`}</div>
                    </button>
                  );
                })}
              </div>
            </div>

            {shippingMethod === 'delivery' && savedAddresses.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 20 }}>
                {savedAddresses.map((savedAddress, index) => (
                  <button
                    key={`${savedAddress.label}-${savedAddress.address}-${index}`}
                    onClick={() => setAddress({
                      name: savedAddress.name,
                      phone: savedAddress.phone,
                      address: savedAddress.address,
                      city: savedAddress.city,
                      postal: savedAddress.postal,
                    })}
                    style={{
                      border: savedAddress.isDefault ? '1px solid var(--green)' : '1px solid var(--ink-20)',
                      background: savedAddress.isDefault ? 'var(--ink-06)' : 'var(--ink-04)',
                      borderRadius: 999,
                      padding: '8px 12px',
                      cursor: 'pointer',
                      fontSize: 12,
                      fontFamily: '"Geist", sans-serif',
                      color: 'var(--ink)',
                    }}
                  >
                    {savedAddress.label || `Dirección ${index + 1}`}
                  </button>
                ))}
              </div>
            )}
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 12, marginTop: 20 }}>
              <FormInput label="Nombre completo" value={address.name} onChange={(v) => { setAddress({ ...address, name: v }); setAddressError(''); }} placeholder="María Gómez" required />
              <FormInput label="Teléfono" value={address.phone} onChange={(v) => { setAddress({ ...address, phone: formatPanamaPhone(v) }); setAddressError(''); }} placeholder="6123-4567" required />
              {shippingMethod === 'delivery' && (
                <>
                  <FormInput label="Dirección" value={address.address} onChange={(v) => { setAddress({ ...address, address: v }); setAddressError(''); }} placeholder="Calle, número, apto" full required />
                  <FormInput label="Ciudad" value={address.city} onChange={(v) => { setAddress({ ...address, city: v }); setAddressError(''); }} placeholder="Ciudad" required />
                  <FormInput label="Código postal" value={address.postal} onChange={(v) => { setAddress({ ...address, postal: v.replace(/\D/g, '') }); setAddressError(''); }} placeholder="10001" required />
                </>
              )}
            </div>
            {addressError && <div role="alert" style={{ marginTop: 12, color: 'var(--coral)', fontSize: 13, fontFamily: '"Geist", sans-serif' }}>{addressError}</div>}

            {step === 2 && (
              <AnimatedButton aria-label="Continuar al pago" variant="primary" onClick={() => { if (!isAddressValid) { setAddressError('Por favor completa todos los campos requeridos'); } else { setStep(3); }}} style={{ marginTop: 16 }} disabled={!isAddressValid} text="Continuar al pago" />
            )}
          </section>

          {/* Step 3: Payment */}
          <section style={{ ...stepCard(isMobile), opacity: step >= 3 ? 1 : 0.4, pointerEvents: step >= 3 ? 'auto' : 'none' }}>
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
            {error && <div role="alert" style={{ marginTop: 12, color: 'var(--coral)', fontSize: 13, fontFamily: '"Geist", sans-serif' }}>{error}</div>}
            <AnimatedButton aria-label={processing ? 'Redirigiendo a Stripe' : `Pagar $${total.toFixed(2)}`} variant="primary" size="lg" full onClick={handlePay} style={{ marginTop: 20 }} icon={<Icon name="lock" size={14} />} disabled={processing} text={processing ? 'Redirigiendo a Stripe…' : `Pagar $${total.toFixed(2)}`} />
          </section>
        </div>

        {/* Order Summary */}
        <aside style={{ position: isSmall ? 'static' : 'sticky', top: 100, background: 'var(--cream-2)', borderRadius: 24, padding: 28, border: '1px solid var(--ink-06)', marginBottom: isSmall ? 40 : 0 }}>
          <div style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'var(--ink-60)', marginBottom: 14 }}>Resumen de orden</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 28, marginBottom: 18 }}>
            {items.map((it) => (
              <div key={it.product.id + (it.variant?.id ?? '')} style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <div style={{ width: 50, height: 56, background: it.product.color, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, position: 'relative' }}>
                  <ProductImage product={it.product} size="xs" imageUrl={it.variant?.images?.[0] ?? it.variant?.imageUrl} />
                  <span style={{ position: 'absolute', top: -5, right: -4, width: 15, height: 15, borderRadius: 999, background: 'oklch(0.1 0.01 155)', color: '#fff', fontSize: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: '"JetBrains Mono", monospace', fontWeight: 700 }}>{it.qty}</span>
                </div>
                <div style={{ flex: 1, fontSize: 13, fontFamily: '"Geist", sans-serif' }}>
                  <div style={{ fontWeight: 500, lineHeight: 1.3 }}>{it.product.name}</div>
                  <div style={{ fontSize: 11, color: 'var(--ink-60)', fontFamily: '"JetBrains Mono", monospace' }}>{it.variant ? it.variant.label : it.product.brand}</div>
                </div>
                <div style={{ fontFamily: '"Instrument Serif", serif', fontSize: 16 }}>${((it.variant?.price ?? it.product.price) * it.qty).toFixed(2)}</div>
              </div>
            ))}
            {freeSample && (
              <div style={{ display: 'flex', gap: 10, alignItems: 'center', paddingTop: 20, borderTop: '1px solid var(--ink-06)' }}>
                <div style={{ width: 50, height: 56, background: freeSample.color || 'white', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, position: 'relative', border: '1.5px solid color-mix(in srgb, var(--green) 35%, transparent)' }}>
                  <ProductImage product={freeSample} size="xs" />
                  <span style={{ position: 'absolute', top: -5, right: -4, width: 15, height: 15, borderRadius: 999, background: 'var(--green)', color: '#fff', fontSize: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: '"JetBrains Mono", monospace', fontWeight: 700 }}>1</span>
                </div>
                <div style={{ flex: 1, fontSize: 13, fontFamily: '"Geist", sans-serif' }}>
                  <div style={{ fontWeight: 500, lineHeight: 1.3 }}>{freeSample.name}</div>
                  <div style={{ fontSize: 10, color: 'var(--green)', fontFamily: '"JetBrains Mono", monospace', letterSpacing: '0.06em', marginTop: 2 }}>MUESTRA GRATIS · CLUB HEALTHORA</div>
                </div>
                <div style={{ fontFamily: '"Instrument Serif", serif', fontSize: 16, color: 'var(--green)' }}>$0.00</div>
              </div>
            )}
          </div>
          <div style={{ padding: '16px 0', borderTop: '1px solid var(--ink-06)' }}>
            <label htmlFor="promo-code" style={{ display: 'block', marginBottom: 8, fontSize: 11, fontFamily: '"JetBrains Mono", monospace', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--ink-60)' }}>
              Código de descuento
            </label>
            <form
              onSubmit={(event) => {
                event.preventDefault();
                handleApplyPromo();
              }}
              style={{ display: 'flex', gap: 8 }}
            >
              <input
                id="promo-code"
                value={promoInput}
                onChange={(event) => {
                  setPromoInput(event.target.value.toUpperCase());
                  setPromoError('');
                }}
                placeholder="BIENVENIDA"
                disabled={processing}
                style={{ flex: 1, minWidth: 0, height: 44, border: '1px solid var(--ink-20)', borderRadius: 999, background: 'var(--cream)', padding: '0 14px', outline: 'none', color: 'var(--ink)', fontSize: 13, fontFamily: '"JetBrains Mono", monospace', letterSpacing: '0.04em' }}
              />
              {appliedPromo ? (
                <button type="button" onClick={handleRemovePromo} disabled={processing} style={{ height: 44, border: '1px solid var(--ink-20)', borderRadius: 999, background: 'transparent', padding: '0 14px', cursor: processing ? 'not-allowed' : 'pointer', color: 'var(--ink-60)', fontSize: 12, fontFamily: '"Geist", sans-serif' }}>
                  Quitar
                </button>
              ) : (
                <AnimatedButton type="submit" disabled={processing} variant="primary" size="sm" text="Aplicar" />
              )}
            </form>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
              {getAvailablePromotionCodes().filter((code) => {
                if (code === 'BIENVENIDA' && hasPaidOrders) return false;
                if (code === 'PIEL25' && !canApplyPromotion(code, items)) return false;
                return true;
              }).map((code) => {
                const isActive = appliedPromo?.code === code;
                return (
                  <button key={code} type="button" onClick={() => handleApplyPromo(code)} disabled={processing} style={{ border: isActive ? '1px solid var(--lime)' : '1px solid var(--ink-12)', background: isActive ? 'var(--lime)' : 'var(--cream)', color: isActive ? 'oklch(0.2 0.03 155)' : 'var(--ink)', borderRadius: 999, padding: '6px 9px', cursor: processing ? 'not-allowed' : 'pointer', fontSize: 10, fontFamily: '"JetBrains Mono", monospace', letterSpacing: '0.06em' }}>
                    {code}
                  </button>
                );
              })}
            </div>
            {appliedPromo && (
              <div aria-live="polite" style={{ marginTop: 10, padding: 10, borderRadius: 12, background: 'color-mix(in oklab, var(--green) 9%, white)', border: '1px solid color-mix(in oklab, var(--green) 18%, white)', color: 'var(--green)', fontSize: 12, fontFamily: '"Geist", sans-serif', lineHeight: 1.4 }}>
                {appliedPromo.label}: ahorras ${discountAmount.toFixed(2)}.
                {appliedPromo.code === 'BIENVENIDA' && <span> Solo válido en tu primera compra pagada.</span>}
              </div>
            )}
            {promoError && <div role="alert" style={{ marginTop: 8, color: 'var(--coral)', fontSize: 12, fontFamily: '"Geist", sans-serif', lineHeight: 1.4 }}>{promoError}</div>}
          </div>
          <div style={{ padding: '14px 0', borderTop: '1px solid var(--ink-06)' }}>
            <Row k="Subtotal" v={`$${subtotal.toFixed(2)}`} />
            {discountAmount > 0 && <Row k={`Descuento ${appliedPromo?.code}`} v={<span style={{ color: 'var(--green)' }}>-${discountAmount.toFixed(2)}</span>} />}
            {freeSample && <Row k="Muestra gratis" v={<span style={{ color: 'var(--green)' }}>$0.00</span>} />}
            <Row k={`Envío (${shippingResolved.eta})`} v={shipping === 0 ? 'GRATIS' : `$${shipping.toFixed(2)}`} />
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
      <SignInModal open={showSignInModal} onClose={() => setShowSignInModal(false)} />
    </div>
  );
}
