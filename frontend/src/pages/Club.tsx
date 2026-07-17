import { useAuth, useUser } from '@clerk/clerk-react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { AnimatedButton } from '../components/shared/AnimatedButton';
import { Icon } from '../components/shared/Icon';
import { useBreakpoint } from '../hooks/useBreakpoint';
import { api } from '../lib/api';
import { formatPanamaMedium } from '../lib/dates';
import { formatCurrency } from '../lib/currency';

type View = 'landing' | 'catalog' | 'product' | 'checkout' | 'success' | 'admin';

interface ClubProps {
  onNav: (view: View) => void;
}

function LoyaltyPointsCard() {
  const { t } = useTranslation();
  const { isSignedIn } = useUser();
  const { getToken } = useAuth();

  const loyaltyQuery = useQuery({
    queryKey: ['loyalty-account'],
    queryFn: async () => api.account.loyalty.get((await getToken())!),
    enabled: Boolean(isSignedIn),
  });

  if (!isSignedIn || !loyaltyQuery.data) return null;

  const { balance, pointsPerDollar, pointValueCents, transactions } = loyaltyQuery.data;
  const pointsPerDollarRedeemed = pointValueCents > 0 ? Math.round(100 / pointValueCents) : 0;

  return (
    <div style={{ background: 'var(--cream-2)', borderRadius: 24, padding: 32, border: '1px solid var(--ink-06)', marginBottom: 56 }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 24, alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--ink-60)', marginBottom: 8 }}>
            {t('club.yourPoints')}
          </div>
          <div style={{ fontFamily: '"Instrument Serif", serif', fontSize: 48, letterSpacing: '-0.03em', lineHeight: 1 }}>{balance}</div>
        </div>
        <p style={{ fontSize: 13, color: 'var(--ink-60)', maxWidth: 340, lineHeight: 1.5, margin: 0 }}>
          {t('club.earnRate', { count: pointsPerDollar, amount: formatCurrency(1) })}
          {pointsPerDollarRedeemed > 0 && t('club.redeemNote', { rate: pointsPerDollarRedeemed, amount: formatCurrency(1) })}
        </p>
      </div>
      {transactions.length > 0 && (
        <div style={{ marginTop: 24, borderTop: '1px solid var(--ink-06)', paddingTop: 16 }}>
          {transactions.slice(0, 5).map((tx, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontSize: 13 }}>
              <span style={{ color: 'var(--ink-60)' }}>{tx.type === 'earn' ? t('club.earned') : t('club.redeemed')} · {formatPanamaMedium(tx.createdAt)}</span>
              <span style={{ fontFamily: '"JetBrains Mono", monospace', color: tx.type === 'earn' ? 'var(--green)' : 'var(--ink)' }}>
                {tx.type === 'earn' ? '+' : '-'}{tx.points}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function Club({ onNav }: ClubProps) {
  const { t } = useTranslation();
  const bp = useBreakpoint();
  const isMobile = bp === 'mobile';
  const isTablet = bp === 'tablet';
  const isSmall = isMobile || isTablet;
  return (
    <div style={{ padding: isMobile ? '40px 16px' : isTablet ? '48px 24px' : '60px 40px', maxWidth: 1200, margin: '0 auto' }}>
      <div style={{ textAlign: 'center', marginBottom: 56 }}>
        <div style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'var(--ink-60)', marginBottom: 12 }}>
          {t('club.kicker')}
        </div>
        <h1 style={{ fontFamily: '"Instrument Serif", serif', fontSize: isMobile ? 42 : isTablet ? 52 : 64, letterSpacing: '-0.035em', lineHeight: 1, margin: '0 0 20px', fontWeight: 400 }}>
          {t('club.headingPrefix')} <em style={{ color: 'var(--green)' }}>{t('club.headingEmphasis')}</em>{t('club.headingSuffix')}
        </h1>
        <p style={{ fontSize: 17, color: 'var(--ink-60)', maxWidth: 560, margin: '0 auto', lineHeight: 1.5 }}>
          {t('club.subtitle')}
        </p>
      </div>

      <LoyaltyPointsCard />

      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : isTablet ? 'repeat(2, 1fr)' : 'repeat(3, 1fr)', gap: 20, marginBottom: 64 }}>
        {[
          { icon: 'gift', title: t('club.benefits.sample.title'), desc: t('club.benefits.sample.desc', { amount: formatCurrency(200) }) },
          { icon: 'percent', title: t('club.benefits.discounts.title'), desc: t('club.benefits.discounts.desc') },
          { icon: 'truck', title: t('club.benefits.shipping.title'), desc: t('club.benefits.shipping.desc') },
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
          {t('club.ctaTitle')}
        </h2>
        <p style={{ fontSize: 16, opacity: 0.8, maxWidth: 400, margin: '0 auto 32px', lineHeight: 1.5 }}>
          {t('club.ctaBody')}
        </p>
        <AnimatedButton variant="lime" size="lg" onClick={() => onNav('catalog')} icon={<Icon name="arrow-right" size={14} />} text={t('club.ctaButton')} />
      </div>
    </div>
  );
}
