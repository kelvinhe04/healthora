import {
  Card,
  KpiCard,
  PageHeader,
  Skeleton,
  tableStyle,
  td,
  th,
  trStyle,
} from '../../../components/admin';
import { useAdminPanelContext } from '../AdminPanelContext';

export function PerformanceSection() {
  const {
    showPerformanceSkeleton,
    performanceWindow,
    setPerformanceWindow,
    performanceData,
  } = useAdminPanelContext();

  return (
    <>
      <PageHeader
        loading={showPerformanceSkeleton}
        kicker="APM"
        title={
          <>
            Métricas de <em style={{ color: 'var(--green)' }}>rendimiento</em>
          </>
        }
        sub="Latencia, throughput y alertas por endpoint del backend."
        actions={
          <select
            value={performanceWindow}
            onChange={(event) => setPerformanceWindow(Number(event.target.value))}
            aria-label="Ventana de tiempo de métricas"
            style={{
              border: '1px solid var(--ink-10)',
              borderRadius: 999,
              background: 'var(--cream)',
              color: 'var(--ink)',
              padding: '10px 14px',
              fontSize: 13,
            }}
          >
            <option value={60}>Última hora</option>
            <option value={360}>Últimas 6 horas</option>
            <option value={1440}>Últimas 24 horas</option>
            <option value={10080}>Últimos 7 días</option>
          </select>
        }
      />

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: 16,
          marginBottom: 24,
        }}
      >
        <KpiCard
          mode="dark"
          label="Requests"
          value={performanceData?.summary.totalRequests ?? '—'}
          loading={showPerformanceSkeleton}
          animKey="perf_requests"
        />
        <KpiCard
          label="Throughput"
          value={performanceData ? `${performanceData.summary.throughputPerMinute}/min` : '—'}
          loading={showPerformanceSkeleton}
          animKey="perf_throughput"
        />
        <KpiCard
          label="p95 latencia"
          value={performanceData ? `${performanceData.summary.p95LatencyMs} ms` : '—'}
          sub={performanceData?.alerts.p95Breached ? 'sobre umbral' : undefined}
          loading={showPerformanceSkeleton}
          animKey="perf_p95"
        />
        <KpiCard
          label="Error rate"
          value={performanceData ? `${performanceData.summary.errorRate}%` : '—'}
          sub={performanceData?.alerts.errorRateBreached ? 'sobre umbral' : undefined}
          loading={showPerformanceSkeleton}
          animKey="perf_errors"
        />
      </div>

      <Card
        title="Alertas configuradas"
        sub="Umbrales usados para evaluar el SLA operativo"
        pad={20}
        loading={showPerformanceSkeleton}
      >
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
          <div>
            <div style={{ fontSize: 12, color: 'var(--ink-60)' }}>Request lenta</div>
            <div style={{ fontFamily: '"JetBrains Mono", monospace', marginTop: 6 }}>
              {performanceData?.alerts.slowThresholdMs ?? '—'} ms
            </div>
          </div>
          <div>
            <div style={{ fontSize: 12, color: 'var(--ink-60)' }}>p95 máximo</div>
            <div style={{ fontFamily: '"JetBrains Mono", monospace', marginTop: 6 }}>
              {performanceData?.alerts.p95ThresholdMs ?? '—'} ms
            </div>
          </div>
          <div>
            <div style={{ fontSize: 12, color: 'var(--ink-60)' }}>Error rate máximo</div>
            <div style={{ fontFamily: '"JetBrains Mono", monospace', marginTop: 6 }}>
              {performanceData?.alerts.errorRateThresholdPercent ?? '—'}%
            </div>
          </div>
        </div>
      </Card>

      <Card
        title="Endpoints"
        sub="Latencia y throughput por ruta"
        pad={0}
        loading={showPerformanceSkeleton}
        skeletonContent={
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <div
                key={i}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 120px 120px 120px',
                  gap: 16,
                  padding: '16px 24px',
                  borderBottom: '1px solid var(--ink-06)',
                }}
              >
                <Skeleton height={18} borderRadius={4} />
                <Skeleton height={18} borderRadius={4} />
                <Skeleton height={18} borderRadius={4} />
                <Skeleton height={18} borderRadius={4} />
              </div>
            ))}
          </div>
        }
      >
        <div style={{ overflowX: 'auto', width: '100%' }}>
          <table style={{ ...tableStyle, minWidth: 840 }}>
            <thead>
              <tr>
                <th scope="col" style={th}>Endpoint</th>
                <th scope="col" style={th}>Requests</th>
                <th scope="col" style={th}>Throughput</th>
                <th scope="col" style={th}>Avg</th>
                <th scope="col" style={th}>p95</th>
                <th scope="col" style={th}>Errores</th>
              </tr>
            </thead>
            <tbody>
              {(performanceData?.endpoints || []).map((endpoint) => (
                <tr key={endpoint.endpoint} style={trStyle}>
                  <td style={{ ...td, fontFamily: '"JetBrains Mono", monospace', fontSize: 12 }}>
                    {endpoint.endpoint}
                  </td>
                  <td style={td}>{endpoint.requests}</td>
                  <td style={td}>{endpoint.throughputPerMinute}/min</td>
                  <td style={td}>{endpoint.avgLatencyMs} ms</td>
                  <td style={td}>{endpoint.p95LatencyMs} ms</td>
                  <td style={td}>{endpoint.errorRate}%</td>
                </tr>
              ))}
              {!performanceData?.endpoints.length && (
                <tr>
                  <td style={{ ...td, textAlign: 'center', color: 'var(--ink-60)' }} colSpan={6}>
                    Sin métricas registradas en esta ventana.
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
