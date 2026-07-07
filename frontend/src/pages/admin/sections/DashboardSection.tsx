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

export function DashboardSection() {
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
              kicker="Panel de administración"
              title={
                <>
                  Dashboard <em style={{ color: "var(--green)" }}>Healthora</em>
                </>
              }
              sub="Resumen en vivo de ventas, órdenes, usuarios e inventario."
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
                label="Ingresos mes"
                value={
                  dashboard
                    ? `$${dashboard.kpis.revenue.toLocaleString()}`
                    : "—"
                }
                delta={dashboard?.kpis.revenueDelta}
                sub="vs mes anterior"
                loading={!dashboard}
                animKey="revenue"
              />
              <KpiCard
                label="Órdenes mes"
                value={dashboard?.kpis.monthOrders ?? "—"}
                sub="pagadas o en curso"
                loading={!dashboard}
                animKey="orders"
              />
              <KpiCard
                label="Clientes"
                value={customers.length ?? "—"}
                sub="clientes registrados"
                loading={!dashboard}
                animKey="users"
              />
              <KpiCard
                label="Existencias bajas"
                value={dashboard?.kpis.lowStock ?? "—"}
                sub="productos con 5 unidades o menos"
                loading={!dashboard}
                animKey="lowstock"
              />
            </div>

            {/* Revenue chart card */}
            <Card
              title="Ingresos · últimos 30 días"
              sub="Ingresos diarios, en USD"
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
                title="Pedidos recientes"
                sub="Últimas 5 órdenes del ecommerce"
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
                        <th style={th}>Orden</th>
                        <th style={th}>Cliente</th>
                        <th style={th}>Total</th>
                        <th style={th}>Pago</th>
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
                              {order.customerName || "Cliente"}
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
                            ${(order.total || 0).toFixed(2)}
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
                    No hay pedidos recientes.
                  </div>
                )}
              </Card>

              {/* Low stock */}
              <Card
                title="Inventario crítico"
                sub="Productos que requieren reposición"
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
                {dashboard?.lowStockProducts?.length ? (
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: 12,
                    }}
                  >
                    {(dashboard?.lowStockProducts || []).map((product) => (
                      <div
                        key={product.id}
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
                          <ProductImage product={product} size="xs" />
                        </div>
                        <div style={{ flex: 1 }}>
                          <div
                            style={{
                              fontSize: 13,
                              fontWeight: 500,
                            }}
                          >
                            {product.name}
                          </div>
                          <div
                            style={{
                              fontSize: 11,
                              color: "var(--ink-60)",
                            }}
                          >
                            {product.brand}
                          </div>
                        </div>
                        <StatusPill status={`${product.stock} uds`} />
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
                    No hay productos con existencias críticas.
                  </div>
                )}
              </Card>
            </div>
          </>
    </>
  );
}
