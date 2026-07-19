import { useTranslation } from 'react-i18next';
import {
  Card,
  KpiCard,
  PageHeader,
  tableStyle,
  td,
  th,
  trStyle,
} from '../../../components/admin';
import { useAdminPanelContext } from '../AdminPanelContext';
import { formatPanamaDateTime } from '../../../lib/dates';
import { productAnalyticsEventLabelKeys } from '../types';
import { Select } from '../../../components/shared/Select';

export function ProductAnalyticsSection() {
  const { t } = useTranslation();
  const {
    showAnalyticsSkeleton,
    analyticsPeriodDays,
    setAnalyticsPeriodDays,
    productAnalytics,
    isMobile,
  } = useAdminPanelContext();

  const configured = productAnalytics?.configured ?? false;

  return (
    <>
      <PageHeader
        loading={showAnalyticsSkeleton}
        kicker="PostHog"
        title={
          <>
            {t('admin.productAnalytics.titlePrefix')} <em style={{ color: 'var(--green)' }}>{t('admin.productAnalytics.titleEmphasis')}</em>
          </>
        }
        sub={t('admin.productAnalytics.sub')}
        actions={
          <Select
            value={analyticsPeriodDays}
            onChange={(event) => setAnalyticsPeriodDays(Number(event.target.value))}
            aria-label={t('admin.productAnalytics.periodAria')}
            wrapperStyle={{ width: 'auto' }}
          >
            <option value={7}>{t('admin.productAnalytics.period.last7')}</option>
            <option value={30}>{t('admin.productAnalytics.period.last30')}</option>
            <option value={90}>{t('admin.productAnalytics.period.last90')}</option>
          </Select>
        }
      />

      {!showAnalyticsSkeleton && !configured && (
        <div style={{ marginBottom: 24 }}>
          <Card pad={20}>
            <p style={{ margin: 0, fontSize: 14, color: 'var(--ink-60)', lineHeight: 1.6 }}>
              {t('admin.productAnalytics.notConfigured.prefix')} (<code>POSTHOG_PERSONAL_API_KEY</code> / <code>POSTHOG_PROJECT_ID</code>).
              {' '}{t('admin.productAnalytics.notConfigured.body')} <code>backend/.env.example</code>.
            </p>
          </Card>
        </div>
      )}

      {!showAnalyticsSkeleton && productAnalytics?.error && (
        <div style={{ marginBottom: 24 }}>
          <Card pad={20}>
            <p style={{ margin: 0, fontSize: 14, color: 'var(--coral)' }}>{productAnalytics.error}</p>
          </Card>
        </div>
      )}

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: isMobile ? 'repeat(1, 1fr)' : 'repeat(3, 1fr)',
          gap: isMobile ? 12 : 16,
          marginBottom: 16,
        }}
      >
        <KpiCard
          mode="dark"
          label={t('admin.productAnalytics.eventLabels.checkoutStarted')}
          value={productAnalytics?.funnel.checkoutStarted ?? '—'}
          loading={showAnalyticsSkeleton}
          animKey="analytics_started"
        />
        <KpiCard
          label={t('admin.productAnalytics.eventLabels.checkoutCompleted')}
          value={productAnalytics?.funnel.checkoutCompleted ?? '—'}
          loading={showAnalyticsSkeleton}
          animKey="analytics_completed"
        />
        <KpiCard
          label={t('admin.productAnalytics.kpi.conversion')}
          value={productAnalytics ? `${productAnalytics.funnel.conversionRate}%` : '—'}
          loading={showAnalyticsSkeleton}
          animKey="analytics_conversion"
        />
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, 1fr)',
          gap: 16,
          marginBottom: 24,
        }}
      >
        <KpiCard
          label={t('admin.productAnalytics.eventLabels.addedToCart')}
          value={productAnalytics?.cartAbandonment.addedToCart ?? '—'}
          loading={showAnalyticsSkeleton}
          animKey="analytics_added"
        />
        <KpiCard
          label={t('admin.productAnalytics.kpi.cartAbandonment')}
          value={productAnalytics ? `${productAnalytics.cartAbandonment.abandonmentRate}%` : '—'}
          loading={showAnalyticsSkeleton}
          animKey="analytics_abandonment"
        />
      </div>

      <Card
        title={t('admin.productAnalytics.table.title')}
        sub={t('admin.productAnalytics.table.sub')}
        pad={0}
        loading={showAnalyticsSkeleton}
      >
        <div style={{ overflowX: 'auto', width: '100%' }}>
          <table style={{ ...tableStyle, minWidth: 700 }}>
            <thead>
              <tr>
                <th scope="col" style={th}>{t('admin.productAnalytics.table.columns.event')}</th>
                <th scope="col" style={th}>{t('admin.productAnalytics.table.columns.userSession')}</th>
                <th scope="col" style={th}>{t('admin.productAnalytics.table.columns.date')}</th>
              </tr>
            </thead>
            <tbody>
              {(productAnalytics?.recentEvents || []).map((event, index) => {
                const labelKey = productAnalyticsEventLabelKeys[event.event];
                return (
                <tr key={`${event.distinctId}-${event.timestamp}-${index}`} style={trStyle}>
                  <td style={td}>{labelKey ? t(`admin.productAnalytics.eventLabels.${labelKey}`) : event.event}</td>
                  <td style={{ ...td, fontFamily: '"JetBrains Mono", monospace', fontSize: 12 }}>{event.distinctId}</td>
                  <td style={{ ...td, fontFamily: '"JetBrains Mono", monospace', fontSize: 12 }}>
                    {formatPanamaDateTime(event.timestamp)}
                  </td>
                </tr>
                );
              })}
              {!productAnalytics?.recentEvents.length && (
                <tr>
                  <td style={{ ...td, textAlign: 'center', color: 'var(--ink-60)' }} colSpan={3}>
                    {t('admin.productAnalytics.table.empty')}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  );
}
