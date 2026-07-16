import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import {
  Card,
  PageHeader,
  Skeleton,
  StatusPill,
  tableStyle,
  td,
  th,
  trStyle,
} from '../../../components/admin';
import { api } from '../../../lib/api';
import { Select } from '../../../components/shared/Select';
import { useAdminToken } from '../hooks/useAdminToken';
import { formatPanamaDateTime } from '../../../lib/dates';
import { PaginationControls } from '../components/PaginationControls';
import { ADMIN_PAGE_SIZE } from '../utils';

const inputStyle = {
  border: '1px solid var(--ink-10)',
  borderRadius: 999,
  background: 'var(--cream)',
  color: 'var(--ink)',
  padding: '10px 14px',
  fontSize: 13,
};

/** Maps the technical action name (stored in English/dot-notation in Mongo, e.g.
 * "products.update") to an i18n key suffix under `admin.auditLogs.actionLabels` (HU-084). The raw
 * value is still what travels to the backend (exact match in `listAuditLogs`) - the filter
 * <select> maps back to the raw value via its `value`, independent of the displayed label's
 * language. */
const ACTION_LABEL_KEYS: Record<string, string> = {
  'admin.access': 'adminAccess',
  'admin.access_denied': 'adminAccessDenied',
  'auth.login': 'authLogin',
  'user.role_changed': 'userRoleChanged',
  'products.create': 'productsCreate',
  'products.update': 'productsUpdate',
  'products.delete': 'productsDelete',
  'categories.create': 'categoriesCreate',
  'categories.update': 'categoriesUpdate',
  'categories.delete': 'categoriesDelete',
  'orders.create': 'ordersCreate',
  'orders.update': 'ordersUpdate',
  'orders.delete': 'ordersDelete',
  'reviews.create': 'reviewsCreate',
  'reviews.update': 'reviewsUpdate',
  'reviews.delete': 'reviewsDelete',
  'returns.create': 'returnsCreate',
  'returns.update': 'returnsUpdate',
  'returns.delete': 'returnsDelete',
  'uploads.create': 'uploadsCreate',
  'uploads.update': 'uploadsUpdate',
  'uploads.delete': 'uploadsDelete',
};

export function AuditLogsSection() {
  const { t } = useTranslation();
  const translateAction = (action: string): string => {
    const key = ACTION_LABEL_KEYS[action];
    return key ? t(`admin.auditLogs.actionLabels.${key}`) : action;
  };
  const getAdminToken = useAdminToken();
  const [action, setAction] = useState('');
  const [actorEmailInput, setActorEmailInput] = useState('');
  const [actorEmail, setActorEmail] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [page, setPage] = useState(1);

  useEffect(() => {
    const timeout = setTimeout(() => {
      setActorEmail(actorEmailInput.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(timeout);
  }, [actorEmailInput]);

  const { data, isLoading } = useQuery({
    queryKey: ['admin-audit-logs', action, actorEmail, from, to, page],
    queryFn: async () =>
      api.admin.auditLogs(await getAdminToken(), {
        action: action || undefined,
        actorEmail: actorEmail || undefined,
        from: from || undefined,
        to: to || undefined,
        page,
        limit: ADMIN_PAGE_SIZE,
      }),
  });

  const items = data?.items ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / ADMIN_PAGE_SIZE));
  const start = total === 0 ? 0 : (page - 1) * ADMIN_PAGE_SIZE + 1;
  const end = Math.min(page * ADMIN_PAGE_SIZE, total);

  return (
    <>
      <PageHeader
        loading={isLoading && !data}
        kicker={data ? t('admin.auditLogs.kicker', { count: total }) : undefined}
        title={
          <>
            {t('admin.auditLogs.titlePrefix')} <em style={{ color: 'var(--green)' }}>{t('admin.auditLogs.titleEmphasis')}</em>
          </>
        }
        sub={t('admin.auditLogs.sub')}
        actions={
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <input
              value={actorEmailInput}
              onChange={(e) => setActorEmailInput(e.target.value)}
              placeholder={t('admin.auditLogs.filters.searchPlaceholder')}
              aria-label={t('admin.auditLogs.filters.actorEmailAria')}
              style={{ ...inputStyle, width: 220 }}
            />
            <Select
              value={action}
              onChange={(e) => { setAction(e.target.value); setPage(1); }}
              aria-label={t('admin.auditLogs.filters.actionAria')}
              wrapperStyle={{ width: 200 }}
            >
              <option value="">{t('admin.auditLogs.filters.allActions')}</option>
              {Object.entries(ACTION_LABEL_KEYS).map(([value, key]) => (
                <option key={value} value={value}>{t(`admin.auditLogs.actionLabels.${key}`)}</option>
              ))}
            </Select>
            <input
              type="date"
              value={from}
              onChange={(e) => { setFrom(e.target.value); setPage(1); }}
              aria-label={t('admin.auditLogs.filters.fromAria')}
              style={inputStyle}
            />
            <input
              type="date"
              value={to}
              onChange={(e) => { setTo(e.target.value); setPage(1); }}
              aria-label={t('admin.auditLogs.filters.toAria')}
              style={inputStyle}
            />
          </div>
        }
      />

      <Card
        pad={0}
        loading={isLoading && !data}
        skeletonContent={
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <div
                key={i}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '150px 200px 160px 1fr',
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
                <th scope="col" style={th}>{t('admin.auditLogs.table.columns.date')}</th>
                <th scope="col" style={th}>{t('admin.auditLogs.table.columns.actor')}</th>
                <th scope="col" style={th}>{t('admin.auditLogs.table.columns.action')}</th>
                <th scope="col" style={th}>{t('admin.auditLogs.table.columns.resource')}</th>
              </tr>
            </thead>
            <tbody>
              {items.map((entry) => (
                <tr key={entry._id} style={trStyle}>
                  <td style={{ ...td, fontFamily: '"JetBrains Mono", monospace', fontSize: 12, whiteSpace: 'nowrap' }}>
                    {formatPanamaDateTime(entry.createdAt)}
                  </td>
                  <td style={td}>{entry.actorEmail || entry.actorClerkId || '—'}</td>
                  <td style={td}>
                    <StatusPill status={translateAction(entry.action)} />
                  </td>
                  <td style={{ ...td, fontFamily: '"JetBrains Mono", monospace', fontSize: 12 }}>
                    {entry.resource || '—'}
                  </td>
                </tr>
              ))}
              {!isLoading && items.length === 0 && (
                <tr>
                  <td style={{ ...td, textAlign: 'center', color: 'var(--ink-60)' }} colSpan={4}>
                    {t('admin.auditLogs.table.empty')}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <PaginationControls
          page={page}
          totalPages={totalPages}
          totalItems={total}
          start={start}
          end={end}
          onPageChange={setPage}
        />
      </Card>
    </>
  );
}
