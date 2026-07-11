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
import type { OrderReturn, ReturnStatus } from '../../../types';
import { formatPanamaDateTime } from '../../../lib/dates';

const STATUS_LABELS: Record<'' | ReturnStatus, string> = {
  '': 'Todas',
  requested: 'Solicitada',
  approved: 'Aprobada',
  in_transit: 'En tránsito',
  in_review: 'En revisión',
  refund_pending: 'Reembolso en proceso',
  refunded: 'Reembolsada',
  replaced: 'Reemplazo enviado',
  rejected: 'Rechazada',
};

const RETURN_METHOD_LABELS: Record<OrderReturn['returnMethod'], string> = {
  courier_pickup: 'Mensajería recoge',
  store_dropoff: 'Cliente trae a tienda',
};

const RESOLUTION_LABELS: Record<OrderReturn['desiredResolution'], string> = {
  refund: 'Prefiere: reembolso',
  replacement: 'Prefiere: reenvío del producto correcto',
};

// Un retiro en tienda nunca salió por un courier, así que tampoco vuelve por uno: la devolución
// salta "en tránsito" y pasa directo a revisión en cuanto está aprobada.
const NEXT_STATUS: Record<OrderReturn['returnMethod'], Partial<Record<ReturnStatus, { next: ReturnStatus; label: string }>>> = {
  courier_pickup: {
    requested: { next: 'approved', label: 'Aprobar' },
    approved: { next: 'in_transit', label: 'Marcar en tránsito' },
    in_transit: { next: 'in_review', label: 'Producto recibido, en revisión' },
  },
  store_dropoff: {
    requested: { next: 'approved', label: 'Aprobar' },
    approved: { next: 'in_review', label: 'Producto recibido, en revisión' },
  },
};

// El producto ya volvió y se revisó: el admin ejecuta lo que el cliente ya pidió al solicitar la
// devolución (desiredResolution) - no vuelve a decidir entre reembolso y reemplazo, solo confirma
// que corresponde procesarlo.
const RESOLVABLE_STATUS: ReturnStatus = 'in_review';

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
        sub="Aprueba, marca en tránsito, confirma la revisión y procesa lo que el cliente pidió (reembolso vía Stripe o reenvío del producto correcto)."
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
            {(['', 'requested', 'approved', 'in_transit', 'in_review', 'refund_pending', 'refunded', 'replaced', 'rejected'] as const).map((value) => (
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
              <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 100px 130px 160px 120px 120px 160px', gap: 16, padding: '16px 24px', borderBottom: '1px solid var(--ink-06)' }}>
                <Skeleton height={18} borderRadius={4} />
                <Skeleton height={18} borderRadius={4} />
                <Skeleton height={18} borderRadius={4} />
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
          <table style={{ ...tableStyle, minWidth: 1120 }}>
            <thead>
              <tr>
                <th scope="col" style={th}>Cliente</th>
                <th scope="col" style={th}>Motivo / ítems</th>
                <th scope="col" style={th}>Monto</th>
                <th scope="col" style={th}>Método</th>
                <th scope="col" style={th}>Ubicación</th>
                <th scope="col" style={th}>Estado</th>
                <th scope="col" style={th}>Fecha</th>
                <th scope="col" style={th}>Acción</th>
              </tr>
            </thead>
            <tbody>
              {items.map((ret) => {
                const nextAction = NEXT_STATUS[ret.returnMethod]?.[ret.status];
                const canResolve = ret.status === RESOLVABLE_STATUS;
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
                      <div style={{ fontSize: 11, color: 'var(--ink)', fontWeight: 500, marginTop: 4 }}>
                        {RESOLUTION_LABELS[ret.desiredResolution]}
                      </div>
                    </td>
                    <td style={td}>${ret.refundAmount.toFixed(2)}</td>
                    <td style={{ ...td, fontSize: 12, color: 'var(--ink-60)' }}>{RETURN_METHOD_LABELS[ret.returnMethod]}</td>
                    <td style={{ ...td, fontSize: 12, color: 'var(--ink-60)', maxWidth: 220 }}>
                      {ret.pickupAddress ? (
                        <>
                          <div>{ret.pickupAddress.name} · {ret.pickupAddress.phone}</div>
                          <div style={{ color: 'var(--ink-40)' }}>
                            {ret.pickupAddress.address}, {ret.pickupAddress.city} · {ret.pickupAddress.postal}
                          </div>
                        </>
                      ) : '—'}
                    </td>
                    <td style={td}>
                      <StatusPill status={STATUS_LABELS[ret.status]} />
                    </td>
                    <td style={{ ...td, fontFamily: '"JetBrains Mono", monospace', fontSize: 12 }}>
                      {formatPanamaDateTime(ret.createdAt)}
                    </td>
                    <td style={td}>
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6 }}>
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
                        {canResolve && (
                          // El cliente ya eligió qué quiere al pedir la devolución - este botón
                          // solo ejecuta esa decisión (confirmación de que el producto ya se
                          // revisó), no es al admin volviendo a elegir entre dos opciones.
                          <button
                            type="button"
                            onClick={() => updateStatusMut.mutate({ id: ret._id, status: ret.desiredResolution === 'replacement' ? 'replaced' : 'refunded' })}
                            disabled={updateStatusMut.isPending}
                            style={{ background: 'oklch(0.28 0.055 155)', border: 'none', borderRadius: 8, padding: '6px 10px', cursor: 'pointer', color: 'var(--lime)', fontSize: 12 }}
                          >
                            {ret.desiredResolution === 'replacement' ? 'Reenviar producto correcto' : 'Reembolsar'}
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
                  <td style={{ ...td, textAlign: 'center', color: 'var(--ink-60)' }} colSpan={8}>
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
