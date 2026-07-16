import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Card,
  PageHeader,
  Skeleton,
  tableStyle,
  td,
  th,
  trStyle,
} from '../../../components/admin';
import { useAdminPanelContext } from '../AdminPanelContext';
import { formatPanamaDateTime } from '../../../lib/dates';
import { PaginationControls } from '../components/PaginationControls';
import { ADMIN_PAGE_SIZE } from '../utils';

export function RepurchaseSection() {
  const { t } = useTranslation();
  const {
    showRepurchaseSkeleton,
    repurchaseReminders,
    repurchaseRemindersPage,
    setRepurchaseRemindersPage,
    repurchaseScanMutation,
  } = useAdminPanelContext();
  const [lastScanResult, setLastScanResult] = useState<{ scanned: number; sent: number } | null>(null);

  const items = repurchaseReminders?.items ?? [];
  const total = repurchaseReminders?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / ADMIN_PAGE_SIZE));
  const start = total === 0 ? 0 : (repurchaseRemindersPage - 1) * ADMIN_PAGE_SIZE + 1;
  const end = Math.min(repurchaseRemindersPage * ADMIN_PAGE_SIZE, total);

  return (
    <>
      <PageHeader
        loading={showRepurchaseSkeleton}
        kicker={repurchaseReminders ? t('admin.repurchase.kicker', { count: total }) : undefined}
        title={
          <>
            {t('admin.repurchase.titlePrefix')} <em style={{ color: 'var(--green)' }}>{t('admin.repurchase.titleEmphasis')}</em>
          </>
        }
        sub={t('admin.repurchase.sub')}
        actions={
          <button
            type="button"
            onClick={() => repurchaseScanMutation.mutate(undefined, { onSuccess: setLastScanResult })}
            disabled={repurchaseScanMutation.isPending}
            style={{
              padding: '10px 18px',
              borderRadius: 999,
              border: 'none',
              background: 'var(--green)',
              color: 'var(--lime)',
              fontSize: 13,
              fontWeight: 700,
              cursor: repurchaseScanMutation.isPending ? 'not-allowed' : 'pointer',
              opacity: repurchaseScanMutation.isPending ? 0.6 : 1,
            }}
          >
            {repurchaseScanMutation.isPending ? t('admin.repurchase.scanning') : t('admin.repurchase.scanButton')}
          </button>
        }
      />

      {lastScanResult && (
        <div style={{ marginBottom: 24 }}>
          <Card pad={20}>
            <p style={{ margin: 0, fontSize: 14, color: 'var(--ink-60)' }}>
              {t('admin.repurchase.lastScan.prefix')} {t('admin.repurchase.lastScan.cyclesEvaluated', { count: lastScanResult.scanned })}, {t('admin.repurchase.lastScan.remindersSent', { count: lastScanResult.sent })}.
            </p>
          </Card>
        </div>
      )}

      <Card
        title={t('admin.repurchase.table.title')}
        sub={t('admin.repurchase.table.sub')}
        pad={0}
        loading={showRepurchaseSkeleton}
        skeletonContent={
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <div
                key={i}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 160px 140px 140px',
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
          <table style={{ ...tableStyle, minWidth: 860 }}>
            <thead>
              <tr>
                <th scope="col" style={th}>{t('admin.repurchase.table.columns.product')}</th>
                <th scope="col" style={th}>{t('admin.repurchase.table.columns.customer')}</th>
                <th scope="col" style={th}>{t('admin.repurchase.table.columns.lastPurchase')}</th>
                <th scope="col" style={th}>{t('admin.repurchase.table.columns.estimatedRunOut')}</th>
                <th scope="col" style={th}>{t('admin.repurchase.table.columns.sentAt')}</th>
              </tr>
            </thead>
            <tbody>
              {items.map((entry) => (
                <tr key={entry._id} style={trStyle}>
                  <td style={td}>{entry.productName || entry.productId}</td>
                  <td style={td}>{entry.customerEmail}</td>
                  <td style={{ ...td, fontFamily: '"JetBrains Mono", monospace', fontSize: 12 }}>
                    {formatPanamaDateTime(entry.lastPurchaseDate)}
                  </td>
                  <td style={{ ...td, fontFamily: '"JetBrains Mono", monospace', fontSize: 12 }}>
                    {formatPanamaDateTime(entry.estimatedRunOutDate)} ({entry.reorderCycleDays}d)
                  </td>
                  <td style={{ ...td, fontFamily: '"JetBrains Mono", monospace', fontSize: 12 }}>
                    {formatPanamaDateTime(entry.sentAt)}
                  </td>
                </tr>
              ))}
              {!items.length && (
                <tr>
                  <td style={{ ...td, textAlign: 'center', color: 'var(--ink-60)' }} colSpan={5}>
                    {t('admin.repurchase.table.empty')}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <PaginationControls
          page={repurchaseRemindersPage}
          totalPages={totalPages}
          totalItems={total}
          start={start}
          end={end}
          onPageChange={setRepurchaseRemindersPage}
        />
      </Card>
    </>
  );
}
