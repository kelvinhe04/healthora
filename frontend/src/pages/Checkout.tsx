import { useCallback, useEffect, useId, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useUser } from '@clerk/clerk-react';
import { useNavigate } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { loadStripe } from '@stripe/stripe-js';
import { CardElement, Elements, useElements, useStripe } from '@stripe/react-stripe-js';
import { useBreakpoint } from '../hooks/useBreakpoint';
import type { CartItem, OrderAddress, SavedAddress, SavedPaymentMethod } from '../types';
import { ProductImage } from '../components/shared/ProductImage';
import { AnimatedButton } from '../components/shared/AnimatedButton';
import { Checkbox } from '../components/shared/Checkbox';
import { Icon } from '../components/shared/Icon';
import { StripeCardInput } from '../components/shared/StripeCardInput';
import { SignInModal } from '../components/chrome/SignInModal';
import { api } from '../lib/api';
import { useAuth } from '@clerk/clerk-react';
import { normalizePromotionCode } from '../lib/promotions';
import { computeRedeemablePoints } from '../lib/loyalty';
import { useCartStore } from '../store/cartStore';
import { getE2EAuthToken, getE2EUser } from '../lib/e2eAuth';
import { resolveShipping, SHIPPING_METHOD_OPTIONS, type ShippingMethod } from '../lib/shipping';
import { formatPanamaPhone } from '../lib/phone';
import { computeItbms } from '../lib/tax';
import { trackCheckoutStarted } from '../lib/analyticsEvents';
import { formatCurrency } from '../lib/currency';

const stripePromise = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY
  ? loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY)
  : null;

type CheckoutRequestBody = {
  items: { productId: string; qty: number; variantId?: string }[];
  address: OrderAddress;
  promoCode?: string;
  freeSampleId?: string;
  freeSampleVariantId?: string;
  usePoints?: boolean;
  shippingMethod: ShippingMethod;
};

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

function FormInput({ label, value, onChange, placeholder, full, required, autoComplete }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; full?: boolean; required?: boolean; autoComplete?: string }) {
  const id = useId();
  return (
    <label htmlFor={id} style={{ display: 'flex', flexDirection: 'column', gap: 6, gridColumn: full ? '1 / -1' : 'auto' }}>
      <span style={{ fontSize: 11, fontFamily: '"JetBrains Mono", monospace', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--ink-60)' }}>
        {label} {required && <span style={{ color: 'var(--coral)' }}>*</span>}
      </span>
      <input id={id} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} required={required} autoComplete={autoComplete} style={{ padding: '12px 14px', border: '1px solid var(--ink-20)', borderRadius: 10, background: 'var(--cream)', fontSize: 14, fontFamily: '"Geist", sans-serif', color: 'var(--ink)', outline: 'none' }} />
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

const SUGGESTED_PROMO_CODES = ['BIENVENIDA', 'PIEL25'];

type ValidatedPromo = {
  code: string;
  label: string;
  discountAmount: number;
  discountedSubtotal: number;
};

function PaymentMethodRow({ method, selected, onSelect }: { method: SavedPaymentMethod; selected: boolean; onSelect: () => void }) {
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
        padding: '12px 16px',
        cursor: 'pointer',
        fontFamily: '"Geist", sans-serif',
      }}
    >
      <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <Icon name="credit-card" size={18} />
        <span style={{ fontSize: 13, textTransform: 'capitalize' }}>{method.brand} •••• {method.last4}</span>
        <span style={{ fontSize: 12, color: 'var(--ink-60)', fontFamily: '"JetBrains Mono", monospace' }}>
          {String(method.expMonth).padStart(2, '0')}/{method.expYear}
        </span>
      </span>
      {selected && <Icon name="check" size={16} />}
    </button>
  );
}

const NEW_CARD_OPTION = 'new';

/**
 * Rendered inside <Elements> (useStripe/useElements only work below the provider). Owns the
 * saved-cards selector and the actual stripe.confirmCardPayment call - everything here is our own
 * UI (see StripeCardInput), no Stripe-hosted page and no Link takeover (HU-059 investigation).
 */
function CheckoutPaymentStep({
  isSignedIn,
  getEffectiveToken,
  total,
  processing,
  setProcessing,
  error,
  setError,
  buildCheckoutBody,
  onSuccess,
}: {
  isSignedIn: boolean;
  getEffectiveToken: () => Promise<string | null | undefined>;
  total: number;
  processing: boolean;
  setProcessing: (value: boolean) => void;
  error: string;
  setError: (value: string) => void;
  buildCheckoutBody: () => CheckoutRequestBody;
  onSuccess: (paymentIntentId: string) => void;
}) {
  const { t } = useTranslation();
  const stripe = useStripe();
  const elements = useElements();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const savedCardsQuery = useQuery({
    queryKey: ['payment-methods'],
    queryFn: async () => {
      const token = await getEffectiveToken();
      if (!token) return [];
      return api.account.paymentMethods.list(token);
    },
    enabled: isSignedIn,
  });
  const savedCards = savedCardsQuery.data ?? [];
  const activeSelection = selectedId
    ?? (savedCards.find((m) => m.isDefault)?.id ?? savedCards[0]?.id ?? NEW_CARD_OPTION);

  const handlePay = async () => {
    if (!stripe || !elements) return;
    setProcessing(true);
    setError('');
    try {
      const token = await getEffectiveToken();
      if (!token) throw new Error(t('checkout.errors.sessionUnavailable'));
      const { clientSecret, paymentIntentId } = await api.checkout.createPaymentIntent(buildCheckoutBody(), token);

      const confirmResult = activeSelection !== NEW_CARD_OPTION
        ? await stripe.confirmCardPayment(clientSecret, { payment_method: activeSelection })
        : await (async () => {
            const cardElement = elements.getElement(CardElement);
            if (!cardElement) throw new Error(t('checkout.errors.cardFormFailed'));
            // Cards entered here are a one-time payment, never saved - saving a card only happens
            // explicitly in Profile, so this never sets allow_redisplay/setup_future_usage.
            return stripe.confirmCardPayment(clientSecret, {
              payment_method: { card: cardElement },
            });
          })();

      if (confirmResult.error) {
        setError(confirmResult.error.message || t('checkout.errors.paymentFailed'));
        return;
      }
      if (confirmResult.paymentIntent?.status === 'succeeded') {
        onSuccess(paymentIntentId);
      } else {
        setError(t('checkout.errors.paymentNotConfirmed'));
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : t('checkout.errors.paymentGeneric'));
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div style={{ marginTop: 20 }}>
      {savedCards.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 8 }}>
          {savedCards.map((method) => (
            <PaymentMethodRow
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
          padding: '12px 16px',
          cursor: 'pointer',
          fontFamily: '"Geist", sans-serif',
          fontSize: 13,
          color: 'var(--ink)',
        }}
      >
        <Icon name="plus" size={14} /> {t('checkout.steps.payment.useNewCard')}
      </button>

      {activeSelection === NEW_CARD_OPTION && (
        <div style={{ marginTop: 12 }}>
          <StripeCardInput />
        </div>
      )}

      {error && <div role="alert" style={{ marginTop: 12, color: 'var(--coral)', fontSize: 13, fontFamily: '"Geist", sans-serif' }}>{error}</div>}
      <AnimatedButton
        aria-label={processing ? t('checkout.steps.payment.processingAria') : t('checkout.steps.payment.payButton', { amount: formatCurrency(total) })}
        variant="primary"
        size="lg"
        full
        onClick={handlePay}
        style={{ marginTop: 20 }}
        icon={<Icon name="lock" size={14} />}
        disabled={processing || !stripe}
        text={processing ? t('checkout.steps.payment.processingButton') : t('checkout.steps.payment.payButton', { amount: formatCurrency(total) })}
      />
    </div>
  );
}

export function Checkout({ items, onBack }: CheckoutProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
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
  const [appliedPromo, setAppliedPromo] = useState<ValidatedPromo | null>(null);
  const [promoError, setPromoError] = useState('');
  const [promoValidating, setPromoValidating] = useState(false);
  const [usePoints, setUsePoints] = useState(false);

  const loyaltyQuery = useQuery({
    queryKey: ['loyalty-account'],
    queryFn: async () => api.account.loyalty.get((await getEffectiveToken())!),
    enabled: isSignedIn,
  });
  const loyaltyBalance = loyaltyQuery.data?.balance ?? 0;
  const loyaltyPointValueCents = loyaltyQuery.data?.pointValueCents ?? 0;

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

  const subtotal = roundMoney(items.reduce((s, it) => s + (it.variant?.price ?? it.product.price) * it.qty, 0));
  const discountAmount = appliedPromo?.discountAmount ?? 0;
  const subtotalAfterCoupon = roundMoney(Math.max(0, subtotal - discountAmount));
  const redeemable = usePoints
    ? computeRedeemablePoints({
        availablePoints: loyaltyBalance,
        maxDiscountCents: Math.round(subtotalAfterCoupon * 100),
        pointValueCents: loyaltyPointValueCents,
      })
    : { pointsToRedeem: 0, discountCents: 0 };
  const loyaltyDiscountAmount = roundMoney(redeemable.discountCents / 100);
  const totalDiscount = roundMoney(discountAmount + loyaltyDiscountAmount);
  const discountedSubtotal = roundMoney(Math.max(0, subtotal - totalDiscount));
  const shippingResolved = resolveShipping(shippingMethod, discountedSubtotal);
  const shipping = shippingResolved.cost;
  const tax = computeItbms(
    items.map((it) => ({ price: it.variant?.price ?? it.product.price, qty: it.qty, taxExempt: it.product.taxExempt })),
    totalDiscount,
    subtotal,
  );
  const total = roundMoney(discountedSubtotal + shipping + tax);

  // Fires once per mount with the cart snapshot at the moment the checkout page is reached - an
  // intentional page-view-style event (not a sync effect), so an empty deps array is correct here.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { trackCheckoutStarted(items.length, subtotal); }, []);

  const handleApplyPromo = async (code = promoInput) => {
    const normalizedCode = normalizePromotionCode(code);

    if (!normalizedCode) {
      setPromoError(t('checkout.errors.promoEmpty'));
      return;
    }

    if (!isSignedIn) {
      setPromoError(t('checkout.errors.promoNeedsSignIn'));
      return;
    }

    setPromoValidating(true);
    setPromoError('');
    try {
      const token = await getEffectiveToken();
      if (!token) throw new Error(t('checkout.errors.sessionUnavailable'));
      const result = await api.promotions.validate(
        {
          code: normalizedCode,
          items: items.map((it) => ({
            productId: it.product.id,
            qty: it.qty,
            ...(it.variant?.id ? { variantId: it.variant.id } : {}),
          })),
        },
        token,
      );
      setAppliedPromo({
        code: result.code,
        label: result.label,
        discountAmount: result.discountAmount,
        discountedSubtotal: result.discountedSubtotal,
      });
      setPromoInput(result.code);
      setPromoError('');
    } catch (e: unknown) {
      setAppliedPromo(null);
      setPromoError(e instanceof Error ? e.message : t('checkout.errors.promoGeneric'));
    } finally {
      setPromoValidating(false);
    }
  };

  const handleRemovePromo = () => {
    setAppliedPromo(null);
    setPromoInput('');
    setPromoError('');
  };

  const buildCheckoutBody = (): CheckoutRequestBody => ({
    items: items.map((it) => ({
      productId: it.product.id,
      qty: it.qty,
      ...(it.variant?.id ? { variantId: it.variant.id } : {}),
    })),
    address,
    promoCode: appliedPromo?.code,
    freeSampleId: freeSample?.productId,
    ...(freeSample?.variantId ? { freeSampleVariantId: freeSample.variantId } : {}),
    usePoints,
    shippingMethod,
  });

  const handlePaymentSuccess = (paymentIntentId: string) => {
    void navigate({ to: '/success', search: { payment_intent: paymentIntentId } });
  };

  return (
    <div style={{ padding: isMobile ? '20px 16px 0' : isTablet ? '24px 24px 0' : '24px 40px 0' }}>
      <button type="button" onClick={onBack} aria-label={t('checkout.backToStore')} style={{ background: 'transparent', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, color: 'var(--ink-60)', fontSize: 13, marginBottom: 24, fontFamily: '"Geist", sans-serif' }}>
        <Icon name="arrow-left" size={14} /> {t('checkout.backToStore')}
      </button>

      <div style={{ display: 'grid', gridTemplateColumns: isSmall ? '1fr' : '1.3fr 1fr', gap: isSmall ? 24 : 48, alignItems: 'start' }}>
        <div>
          <div style={{ marginBottom: 32 }}>
            <div style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'var(--ink-60)', marginBottom: 10 }}>{t('checkout.stepIndicator', { step })}</div>
            <h1 style={{ fontFamily: '"Instrument Serif", serif', fontSize: isMobile ? 40 : isTablet ? 50 : 60, letterSpacing: '-0.035em', lineHeight: 1, margin: 0, color: 'var(--ink)', fontWeight: 400 }}>{t('checkout.headingPrefix')} <em style={{ color: 'var(--green)' }}>{t('checkout.headingEmphasis')}</em></h1>
          </div>

          <div
            role="progressbar"
            aria-label={t('checkout.progressAria')}
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
                <h2 style={stepTitle}>{t('checkout.steps.auth.title')}</h2>
              </div>
              {isSignedIn && <span style={{ fontSize: 12, color: 'var(--green)', fontFamily: '"JetBrains Mono", monospace', letterSpacing: '0.06em' }}>{t('checkout.steps.auth.authenticated')}</span>}
            </div>
            {!isSignedIn ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 20 }}>
                <AuthButton
                  onClick={() => setShowSignInModal(true)}
                  icon={<img src="/brands/google.svg" alt="Google" style={authLogoImg} />}
                  text={t('checkout.steps.auth.continueWithGoogle')}
                />
                <AuthButton
                  onClick={() => setShowSignInModal(true)}
                  icon={<img src="/brands/microsoft.svg" alt="Microsoft" style={authLogoImg} />}
                  text={t('checkout.steps.auth.continueWithMicrosoft')}
                />
                <AuthButton
                  onClick={() => setShowSignInModal(true)}
                  icon={<Icon name="lock" size={16} />}
                  text={t('checkout.steps.auth.otpEmail')}
                />
                <div style={{ fontSize: 11, color: 'var(--ink-60)', fontFamily: '"JetBrains Mono", monospace', letterSpacing: '0.06em', marginTop: 6, textAlign: 'center' }}>{t('checkout.steps.auth.protectedByClerk')}</div>
              </div>
            ) : (
              <div style={{ marginTop: 16, padding: 16, background: 'var(--cream)', border: '1px solid var(--ink-06)', borderRadius: 12, display: 'flex', alignItems: 'center', gap: 14 }}>
                {user?.imageUrl ? (
                  <img src={user.imageUrl} alt={user?.fullName || t('checkout.steps.auth.defaultUserAlt')} style={{ width: 40, height: 40, borderRadius: 999, objectFit: 'cover' }} />
                ) : (
                  <div style={{ width: 40, height: 40, borderRadius: 999, background: 'var(--green)', color: 'var(--lime)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontFamily: '"Instrument Serif", serif' }}>
                    {user?.firstName?.[0] || user?.primaryEmailAddress?.emailAddress?.[0]?.toUpperCase() || 'U'}
                  </div>
                )}
                <div>
                  <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--ink)' }}>{user?.fullName || user?.primaryEmailAddress?.emailAddress}</div>
                  <div style={{ fontSize: 11, color: 'var(--ink-60)', fontFamily: '"JetBrains Mono", monospace', marginTop: 2 }}>{t('checkout.steps.auth.activeSession')}</div>
                </div>
              </div>
            )}
          </section>

          {/* Step 2: Address */}
          <section style={{ ...stepCard(isMobile), opacity: isSignedIn ? 1 : 0.4, pointerEvents: isSignedIn ? 'auto' : 'none' }}>
            <div style={stepHeader}>
              <div>
                <div style={stepNum}>02</div>
                <h2 style={stepTitle}>{shippingMethod === 'pickup' ? t('checkout.steps.address.titlePickup') : t('checkout.steps.address.titleShipping')}</h2>
              </div>
            </div>

            <div style={{ marginTop: 20 }}>
              <span style={{ fontSize: 11, fontFamily: '"JetBrains Mono", monospace', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--ink-60)' }}>{t('checkout.steps.address.deliveryLabel')}</span>
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
                      <div style={{ fontSize: 13, color: 'var(--ink)' }}>{t(`checkout.shipping.methods.${option.value}`)} <span style={{ color: 'var(--ink-60)' }}>· {t(`checkout.shipping.eta.${option.value}`)}</span></div>
                      <div style={{ fontSize: 12, color: 'var(--green)', marginTop: 2 }}>{resolved.cost === 0 ? t('checkout.shipping.free') : formatCurrency(resolved.cost)}</div>
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
                    {savedAddress.label || t('checkout.steps.address.unnamed', { n: index + 1 })}
                  </button>
                ))}
              </div>
            )}
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 12, marginTop: 20 }}>
              <FormInput label={t('checkout.steps.address.form.fullName')} value={address.name} onChange={(v) => { setAddress({ ...address, name: v }); setAddressError(''); }} placeholder={t('checkout.steps.address.form.fullNamePlaceholder')} autoComplete="name" required />
              <FormInput label={t('checkout.steps.address.form.phone')} value={address.phone} onChange={(v) => { setAddress({ ...address, phone: formatPanamaPhone(v) }); setAddressError(''); }} placeholder={t('checkout.steps.address.form.phonePlaceholder')} autoComplete="tel" required />
              {shippingMethod === 'delivery' && (
                <>
                  <FormInput label={t('checkout.steps.address.form.address')} value={address.address} onChange={(v) => { setAddress({ ...address, address: v }); setAddressError(''); }} placeholder={t('checkout.steps.address.form.addressPlaceholder')} autoComplete="street-address" full required />
                  <FormInput label={t('checkout.steps.address.form.city')} value={address.city} onChange={(v) => { setAddress({ ...address, city: v }); setAddressError(''); }} placeholder={t('checkout.steps.address.form.cityPlaceholder')} autoComplete="address-level2" required />
                  <FormInput label={t('checkout.steps.address.form.postal')} value={address.postal} onChange={(v) => { setAddress({ ...address, postal: v.replace(/\D/g, '') }); setAddressError(''); }} placeholder={t('checkout.steps.address.form.postalPlaceholder')} autoComplete="postal-code" required />
                </>
              )}
            </div>
            {addressError && <div role="alert" style={{ marginTop: 12, color: 'var(--coral)', fontSize: 13, fontFamily: '"Geist", sans-serif' }}>{addressError}</div>}

            {step === 2 && (
              <AnimatedButton aria-label={t('checkout.steps.address.continueToPayment')} variant="primary" onClick={() => { if (!isAddressValid) { setAddressError(t('checkout.steps.address.requiredFieldsError')); } else { setStep(3); }}} style={{ marginTop: 16 }} disabled={!isAddressValid} text={t('checkout.steps.address.continueToPayment')} />
            )}
          </section>

          {/* Step 3: Payment */}
          <section style={{ ...stepCard(isMobile), opacity: step >= 3 ? 1 : 0.4, pointerEvents: step >= 3 ? 'auto' : 'none' }}>
            <div style={stepHeader}>
              <div>
                <div style={stepNum}>03</div>
                <h2 style={stepTitle}>{t('checkout.steps.payment.title')}</h2>
              </div>
              <span style={{ fontSize: 11, color: 'var(--ink-60)', fontFamily: '"JetBrains Mono", monospace', letterSpacing: '0.06em' }}>{t('checkout.steps.payment.securePayment')}</span>
            </div>
            {stripePromise ? (
              <Elements stripe={stripePromise}>
                <CheckoutPaymentStep
                  isSignedIn={isSignedIn}
                  getEffectiveToken={getEffectiveToken}
                  total={total}
                  processing={processing}
                  setProcessing={setProcessing}
                  error={error}
                  setError={setError}
                  buildCheckoutBody={buildCheckoutBody}
                  onSuccess={handlePaymentSuccess}
                />
              </Elements>
            ) : (
              <p style={{ marginTop: 20, fontSize: 13, color: 'var(--ink-60)', fontFamily: '"Geist", sans-serif' }}>
                {t('checkout.steps.payment.stripeMissing')}
              </p>
            )}
          </section>
        </div>

        {/* Order Summary */}
        <aside style={{ position: isSmall ? 'static' : 'sticky', top: 100, background: 'var(--cream-2)', borderRadius: 24, padding: 28, border: '1px solid var(--ink-06)', marginBottom: isSmall ? 40 : 0 }}>
          <div style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'var(--ink-60)', marginBottom: 14 }}>{t('checkout.summary.title')}</div>
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
                <div style={{ fontFamily: '"Instrument Serif", serif', fontSize: 16 }}>{formatCurrency((it.variant?.price ?? it.product.price) * it.qty)}</div>
              </div>
            ))}
            {freeSample && (
              <div style={{ display: 'flex', gap: 10, alignItems: 'center', paddingTop: 20, borderTop: '1px solid var(--ink-06)' }}>
                <div style={{ width: 50, height: 56, background: freeSample.product.color || 'white', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, position: 'relative', border: '1.5px solid color-mix(in srgb, var(--green) 35%, transparent)' }}>
                  <ProductImage product={freeSample.product} imageUrl={freeSample.imageUrl} size="xs" />
                  <span style={{ position: 'absolute', top: -5, right: -4, width: 15, height: 15, borderRadius: 999, background: 'var(--green)', color: '#fff', fontSize: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: '"JetBrains Mono", monospace', fontWeight: 700 }}>1</span>
                </div>
                <div style={{ flex: 1, fontSize: 13, fontFamily: '"Geist", sans-serif' }}>
                  <div style={{ fontWeight: 500, lineHeight: 1.3 }}>{freeSample.product.name}{freeSample.label ? ` · ${freeSample.label}` : ''}</div>
                  <div style={{ fontSize: 10, color: 'var(--green)', fontFamily: '"JetBrains Mono", monospace', letterSpacing: '0.06em', marginTop: 2 }}>{t('checkout.summary.freeSampleBadge')}</div>
                </div>
                <div style={{ fontFamily: '"Instrument Serif", serif', fontSize: 16, color: 'var(--green)' }}>{formatCurrency(0)}</div>
              </div>
            )}
          </div>
          <div style={{ padding: '16px 0', borderTop: '1px solid var(--ink-06)' }}>
            <label htmlFor="promo-code" style={{ display: 'block', marginBottom: 8, fontSize: 11, fontFamily: '"JetBrains Mono", monospace', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--ink-60)' }}>
              {t('checkout.summary.promoCodeLabel')}
            </label>
            <form
              onSubmit={(event) => {
                event.preventDefault();
                void handleApplyPromo();
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
                placeholder={t('checkout.summary.promoPlaceholder')}
                disabled={processing || promoValidating}
                style={{ flex: 1, minWidth: 0, height: 44, border: '1px solid var(--ink-20)', borderRadius: 999, background: 'var(--cream)', padding: '0 14px', outline: 'none', color: 'var(--ink)', fontSize: 13, fontFamily: '"JetBrains Mono", monospace', letterSpacing: '0.04em' }}
              />
              {appliedPromo ? (
                <button type="button" onClick={handleRemovePromo} disabled={processing} style={{ height: 44, border: '1px solid var(--ink-20)', borderRadius: 999, background: 'transparent', padding: '0 14px', cursor: processing ? 'not-allowed' : 'pointer', color: 'var(--ink-60)', fontSize: 12, fontFamily: '"Geist", sans-serif' }}>
                  {t('checkout.summary.remove')}
                </button>
              ) : (
                <AnimatedButton type="submit" disabled={processing || promoValidating} variant="primary" size="sm" text={promoValidating ? t('checkout.summary.validating') : t('checkout.summary.apply')} />
              )}
            </form>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
              {SUGGESTED_PROMO_CODES.map((code) => {
                const isActive = appliedPromo?.code === code;
                return (
                  <button key={code} type="button" onClick={() => void handleApplyPromo(code)} disabled={processing || promoValidating} style={{ border: isActive ? '1px solid var(--lime)' : '1px solid var(--ink-12)', background: isActive ? 'var(--lime)' : 'var(--cream)', color: isActive ? 'oklch(0.2 0.03 155)' : 'var(--ink)', borderRadius: 999, padding: '6px 9px', cursor: processing || promoValidating ? 'not-allowed' : 'pointer', fontSize: 10, fontFamily: '"JetBrains Mono", monospace', letterSpacing: '0.06em' }}>
                    {code}
                  </button>
                );
              })}
            </div>
            {appliedPromo && (
              <div aria-live="polite" style={{ marginTop: 10, padding: 10, borderRadius: 12, background: 'color-mix(in oklab, var(--green) 9%, white)', border: '1px solid color-mix(in oklab, var(--green) 18%, white)', color: 'var(--green)', fontSize: 12, fontFamily: '"Geist", sans-serif', lineHeight: 1.4 }}>
                {t('checkout.summary.savings', { label: appliedPromo.label, amount: formatCurrency(discountAmount) })}
                {appliedPromo.code === 'BIENVENIDA' && <span>{t('checkout.summary.welcomeCodeNote')}</span>}
              </div>
            )}
            {promoError && <div role="alert" style={{ marginTop: 8, color: 'var(--coral)', fontSize: 12, fontFamily: '"Geist", sans-serif', lineHeight: 1.4 }}>{promoError}</div>}
          </div>
          {isSignedIn && loyaltyBalance > 0 && (
            <div style={{ padding: '16px 0', borderTop: '1px solid var(--ink-06)' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, fontFamily: '"Geist", sans-serif', cursor: 'pointer' }}>
                <Checkbox checked={usePoints} onChange={(e) => setUsePoints(e.target.checked)} disabled={processing} />
                {t('checkout.summary.useLoyaltyPoints', { points: loyaltyBalance })}
                {usePoints && loyaltyDiscountAmount > 0 && <span style={{ color: 'var(--green)' }}> (-{formatCurrency(loyaltyDiscountAmount)})</span>}
              </label>
            </div>
          )}
          <div style={{ padding: '14px 0', borderTop: '1px solid var(--ink-06)' }}>
            <Row k={t('checkout.summary.subtotal')} v={formatCurrency(subtotal)} />
            {discountAmount > 0 && <Row k={t('checkout.summary.discountLabel', { code: appliedPromo?.code })} v={<span style={{ color: 'var(--green)' }}>-{formatCurrency(discountAmount)}</span>} />}
            {loyaltyDiscountAmount > 0 && <Row k={t('checkout.summary.loyaltyPoints')} v={<span style={{ color: 'var(--green)' }}>-{formatCurrency(loyaltyDiscountAmount)}</span>} />}
            {freeSample && <Row k={t('checkout.summary.freeSample')} v={<span style={{ color: 'var(--green)' }}>{formatCurrency(0)}</span>} />}
            <Row k={t('checkout.summary.shippingLabel', { eta: t(`checkout.shipping.eta.${shippingMethod}`) })} v={shipping === 0 ? t('checkout.shipping.free') : formatCurrency(shipping)} />
            <Row k={t('checkout.summary.tax')} v={formatCurrency(tax)} />
          </div>
          <div style={{ padding: '14px 0', borderTop: '1px solid var(--ink-06)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <strong style={{ fontSize: 16, fontFamily: '"Geist", sans-serif' }}>{t('checkout.summary.total')}</strong>
            <strong style={{ fontSize: 30, fontFamily: '"Instrument Serif", serif', color: 'var(--ink)', letterSpacing: '-0.02em' }}>{formatCurrency(total)}</strong>
          </div>
          <div style={{ marginTop: 16, padding: 12, background: 'var(--cream)', borderRadius: 12, display: 'flex', alignItems: 'center', gap: 10, fontSize: 12, color: 'var(--ink-80)' }}>
            <Icon name="shield" size={16} /> {t('checkout.summary.securedByStripe')}
          </div>
        </aside>
      </div>
      <SignInModal open={showSignInModal} onClose={() => setShowSignInModal(false)} />
    </div>
  );
}
