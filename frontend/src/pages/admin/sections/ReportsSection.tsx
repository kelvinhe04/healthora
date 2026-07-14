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

const inputStyle = {
  border: '1px solid var(--ink-10)',
  borderRadius: 999,
  background: 'var(--cream)',
  color: 'var(--ink)',
  padding: '10px 14px',
  fontSize: 13,
};

function retentionColor(percent: number): string {
  const clamped = Math.max(0, Math.min(100, percent));
  return `color-mix(in srgb, var(--green) ${clamped}%, transparent)`;
}

export function ReportsSection() {
  const { cohortReport, showReportsSkeleton, reportsRange, setReportsRange, isSmall } =
    useAdminPanelContext();

  const cohorts = cohortReport?.cohorts ?? [];
  const maxOffset = cohorts.reduce((max, cohort) => Math.max(max, cohort.retention.length - 1), 0);
  const offsets = Array.from({ length: maxOffset + 1 }, (_, i) => i);
  // Mes 0 = mes de la primera compra: por definición siempre es 100% de retención para
  // cualquier cohorte, así que no aporta señal en el heatmap - se omite de esa tabla nada más
  // (el LTV acumulado del mes 0 sí varía por cohorte, esa tabla sigue mostrándolo).
  const retentionOffsets = offsets.slice(1);

  return (
    <>
      <PageHeader
        loading={showReportsSkeleton}
        kicker="Reportes avanzados"
        title={
          <>
            Cohortes y <em style={{ color: 'var(--green)' }}>LTV</em>
          </>
        }
        sub="Retención de clientes por mes de primera compra y valor de vida (LTV) acumulado por cohorte."
        actions={
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <input
              type="date"
              value={reportsRange.from}
              onChange={(e) => setReportsRange((r) => ({ ...r, from: e.target.value }))}
              aria-label="Cohortes desde"
              style={inputStyle}
            />
            <input
              type="date"
              value={reportsRange.to}
              onChange={(e) => setReportsRange((r) => ({ ...r, to: e.target.value }))}
              aria-label="Cohortes hasta"
              style={inputStyle}
            />
          </div>
        }
      />

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: isSmall ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)',
          gap: 16,
          marginBottom: 28,
        }}
      >
        <KpiCard
          label="Clientes con compra"
          value={cohortReport?.overall.totalCustomers.toLocaleString() ?? '—'}
          sub="pagaron al menos una vez"
          loading={showReportsSkeleton}
          animKey="reports_customers"
        />
        <KpiCard
          label="Órdenes / cliente"
          value={cohortReport ? cohortReport.overall.averageOrdersPerCustomer.toFixed(2) : '—'}
          sub="promedio histórico"
          loading={showReportsSkeleton}
          animKey="reports_orders_per_customer"
        />
        <KpiCard
          mode="dark"
          label="LTV promedio"
          value={cohortReport ? `$${cohortReport.overall.averageRevenuePerCustomer.toFixed(2)}` : '—'}
          sub="ingresos por cliente"
          loading={showReportsSkeleton}
          animKey="reports_ltv"
        />
        <KpiCard
          label="Ticket promedio"
          value={cohortReport ? `$${cohortReport.overall.averageOrderValue.toFixed(2)}` : '—'}
          sub="por orden pagada"
          loading={showReportsSkeleton}
          animKey="reports_aov"
        />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 24, marginBottom: 24 }}>
        <Card
          title="Retención por cohorte"
          sub="% de la cohorte que volvió a comprar, por mes transcurrido desde su primera compra"
          pad={0}
          loading={showReportsSkeleton}
          skeletonContent={<Skeleton height={240} borderRadius={8} />}
        >
          {cohorts.length > 0 ? (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ ...tableStyle, minWidth: 480 + retentionOffsets.length * 90 }}>
                <thead>
                  <tr>
                    <th style={th}>Cohorte</th>
                    <th style={th}>Clientes</th>
                    {retentionOffsets.map((offset) => (
                      <th key={offset} style={{ ...th, textAlign: 'center' }}>
                        Mes {offset}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {cohorts.map((cohort) => (
                    <tr key={cohort.cohortMonth} style={trStyle}>
                      <td style={{ ...td, fontWeight: 600, whiteSpace: 'nowrap' }}>{cohort.cohortMonth}</td>
                      <td style={td}>{cohort.customers}</td>
                      {retentionOffsets.map((offset) => {
                        const cell = cohort.retention[offset];
                        return (
                          <td
                            key={offset}
                            style={{
                              ...td,
                              textAlign: 'center',
                              background: cell ? retentionColor(cell.percent) : undefined,
                            }}
                          >
                            {cell ? `${cell.percent}%` : '—'}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div style={{ padding: 24, fontSize: 13, color: 'var(--ink-60)' }}>
              Todavía no hay suficientes órdenes pagadas para armar cohortes en este rango.
            </div>
          )}
        </Card>

        <Card
          title="LTV acumulado por cliente"
          sub="Ingresos acumulados por cliente inicial de la cohorte, mes a mes"
          pad={0}
          loading={showReportsSkeleton}
          skeletonContent={<Skeleton height={240} borderRadius={8} />}
        >
          {cohorts.length > 0 ? (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ ...tableStyle, minWidth: 640 + offsets.length * 90 }}>
                <thead>
                  <tr>
                    <th style={th}>Cohorte</th>
                    <th style={th}>Clientes</th>
                    {offsets.map((offset) => (
                      <th key={offset} style={{ ...th, textAlign: 'center' }}>
                        Mes {offset}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {cohorts.map((cohort) => (
                    <tr key={cohort.cohortMonth} style={trStyle}>
                      <td style={{ ...td, fontWeight: 600, whiteSpace: 'nowrap' }}>{cohort.cohortMonth}</td>
                      <td style={td}>{cohort.customers}</td>
                      {offsets.map((offset) => {
                        const cell = cohort.cumulativeLtv[offset];
                        return (
                          <td key={offset} style={{ ...td, textAlign: 'center' }}>
                            {cell ? `$${cell.value.toFixed(2)}` : '—'}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div style={{ padding: 24, fontSize: 13, color: 'var(--ink-60)' }}>
              Todavía no hay suficientes órdenes pagadas para calcular LTV en este rango.
            </div>
          )}
        </Card>
      </div>
    </>
  );
}
