import { useState, type FormEvent } from 'react';
import { useAuth, useClerk, useUser } from '@clerk/clerk-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { loadStripe } from '@stripe/stripe-js';
import { CardElement, Elements, useElements, useStripe } from '@stripe/react-stripe-js';
import { useBreakpoint } from '../hooks/useBreakpoint';
import { Icon } from '../components/shared/Icon';
import { AnimatedButton } from '../components/shared/AnimatedButton';
import { StripeCardInput } from '../components/shared/StripeCardInput';
import { api } from '../lib/api';
import { formatPanamaMedium } from '../lib/dates';
import type { ProductSubscription, SubscriptionStatus } from '../types';

interface ProfileProps {
  onBack: () => void;
}

const sectionCard = { background: 'var(--cream-2)', borderRadius: 20, padding: 28, marginBottom: 16, border: '1px solid var(--ink-06)' } as const;
const sectionLabel = { fontFamily: '"JetBrains Mono", monospace', fontSize: 10, textTransform: 'uppercase' as const, letterSpacing: '0.12em', color: 'var(--ink-60)', marginBottom: 4 };
const sectionTitle = { fontFamily: '"Instrument Serif", serif', fontSize: 24, letterSpacing: '-0.02em', margin: '0 0 18px', color: 'var(--ink)', fontWeight: 400 };

const STATUS_LABELS: Record<SubscriptionStatus, string> = {
  active: 'Activa',
  paused: 'Pausada',
  canceled: 'Cancelada',
};

const STATUS_COLORS: Record<SubscriptionStatus, { bg: string; fg: string }> = {
  active: { bg: 'oklch(0.92 0.1 140)', fg: 'oklch(0.4 0.1 140)' },
  paused: { bg: 'oklch(0.93 0.08 90)', fg: 'oklch(0.45 0.1 90)' },
  canceled: { bg: 'var(--ink-06)', fg: 'var(--ink-60)' },
};

function SubscriptionsSection() {
  const { getToken } = useAuth();
  const queryClient = useQueryClient();

  const subscriptionsQuery = useQuery({
    queryKey: ['subscriptions'],
    queryFn: async () => {
      const token = await getToken();
      if (!token) return [];
      return api.subscriptions.list(token);
    },
  });

  const invalidate = () => void queryClient.invalidateQueries({ queryKey: ['subscriptions'] });

  const pauseMut = useMutation({
    mutationFn: async (id: string) => {
      const token = await getToken();
      if (!token) throw new Error('No autenticado');
      return api.subscriptions.pause(id, token);
    },
    onSuccess: invalidate,
  });
  const resumeMut = useMutation({
    mutationFn: async (id: string) => {
      const token = await getToken();
      if (!token) throw new Error('No autenticado');
      return api.subscriptions.resume(id, token);
    },
    onSuccess: invalidate,
  });
  const cancelMut = useMutation({
    mutationFn: async (id: string) => {
      const token = await getToken();
      if (!token) throw new Error('No autenticado');
      return api.subscriptions.cancel(id, token);
    },
    onSuccess: invalidate,
  });

  const subscriptions = subscriptionsQuery.data ?? [];
  const isMutating = pauseMut.isPending || resumeMut.isPending || cancelMut.isPending;

  return (
    <section style={sectionCard}>
      <h2 style={sectionTitle}>Mis suscripciones</h2>
      {subscriptionsQuery.isLoading ? (
        <p style={{ fontSize: 13, color: 'var(--ink-60)', fontFamily: '"Geist", sans-serif' }}>Cargando…</p>
      ) : subscriptions.length === 0 ? (
        <p style={{ fontSize: 13, color: 'var(--ink-60)', fontFamily: '"Geist", sans-serif' }}>
          No tienes reposiciones automáticas activas. Puedes suscribirte desde la ficha de cualquier producto.
        </p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {subscriptions.map((sub: ProductSubscription) => {
            const colors = STATUS_COLORS[sub.status];
            return (
              <div key={sub._id} style={{ border: '1px solid var(--ink-06)', borderRadius: 14, padding: '14px 16px' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 8 }}>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--ink)', fontFamily: '"Geist", sans-serif' }}>
                      {sub.productName}{sub.variantLabel ? ` · ${sub.variantLabel}` : ''}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--ink-60)', fontFamily: '"JetBrains Mono", monospace', marginTop: 4 }}>
                      Cada {sub.intervalDays} días · ${sub.total.toFixed(2)} por envío
                    </div>
                  </div>
                  <span style={{ padding: '3px 10px', borderRadius: 999, fontSize: 11, fontFamily: '"JetBrains Mono", monospace', background: colors.bg, color: colors.fg, whiteSpace: 'nowrap' }}>
                    {STATUS_LABELS[sub.status]}
                  </span>
                </div>
                {sub.status !== 'canceled' && sub.nextBillingDate && (
                  <p style={{ fontSize: 12, color: 'var(--ink-60)', fontFamily: '"Geist", sans-serif', margin: '0 0 10px' }}>
                    Próximo envío: {formatPanamaMedium(sub.nextBillingDate)}
                  </p>
                )}
                {sub.status !== 'canceled' && (
                  <div style={{ display: 'flex', gap: 8 }}>
                    {sub.status === 'active' ? (
                      <AnimatedButton
                        variant="outline"
                        size="sm"
                        disabled={isMutating}
                        onClick={() => pauseMut.mutate(sub._id)}
                        text="Pausar"
                      />
                    ) : (
                      <AnimatedButton
                        variant="outline"
                        size="sm"
                        disabled={isMutating}
                        onClick={() => resumeMut.mutate(sub._id)}
                        text="Reanudar"
                      />
                    )}
                    <AnimatedButton
                      variant="ghost"
                      size="sm"
                      disabled={isMutating}
                      onClick={() => cancelMut.mutate(sub._id)}
                      text="Cancelar"
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

const stripePromise = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY
  ? loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY)
  : null;

function AddCardForm({ onSaved, onCancel }: { onSaved: () => void; onCancel: () => void }) {
  const stripe = useStripe();
  const elements = useElements();
  const { getToken } = useAuth();
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements) return;
    setSaving(true);
    setError('');
    try {
      const token = await getToken();
      if (!token) throw new Error('No autenticado');
      const { clientSecret } = await api.account.paymentMethods.createSetupIntent(token);
      const cardElement = elements.getElement(CardElement);
      if (!cardElement) throw new Error('No se pudo cargar el formulario de tarjeta');

      const result = await stripe.confirmCardSetup(clientSecret, {
        payment_method: { card: cardElement, allow_redisplay: 'always' },
      });

      if (result.error) {
        setError(result.error.message || 'No se pudo guardar la tarjeta');
        return;
      }
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar la tarjeta');
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} style={{ marginTop: 14 }}>
      <StripeCardInput />
      {error && (
        <p style={{ color: 'oklch(0.5 0.15 30)', fontSize: 12, marginTop: 8, fontFamily: '"Geist", sans-serif' }}>{error}</p>
      )}
      <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
        <AnimatedButton
          type="submit"
          variant="primary"
          size="sm"
          disabled={!stripe || saving}
          text={saving ? 'Guardando…' : 'Guardar tarjeta'}
        />
        <AnimatedButton type="button" variant="ghost" size="sm" onClick={onCancel} text="Cancelar" />
      </div>
    </form>
  );
}

function PaymentMethodsSection() {
  const { getToken } = useAuth();
  const queryClient = useQueryClient();
  const [showAddForm, setShowAddForm] = useState(false);

  const methodsQuery = useQuery({
    queryKey: ['payment-methods'],
    queryFn: async () => {
      const token = await getToken();
      if (!token) return [];
      return api.account.paymentMethods.list(token);
    },
  });

  const deleteMut = useMutation({
    mutationFn: async (id: string) => {
      const token = await getToken();
      if (!token) throw new Error('No autenticado');
      return api.account.paymentMethods.remove(id, token);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['payment-methods'] });
    },
  });

  const setDefaultMut = useMutation({
    mutationFn: async (id: string) => {
      const token = await getToken();
      if (!token) throw new Error('No autenticado');
      return api.account.paymentMethods.setDefault(id, token);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['payment-methods'] });
    },
  });

  const methods = methodsQuery.data ?? [];

  return (
    <section style={sectionCard}>
      <h2 style={sectionTitle}>Métodos de pago</h2>
      {methodsQuery.isLoading ? (
        <p style={{ fontSize: 13, color: 'var(--ink-60)', fontFamily: '"Geist", sans-serif' }}>Cargando…</p>
      ) : methods.length === 0 ? (
        <p style={{ fontSize: 13, color: 'var(--ink-60)', fontFamily: '"Geist", sans-serif', marginBottom: 14 }}>
          No tienes tarjetas guardadas todavía.
        </p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 14 }}>
          {methods.map((m) => (
            <div
              key={m.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                border: '1px solid var(--ink-06)',
                borderRadius: 12,
                padding: '12px 16px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <Icon name="credit-card" size={18} />
                <span style={{ fontSize: 13, fontFamily: '"Geist", sans-serif', textTransform: 'capitalize' }}>
                  {m.brand} •••• {m.last4}
                </span>
                <span style={{ fontSize: 12, color: 'var(--ink-60)', fontFamily: '"JetBrains Mono", monospace' }}>
                  {String(m.expMonth).padStart(2, '0')}/{m.expYear}
                </span>
                {m.isDefault && (
                  <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--green)', fontFamily: '"JetBrains Mono", monospace', letterSpacing: '0.04em' }}>
                    <Icon name="star" size={12} /> PRINCIPAL
                  </span>
                )}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                {!m.isDefault && (
                  <button
                    type="button"
                    onClick={() => setDefaultMut.mutate(m.id)}
                    disabled={setDefaultMut.isPending}
                    aria-label={`Marcar tarjeta terminada en ${m.last4} como principal`}
                    style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--ink-60)', display: 'flex', padding: 6 }}
                  >
                    <Icon name="star" size={16} />
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => deleteMut.mutate(m.id)}
                  disabled={deleteMut.isPending}
                  aria-label={`Eliminar tarjeta terminada en ${m.last4}`}
                  style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--ink-60)', display: 'flex', padding: 6 }}
                >
                  <Icon name="trash" size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showAddForm ? (
        stripePromise ? (
          <Elements stripe={stripePromise}>
            <AddCardForm
              onSaved={() => {
                setShowAddForm(false);
                void queryClient.invalidateQueries({ queryKey: ['payment-methods'] });
              }}
              onCancel={() => setShowAddForm(false)}
            />
          </Elements>
        ) : (
          <p style={{ fontSize: 12, color: 'var(--ink-60)', fontFamily: '"Geist", sans-serif' }}>
            Falta configurar VITE_STRIPE_PUBLISHABLE_KEY para agregar tarjetas.
          </p>
        )
      ) : (
        <AnimatedButton
          variant="outline"
          size="sm"
          onClick={() => setShowAddForm(true)}
          icon={<Icon name="plus" size={14} />}
          text="Agregar tarjeta"
        />
      )}
      <p style={{ marginTop: 14, fontSize: 12, color: 'var(--ink-60)', fontFamily: '"Geist", sans-serif', lineHeight: 1.5 }}>
        Tus tarjetas se guardan de forma segura en Stripe — Healthora nunca almacena el número completo. Podrás elegir una tarjeta guardada al pagar en el checkout.
      </p>
    </section>
  );
}

export function Profile({ onBack }: ProfileProps) {
  const bp = useBreakpoint();
  const isMobile = bp === 'mobile';
  const { user } = useUser();
  const { openUserProfile } = useClerk();

  return (
    <div style={{ padding: isMobile ? '20px 16px 60px' : '24px 40px 80px', maxWidth: 640, margin: '0 auto' }}>
      <button type="button" onClick={onBack} aria-label="Volver a la tienda" style={{ background: 'transparent', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, color: 'var(--ink-60)', fontSize: 13, marginBottom: 24, fontFamily: '"Geist", sans-serif' }}>
        <Icon name="arrow-left" size={14} /> Volver a la tienda
      </button>

      <div style={{ marginBottom: 32 }}>
        <div style={{ ...sectionLabel, marginBottom: 10 }}>Mi cuenta</div>
        <h1 style={{ fontFamily: '"Instrument Serif", serif', fontSize: isMobile ? 40 : 52, letterSpacing: '-0.035em', lineHeight: 1, margin: 0, color: 'var(--ink)', fontWeight: 400 }}>
          Tu <em style={{ color: 'var(--green)' }}>perfil</em>
        </h1>
      </div>

      <section style={sectionCard}>
        <h2 style={sectionTitle}>Identidad</h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 18 }}>
          {user?.imageUrl ? (
            <img src={user.imageUrl} alt={user.fullName || 'Perfil'} style={{ width: 48, height: 48, borderRadius: 999, objectFit: 'cover' }} />
          ) : (
            <div style={{ width: 48, height: 48, borderRadius: 999, background: 'var(--green)', color: 'var(--lime)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, fontFamily: '"Instrument Serif", serif' }}>
              {user?.firstName?.[0] || user?.primaryEmailAddress?.emailAddress?.[0]?.toUpperCase() || 'U'}
            </div>
          )}
          <div>
            <div style={{ fontSize: 15, fontWeight: 500, color: 'var(--ink)', fontFamily: '"Geist", sans-serif' }}>{user?.fullName || 'Sin nombre'}</div>
            <div style={{ fontSize: 12, color: 'var(--ink-60)', fontFamily: '"JetBrains Mono", monospace' }}>{user?.primaryEmailAddress?.emailAddress}</div>
          </div>
        </div>
        <AnimatedButton variant="primary" onClick={() => openUserProfile()} icon={<Icon name="pencil" size={14} />} text="Editar nombre y foto" />
        <p style={{ marginTop: 14, fontSize: 12, color: 'var(--ink-60)', fontFamily: '"Geist", sans-serif', lineHeight: 1.5 }}>
          Tu nombre, foto y seguridad de la cuenta se gestionan de forma segura a través de tu proveedor de acceso (Clerk).
        </p>
      </section>

      <PaymentMethodsSection />
      <SubscriptionsSection />
    </div>
  );
}
