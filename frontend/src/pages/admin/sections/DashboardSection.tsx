import { useTranslation } from 'react-i18next';
import {
  Card,
  KpiCard,
  LineChart,
  PageHeader,
  Skeleton,
  StatusPill,
  tableStyle,
  td,
  th,
  trStyle,
} from '../../../components/admin';
import { ProductImage } from '../../../components/shared/ProductImage';
import { useAdminPanelContext } from '../AdminPanelContext';
import { formatCurrency } from '../../../lib/currency';

export function DashboardSection() {
  const { t } = useTranslation();
  const {
  dashboard,
  isMobile,
  isTablet,
  isSmall,
  customers,
  } = useAdminPanelContext();

  return (
    <>
          <>
            <PageHeader
              loading={!dashboard}
              kicker={t('admin.dashboard.kicker')}
              title={
                <>
                  {t('admin.dashboard.titleWord')} <em style={{ color: "var(--green)" }}>Healthora</em>
                </>
              }
              sub={t('admin.dashboard.sub')}
            />
            <div
              style={{
                display: "grid",
                gridTemplateColumns: isMobile ? "repeat(2, 1fr)" : isTablet ? "repeat(2, 1fr)" : "repeat(4, 1fr)",
                gap: isMobile ? 12 : 16,
                marginBottom: 24,
              }}
            >
              <KpiCard
                mode="dark"
                label={t('admin.dashboard.kpi.revenueMonth')}
                value={
                  dashboard
                    ? formatCurrency(dashboard.kpis.revenue)
                    : "—"
                }
                delta={dashboard?.kpis.revenueDelta}
                sub={t('admin.dashboard.kpi.revenueMonthSub')}
                loading={!dashboard}
                animKey="revenue"
              />
              <KpiCard
                label={t('admin.dashboard.kpi.ordersMonth')}
                value={dashboard?.kpis.monthOrders ?? "—"}
                sub={t('admin.dashboard.kpi.ordersMonthSub')}
                loading={!dashboard}
                animKey="orders"
              />
              <KpiCard
                label={t('admin.dashboard.kpi.customers')}
                value={customers.length ?? "—"}
                sub={t('admin.dashboard.kpi.customersSub')}
                loading={!dashboard}
                animKey="users"
              />
              <KpiCard
                label={t('admin.dashboard.kpi.lowStock')}
                value={dashboard?.kpis.lowStock ?? "—"}
                sub={t('admin.dashboard.kpi.lowStockSub')}
                loading={!dashboard}
                animKey="lowstock"
              />
            </div>

            {/* Revenue chart card */}
            <Card
              title={t('admin.dashboard.revenueChart.title')}
              sub={t('admin.dashboard.revenueChart.sub')}
              loading={!dashboard}
              skeletonContent={<Skeleton height={240} borderRadius={8} />}
            >
              {(dashboard?.dailySales?.length ?? 0) > 0 ? (
                <LineChart data={dashboard?.dailySales} height={240} />
              ) : (
                <Skeleton height={240} borderRadius={8} />
              )}
            </Card>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: isSmall ? "1fr" : "1.2fr 1fr",
                gap: 20,
                marginTop: 24,
              }}
            >
              {/* Recent orders */}
              <Card
                title={t('admin.dashboard.recentOrders.title')}
                sub={t('admin.dashboard.recentOrders.sub')}
                loading={dashboard === undefined}
                skeletonContent={
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                    }}
                  >
                    {[0, 1, 2, 3, 4].map((i) => (
                      <div
                        key={i}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 14,
                          padding: "14px 0",
                          borderBottom: "1px solid var(--ink-06)",
                        }}
                      >
                        <Skeleton height={13} width="16%" borderRadius={4} />
                        <div style={{ flex: 1 }}>
                          <Skeleton height={13} width="65%" borderRadius={4} />
                          <div style={{ marginTop: 6 }}>
                            <Skeleton
                              height={10}
                              width="55%"
                              borderRadius={4}
                            />
                          </div>
                        </div>
                        <Skeleton height={18} width="13%" borderRadius={4} />
                        <Skeleton height={22} width={58} borderRadius={999} />
                      </div>
                    ))}
                  </div>
                }
              >
                {dashboard?.recentOrders?.length ? (
                  <div style={{ overflowX: 'auto', width: '100%' }}>
                  <table style={{ ...tableStyle, minWidth: 420 }}>
                    <thead>
                      <tr>
                        <th style={th}>{t('admin.dashboard.recentOrders.columns.order')}</th>
                        <th style={th}>{t('admin.dashboard.recentOrders.columns.customer')}</th>
                        <th style={th}>{t('admin.dashboard.recentOrders.columns.total')}</th>
                        <th style={th}>{t('admin.dashboard.recentOrders.columns.payment')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(dashboard?.recentOrders || []).map((order) => (
                        <tr key={order._id} style={trStyle}>
                          <td
                            style={{
                              ...td,
                              fontFamily: '"JetBrains Mono", monospace',
                            }}
                          >
                            {order._id.slice(-8).toUpperCase()}
                          </td>
                          <td style={td}>
                            <div
                              style={{
                                fontWeight: 500,
                              }}
                            >
                              {order.customerName || t('admin.dashboard.recentOrders.defaultCustomerName')}
                            </div>
                            <div
                              style={{
                                fontSize: 11,
                                color: "var(--ink-60)",
                              }}
                            >
                              {order.customerEmail}
                            </div>
                          </td>
                          <td
                            style={{
                              ...td,
                              fontFamily: '"Instrument Serif", serif',
                              fontSize: 18,
                            }}
                          >
                            {formatCurrency(order.total || 0)}
                          </td>
                          <td style={td}>
                            <StatusPill
                              status={
                                order.paymentStatus === "paid"
                                  ? "Pagado"
                                  : order.paymentStatus === "cancelled"
                                    ? "Cancelado"
                                    : order.paymentStatus === "refunded"
                                      ? "Reembolsado"
                                      : "Pendiente"
                              }
                              label={
                                order.paymentStatus === "paid"
                                  ? t('admin.dashboard.paymentStatus.paid')
                                  : order.paymentStatus === "cancelled"
                                    ? t('admin.dashboard.paymentStatus.cancelled')
                                    : order.paymentStatus === "refunded"
                                      ? t('admin.dashboard.paymentStatus.refunded')
                                      : t('admin.dashboard.paymentStatus.pending')
                              }
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  </div>
                ) : (
                  <div
                    style={{
                      fontSize: 14,
                      color: "var(--ink-60)",
                    }}
                  >
                    {t('admin.dashboard.recentOrders.empty')}
                  </div>
                )}
              </Card>

              {/* Low stock */}
              <Card
                title={t('admin.dashboard.lowStockCard.title')}
                sub={t('admin.dashboard.lowStockCard.sub')}
                loading={dashboard === undefined}
                skeletonContent={
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: 14,
                    }}
                  >
                    {[0, 1, 2, 3].map((i) => (
                      <div
                        key={i}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 12,
                        }}
                      >
                        <Skeleton height={72} width={60} borderRadius={10} />
                        <div style={{ flex: 1 }}>
                          <Skeleton height={13} width="65%" borderRadius={4} />
                          <div style={{ marginTop: 7 }}>
                            <Skeleton
                              height={11}
                              width="42%"
                              borderRadius={4}
                            />
                          </div>
                        </div>
                        <Skeleton height={22} width={54} borderRadius={999} />
                      </div>
                    ))}
                  </div>
                }
              >
                {dashboard?.lowStockCells?.length ? (
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: 12,
                    }}
                  >
                    {(dashboard?.lowStockCells || []).map((cell) => (
                      <div
                        key={`${cell.product.id}-${cell.variantId ?? "base"}`}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 12,
                        }}
                      >
                        <div
                          style={{
                            width: 60,
                            height: 72,
                            borderRadius: 10,
                            overflow: "hidden",
                            border: "1px solid var(--ink-06)",
                            flexShrink: 0,
                          }}
                        >
                          <ProductImage product={cell.product} size="xs" />
                        </div>
                        <div style={{ flex: 1 }}>
                          <div
                            style={{
                              fontSize: 13,
                              fontWeight: 500,
                            }}
                          >
                            {cell.product.name}
                          </div>
                          <div
                            style={{
                              fontSize: 11,
                              color: "var(--ink-60)",
                            }}
                          >
                            {cell.variantLabel ?? cell.product.brand}
                          </div>
                        </div>
                        <StatusPill status={t('admin.dashboard.lowStockCard.unitsBadge', { count: cell.stock })} />
                      </div>
                    ))}
                  </div>
                ) : (
                  <div
                    style={{
                      fontSize: 14,
                      color: "var(--ink-60)",
                    }}
                  >
                    {t('admin.dashboard.lowStockCard.empty')}
                  </div>
                )}
              </Card>
            </div>
          </>
    </>
  );
}
