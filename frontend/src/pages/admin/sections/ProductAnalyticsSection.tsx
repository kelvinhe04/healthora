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
import { productAnalyticsEventLabels } from '../types';

const inputStyle = {
  border: '1px solid var(--ink-10)',
  borderRadius: 999,
  background: 'var(--cream)',
  color: 'var(--ink)',
  padding: '10px 14px',
  fontSize: 13,
};

export function ProductAnalyticsSection() {
  const {
    showAnalyticsSkeleton,
    analyticsPeriodDays,
    setAnalyticsPeriodDays,
    productAnalytics,
  } = useAdminPanelContext();

  const configured = productAnalytics?.configured ?? false;

  return (
    <>
      <PageHeader
        loading={showAnalyticsSkeleton}
        kicker="PostHog"
        title={
          <>
            Analítica de <em style={{ color: 'var(--green)' }}>producto</em>
          </>
        }
        sub="Embudo de checkout y abandono de carrito, sobre el comportamiento real de los usuarios."
        actions={
          <select
            value={analyticsPeriodDays}
            onChange={(event) => setAnalyticsPeriodDays(Number(event.target.value))}
            aria-label="Periodo de analítica"
            style={{
              ...inputStyle,
              appearance: 'none',
              backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23888' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E")`,
              backgroundRepeat: 'no-repeat',
              backgroundPosition: 'right 12px center',
              paddingRight: 32,
              cursor: 'pointer',
            }}
          >
            <option value={7}>Últimos 7 días</option>
            <option value={30}>Últimos 30 días</option>
            <option value={90}>Últimos 90 días</option>
          </select>
        }
      />

      {!showAnalyticsSkeleton && !configured && (
        <div style={{ marginBottom: 24 }}>
          <Card pad={20}>
            <p style={{ margin: 0, fontSize: 14, color: 'var(--ink-60)', lineHeight: 1.6 }}>
              PostHog no está configurado para consultas (<code>POSTHOG_PERSONAL_API_KEY</code> / <code>POSTHOG_PROJECT_ID</code>).
              El embudo y el abandono de carrito se muestran en cero hasta configurarlos — ver <code>backend/.env.example</code>.
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
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 16,
          marginBottom: 16,
        }}
      >
        <KpiCard
          mode="dark"
          label="Checkout iniciado"
          value={productAnalytics?.funnel.checkoutStarted ?? '—'}
          loading={showAnalyticsSkeleton}
          animKey="analytics_started"
        />
        <KpiCard
          label="Checkout completado"
          value={productAnalytics?.funnel.checkoutCompleted ?? '—'}
          loading={showAnalyticsSkeleton}
          animKey="analytics_completed"
        />
        <KpiCard
          label="Conversión"
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
          label="Agregado al carrito"
          value={productAnalytics?.cartAbandonment.addedToCart ?? '—'}
          loading={showAnalyticsSkeleton}
          animKey="analytics_added"
        />
        <KpiCard
          label="Abandono de carrito"
          value={productAnalytics ? `${productAnalytics.cartAbandonment.abandonmentRate}%` : '—'}
          loading={showAnalyticsSkeleton}
          animKey="analytics_abandonment"
        />
      </div>

      <Card
        title="Eventos clave recientes"
        sub="Últimos eventos de embudo capturados por PostHog"
        pad={0}
        loading={showAnalyticsSkeleton}
      >
        <div style={{ overflowX: 'auto', width: '100%' }}>
          <table style={{ ...tableStyle, minWidth: 700 }}>
            <thead>
              <tr>
                <th scope="col" style={th}>Evento</th>
                <th scope="col" style={th}>Usuario/sesión</th>
                <th scope="col" style={th}>Fecha</th>
              </tr>
            </thead>
            <tbody>
              {(productAnalytics?.recentEvents || []).map((event, index) => (
                <tr key={`${event.distinctId}-${event.timestamp}-${index}`} style={trStyle}>
                  <td style={td}>{productAnalyticsEventLabels[event.event] ?? event.event}</td>
                  <td style={{ ...td, fontFamily: '"JetBrains Mono", monospace', fontSize: 12 }}>{event.distinctId}</td>
                  <td style={{ ...td, fontFamily: '"JetBrains Mono", monospace', fontSize: 12 }}>
                    {formatPanamaDateTime(event.timestamp)}
                  </td>
                </tr>
              ))}
              {!productAnalytics?.recentEvents.length && (
                <tr>
                  <td style={{ ...td, textAlign: 'center', color: 'var(--ink-60)' }} colSpan={3}>
                    Sin eventos para este periodo.
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
