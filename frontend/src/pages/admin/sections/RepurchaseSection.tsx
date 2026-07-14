import { useState } from 'react';
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
        kicker={repurchaseReminders ? `${total} recordatorio${total !== 1 ? 's' : ''} enviados` : undefined}
        title={
          <>
            Recordatorios de <em style={{ color: 'var(--green)' }}>recompra</em>
          </>
        }
        sub="Correos sin costo enviados antes de que se le acabe a un cliente un producto ya comprado (HU-102)."
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
            {repurchaseScanMutation.isPending ? 'Escaneando…' : 'Ejecutar ahora'}
          </button>
        }
      />

      {lastScanResult && (
        <div style={{ marginBottom: 24 }}>
          <Card pad={20}>
            <p style={{ margin: 0, fontSize: 14, color: 'var(--ink-60)' }}>
              Último escaneo manual: {lastScanResult.scanned} ciclo{lastScanResult.scanned !== 1 ? 's' : ''} de compra evaluados, {lastScanResult.sent} recordatorio{lastScanResult.sent !== 1 ? 's' : ''} nuevo{lastScanResult.sent !== 1 ? 's' : ''} enviado{lastScanResult.sent !== 1 ? 's' : ''}.
            </p>
          </Card>
        </div>
      )}

      <Card
        title="Enviados"
        sub="Un cliente y producto solo aparece una vez por ciclo de compra (no se repite hasta que vuelva a comprar)"
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
                <th scope="col" style={th}>Producto</th>
                <th scope="col" style={th}>Cliente</th>
                <th scope="col" style={th}>Última compra</th>
                <th scope="col" style={th}>Estimado de agotamiento</th>
                <th scope="col" style={th}>Enviado</th>
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
                    Sin recordatorios enviados todavía.
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
