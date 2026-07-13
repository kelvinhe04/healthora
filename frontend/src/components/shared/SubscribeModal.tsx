import { useEffect, useId, useState } from 'react';
import { useAuth } from '@clerk/clerk-react';
import type { OrderAddress, SavedAddress, SubscriptionIntervalDays } from '../../types';
import { SUBSCRIPTION_INTERVAL_DAYS } from '../../types';
import { ModalOverlay } from './ModalOverlay';
import { AnimatedButton } from './AnimatedButton';
import { Icon } from './Icon';
import { api } from '../../lib/api';
import { SHIPPING_METHOD_OPTIONS, type ShippingMethod } from '../../lib/shipping';

interface SubscribeModalProps {
  open: boolean;
  onClose: () => void;
  productId: string;
  variantId?: string;
  productLabel: string;
  unitPrice: number;
  defaultQty: number;
}

const INTERVAL_LABELS: Record<SubscriptionIntervalDays, string> = {
  7: 'Cada 7 días',
  15: 'Cada 15 días',
  30: 'Cada 30 días',
  60: 'Cada 60 días',
};

function FormInput({ label, value, onChange, required }: { label: string; value: string; onChange: (v: string) => void; required?: boolean }) {
  const id = useId();
  return (
    <label htmlFor={id} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <span style={{ fontSize: 11, fontFamily: '"JetBrains Mono", monospace', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--ink-60)' }}>
        {label} {required && <span style={{ color: 'var(--coral)' }}>*</span>}
      </span>
      <input
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        style={{ padding: '11px 13px', border: '1px solid var(--ink-20)', borderRadius: 10, background: 'var(--cream)', fontSize: 14, fontFamily: '"Geist", sans-serif', color: 'var(--ink)', outline: 'none' }}
      />
    </label>
  );
}

export function SubscribeModal({ open, onClose, productId, variantId, productLabel, unitPrice, defaultQty }: SubscribeModalProps) {
  const { getToken } = useAuth();
  const [qty, setQty] = useState(defaultQty);
  const [intervalDays, setIntervalDays] = useState<SubscriptionIntervalDays>(30);
  const [shippingMethod, setShippingMethod] = useState<ShippingMethod>('delivery');
  const [address, setAddress] = useState<OrderAddress>({ name: '', phone: '', address: '', city: '', postal: '' });
  const [loadingAddress, setLoadingAddress] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

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
        const primary: SavedAddress | undefined = addresses.find((a) => a.isDefault) || addresses[0];
        if (primary) {
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

  const isAddressValid = address.name.trim() && address.phone.trim()
    && (shippingMethod === 'pickup' || (address.address.trim() && address.city.trim() && address.postal.trim()));

  const handleSubmit = async () => {
    if (!isAddressValid) {
      setError('Completa nombre, teléfono y dirección para continuar.');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      const token = await getToken();
      if (!token) throw new Error('No autenticado');
      const { url } = await api.subscriptions.create(
        { productId, variantId, qty, intervalDays, address, shippingMethod },
        token,
      );
      window.location.href = url;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo crear la suscripción');
      setSubmitting(false);
    }
  };

  return (
    <ModalOverlay open={open} onClose={onClose} ariaLabel="Suscribirse a reposición automática">
      <div style={{ width: '100%', maxWidth: 460, background: 'var(--cream)', border: '1px solid var(--ink-06)', borderRadius: 24, padding: 28, maxHeight: '86vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
          <h2 style={{ fontFamily: '"Instrument Serif", serif', fontSize: 28, letterSpacing: '-0.02em', margin: 0, color: 'var(--ink)', fontWeight: 400 }}>
            Reposición <em style={{ color: 'var(--green)' }}>automática</em>
          </h2>
          <button type="button" onClick={onClose} aria-label="Cerrar" style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--ink-60)' }}>
            <Icon name="x" size={18} />
          </button>
        </div>
        <p style={{ fontSize: 13, color: 'var(--ink-60)', fontFamily: '"Geist", sans-serif', marginBottom: 20 }}>
          {productLabel} — te cobramos y enviamos un pedido nuevo cada cierto tiempo, sin que tengas que volver a comprarlo. Puedes pausar o cancelar cuando quieras desde tu perfil.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginBottom: 20 }}>
          <div>
            <span style={{ fontSize: 11, fontFamily: '"JetBrains Mono", monospace', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--ink-60)', display: 'block', marginBottom: 8 }}>
              Frecuencia
            </span>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {SUBSCRIPTION_INTERVAL_DAYS.map((days) => (
                <button
                  key={days}
                  type="button"
                  onClick={() => setIntervalDays(days)}
                  style={{
                    padding: '8px 14px',
                    borderRadius: 999,
                    border: intervalDays === days ? '1px solid var(--ink)' : '1px solid var(--ink-20)',
                    background: intervalDays === days ? 'var(--ink)' : 'transparent',
                    color: intervalDays === days ? 'var(--cream)' : 'var(--ink)',
                    fontSize: 12,
                    fontFamily: '"Geist", sans-serif',
                    cursor: 'pointer',
                  }}
                >
                  {INTERVAL_LABELS[days]}
                </button>
              ))}
            </div>
          </div>

          <div>
            <span style={{ fontSize: 11, fontFamily: '"JetBrains Mono", monospace', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--ink-60)', display: 'block', marginBottom: 8 }}>
              Cantidad por envío
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

          {loadingAddress ? (
            <p style={{ fontSize: 12, color: 'var(--ink-60)' }}>Cargando dirección…</p>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div style={{ gridColumn: '1 / -1' }}>
                <FormInput label="Nombre" value={address.name} onChange={(v) => setAddress((a) => ({ ...a, name: v }))} required />
              </div>
              <FormInput label="Teléfono" value={address.phone} onChange={(v) => setAddress((a) => ({ ...a, phone: v }))} required />
              {shippingMethod === 'delivery' && (
                <>
                  <FormInput label="Ciudad" value={address.city} onChange={(v) => setAddress((a) => ({ ...a, city: v }))} required />
                  <div style={{ gridColumn: '1 / -1' }}>
                    <FormInput label="Dirección" value={address.address} onChange={(v) => setAddress((a) => ({ ...a, address: v }))} required />
                  </div>
                  <FormInput label="Código postal" value={address.postal} onChange={(v) => setAddress((a) => ({ ...a, postal: v }))} required />
                </>
              )}
            </div>
          )}
        </div>

        {error && <p style={{ color: 'oklch(0.5 0.15 30)', fontSize: 12, marginBottom: 12, fontFamily: '"Geist", sans-serif' }}>{error}</p>}

        <AnimatedButton
          variant="primary"
          full
          onClick={handleSubmit}
          disabled={submitting || loadingAddress}
          text={submitting ? 'Redirigiendo a pago…' : `Suscribirme · ~$${(unitPrice * qty).toFixed(2)} / envío`}
        />
      </div>
    </ModalOverlay>
  );
}
