import { useTranslation } from 'react-i18next';
import {
  BarChart,
  Card,
  KpiCard,
  PageHeader,
  Skeleton,
  StatusPill,
  tableStyle,
  td,
  th,
  trStyle,
} from '../../../components/admin';
import { useAdminPanelContext } from '../AdminPanelContext';
import { formatCurrency, formatNumber } from '../../../lib/currency';

export function SalesSection() {
  const { t } = useTranslation();
  const {
  showSalesSkeleton,
  sales,
  isSmall,
  } = useAdminPanelContext();

  return (
    <>
          <>
            <PageHeader
              loading={showSalesSkeleton}
              kicker={t('admin.sidebar.nav.sales')}
              title={
                <>
                  {t('admin.sales.titlePrefix')} <em style={{ color: "var(--green)" }}>{t('admin.sales.titleEmphasis')}</em>
                </>
              }
              sub={t('admin.sales.sub')}
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
                label={t('admin.sales.kpi.totalOrders')}
                value={sales?.summary?.totalOrders != null ? formatNumber(sales.summary.totalOrders) : "—"}
                sub={t('admin.sales.kpi.totalOrdersSub')}
                loading={showSalesSkeleton}
                animKey="sales_orders"
              />
              <KpiCard
                label={t('admin.sales.kpi.totalRevenue')}
                value={
                  sales?.summary
                    ? formatCurrency(sales.summary.totalRevenue)
                    : "—"
                }
                sub={t('admin.sales.kpi.totalRevenueSub')}
                loading={showSalesSkeleton}
                animKey="sales_revenue"
              />
              <KpiCard
                mode="dark"
                label={t('admin.sales.kpi.avgOrderValue')}
                value={
                  sales?.summary
                    ? formatCurrency(sales.summary.avgOrderValue)
                    : "—"
                }
                sub={t('admin.sales.kpi.avgOrderValueSub')}
                loading={showSalesSkeleton}
                animKey="sales_avg"
              />
              <KpiCard
                label={t('admin.sales.kpi.totalUnits')}
                value={sales?.summary?.totalUnits != null ? formatNumber(sales.summary.totalUnits) : "—"}
                sub={t('admin.sales.kpi.totalUnitsSub')}
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
                title={t('admin.sales.dailyOrders.title')}
                sub={t('admin.sales.dailyOrders.sub')}
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
                title={t('admin.sales.revenueByCategory.title')}
                sub={t('admin.sales.revenueByCategory.sub')}
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
                title={t('admin.sales.topProducts.title')}
                sub={t('admin.sales.topProducts.sub')}
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
                      <th style={th}>{t('admin.sales.topProducts.columns.product')}</th>
                      <th style={th}>{t('admin.sales.topProducts.columns.brand')}</th>
                      <th style={th}>{t('admin.sales.topProducts.columns.category')}</th>
                      <th style={th}>{t('admin.sales.topProducts.columns.units')}</th>
                      <th style={th}>{t('admin.sales.topProducts.columns.revenue')}</th>
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
                          {formatCurrency(row.revenue)}
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
                  title={t('admin.sales.topCategories.title')}
                  sub={t('admin.sales.topCategories.sub')}
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
                        {t('admin.sales.noData')}
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
                              {t('admin.sales.unitsAbbrev', { count: row.units })}
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
                  title={t('admin.sales.topBrands.title')}
                  sub={t('admin.sales.topBrands.sub')}
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
                        {t('admin.sales.noData')}
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
                              {t('admin.sales.unitsAbbrev', { count: row.units })}
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
            <div style={{ marginTop: 24 }}>
              <Card
                title={t('admin.sales.topVariants.title')}
                sub={t('admin.sales.topVariants.sub')}
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
                          <Skeleton height={13} width="55%" borderRadius={4} />
                          <Skeleton height={13} width={48} borderRadius={4} />
                        </div>
                        <Skeleton height={6} width="100%" borderRadius={999} />
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
                  {(sales?.topVariants || []).length === 0 ? (
                    <div
                      style={{
                        fontSize: 14,
                        color: "var(--ink-60)",
                      }}
                    >
                      {t('admin.sales.topVariants.empty')}
                    </div>
                  ) : (
                    (sales?.topVariants || []).map((row, i) => (
                      <div key={`${row.productId}-${row.variantLabel}`}>
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
                            {row.productName}{" "}
                            <span style={{ color: "var(--ink-60)", fontWeight: 400 }}>
                              · {row.variantLabel}
                            </span>
                          </span>
                          <span
                            style={{
                              fontSize: 14,
                              fontFamily: '"JetBrains Mono", monospace',
                            }}
                          >
                            {t('admin.sales.unitsAbbrev', { count: row.units })}
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
                              width: `${(row.units / Math.max(...((sales?.topVariants || []).map((r) => r.units) || [1]))) * 100}%`,
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
          </>
    </>
  );
}
