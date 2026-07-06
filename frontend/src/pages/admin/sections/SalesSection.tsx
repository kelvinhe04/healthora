import {
  BarChart,
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
import { useAdminPanelContext } from '../AdminPanelContext';

export function SalesSection() {
  const {
  showSalesSkeleton,
  sales,
  isMobile,
  isTablet,
  isSmall,
  } = useAdminPanelContext();

  return (
    <>
          <>
            <PageHeader
              loading={showSalesSkeleton}
              kicker="Ventas"
              title={
                <>
                  Análisis de <em style={{ color: "var(--green)" }}>ventas</em>
                </>
              }
              sub="Tendencia diaria, productos y categorías más vendidas."
            />
            <div
              style={{
                display: "grid",
                gridTemplateColumns: isSmall ? "repeat(2, 1fr)" : "repeat(4, 1fr)",
                gap: 16,
                marginBottom: 28,
              }}
            >
              <KpiCard
                label="Total órdenes"
                value={sales?.summary?.totalOrders?.toLocaleString() ?? "—"}
                sub="pagadas en total"
                loading={showSalesSkeleton}
                animKey="sales_orders"
              />
              <KpiCard
                label="Ingresos totales"
                value={
                  sales?.summary
                    ? `$${sales.summary.totalRevenue.toLocaleString()}`
                    : "—"
                }
                sub="todos los pedidos"
                loading={showSalesSkeleton}
                animKey="sales_revenue"
              />
              <KpiCard
                mode="dark"
                label="Promedio por pedido"
                value={
                  sales?.summary
                    ? `$${sales.summary.avgOrderValue.toFixed(2)}`
                    : "—"
                }
                sub="por orden"
                loading={showSalesSkeleton}
                animKey="sales_avg"
              />
              <KpiCard
                label="Unidades vendidas"
                value={sales?.summary?.totalUnits?.toLocaleString() ?? "—"}
                sub="total de productos"
                loading={showSalesSkeleton}
                animKey="sales_units"
              />
            </div>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 24,
                marginBottom: 24,
              }}
            >
              <Card
                title="Órdenes por día"
                sub="Pedidos diarios · últimos 30 días"
                loading={showSalesSkeleton}
                skeletonContent={<Skeleton height={240} borderRadius={8} />}
              >
                {sales?.daily ? (
                  <BarChart data={sales.daily} height={240} />
                ) : (
                  <Skeleton height={240} borderRadius={8} />
                )}
              </Card>
              <Card
                title="Ingresos por categoría"
                sub="Ingresos por categoría"
                loading={showSalesSkeleton}
                skeletonContent={<Skeleton height={240} borderRadius={8} />}
              >
                {sales?.revenueByCategory?.length ? (
                  <BarChart data={sales.revenueByCategory} height={240} />
                ) : (
                  <Skeleton height={240} borderRadius={8} />
                )}
              </Card>
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: isSmall ? "1fr" : "1fr 1fr",
                gap: 20,
              }}
            >
              <Card
                title="Productos con más ingresos"
                sub="Basado en órdenes pagadas"
                loading={showSalesSkeleton}
                skeletonContent={
                  <div
                    style={{ display: "flex", flexDirection: "column", gap: 0 }}
                  >
                    {[0, 1, 2, 3, 4].map((i) => (
                      <div
                        key={i}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 14,
                          padding: "12px 0",
                          borderBottom: "1px solid var(--ink-06)",
                        }}
                      >
                        <div style={{ flex: 2 }}>
                          <Skeleton height={13} width="75%" borderRadius={4} />
                        </div>
                        <Skeleton height={22} width={72} borderRadius={999} />
                        <Skeleton height={22} width={80} borderRadius={999} />
                        <Skeleton height={13} width={32} borderRadius={4} />
                        <Skeleton height={16} width={52} borderRadius={4} />
                      </div>
                    ))}
                  </div>
                }
              >
                <div style={{ overflowX: 'auto', width: '100%' }}>
                <table style={{ ...tableStyle, minWidth: 420 }}>
                  <thead>
                    <tr>
                      <th style={th}>Producto</th>
                      <th style={th}>Marca</th>
                      <th style={th}>Categoría</th>
                      <th style={th}>Unidades</th>
                      <th style={th}>Ingresos</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(sales?.byCategory || []).map((row) => (
                      <tr key={row.productId} style={trStyle}>
                        <td style={td}>{row.name}</td>
                        <td style={td}>
                          <StatusPill status={row.brand} />
                        </td>
                        <td style={td}>
                          <StatusPill status={row.category} />
                        </td>
                        <td
                          style={{
                            ...td,
                            fontFamily: '"JetBrains Mono", monospace',
                          }}
                        >
                          {row.units}
                        </td>
                        <td
                          style={{
                            ...td,
                            fontFamily: '"Instrument Serif", serif',
                            fontSize: 18,
                          }}
                        >
                          ${row.revenue.toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                </div>
              </Card>
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 20,
                }}
              >
                <Card
                  title="Mejores categorías"
                  sub="Por unidades vendidas"
                  loading={showSalesSkeleton}
                  skeletonContent={
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: 16,
                      }}
                    >
                      {[0, 1, 2, 3, 4].map((i) => (
                        <div key={i}>
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: 10,
                              marginBottom: 6,
                            }}
                          >
                            <Skeleton height={11} width={20} borderRadius={4} />
                            <Skeleton
                              height={13}
                              width="50%"
                              borderRadius={4}
                            />
                            <Skeleton height={13} width={48} borderRadius={4} />
                          </div>
                          <Skeleton
                            height={6}
                            width="100%"
                            borderRadius={999}
                          />
                        </div>
                      ))}
                    </div>
                  }
                >
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: 16,
                    }}
                  >
                    {(sales?.topCategories || []).length === 0 ? (
                      <div
                        style={{
                          fontSize: 14,
                          color: "var(--ink-60)",
                        }}
                      >
                        No hay datos.
                      </div>
                    ) : (
                      (sales?.topCategories || []).map((row, i) => (
                        <div key={row._id}>
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: 12,
                              marginBottom: 6,
                            }}
                          >
                            <span
                              style={{
                                fontSize: 11,
                                fontFamily: '"JetBrains Mono", monospace',
                                color: "var(--ink-60)",
                                width: 20,
                              }}
                            >
                              #{i + 1}
                            </span>
                            <span
                              style={{
                                fontSize: 14,
                                fontWeight: 500,
                                flex: 1,
                              }}
                            >
                              {row._id}
                            </span>
                            <span
                              style={{
                                fontSize: 14,
                                fontFamily: '"JetBrains Mono", monospace',
                              }}
                            >
                              {row.units} uds
                            </span>
                          </div>
                          <div
                            style={{
                              height: 6,
                              background: "var(--ink-06)",
                              borderRadius: 999,
                              overflow: "hidden",
                            }}
                          >
                            <div
                              style={{
                                height: "100%",
                                width: `${(row.units / Math.max(...((sales?.topCategories || []).map((r) => r.units) || [1]))) * 100}%`,
                                background: "var(--green)",
                                borderRadius: 999,
                              }}
                            />
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </Card>
                <Card
                  title="Mejores marcas"
                  sub="Por unidades vendidas"
                  loading={showSalesSkeleton}
                  skeletonContent={
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: 16,
                      }}
                    >
                      {[0, 1, 2, 3, 4].map((i) => (
                        <div key={i}>
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: 10,
                              marginBottom: 6,
                            }}
                          >
                            <Skeleton height={11} width={20} borderRadius={4} />
                            <Skeleton
                              height={13}
                              width="45%"
                              borderRadius={4}
                            />
                            <Skeleton height={13} width={48} borderRadius={4} />
                          </div>
                          <Skeleton
                            height={6}
                            width="100%"
                            borderRadius={999}
                          />
                        </div>
                      ))}
                    </div>
                  }
                >
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: 16,
                    }}
                  >
                    {(sales?.topBrands || []).length === 0 ? (
                      <div
                        style={{
                          fontSize: 14,
                          color: "var(--ink-60)",
                        }}
                      >
                        No hay datos.
                      </div>
                    ) : (
                      (sales?.topBrands || []).map((row, i) => (
                        <div key={row._id}>
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: 12,
                              marginBottom: 6,
                            }}
                          >
                            <span
                              style={{
                                fontSize: 11,
                                fontFamily: '"JetBrains Mono", monospace',
                                color: "var(--ink-60)",
                                width: 20,
                              }}
                            >
                              #{i + 1}
                            </span>
                            <span
                              style={{
                                fontSize: 14,
                                fontWeight: 500,
                                flex: 1,
                              }}
                            >
                              {row._id}
                            </span>
                            <span
                              style={{
                                fontSize: 14,
                                fontFamily: '"JetBrains Mono", monospace',
                              }}
                            >
                              {row.units} uds
                            </span>
                          </div>
                          <div
                            style={{
                              height: 6,
                              background: "var(--ink-06)",
                              borderRadius: 999,
                              overflow: "hidden",
                            }}
                          >
                            <div
                              style={{
                                height: "100%",
                                width: `${(row.units / Math.max(...((sales?.topBrands || []).map((r) => r.units) || [1]))) * 100}%`,
                                background: "var(--green)",
                                borderRadius: 999,
                              }}
                            />
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </Card>
              </div>
            </div>
          </>
    </>
  );
}
