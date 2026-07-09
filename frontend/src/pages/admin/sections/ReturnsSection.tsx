import { useState } from 'react';
import { useAuth } from '@clerk/clerk-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
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
import type { ReturnStatus } from '../../../types';
import { formatPanamaDateTime } from '../../../lib/dates';

const STATUS_LABELS: Record<'' | ReturnStatus, string> = {
  '': 'Todas',
  requested: 'Solicitada',
  approved: 'Aprobada',
  in_transit: 'En tránsito',
  refunded: 'Reembolsada',
  rejected: 'Rechazada',
};

const NEXT_STATUS: Partial<Record<ReturnStatus, { next: ReturnStatus; label: string }>> = {
  requested: { next: 'approved', label: 'Aprobar' },
  approved: { next: 'in_transit', label: 'Marcar en tránsito' },
  in_transit: { next: 'refunded', label: 'Reembolsar' },
};

export function ReturnsSection() {
  const { getToken } = useAuth();
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<'' | ReturnStatus>('');

  const returnsQuery = useQuery({
    queryKey: ['admin', 'returns', statusFilter],
    queryFn: async () => {
      const token = await getToken();
      return api.admin.returns.list(token!, statusFilter || undefined);
    },
  });

  const updateStatusMut = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: ReturnStatus }) => {
      const token = await getToken();
      return api.admin.returns.updateStatus(id, status, token!);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin', 'returns'] });
    },
  });

  const items = returnsQuery.data ?? [];
  const isLoading = returnsQuery.isLoading;

  return (
    <>
      <PageHeader
        loading={isLoading}
        kicker="Devoluciones y reembolsos"
        title={
          <>
            Devoluciones de <em style={{ color: 'var(--green)' }}>clientes</em>
          </>
        }
        sub="Aprueba, marca en tránsito y procesa el reembolso vía Stripe cuando el producto vuelva."
        actions={
          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value as '' | ReturnStatus)}
            aria-label="Filtrar devoluciones por estado"
            style={{
              border: '1px solid var(--ink-10)',
              borderRadius: 999,
              background: 'var(--cream)',
              color: 'var(--ink)',
              padding: '10px 14px',
              fontSize: 13,
            }}
          >
            {(['', 'requested', 'approved', 'in_transit', 'refunded', 'rejected'] as const).map((value) => (
              <option key={value} value={value}>{STATUS_LABELS[value]}</option>
            ))}
          </select>
        }
      />

      <Card
        title="Solicitudes de devolución"
        sub={`${items.length} solicitud(es)${statusFilter ? ` · ${STATUS_LABELS[statusFilter]}` : ''}`}
        pad={0}
        loading={isLoading}
        skeletonContent={
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {[0, 1, 2, 3].map((i) => (
              <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 120px 120px 160px', gap: 16, padding: '16px 24px', borderBottom: '1px solid var(--ink-06)' }}>
                <Skeleton height={18} borderRadius={4} />
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
          <table style={{ ...tableStyle, minWidth: 960 }}>
            <thead>
              <tr>
                <th scope="col" style={th}>Cliente</th>
                <th scope="col" style={th}>Motivo / ítems</th>
                <th scope="col" style={th}>Monto</th>
                <th scope="col" style={th}>Estado</th>
                <th scope="col" style={th}>Fecha</th>
                <th scope="col" style={th}>Acción</th>
              </tr>
            </thead>
            <tbody>
              {items.map((ret) => {
                const nextAction = NEXT_STATUS[ret.status];
                return (
                  <tr key={ret._id} style={trStyle}>
                    <td style={td}>
                      <div style={{ fontWeight: 500 }}>{ret.customerName || 'Cliente'}</div>
                      <div style={{ fontSize: 11, color: 'var(--ink-60)' }}>{ret.customerEmail}</div>
                    </td>
                    <td style={{ ...td, maxWidth: 320 }}>
                      <div style={{ color: 'var(--ink-60)', fontSize: 12, whiteSpace: 'normal', marginBottom: 4 }}>{ret.reason}</div>
                      <div style={{ fontSize: 11, color: 'var(--ink-40)' }}>
                        {ret.items.map((item) => `${item.productName} ×${item.qty}`).join(', ')}
                      </div>
                    </td>
                    <td style={td}>${ret.refundAmount.toFixed(2)}</td>
                    <td style={td}>
                      <StatusPill status={ret.status} />
                    </td>
                    <td style={{ ...td, fontFamily: '"JetBrains Mono", monospace', fontSize: 12 }}>
                      {formatPanamaDateTime(ret.createdAt)}
                    </td>
                    <td style={td}>
                      <div style={{ display: 'flex', gap: 6 }}>
                        {nextAction && (
                          <button
                            type="button"
                            onClick={() => updateStatusMut.mutate({ id: ret._id, status: nextAction.next })}
                            disabled={updateStatusMut.isPending}
                            style={{ background: 'oklch(0.28 0.055 155)', border: 'none', borderRadius: 8, padding: '6px 10px', cursor: 'pointer', color: 'var(--lime)', fontSize: 12 }}
                          >
                            {nextAction.label}
                          </button>
                        )}
                        {ret.status === 'requested' && (
                          <button
                            type="button"
                            onClick={() => updateStatusMut.mutate({ id: ret._id, status: 'rejected' })}
                            disabled={updateStatusMut.isPending}
                            style={{ background: 'transparent', border: '1px solid var(--ink-12)', borderRadius: 8, padding: '6px 10px', cursor: 'pointer', color: 'var(--coral)', fontSize: 12 }}
                          >
                            Rechazar
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {!items.length && (
                <tr>
                  <td style={{ ...td, textAlign: 'center', color: 'var(--ink-60)' }} colSpan={6}>
                    Sin solicitudes para este filtro.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  );
}
