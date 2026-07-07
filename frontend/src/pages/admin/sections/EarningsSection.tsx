import {
  Card,
  KpiCard,
  LineChart,
  PageHeader,
  Skeleton,
  tableStyle,
  td,
  th,
  trStyle,
} from '../../../components/admin';
import { useAdminPanelContext } from '../AdminPanelContext';

export function EarningsSection() {
  const {
  showEarningsSkeleton,
  earnings,
  isMobile,
  isTablet,
  } = useAdminPanelContext();

  return (
    <>
            <PageHeader
              loading={showEarningsSkeleton}
              kicker="Ganancias"
              title={
                <>
                  Las <em style={{ color: "var(--green)" }}>ganancias</em>
                </>
              }
              sub="Resumen bruto, neto y evolución mensual del ecommerce."
            />
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(4, 1fr)",
                gap: 16,
                marginBottom: 24,
              }}
            >
              <KpiCard
                mode="dark"
                label="Ingresos brutos"
                value={
                  earnings?.summary
                    ? `$${earnings.summary.gross.toFixed(2)}`
                    : "—"
                }
                loading={showEarningsSkeleton}
                animKey="earn_gross"
              />
              <KpiCard
                label="Impuestos"
                value={
                  earnings?.summary
                    ? `$${earnings.summary.tax.toFixed(2)}`
                    : "—"
                }
                loading={showEarningsSkeleton}
                animKey="earn_tax"
              />
              <KpiCard
                label="Utilidad neta"
                value={
                  earnings?.summary
                    ? `$${earnings.summary.net.toLocaleString()}`
                    : "—"
                }
                loading={showEarningsSkeleton}
                animKey="earn_net"
              />
              <KpiCard
                label="Comisiones Stripe"
                value={
                  earnings?.summary
                    ? `$${earnings.summary.fees.toFixed(2)}`
                    : "—"
                }
                sub="estimado 2.9%"
                loading={showEarningsSkeleton}
                animKey="earn_fees"
              />
            </div>
            <Card
              title="Detalle mensual"
              sub="Ingresos y órdenes por mes"
              pad={20}
              loading={showEarningsSkeleton}
              skeletonContent={
                <div style={{ display: "flex", flexDirection: "column" }}>
                  {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map((i) => (
                    <div
                      key={i}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 16,
                        padding: "14px 24px",
                        borderBottom: "1px solid var(--ink-06)",
                      }}
                    >
                      {/* Mes */}
                      <div style={{ flex: 3 }}>
                        <Skeleton height={13} width="70%" borderRadius={4} />
                      </div>
                      {/* Órdenes */}
                      <div style={{ flex: 1 }}>
                        <Skeleton height={13} width={32} borderRadius={4} />
                      </div>
                      {/* Revenue */}
                      <div style={{ flex: 2 }}>
                        <Skeleton height={18} width={80} borderRadius={4} />
                      </div>
                    </div>
                  ))}
                </div>
              }
            >
              <div style={{ overflowX: 'auto', width: '100%' }}>
              <table style={{ ...tableStyle, minWidth: 340 }}>
                <thead>
                  <tr>
                    <th style={th}>Mes</th>
                    <th style={th}>Órdenes</th>
                    <th style={th}>Ingresos</th>
                  </tr>
                </thead>
                <tbody>
                  {(earnings?.monthly
                    ? [...earnings.monthly].reverse()
                    : []
                  ).map((row) => (
                    <tr key={row.month} style={trStyle}>
                      <td style={td}>{row.month}</td>
                      <td
                        style={{
                          ...td,
                          fontFamily: '"JetBrains Mono", monospace',
                        }}
                      >
                        {row.orders}
                      </td>
                      <td
                        style={{
                          ...td,
                          fontFamily: '"Instrument Serif", serif',
                          fontSize: 18,
                        }}
                      >
                        ${row.revenue.toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
            </Card>
    </>
  );
}
