import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useClerk, useUser } from '@clerk/clerk-react';
import { useEffectiveToken } from '../hooks/useEffectiveToken';
import { getE2EUser } from '../lib/e2eAuth';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { loadStripe } from '@stripe/stripe-js';
import { CardElement, Elements, useElements, useStripe } from '@stripe/react-stripe-js';
import { useBreakpoint } from '../hooks/useBreakpoint';
import { Icon } from '../components/shared/Icon';
import { AnimatedButton } from '../components/shared/AnimatedButton';
import { StripeCardInput } from '../components/shared/StripeCardInput';
import { Checkbox } from '../components/shared/Checkbox';
import { api } from '../lib/api';
import { formatPanamaMedium } from '../lib/dates';
import { formatCurrency } from '../lib/currency';
import type { NotificationPreferences, ProductSubscription, SubscriptionStatus } from '../types';

interface ProfileProps {
  onBack: () => void;
}

const sectionCard = { background: 'var(--cream-2)', borderRadius: 20, padding: 28, marginBottom: 16, border: '1px solid var(--ink-06)' } as const;
const sectionLabel = { fontFamily: '"JetBrains Mono", monospace', fontSize: 10, textTransform: 'uppercase' as const, letterSpacing: '0.12em', color: 'var(--ink-60)', marginBottom: 4 };
const sectionTitle = { fontFamily: '"Instrument Serif", serif', fontSize: 24, letterSpacing: '-0.02em', margin: '0 0 18px', color: 'var(--ink)', fontWeight: 400 };

const STATUS_COLORS: Record<SubscriptionStatus, { bg: string; fg: string }> = {
  active: { bg: 'oklch(0.92 0.1 140)', fg: 'oklch(0.4 0.1 140)' },
  paused: { bg: 'oklch(0.93 0.08 90)', fg: 'oklch(0.45 0.1 90)' },
  canceled: { bg: 'var(--ink-06)', fg: 'var(--ink-60)' },
};

function SubscriptionsSection() {
  const { t } = useTranslation();
  const getToken = useEffectiveToken();
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
      if (!token) throw new Error(t('profile.errors.notAuthenticated'));
      return api.subscriptions.pause(id, token);
    },
    onSuccess: invalidate,
  });
  const resumeMut = useMutation({
    mutationFn: async (id: string) => {
      const token = await getToken();
      if (!token) throw new Error(t('profile.errors.notAuthenticated'));
      return api.subscriptions.resume(id, token);
    },
    onSuccess: invalidate,
  });
  const cancelMut = useMutation({
    mutationFn: async (id: string) => {
      const token = await getToken();
      if (!token) throw new Error(t('profile.errors.notAuthenticated'));
      return api.subscriptions.cancel(id, token);
    },
    onSuccess: invalidate,
  });

  const subscriptions = subscriptionsQuery.data ?? [];
  const isMutating = pauseMut.isPending || resumeMut.isPending || cancelMut.isPending;

  return (
    <section style={sectionCard}>
      <h2 style={sectionTitle}>{t('profile.subscriptions.title')}</h2>
      {subscriptionsQuery.isLoading ? (
        <p style={{ fontSize: 13, color: 'var(--ink-60)', fontFamily: '"Geist", sans-serif' }}>{t('profile.subscriptions.loading')}</p>
      ) : subscriptions.length === 0 ? (
        <p style={{ fontSize: 13, color: 'var(--ink-60)', fontFamily: '"Geist", sans-serif' }}>
          {t('profile.subscriptions.empty')}
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
                      {t('profile.subscriptions.frequency', { days: sub.intervalDays, amount: formatCurrency(sub.total) })}
                    </div>
                  </div>
                  <span style={{ padding: '3px 10px', borderRadius: 999, fontSize: 11, fontFamily: '"JetBrains Mono", monospace', background: colors.bg, color: colors.fg, whiteSpace: 'nowrap' }}>
                    {t(`profile.subscriptions.status.${sub.status}`)}
                  </span>
                </div>
                {sub.status !== 'canceled' && sub.nextBillingDate && (
                  <p style={{ fontSize: 12, color: 'var(--ink-60)', fontFamily: '"Geist", sans-serif', margin: '0 0 10px' }}>
                    {t('profile.subscriptions.nextShipment', { date: formatPanamaMedium(sub.nextBillingDate) })}
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
                        text={t('profile.subscriptions.pause')}
                      />
                    ) : (
                      <AnimatedButton
                        variant="outline"
                        size="sm"
                        disabled={isMutating}
                        onClick={() => resumeMut.mutate(sub._id)}
                        text={t('profile.subscriptions.resume')}
                      />
                    )}
                    <AnimatedButton
                      variant="ghost"
                      size="sm"
                      disabled={isMutating}
                      onClick={() => cancelMut.mutate(sub._id)}
                      text={t('profile.subscriptions.cancel')}
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
  const { t } = useTranslation();
  const stripe = useStripe();
  const elements = useElements();
  const getToken = useEffectiveToken();
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements) return;
    setSaving(true);
    setError('');
    try {
      const token = await getToken();
      if (!token) throw new Error(t('profile.errors.notAuthenticated'));
      const { clientSecret } = await api.account.paymentMethods.createSetupIntent(token);
      const cardElement = elements.getElement(CardElement);
      if (!cardElement) throw new Error(t('profile.errors.cardFormFailed'));

      const result = await stripe.confirmCardSetup(clientSecret, {
        payment_method: { card: cardElement, allow_redisplay: 'always' },
      });

      if (result.error) {
        setError(result.error.message || t('profile.errors.cardSaveFailed'));
        return;
      }
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('profile.errors.cardSaveFailed'));
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
          text={saving ? t('profile.addCard.saving') : t('profile.addCard.saveCard')}
        />
        <AnimatedButton type="button" variant="ghost" size="sm" onClick={onCancel} text={t('profile.addCard.cancel')} />
      </div>
    </form>
  );
}

function PaymentMethodsSection() {
  const { t } = useTranslation();
  const getToken = useEffectiveToken();
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
      if (!token) throw new Error(t('profile.errors.notAuthenticated'));
      return api.account.paymentMethods.remove(id, token);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['payment-methods'] });
    },
  });

  const setDefaultMut = useMutation({
    mutationFn: async (id: string) => {
      const token = await getToken();
      if (!token) throw new Error(t('profile.errors.notAuthenticated'));
      return api.account.paymentMethods.setDefault(id, token);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['payment-methods'] });
    },
  });

  const methods = methodsQuery.data ?? [];

  return (
    <section style={sectionCard}>
      <h2 style={sectionTitle}>{t('profile.paymentMethods.title')}</h2>
      {methodsQuery.isLoading ? (
        <p style={{ fontSize: 13, color: 'var(--ink-60)', fontFamily: '"Geist", sans-serif' }}>{t('profile.paymentMethods.loading')}</p>
      ) : methods.length === 0 ? (
        <p style={{ fontSize: 13, color: 'var(--ink-60)', fontFamily: '"Geist", sans-serif', marginBottom: 14 }}>
          {t('profile.paymentMethods.empty')}
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
                    <Icon name="star" size={12} /> {t('profile.paymentMethods.default')}
                  </span>
                )}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                {!m.isDefault && (
                  <button
                    type="button"
                    onClick={() => setDefaultMut.mutate(m.id)}
                    disabled={setDefaultMut.isPending}
                    aria-label={t('profile.paymentMethods.setDefaultAria', { last4: m.last4 })}
                    style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--ink-60)', display: 'flex', padding: 6 }}
                  >
                    <Icon name="star" size={16} />
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => deleteMut.mutate(m.id)}
                  disabled={deleteMut.isPending}
                  aria-label={t('profile.paymentMethods.deleteAria', { last4: m.last4 })}
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
            {t('profile.paymentMethods.stripeMissing')}
          </p>
        )
      ) : (
        <AnimatedButton
          variant="outline"
          size="sm"
          onClick={() => setShowAddForm(true)}
          icon={<Icon name="plus" size={14} />}
          text={t('profile.paymentMethods.addCard')}
        />
      )}
      <p style={{ marginTop: 14, fontSize: 12, color: 'var(--ink-60)', fontFamily: '"Geist", sans-serif', lineHeight: 1.5 }}>
        {t('profile.paymentMethods.securityNote')}
      </p>
    </section>
  );
}

const NOTIFICATION_PREFERENCES_DEFAULTS: NotificationPreferences = {
  orderUpdates: true,
  promotions: true,
  unsubscribedAll: false,
};

function NotificationPreferencesSection() {
  const { t } = useTranslation();
  const getToken = useEffectiveToken();
  const queryClient = useQueryClient();

  const [error, setError] = useState('');
  const queryKey = ['notification-preferences'];

  const prefsQuery = useQuery({
    queryKey,
    queryFn: async () => {
      const token = await getToken();
      if (!token) throw new Error(t('profile.errors.notAuthenticated'));
      return api.account.notificationPreferences.get(token);
    },
  });

  const updateMut = useMutation({
    mutationFn: async (next: NotificationPreferences) => {
      const token = await getToken();
      if (!token) throw new Error(t('profile.errors.notAuthenticated'));
      return api.account.notificationPreferences.update(next, token);
    },
    // Optimista: el checkbox tiene que reflejar el click al instante, no recien cuando vuelve la
    // respuesta del PUT - si algo falla (red, sesion vencida) se revierte al valor previo y se
    // muestra el error, en vez de dejar el checkbox "sin hacer nada" en silencio.
    onMutate: async (next) => {
      setError('');
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<NotificationPreferences>(queryKey);
      queryClient.setQueryData(queryKey, next);
      return { previous };
    },
    onError: (err, _next, context) => {
      if (context?.previous) queryClient.setQueryData(queryKey, context.previous);
      setError(err instanceof Error ? err.message : t('profile.errors.prefsSaveFailed'));
    },
    onSuccess: (data) => queryClient.setQueryData(queryKey, data),
  });

  const prefs = prefsQuery.data ?? NOTIFICATION_PREFERENCES_DEFAULTS;
  const setPref = (key: keyof NotificationPreferences, value: boolean) => updateMut.mutate({ ...prefs, [key]: value });
  const busy = updateMut.isPending;

  return (
    <section style={sectionCard}>
      <h2 style={sectionTitle}>{t('profile.notifications.title')}</h2>
      {prefsQuery.isLoading ? (
        <p style={{ fontSize: 13, color: 'var(--ink-60)', fontFamily: '"Geist", sans-serif' }}>{t('profile.notifications.loading')}</p>
      ) : prefsQuery.isError ? (
        <p style={{ fontSize: 13, color: 'var(--coral)', fontFamily: '"Geist", sans-serif' }}>{t('profile.notifications.loadError')}</p>
      ) : (
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 20 }}>
            <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, cursor: prefs.unsubscribedAll ? 'not-allowed' : 'pointer', opacity: prefs.unsubscribedAll ? 0.5 : 1 }}>
              <Checkbox
                checked={prefs.orderUpdates}
                disabled={prefs.unsubscribedAll || busy}
                onChange={(e) => setPref('orderUpdates', e.target.checked)}
                style={{ marginTop: 3 }}
              />
              <span>
                <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--ink)', fontFamily: '"Geist", sans-serif' }}>{t('profile.notifications.orderUpdates.title')}</div>
                <div style={{ fontSize: 12, color: 'var(--ink-60)', fontFamily: '"Geist", sans-serif' }}>{t('profile.notifications.orderUpdates.desc')}</div>
              </span>
            </label>
            <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, cursor: prefs.unsubscribedAll ? 'not-allowed' : 'pointer', opacity: prefs.unsubscribedAll ? 0.5 : 1 }}>
              <Checkbox
                checked={prefs.promotions}
                disabled={prefs.unsubscribedAll || busy}
                onChange={(e) => setPref('promotions', e.target.checked)}
                style={{ marginTop: 3 }}
              />
              <span>
                <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--ink)', fontFamily: '"Geist", sans-serif' }}>{t('profile.notifications.promotions.title')}</div>
                <div style={{ fontSize: 12, color: 'var(--ink-60)', fontFamily: '"Geist", sans-serif' }}>{t('profile.notifications.promotions.desc')}</div>
              </span>
            </label>
          </div>
          <div style={{ borderTop: '1px solid var(--ink-06)', marginTop: 20, paddingTop: 16 }}>
            <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer' }}>
              <Checkbox
                checked={prefs.unsubscribedAll}
                disabled={busy}
                onChange={(e) => setPref('unsubscribedAll', e.target.checked)}
                style={{ marginTop: 3 }}
              />
              <span>
                <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--coral)', fontFamily: '"Geist", sans-serif' }}>{t('profile.notifications.unsubscribeAll.title')}</div>
                <div style={{ fontSize: 12, color: 'var(--ink-60)', fontFamily: '"Geist", sans-serif' }}>{t('profile.notifications.unsubscribeAll.desc')}</div>
              </span>
            </label>
          </div>
          {error && <p role="alert" style={{ fontSize: 12, color: 'var(--coral)', marginTop: 14, fontFamily: '"Geist", sans-serif' }}>{error}</p>}
        </div>
      )}
    </section>
  );
}

export function Profile({ onBack }: ProfileProps) {
  const { t } = useTranslation();
  const bp = useBreakpoint();
  const isMobile = bp === 'mobile';
  const isSmall = isMobile || bp === 'tablet';
  const { user: clerkUser } = useUser();
  const user = getE2EUser() ?? clerkUser;
  const [avatarBroken, setAvatarBroken] = useState(false);
  const getToken = useEffectiveToken();
  const avatarQuery = useQuery({
    queryKey: ['profile-avatar'],
    queryFn: async () => {
      const token = await getToken();
      if (!token) return { imageUrl: null };
      return api.account.profile.get(token);
    },
    enabled: Boolean(user),
  });
  // El avatar real (proveedor OAuth) resuelto por el backend - evita el proxy img.clerk.com que
  // useUser().imageUrl usa directo y que no resuelve en todas las redes (#314/#320).
  const avatarUrl = avatarQuery.data?.imageUrl || user?.imageUrl;
  const { openUserProfile } = useClerk();

  return (
    <div style={{ padding: isMobile ? '20px 16px 60px' : '24px 40px 80px', maxWidth: 960, margin: '0 auto' }}>
      <button type="button" onClick={onBack} aria-label={t('profile.backToStore')} style={{ background: 'transparent', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, color: 'var(--ink-60)', fontSize: 13, marginBottom: 24, fontFamily: '"Geist", sans-serif' }}>
        <Icon name="arrow-left" size={14} /> {t('profile.backToStore')}
      </button>

      <div style={{ marginBottom: 32 }}>
        <div style={{ ...sectionLabel, marginBottom: 10 }}>{t('profile.kicker')}</div>
        <h1 style={{ fontFamily: '"Instrument Serif", serif', fontSize: isMobile ? 40 : 52, letterSpacing: '-0.035em', lineHeight: 1, margin: 0, color: 'var(--ink)', fontWeight: 400 }}>
          {t('profile.headingPrefix')} <em style={{ color: 'var(--green)' }}>{t('profile.headingEmphasis')}</em>
        </h1>
      </div>

      <section style={{ ...sectionCard, display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          {avatarUrl && !avatarBroken ? (
            <img src={avatarUrl} alt={user?.fullName || t('profile.defaultUserAlt')} onError={() => setAvatarBroken(true)} style={{ width: 48, height: 48, borderRadius: 999, objectFit: 'cover' }} />
          ) : (
            <div style={{ width: 48, height: 48, borderRadius: 999, background: 'var(--green)', color: 'var(--lime)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, fontFamily: '"Instrument Serif", serif' }}>
              {user?.firstName?.[0] || user?.primaryEmailAddress?.emailAddress?.[0]?.toUpperCase() || 'U'}
            </div>
          )}
          <div>
            <div style={{ fontSize: 15, fontWeight: 500, color: 'var(--ink)', fontFamily: '"Geist", sans-serif' }}>{user?.fullName || t('profile.noName')}</div>
            <div style={{ fontSize: 12, color: 'var(--ink-60)', fontFamily: '"JetBrains Mono", monospace' }}>{user?.primaryEmailAddress?.emailAddress}</div>
          </div>
        </div>
        <AnimatedButton variant="primary" size="sm" onClick={() => openUserProfile()} icon={<Icon name="pencil" size={14} />} text={t('profile.editNameAndPhoto')} />
      </section>

      <div style={{ display: 'grid', gridTemplateColumns: isSmall ? '1fr' : '1fr 1fr', gap: 16, alignItems: 'start' }}>
        <PaymentMethodsSection />
        <SubscriptionsSection />
        <div style={{ gridColumn: isSmall ? 'auto' : '1 / -1' }}>
          <NotificationPreferencesSection />
        </div>
      </div>
    </div>
  );
}
