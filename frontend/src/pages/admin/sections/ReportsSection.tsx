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
import { ModalOverlay } from '../../../components/shared/ModalOverlay';
import { useAdminPanelContext } from '../AdminPanelContext';
import { formatPanamaDateTime } from '../../../lib/dates';
import { formatCurrency, formatNumber } from '../../../lib/currency';

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
  const { t } = useTranslation();
  const {
    cohortReport,
    showReportsSkeleton,
    reportsRange,
    setReportsRange,
    isSmall,
    selectedCohortMonth,
    setSelectedCohortMonth,
    cohortCustomers,
    loadingCohortCustomers,
  } = useAdminPanelContext();

  const cohorts = cohortReport?.cohorts ?? [];
  const maxOffset = cohorts.reduce((max, cohort) => Math.max(max, cohort.retention.length - 1), 0);
  const offsets = Array.from({ length: maxOffset + 1 }, (_, i) => i);
  // Mes 0 = mes de la primera compra: por definición siempre es 100% de retención para
  // cualquier cohorte, así que no aporta señal en el heatmap - se omite de esa tabla nada más
  // (el LTV acumulado del mes 0 sí varía por cohorte, esa tabla sigue mostrándolo).
  const retentionOffsets = offsets.slice(1);

  const selectedCohort = cohorts.find((c) => c.cohortMonth === selectedCohortMonth);
  const selectedCohortOffsets = selectedCohort ? selectedCohort.retention.map((r) => r.offset).slice(1) : [];

  return (
    <>
      <PageHeader
        loading={showReportsSkeleton}
        kicker={t('admin.reports.kicker')}
        title={
          <>
            {t('admin.reports.titlePrefix')} <em style={{ color: 'var(--green)' }}>{t('admin.reports.titleEmphasis')}</em>
          </>
        }
        sub={t('admin.reports.sub')}
        actions={
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--ink-60)', whiteSpace: 'nowrap' }}>
              {t('admin.reports.filters.from')}
              <input
                type="date"
                value={reportsRange.from}
                onChange={(e) => setReportsRange((r) => ({ ...r, from: e.target.value }))}
                style={inputStyle}
              />
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--ink-60)', whiteSpace: 'nowrap' }}>
              {t('admin.reports.filters.to')}
              <input
                type="date"
                value={reportsRange.to}
                onChange={(e) => setReportsRange((r) => ({ ...r, to: e.target.value }))}
                style={inputStyle}
              />
            </label>
          </div>
        }
      />

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: isSmall ? 'repeat(2, 1fr)' : 'repeat(3, 1fr)',
          gap: 16,
          marginBottom: 28,
        }}
      >
        <KpiCard
          label={t('admin.reports.kpi.customersWithPurchase')}
          value={cohortReport ? formatNumber(cohortReport.overall.totalCustomers) : '—'}
          sub={t('admin.reports.kpi.customersWithPurchaseSub')}
          loading={showReportsSkeleton}
          animKey="reports_customers"
        />
        <KpiCard
          label={t('admin.reports.kpi.ordersPerCustomer')}
          value={cohortReport ? cohortReport.overall.averageOrdersPerCustomer.toFixed(2) : '—'}
          sub={t('admin.reports.kpi.ordersPerCustomerSub')}
          loading={showReportsSkeleton}
          animKey="reports_orders_per_customer"
        />
        <KpiCard
          mode="dark"
          label={t('admin.reports.kpi.avgLtv')}
          value={cohortReport ? formatCurrency(cohortReport.overall.averageRevenuePerCustomer) : '—'}
          sub={t('admin.reports.kpi.avgLtvSub')}
          loading={showReportsSkeleton}
          animKey="reports_ltv"
        />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 24, marginBottom: 24 }}>
        <Card
          title={t('admin.reports.retention.title')}
          sub={t('admin.reports.retention.sub')}
          pad={0}
          loading={showReportsSkeleton}
          skeletonContent={<Skeleton height={240} borderRadius={8} />}
        >
          {cohorts.length > 0 ? (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ ...tableStyle, minWidth: 480 + retentionOffsets.length * 90 }}>
                <thead>
                  <tr>
                    <th style={th}>{t('admin.reports.table.columns.cohort')}</th>
                    <th style={th}>{t('admin.reports.table.columns.customers')}</th>
                    {retentionOffsets.map((offset) => (
                      <th key={offset} style={{ ...th, textAlign: 'center' }}>
                        {t('admin.reports.monthColumn', { n: offset })}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {cohorts.map((cohort) => (
                    <tr key={cohort.cohortMonth} style={trStyle}>
                      <td style={{ ...td, whiteSpace: 'nowrap' }}>
                        <button
                          type="button"
                          onClick={() => setSelectedCohortMonth(cohort.cohortMonth)}
                          style={{
                            font: 'inherit',
                            fontWeight: 600,
                            color: 'var(--green)',
                            background: 'none',
                            border: 'none',
                            padding: 0,
                            cursor: 'pointer',
                          }}
                        >
                          {cohort.cohortMonth}
                        </button>
                      </td>
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
              {t('admin.reports.retention.empty')}
            </div>
          )}
        </Card>

        <Card
          title={t('admin.reports.ltv.title')}
          sub={t('admin.reports.ltv.sub')}
          pad={0}
          loading={showReportsSkeleton}
          skeletonContent={<Skeleton height={240} borderRadius={8} />}
        >
          {cohorts.length > 0 ? (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ ...tableStyle, minWidth: 640 + offsets.length * 90 }}>
                <thead>
                  <tr>
                    <th style={th}>{t('admin.reports.table.columns.cohort')}</th>
                    <th style={th}>{t('admin.reports.table.columns.customers')}</th>
                    {offsets.map((offset) => (
                      <th key={offset} style={{ ...th, textAlign: 'center' }}>
                        {t('admin.reports.monthColumn', { n: offset })}
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
                            {cell ? formatCurrency(cell.value) : '—'}
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
              {t('admin.reports.ltv.empty')}
            </div>
          )}
        </Card>
      </div>

      <ModalOverlay open={!!selectedCohortMonth} onClose={() => setSelectedCohortMonth(null)} zIndex={120}>
        <div style={{ width: '100%', maxWidth: 720, background: 'var(--cream)', borderRadius: 20, padding: 24 }}>
          <h3 style={{ margin: '0 0 4px', fontFamily: '"Instrument Serif", serif', fontSize: 26 }}>
            {t('admin.reports.modal.cohortTitle', { month: selectedCohortMonth })}
          </h3>
          <p style={{ margin: '0 0 16px', fontSize: 13, color: 'var(--ink-60)' }}>
            {t('admin.reports.modal.sub')}
          </p>

          {loadingCohortCustomers ? (
            <Skeleton height={200} borderRadius={8} />
          ) : (
            <div style={{ overflowX: 'auto', maxHeight: 420, overflowY: 'auto' }}>
              <table style={{ ...tableStyle, minWidth: 420 + selectedCohortOffsets.length * 70 }}>
                <thead>
                  <tr>
                    <th style={th}>{t('admin.reports.modal.columns.customer')}</th>
                    <th style={th}>{t('admin.reports.modal.columns.firstPurchase')}</th>
                    {selectedCohortOffsets.map((offset) => (
                      <th key={offset} style={{ ...th, textAlign: 'center' }}>
                        {t('admin.reports.monthColumn', { n: offset })}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(cohortCustomers?.customers ?? []).map((customer) => {
                    const active = new Set(customer.activeOffsets);
                    return (
                      <tr key={customer.customerId} style={trStyle}>
                        <td style={td}>
                          <div style={{ fontWeight: 600 }}>{customer.customerName || customer.customerId}</div>
                          <div style={{ fontSize: 12, color: 'var(--ink-60)' }}>{customer.customerEmail || '—'}</div>
                        </td>
                        <td style={{ ...td, whiteSpace: 'nowrap', fontSize: 12 }}>
                          {formatPanamaDateTime(customer.firstPurchaseDate)}
                        </td>
                        {selectedCohortOffsets.map((offset) => (
                          <td key={offset} style={{ ...td, textAlign: 'center', color: active.has(offset) ? 'var(--green)' : 'var(--ink-30)' }}>
                            {active.has(offset) ? '✓' : '—'}
                          </td>
                        ))}
                      </tr>
                    );
                  })}
                  {!loadingCohortCustomers && !cohortCustomers?.customers.length && (
                    <tr>
                      <td style={{ ...td, textAlign: 'center', color: 'var(--ink-60)' }} colSpan={2 + selectedCohortOffsets.length}>
                        {t('admin.reports.modal.empty')}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </ModalOverlay>
    </>
  );
}
