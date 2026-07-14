import { useEffect, useId, useState } from 'react';
import { useAuth } from '@clerk/clerk-react';
import { useQuery } from '@tanstack/react-query';
import { loadStripe } from '@stripe/stripe-js';
import { CardElement, Elements, useElements, useStripe } from '@stripe/react-stripe-js';
import { useBreakpoint } from '../../hooks/useBreakpoint';
import type { OrderAddress, SavedAddress, SavedPaymentMethod, SubscriptionIntervalDays } from '../../types';
import { MAX_SUBSCRIPTION_INTERVAL_DAYS, MIN_SUBSCRIPTION_INTERVAL_DAYS, SUBSCRIPTION_INTERVAL_DAYS } from '../../types';
import { ModalOverlay } from './ModalOverlay';
import { AnimatedButton } from './AnimatedButton';
import { StripeCardInput } from './StripeCardInput';
import { Icon } from './Icon';
import { api } from '../../lib/api';
import { SHIPPING_METHOD_OPTIONS, resolveShipping, type ShippingMethod } from '../../lib/shipping';
import { computeItbms } from '../../lib/tax';

interface SubscribeModalProps {
  open: boolean;
  onClose: () => void;
  productId: string;
  variantId?: string;
  productLabel: string;
  unitPrice: number;
  taxExempt?: boolean;
  defaultQty: number;
}

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

const INTERVAL_LABELS: Record<SubscriptionIntervalDays, string> = {
  7: 'Cada 7 días',
  15: 'Cada 15 días',
  30: 'Cada 30 días',
  60: 'Cada 60 días',
};

const NEW_CARD_OPTION = 'new';

const stripePromise = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY
  ? loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY)
  : null;

function FormInput({ label, value, onChange, required }: { label: string; value: string; onChange: (v: string) => void; required?: boolean }) {
  const id = useId();
  return (
    <label htmlFor={id} style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 }}>
      <span style={{ fontSize: 11, fontFamily: '"JetBrains Mono", monospace', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--ink-60)' }}>
        {label} {required && <span style={{ color: 'var(--coral)' }}>*</span>}
      </span>
      <input
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        style={{ width: '100%', boxSizing: 'border-box', minWidth: 0, padding: '11px 13px', border: '1px solid var(--ink-20)', borderRadius: 10, background: 'var(--cream)', fontSize: 14, fontFamily: '"Geist", sans-serif', color: 'var(--ink)', outline: 'none' }}
      />
    </label>
  );
}

function SavedCardRow({ method, selected, onSelect }: { method: SavedPaymentMethod; selected: boolean; onSelect: () => void }) {
  return (
    <button
      type="button"
      onClick={onSelect}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        width: '100%',
        textAlign: 'left',
        border: selected ? '1px solid var(--green)' : '1px solid var(--ink-06)',
        background: selected ? 'var(--ink-06)' : 'var(--cream)',
        borderRadius: 12,
        padding: '10px 14px',
        cursor: 'pointer',
        fontFamily: '"Geist", sans-serif',
      }}
    >
      <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <Icon name="credit-card" size={16} />
        <span style={{ fontSize: 13, textTransform: 'capitalize' }}>{method.brand} •••• {method.last4}</span>
        <span style={{ fontSize: 12, color: 'var(--ink-60)', fontFamily: '"JetBrains Mono", monospace' }}>
          {String(method.expMonth).padStart(2, '0')}/{method.expYear}
        </span>
      </span>
      {selected && <Icon name="check" size={16} />}
    </button>
  );
}

/**
 * Rendered inside <Elements> (useStripe/useElements only work below the provider). Creates the
 * subscription (POST /subscriptions returns an incomplete subscription's PaymentIntent client
 * secret) and confirms it right here with stripe.confirmCardPayment - same embedded pattern as
 * Checkout.tsx's CheckoutPaymentStep, no redirect to a Stripe-hosted page.
 */
function SubscribePaymentStep({
  getToken,
  productId,
  variantId,
  qty,
  intervalDays,
  address,
  shippingMethod,
  isAddressValid,
  total,
  onSuccess,
}: {
  getToken: () => Promise<string | null>;
  productId: string;
  variantId?: string;
  qty: number;
  intervalDays: SubscriptionIntervalDays;
  address: OrderAddress;
  shippingMethod: ShippingMethod;
  isAddressValid: boolean;
  total: number;
  onSuccess: () => void;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const savedCardsQuery = useQuery({
    queryKey: ['payment-methods'],
    queryFn: async () => {
      const token = await getToken();
      if (!token) return [];
      return api.account.paymentMethods.list(token);
    },
  });
  const savedCards = savedCardsQuery.data ?? [];
  const activeSelection = selectedId
    ?? (savedCards.find((m) => m.isDefault)?.id ?? savedCards[0]?.id ?? NEW_CARD_OPTION);

  const handleSubmit = async () => {
    if (!isAddressValid) {
      setError('Completa nombre, teléfono y dirección para continuar.');
      return;
    }
    if (!stripe || !elements) return;
    setSubmitting(true);
    setError('');
    try {
      const token = await getToken();
      if (!token) throw new Error('No autenticado');
      const { clientSecret, subscriptionId } = await api.subscriptions.create(
        { productId, variantId, qty, intervalDays, address, shippingMethod },
        token,
      );

      const confirmResult = activeSelection !== NEW_CARD_OPTION
        ? await stripe.confirmCardPayment(clientSecret, { payment_method: activeSelection })
        : await (async () => {
            const cardElement = elements.getElement(CardElement);
            if (!cardElement) throw new Error('No se pudo cargar el formulario de tarjeta');
            return stripe.confirmCardPayment(clientSecret, { payment_method: { card: cardElement } });
          })();

      if (confirmResult.error) {
        setError(confirmResult.error.message || 'No se pudo procesar el pago');
        return;
      }
      if (confirmResult.paymentIntent?.status !== 'succeeded') {
        setError('El pago no se pudo confirmar. Intenta de nuevo.');
        return;
      }

      // The payment succeeded, but the subscription is only visible in "Mis suscripciones" once
      // invoice.payment_succeeded activates it (webhooks.ts) - that webhook never reaches a plain
      // local dev server without Stripe CLI forwarding, so confirm it here too (idempotent no-op
      // if the webhook already beat us to it).
      try {
        await api.subscriptions.confirm(subscriptionId, token);
      } catch (confirmError) {
        console.error('Failed to confirm subscription activation', confirmError);
        setError('Tu pago se procesó, pero no pudimos activar la suscripción. Refresca tu perfil en unos segundos o contáctanos si no aparece.');
        return;
      }

      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo crear la suscripción');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div>
      <span style={{ fontSize: 11, fontFamily: '"JetBrains Mono", monospace', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--ink-60)', display: 'block', marginBottom: 8 }}>
        Método de pago
      </span>

      {savedCards.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 8 }}>
          {savedCards.map((method) => (
            <SavedCardRow
              key={method.id}
              method={method}
              selected={activeSelection === method.id}
              onSelect={() => setSelectedId(method.id)}
            />
          ))}
        </div>
      )}

      <button
        type="button"
        onClick={() => setSelectedId(NEW_CARD_OPTION)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          width: '100%',
          textAlign: 'left',
          border: activeSelection === NEW_CARD_OPTION ? '1px solid var(--green)' : '1px solid var(--ink-06)',
          background: activeSelection === NEW_CARD_OPTION ? 'var(--ink-06)' : 'var(--cream)',
          borderRadius: 12,
          padding: '10px 14px',
          cursor: 'pointer',
          fontFamily: '"Geist", sans-serif',
          fontSize: 13,
          color: 'var(--ink)',
        }}
      >
        <Icon name="plus" size={14} /> Usar tarjeta nueva
      </button>

      {activeSelection === NEW_CARD_OPTION && (
        <div style={{ marginTop: 10 }}>
          <StripeCardInput />
        </div>
      )}

      {error && <p style={{ color: 'oklch(0.5 0.15 30)', fontSize: 12, marginTop: 12, marginBottom: 0, fontFamily: '"Geist", sans-serif' }}>{error}</p>}

      <AnimatedButton
        variant="primary"
        full
        onClick={handleSubmit}
        disabled={submitting || !stripe}
        loading={submitting}
        style={{ marginTop: 14 }}
        text={submitting ? 'Procesando pago…' : `Suscribirme · $${total.toFixed(2)} / ${shippingMethod === 'pickup' ? 'retiro' : 'envío'}`}
      />
    </div>
  );
}

export function SubscribeModal({ open, onClose, productId, variantId, productLabel, unitPrice, taxExempt, defaultQty }: SubscribeModalProps) {
  const bp = useBreakpoint();
  const isSmall = bp === 'mobile' || bp === 'tablet';
  const { getToken } = useAuth();
  const [qty, setQty] = useState(defaultQty);
  const [intervalDays, setIntervalDays] = useState<SubscriptionIntervalDays>(30);
  const [customInterval, setCustomInterval] = useState(false);
  const [shippingMethod, setShippingMethod] = useState<ShippingMethod>('delivery');
  const [address, setAddress] = useState<OrderAddress>({ name: '', phone: '', address: '', city: '', postal: '' });
  const [savedAddresses, setSavedAddresses] = useState<SavedAddress[]>([]);
  const [selectedAddressIndex, setSelectedAddressIndex] = useState<number | null>(null);
  const [manualEdit, setManualEdit] = useState(false);
  const [loadingAddress, setLoadingAddress] = useState(true);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoadingAddress(true);
    (async () => {
      try {
        const token = await getToken();
        if (!token) return;
        const addresses = await api.account.addresses.list(token);
        if (cancelled) return;
        setSavedAddresses(addresses);
        const primaryIndex = addresses.findIndex((a) => a.isDefault);
        const index = primaryIndex >= 0 ? primaryIndex : addresses.length > 0 ? 0 : null;
        const primary = index !== null ? addresses[index] : undefined;
        if (primary) {
          setSelectedAddressIndex(index);
          setAddress({ name: primary.name, phone: primary.phone, address: primary.address, city: primary.city, postal: primary.postal });
        }
      } catch (err) {
        console.error('Failed to load saved addresses', err);
      } finally {
        if (!cancelled) setLoadingAddress(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, getToken]);

  useEffect(() => {
    if (!open) setSuccess(false);
  }, [open]);

  // Guards against subscribing to the same product+variant twice - the backend rejects the
  // duplicate too (routes/subscriptions.ts), but checking here avoids making the user fill out
  // the whole form (address, card) before finding out.
  const existingSubscriptionsQuery = useQuery({
    queryKey: ['subscriptions'],
    queryFn: async () => {
      const token = await getToken();
      if (!token) return [];
      return api.subscriptions.list(token);
    },
    enabled: open,
  });
  const hasExistingSubscription = (existingSubscriptionsQuery.data ?? []).some(
    (sub) => sub.status !== 'canceled' && sub.productId === productId && (sub.variantId || undefined) === (variantId || undefined),
  );

  const selectSavedAddress = (savedAddress: SavedAddress, index: number) => {
    setSelectedAddressIndex(index);
    setManualEdit(false);
    setAddress({ name: savedAddress.name, phone: savedAddress.phone, address: savedAddress.address, city: savedAddress.city, postal: savedAddress.postal });
  };

  const showAddressSummary = !manualEdit && selectedAddressIndex !== null;

  const isAddressValid = Boolean(address.name.trim() && address.phone.trim()
    && (shippingMethod === 'pickup' || (address.address.trim() && address.city.trim() && address.postal.trim())));

  // Mirrors routes/subscriptions.ts exactly (subtotal -> ITBMS -> shipping) so the amount shown
  // here always matches what Stripe will actually charge - showing just unitPrice*qty would hide
  // shipping/tax from the user.
  const subtotal = roundMoney(unitPrice * qty);
  const shippingResolved = resolveShipping(shippingMethod, subtotal);
  const shipping = shippingResolved.cost;
  const tax = computeItbms([{ price: unitPrice, qty, taxExempt }], 0, subtotal);
  const total = roundMoney(subtotal + tax + shipping);

  const handleSuccess = () => {
    setSuccess(true);
    setTimeout(onClose, 1400);
  };

  return (
    <ModalOverlay open={open} onClose={onClose} ariaLabel="Suscribirse a reposición automática">
      <div style={{ width: '100%', maxWidth: isSmall ? 460 : 800, maxHeight: '86vh', background: 'var(--cream)', border: '1px solid var(--ink-06)', borderRadius: 24, display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '28px 28px 0', flexShrink: 0 }}>
          <h2 style={{ fontFamily: '"Instrument Serif", serif', fontSize: 28, letterSpacing: '-0.02em', margin: 0, color: 'var(--ink)', fontWeight: 400 }}>
            Reposición <em style={{ color: 'var(--green)' }}>automática</em>
          </h2>
          <button type="button" onClick={onClose} aria-label="Cerrar" style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--ink-60)' }}>
            <Icon name="x" size={18} />
          </button>
        </div>

        {success ? (
          <div style={{ padding: '40px 28px 48px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, textAlign: 'center' }}>
            <div style={{ width: 48, height: 48, borderRadius: 999, background: 'var(--green)', color: 'var(--lime)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="check" size={22} />
            </div>
            <p style={{ margin: 0, fontSize: 14, color: 'var(--ink)', fontFamily: '"Geist", sans-serif' }}>
              ¡Listo! Tu suscripción quedó activa.
            </p>
          </div>
        ) : hasExistingSubscription ? (
          <div style={{ padding: '32px 28px 40px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, textAlign: 'center' }}>
            <div style={{ width: 48, height: 48, borderRadius: 999, background: 'var(--ink-06)', color: 'var(--ink-60)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="repeat" size={20} />
            </div>
            <p style={{ margin: 0, fontSize: 14, color: 'var(--ink)', fontFamily: '"Geist", sans-serif' }}>
              Ya tienes una reposición automática activa para {productLabel}.
            </p>
            <p style={{ margin: 0, fontSize: 12, color: 'var(--ink-60)', fontFamily: '"Geist", sans-serif' }}>
              Puedes pausarla, cambiar su frecuencia o cancelarla desde tu perfil.
            </p>
          </div>
        ) : (
          <>
            <div style={{ overflowY: 'auto', overflowX: 'hidden', padding: '4px 28px 28px', flex: '1 1 auto', minHeight: 0 }}>
              <p style={{ fontSize: 13, color: 'var(--ink-60)', fontFamily: '"Geist", sans-serif', marginBottom: 20 }}>
                {productLabel} — te cobramos y {shippingMethod === 'pickup' ? 'preparamos un pedido nuevo para que lo recojas en tienda' : 'te enviamos un pedido nuevo'} cada cierto tiempo, sin que tengas que volver a comprarlo. Puedes pausar o cancelar cuando quieras desde tu perfil.
              </p>

              <div style={{ display: 'grid', gridTemplateColumns: isSmall ? '1fr' : '1.15fr 1fr', gap: isSmall ? 24 : 28, alignItems: 'start' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <div>
                    <span style={{ fontSize: 11, fontFamily: '"JetBrains Mono", monospace', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--ink-60)', display: 'block', marginBottom: 8 }}>
                      Frecuencia
                    </span>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      {SUBSCRIPTION_INTERVAL_DAYS.map((days) => (
                        <button
                          key={days}
                          type="button"
                          onClick={() => { setIntervalDays(days); setCustomInterval(false); }}
                          style={{
                            padding: '8px 14px',
                            borderRadius: 999,
                            border: !customInterval && intervalDays === days ? '1px solid var(--ink)' : '1px solid var(--ink-20)',
                            background: !customInterval && intervalDays === days ? 'var(--ink)' : 'transparent',
                            color: !customInterval && intervalDays === days ? 'var(--cream)' : 'var(--ink)',
                            fontSize: 12,
                            fontFamily: '"Geist", sans-serif',
                            cursor: 'pointer',
                          }}
                        >
                          {INTERVAL_LABELS[days]}
                        </button>
                      ))}
                      <button
                        type="button"
                        onClick={() => setCustomInterval(true)}
                        style={{
                          padding: '8px 14px',
                          borderRadius: 999,
                          border: customInterval ? '1px solid var(--ink)' : '1px solid var(--ink-20)',
                          background: customInterval ? 'var(--ink)' : 'transparent',
                          color: customInterval ? 'var(--cream)' : 'var(--ink)',
                          fontSize: 12,
                          fontFamily: '"Geist", sans-serif',
                          cursor: 'pointer',
                        }}
                      >
                        Personalizado
                      </button>
                    </div>
                    {customInterval && (
                      <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
                        <input
                          type="number"
                          min={MIN_SUBSCRIPTION_INTERVAL_DAYS}
                          max={MAX_SUBSCRIPTION_INTERVAL_DAYS}
                          value={intervalDays}
                          onChange={(e) => {
                            const value = Math.round(Number(e.target.value));
                            const clamped = Number.isFinite(value)
                              ? Math.min(MAX_SUBSCRIPTION_INTERVAL_DAYS, Math.max(MIN_SUBSCRIPTION_INTERVAL_DAYS, value))
                              : MIN_SUBSCRIPTION_INTERVAL_DAYS;
                            setIntervalDays(clamped);
                          }}
                          style={{ width: 70, padding: '8px 10px', border: '1px solid var(--ink-20)', borderRadius: 10, fontSize: 14, fontFamily: '"Geist", sans-serif', background: 'var(--cream)', color: 'var(--ink)', outline: 'none' }}
                        />
                        <span style={{ fontSize: 13, color: 'var(--ink-60)' }}>días (entre {MIN_SUBSCRIPTION_INTERVAL_DAYS} y {MAX_SUBSCRIPTION_INTERVAL_DAYS})</span>
                      </div>
                    )}
                  </div>

                  <div>
                    <span style={{ fontSize: 11, fontFamily: '"JetBrains Mono", monospace', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--ink-60)', display: 'block', marginBottom: 8 }}>
                      Cantidad por pedido
                    </span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, border: '1px solid var(--ink-20)', borderRadius: 999, padding: 4, width: 'fit-content' }}>
                      <button type="button" onClick={() => setQty((q) => Math.max(1, q - 1))} aria-label="Disminuir cantidad" style={{ width: 32, height: 32, borderRadius: 999, border: 'none', background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Icon name="minus" size={13} />
                      </button>
                      <span style={{ width: 32, textAlign: 'center', fontFamily: '"Geist", sans-serif', fontSize: 14 }}>{qty}</span>
                      <button type="button" onClick={() => setQty((q) => Math.min(10, q + 1))} aria-label="Aumentar cantidad" style={{ width: 32, height: 32, borderRadius: 999, border: 'none', background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Icon name="plus" size={13} />
                      </button>
                    </div>
                  </div>

                  <div style={{ borderTop: '1px solid var(--ink-06)', margin: '4px 0' }} />

                  <div>
                    <span style={{ fontSize: 11, fontFamily: '"JetBrains Mono", monospace', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--ink-60)', display: 'block', marginBottom: 8 }}>
                      Entrega
                    </span>
                    <div style={{ display: 'flex', gap: 8 }}>
                      {SHIPPING_METHOD_OPTIONS.map((opt) => (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => setShippingMethod(opt.value)}
                          style={{
                            flex: 1,
                            padding: '10px 12px',
                            borderRadius: 10,
                            border: shippingMethod === opt.value ? '1px solid var(--ink)' : '1px solid var(--ink-20)',
                            background: shippingMethod === opt.value ? 'var(--ink)' : 'transparent',
                            color: shippingMethod === opt.value ? 'var(--cream)' : 'var(--ink)',
                            fontSize: 13,
                            fontFamily: '"Geist", sans-serif',
                            cursor: 'pointer',
                          }}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {!loadingAddress && shippingMethod === 'delivery' && savedAddresses.length > 1 && (
                    <div>
                      <span style={{ fontSize: 11, fontFamily: '"JetBrains Mono", monospace', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--ink-60)', display: 'block', marginBottom: 8 }}>
                        Dirección guardada
                      </span>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                        {savedAddresses.map((savedAddress, index) => (
                          <button
                            key={`${savedAddress.label}-${savedAddress.address}-${index}`}
                            type="button"
                            onClick={() => selectSavedAddress(savedAddress, index)}
                            style={{
                              border: selectedAddressIndex === index ? '1px solid var(--ink)' : '1px solid var(--ink-20)',
                              background: selectedAddressIndex === index ? 'var(--ink)' : 'transparent',
                              color: selectedAddressIndex === index ? 'var(--cream)' : 'var(--ink)',
                              borderRadius: 999,
                              padding: '8px 12px',
                              cursor: 'pointer',
                              fontSize: 12,
                              fontFamily: '"Geist", sans-serif',
                            }}
                          >
                            {savedAddress.label || `Dirección ${index + 1}`}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {loadingAddress ? (
                    <p style={{ fontSize: 12, color: 'var(--ink-60)' }}>Cargando dirección…</p>
                  ) : showAddressSummary ? (
                    <div style={{ border: '1px solid var(--ink-06)', borderRadius: 12, padding: '12px 14px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                      <div style={{ fontSize: 13, color: 'var(--ink-80)', fontFamily: '"Geist", sans-serif', lineHeight: 1.5, minWidth: 0 }}>
                        <div style={{ fontWeight: 500, color: 'var(--ink)' }}>{address.name} · {address.phone}</div>
                        {shippingMethod === 'delivery' && (
                          <div>{[address.address, address.city, address.postal].filter(Boolean).join(', ')}</div>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => setManualEdit(true)}
                        style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--ink-60)', display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, fontFamily: '"Geist", sans-serif', flexShrink: 0, padding: 0 }}
                      >
                        <Icon name="pencil" size={12} /> Editar
                      </button>
                    </div>
                  ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                      {savedAddresses.length > 0 && (
                        <div style={{ gridColumn: '1 / -1' }}>
                          <button
                            type="button"
                            onClick={() => {
                              const primaryIndex = savedAddresses.findIndex((a) => a.isDefault);
                              const index = primaryIndex >= 0 ? primaryIndex : 0;
                              selectSavedAddress(savedAddresses[index], index);
                            }}
                            style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--ink-60)', display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, fontFamily: '"Geist", sans-serif', padding: 0, marginBottom: 4 }}
                          >
                            <Icon name="arrow-left" size={12} /> Usar dirección guardada
                          </button>
                        </div>
                      )}
                      <div style={{ gridColumn: '1 / -1' }}>
                        <FormInput label="Nombre" value={address.name} onChange={(v) => { setSelectedAddressIndex(null); setAddress((a) => ({ ...a, name: v })); }} required />
                      </div>
                      <FormInput label="Teléfono" value={address.phone} onChange={(v) => { setSelectedAddressIndex(null); setAddress((a) => ({ ...a, phone: v })); }} required />
                      {shippingMethod === 'delivery' && (
                        <>
                          <FormInput label="Ciudad" value={address.city} onChange={(v) => { setSelectedAddressIndex(null); setAddress((a) => ({ ...a, city: v })); }} required />
                          <div style={{ gridColumn: '1 / -1' }}>
                            <FormInput label="Dirección" value={address.address} onChange={(v) => { setSelectedAddressIndex(null); setAddress((a) => ({ ...a, address: v })); }} required />
                          </div>
                          <FormInput label="Código postal" value={address.postal} onChange={(v) => { setSelectedAddressIndex(null); setAddress((a) => ({ ...a, postal: v })); }} required />
                        </>
                      )}
                    </div>
                  )}
                </div>

                <div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 14, fontSize: 12, color: 'var(--ink-60)', fontFamily: '"Geist", sans-serif' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span>Subtotal</span><span>${subtotal.toFixed(2)}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span>Envío</span><span>{shipping === 0 ? 'Gratis' : `$${shipping.toFixed(2)}`}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span>ITBMS</span><span>${tax.toFixed(2)}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--ink)', fontWeight: 600, paddingTop: 4, borderTop: '1px solid var(--ink-06)' }}>
                      <span>Total por pedido</span><span>${total.toFixed(2)}</span>
                    </div>
                  </div>
                  {stripePromise ? (
                    <Elements stripe={stripePromise}>
                      <SubscribePaymentStep
                        getToken={getToken}
                        productId={productId}
                        variantId={variantId}
                        qty={qty}
                        intervalDays={intervalDays}
                        address={address}
                        shippingMethod={shippingMethod}
                        isAddressValid={isAddressValid}
                        total={total}
                        onSuccess={handleSuccess}
                      />
                    </Elements>
                  ) : (
                    <p style={{ fontSize: 12, color: 'var(--ink-60)', fontFamily: '"Geist", sans-serif' }}>
                      Falta configurar VITE_STRIPE_PUBLISHABLE_KEY para procesar el pago.
                    </p>
                  )}
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </ModalOverlay>
  );
}
