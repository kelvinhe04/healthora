import { useTranslation } from 'react-i18next';
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
import { formatCurrency } from '../../../lib/currency';

export function EarningsSection() {
  const { t } = useTranslation();
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
              kicker={t('admin.earnings.kicker')}
              title={
                <>
                  {t('admin.earnings.titlePrefix')} <em style={{ color: "var(--green)" }}>{t('admin.earnings.titleEmphasis')}</em>
                </>
              }
              sub={t('admin.earnings.sub')}
            />
            <div
              style={{
                display: "grid",
                gridTemplateColumns: isMobile || isTablet ? "repeat(2, 1fr)" : "repeat(4, 1fr)",
                gap: isMobile ? 12 : 16,
                marginBottom: 24,
              }}
            >
              <KpiCard
                mode="dark"
                label={t('admin.earnings.kpi.grossRevenue')}
                value={
                  earnings?.summary
                    ? formatCurrency(earnings.summary.gross)
                    : "—"
                }
                loading={showEarningsSkeleton}
                animKey="earn_gross"
              />
              <KpiCard
                label={t('admin.earnings.kpi.tax')}
                value={
                  earnings?.summary
                    ? formatCurrency(earnings.summary.tax)
                    : "—"
                }
                loading={showEarningsSkeleton}
                animKey="earn_tax"
              />
              <KpiCard
                label={t('admin.earnings.kpi.netProfit')}
                value={
                  earnings?.summary
                    ? formatCurrency(earnings.summary.net)
                    : "—"
                }
                loading={showEarningsSkeleton}
                animKey="earn_net"
              />
              <KpiCard
                label={t('admin.earnings.kpi.stripeFees')}
                value={
                  earnings?.summary
                    ? formatCurrency(earnings.summary.fees)
                    : "—"
                }
                sub={t('admin.earnings.kpi.stripeFeesSub')}
                loading={showEarningsSkeleton}
                animKey="earn_fees"
              />
            </div>
            <Card
              title={t('admin.earnings.monthly.title')}
              sub={t('admin.earnings.monthly.sub')}
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
                    <th style={th}>{t('admin.earnings.monthly.columns.month')}</th>
                    <th style={th}>{t('admin.charts.orders')}</th>
                    <th style={th}>{t('admin.charts.revenue')}</th>
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
                        {formatCurrency(row.revenue)}
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
