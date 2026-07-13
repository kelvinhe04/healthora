import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@clerk/clerk-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Card,
  PageHeader,
  Skeleton,
  SortableTh,
  SortClearChip,
  StatusPill,
  tableStyle,
  td,
  th,
  trStyle,
  type ColumnSort,
} from '../../../components/admin';
import { Icon } from '../../../components/shared/Icon';
import { AnimatedButton } from '../../../components/shared/AnimatedButton';
import { ModalOverlay } from '../../../components/shared/ModalOverlay';
import { PaginationControls } from '../components/PaginationControls';
import { paginateItems } from '../utils';
import { useAdminPanelContext } from '../AdminPanelContext';
import { api } from '../../../lib/api';
import type { OrderReturn, ReturnMethod, ReturnStatus } from '../../../types';
import { formatPanamaDateTime } from '../../../lib/dates';

function ButtonSpinner() {
  return (
    <>
      <span
        style={{
          display: 'inline-block',
          width: 11,
          height: 11,
          borderRadius: '50%',
          border: '2px solid currentColor',
          borderTopColor: 'transparent',
          opacity: 0.85,
          animation: 'admin-btn-spin 0.6s linear infinite',
        }}
      />
      <style>{'@keyframes admin-btn-spin { to { transform: rotate(360deg); } }'}</style>
    </>
  );
}

const STATUS_LABELS: Record<'' | ReturnStatus, string> = {
  '': 'Todas',
  requested: 'Solicitada',
  approved: 'Aprobada',
  in_transit: 'En tránsito',
  in_review: 'En revisión',
  refund_pending: 'Reembolso en proceso',
  refunded: 'Reembolsada',
  // Not "enviado" - resolving to `replaced` only creates the replacement Order (fulfillmentStatus
  // starts at 'unfulfilled'); it still needs to be prepared/shipped/delivered like any other order
  // in Pedidos, linked back via replacesOrderId.
  replaced: 'Reemplazo en camino',
  rejected: 'Rechazada',
};

const STATUS_FILTER_OPTIONS = ['', 'requested', 'approved', 'in_transit', 'in_review', 'refund_pending', 'refunded', 'replaced', 'rejected'] as const;

const RETURN_METHOD_LABELS: Record<OrderReturn['returnMethod'], string> = {
  courier_pickup: 'Mensajería recoge',
  store_dropoff: 'Cliente trae a tienda',
};

const METHOD_FILTER_LABELS: Record<'' | ReturnMethod, string> = {
  '': 'Todos',
  courier_pickup: 'Mensajería recoge',
  store_dropoff: 'Cliente trae a tienda',
};

const METHOD_FILTER_OPTIONS = ['', 'courier_pickup', 'store_dropoff'] as const;

const RESOLUTION_LABELS: Record<OrderReturn['desiredResolution'], string> = {
  refund: 'Prefiere: reembolso',
  replacement: 'Prefiere: reenvío del producto correcto',
};

const REASON_CATEGORY_LABELS: Record<OrderReturn['reasonCategory'], string> = {
  damaged: 'Llegó dañado',
  wrong_item: 'Producto diferente al pedido',
  defective: 'No funciona / defectuoso',
  changed_mind: 'Ya no lo necesita',
  other: 'Otro',
};

// Un retiro en tienda nunca salió por un courier, así que tampoco vuelve por uno: la devolución
// salta "en tránsito" y pasa directo a revisión en cuanto está aprobada.
const NEXT_STATUS: Record<OrderReturn['returnMethod'], Partial<Record<ReturnStatus, { next: ReturnStatus; label: string }>>> = {
  courier_pickup: {
    requested: { next: 'approved', label: 'Aprobar' },
    approved: { next: 'in_transit', label: 'Marcar en tránsito' },
    in_transit: { next: 'in_review', label: 'En revisión' },
  },
  store_dropoff: {
    requested: { next: 'approved', label: 'Aprobar' },
    approved: { next: 'in_review', label: 'En revisión' },
  },
};

// El producto ya volvió y se revisó: el admin ejecuta lo que el cliente ya pidió al solicitar la
// devolución (desiredResolution) - no vuelve a decidir entre reembolso y reemplazo, solo confirma
// que corresponde procesarlo.
const RESOLVABLE_STATUS: ReturnStatus = 'in_review';

type ReturnSortKey = 'amount' | 'date';
const RETURN_SORT_LABEL: Record<ReturnSortKey, string> = { amount: 'Monto', date: 'Fecha' };

// Un retiro en tienda nunca sale por courier, así que el reemplazo tampoco "viene en camino" - el
// cliente lo recoge en la tienda una vez preparado (ver STATUS_LABELS.replaced para el caso courier).
function replacedStatusLabel(returnMethod: ReturnMethod): string {
  return returnMethod === 'store_dropoff' ? 'Reemplazo en tienda' : STATUS_LABELS.replaced;
}

function matchesReturnSearch(ret: OrderReturn, term: string): boolean {
  if (!term) return true;
  return (
    (ret.customerName?.toLowerCase().includes(term) ?? false) ||
    (ret.customerEmail?.toLowerCase().includes(term) ?? false) ||
    ret.orderId.toLowerCase().includes(term)
  );
}

export function ReturnsSection() {
  const { getToken } = useAuth();
  const { setPage: setAdminPage, setOrderSearch } = useAdminPanelContext();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'' | ReturnStatus>('');
  const [methodFilter, setMethodFilter] = useState<'' | ReturnMethod>('');
  const [sort, setSort] = useState<ColumnSort<ReturnSortKey>>({ key: null, dir: 'asc' });
  const [page, setPage] = useState(1);
  const [confirmReject, setConfirmReject] = useState<{ id: string; customerName: string; orderId: string; fromReview: boolean } | null>(null);

  const returnsQuery = useQuery({
    queryKey: ['admin', 'returns'],
    queryFn: async () => {
      const token = await getToken();
      return api.admin.returns.list(token!);
    },
  });

  const updateStatusMut = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: ReturnStatus }) => {
      const token = await getToken();
      return api.admin.returns.updateStatus(id, status, token!);
    },
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({ queryKey: ['admin', 'returns'] });
      // Resolving as `replaced` creates a brand-new no-charge Order (see createReplacementOrder) -
      // without this, Pedidos keeps showing its stale pre-replacement list/count until something
      // else happens to refetch it, so the "PEDIDO DE REEMPLAZO" badge's search comes up empty.
      if (variables.status === 'replaced') {
        void queryClient.invalidateQueries({ queryKey: ['admin-orders'] });
      }
    },
  });

  const returnToCustomerMut = useMutation({
    mutationFn: async (id: string) => {
      const token = await getToken();
      return api.admin.returns.markReturnedToCustomer(id, token!);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin', 'returns'] });
    },
  });

  const items = returnsQuery.data ?? [];
  const isLoading = returnsQuery.isLoading;

  const toggleSort = (key: ReturnSortKey) => {
    setSort((current) => {
      if (current.key !== key) return { key, dir: 'asc' };
      if (current.dir === 'asc') return { key, dir: 'desc' };
      return { key: null, dir: 'asc' };
    });
  };
  const clearSort = () => setSort({ key: null, dir: 'asc' });

  // Reflects only the search term, not the active status/method filter, so each pill shows how
  // many results it would surface if picked - same pattern as Orders' fulfillment/shipping pills.
  const forCounts = useMemo(() => {
    const term = search.toLowerCase();
    return items.filter((r) => matchesReturnSearch(r, term));
  }, [items, search]);

  const statusCounts = useMemo(
    () =>
      Object.fromEntries(
        STATUS_FILTER_OPTIONS.map((s) => [s, s ? forCounts.filter((r) => r.status === s).length : forCounts.length]),
      ) as Record<'' | ReturnStatus, number>,
    [forCounts],
  );

  const methodCounts = useMemo(
    () =>
      Object.fromEntries(
        METHOD_FILTER_OPTIONS.map((m) => [m, m ? forCounts.filter((r) => r.returnMethod === m).length : forCounts.length]),
      ) as Record<'' | ReturnMethod, number>,
    [forCounts],
  );

  const displayedReturns = useMemo(() => {
    const term = search.toLowerCase();
    const filtered = items.filter((r) => {
      if (!matchesReturnSearch(r, term)) return false;
      if (statusFilter && r.status !== statusFilter) return false;
      if (methodFilter && r.returnMethod !== methodFilter) return false;
      return true;
    });
    if (!sort.key) return filtered;
    const sorted = filtered.slice();
    const dirMul = sort.dir === 'asc' ? 1 : -1;
    if (sort.key === 'amount') {
      sorted.sort((a, b) => (a.refundAmount - b.refundAmount) * dirMul || a._id.localeCompare(b._id));
    } else if (sort.key === 'date') {
      sorted.sort((a, b) => {
        const dateA = new Date(a.createdAt).getTime();
        const dateB = new Date(b.createdAt).getTime();
        return (dateA - dateB) * dirMul || a._id.localeCompare(b._id);
      });
    }
    return sorted;
  }, [items, search, statusFilter, methodFilter, sort]);

  useEffect(() => {
    setPage(1);
  }, [search, statusFilter, methodFilter, sort]);

  const paginated = useMemo(() => paginateItems(displayedReturns, page), [displayedReturns, page]);

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
      />

      {!isLoading && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginBottom: 20 }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              background: 'var(--cream)',
              borderRadius: 999,
              padding: '9px 16px',
              border: '1px solid var(--ink-06)',
              flexShrink: 0,
              width: 296,
              boxSizing: 'border-box',
            }}
          >
            <Icon name="search" size={14} stroke="var(--ink-40)" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por cliente, email o pedido…"
              style={{
                border: 'none',
                outline: 'none',
                background: 'transparent',
                fontSize: 13,
                fontFamily: '"Geist", sans-serif',
                width: '100%',
                color: 'var(--ink)',
              }}
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                style={{ border: 'none', background: 'transparent', cursor: 'pointer', padding: '2px 4px', display: 'flex', alignItems: 'center', color: 'var(--ink-40)', borderRadius: 4, flexShrink: 0 }}
              >
                <Icon name="x" size={13} />
              </button>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 10, fontFamily: '"JetBrains Mono", monospace', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--ink-40)', flexShrink: 0, width: 48 }}>
              Estado
            </span>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {STATUS_FILTER_OPTIONS.filter((status) => status === '' || status === statusFilter || (statusCounts[status] ?? 0) > 0).map((status) => (
                <button
                  key={status || 'all'}
                  onClick={() => setStatusFilter(status)}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '7px 14px',
                    borderRadius: 999,
                    fontSize: 12,
                    cursor: 'pointer',
                    border: '1px solid ' + (statusFilter === status ? 'var(--ink)' : 'var(--ink-20)'),
                    background: statusFilter === status ? 'var(--ink)' : 'transparent',
                    color: statusFilter === status ? 'var(--cream)' : 'var(--ink)',
                    fontFamily: '"Geist", sans-serif',
                  }}
                >
                  <span>{STATUS_LABELS[status]}</span>
                  <span style={{ fontSize: 10, fontFamily: '"JetBrains Mono", monospace', opacity: statusFilter === status ? 0.8 : 0.6 }}>
                    {statusCounts[status] ?? 0}
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 10, fontFamily: '"JetBrains Mono", monospace', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--ink-40)', flexShrink: 0, width: 48 }}>
              Método
            </span>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {METHOD_FILTER_OPTIONS.filter((method) => method === '' || method === methodFilter || (methodCounts[method] ?? 0) > 0).map((method) => (
                <button
                  key={method || 'all'}
                  onClick={() => setMethodFilter(method)}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '7px 14px',
                    borderRadius: 999,
                    fontSize: 12,
                    cursor: 'pointer',
                    border: '1px solid ' + (methodFilter === method ? 'var(--green)' : 'var(--ink-20)'),
                    background: methodFilter === method ? 'var(--green)' : 'transparent',
                    color: methodFilter === method ? 'var(--cream)' : 'var(--ink)',
                    fontFamily: '"Geist", sans-serif',
                  }}
                >
                  <span>{METHOD_FILTER_LABELS[method]}</span>
                  <span style={{ fontSize: 10, fontFamily: '"JetBrains Mono", monospace', opacity: methodFilter === method ? 0.8 : 0.6 }}>
                    {methodCounts[method] ?? 0}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      <Card
        title="Solicitudes de devolución"
        sub={
          search || statusFilter || methodFilter
            ? `${displayedReturns.length} resultado${displayedReturns.length !== 1 ? 's' : ''} de ${items.length}`
            : `${items.length} solicitud${items.length !== 1 ? 's' : ''}`
        }
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
        {sort.key && (
          <div style={{ padding: '0 24px 14px', display: 'flex', alignItems: 'center', gap: 10 }}>
            <SortClearChip sort={sort} labels={RETURN_SORT_LABEL} onClear={clearSort} />
          </div>
        )}
        <div style={{ overflowX: 'auto', width: '100%' }}>
          <table style={{ ...tableStyle, minWidth: 1120 }}>
            <thead>
              <tr>
                <th scope="col" style={th}>Cliente</th>
                <th scope="col" style={th}>Motivo / ítems</th>
                <SortableTh label="Monto" sortKey="amount" activeSort={sort} onSort={toggleSort} />
                <th scope="col" style={th}>Método</th>
                <th scope="col" style={th}>Ubicación</th>
                <th scope="col" style={th}>Estado</th>
                <SortableTh label="Fecha" sortKey="date" activeSort={sort} onSort={toggleSort} />
                <th scope="col" style={th}>Acción</th>
              </tr>
            </thead>
            <tbody>
              {paginated.items.map((ret) => {
                const nextAction = NEXT_STATUS[ret.returnMethod]?.[ret.status];
                const canResolve = ret.status === RESOLVABLE_STATUS;
                // Only the row actually being mutated shows the spinner - the shared mutation's
                // isPending alone would light up every row's button at once.
                const pendingStatus = updateStatusMut.isPending && updateStatusMut.variables?.id === ret._id
                  ? updateStatusMut.variables.status
                  : null;
                return (
                  <tr key={ret._id} style={trStyle}>
                    <td style={td}>
                      <div style={{ fontWeight: 500 }}>{ret.customerName || 'Cliente'}</div>
                      <div style={{ fontSize: 11, color: 'var(--ink-60)' }}>{ret.customerEmail}</div>
                    </td>
                    <td style={{ ...td, maxWidth: 320 }}>
                      <div style={{ fontSize: 11, color: 'var(--ink)', fontWeight: 500 }}>
                        {REASON_CATEGORY_LABELS[ret.reasonCategory]}
                      </div>
                      <div style={{ color: 'var(--ink-60)', fontSize: 12, whiteSpace: 'normal', margin: '2px 0 4px' }}>{ret.reason}</div>
                      <div style={{ fontSize: 11, color: 'var(--ink-40)' }}>
                        {ret.items.map((item) => `${item.productName} ×${item.qty}`).join(', ')}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--ink)', fontWeight: 500, marginTop: 4 }}>
                        {RESOLUTION_LABELS[ret.desiredResolution]}
                      </div>
                      {ret.photos?.length > 0 && (
                        <div style={{ display: 'flex', gap: 4, marginTop: 6, flexWrap: 'wrap' }}>
                          {ret.photos.map((url, idx) => (
                            <a key={idx} href={url} target="_blank" rel="noreferrer" title={`Ver foto ${idx + 1} de evidencia`}>
                              <img
                                src={url}
                                alt={`Evidencia ${idx + 1} de ${ret.customerName || 'cliente'}`}
                                style={{ width: 40, height: 40, borderRadius: 8, objectFit: 'cover', border: '1px solid var(--ink-12)' }}
                              />
                            </a>
                          ))}
                        </div>
                      )}
                      {ret.status === 'replaced' && ret.replacementOrderId && (
                        <button
                          type="button"
                          onClick={() => {
                            setOrderSearch(ret.replacementOrderId!);
                            setAdminPage('orders');
                          }}
                          style={{ display: 'inline-block', marginTop: 6, fontSize: 10, fontFamily: '"JetBrains Mono", monospace', letterSpacing: '0.04em', color: 'var(--green)', background: 'color-mix(in oklab, var(--green) 10%, white)', border: '1px solid color-mix(in oklab, var(--green) 25%, white)', borderRadius: 999, padding: '2px 8px', cursor: 'pointer' }}
                          title="Ver ese pedido en Pedidos - todavía necesita prepararse y enviarse."
                        >
                          PEDIDO DE REEMPLAZO #{ret.replacementOrderId.slice(-8).toUpperCase()}
                        </button>
                      )}
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
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 4 }}>
                        <StatusPill status={ret.status === 'replaced' ? replacedStatusLabel(ret.returnMethod) : STATUS_LABELS[ret.status]} />
                        {ret.status === 'rejected' && ret.rejectedAfterReview && (
                          <span
                            style={{ fontSize: 10, fontFamily: '"JetBrains Mono", monospace', letterSpacing: '0.04em', color: 'var(--coral)' }}
                            title="El producto ya había vuelto físicamente y no coincidía con lo reportado en la solicitud."
                          >
                            No coincide con lo reportado
                          </span>
                        )}
                        {ret.status === 'rejected' && ret.rejectedAfterReview && ret.returnedToCustomerAt && (
                          <span style={{ fontSize: 10, fontFamily: '"JetBrains Mono", monospace', letterSpacing: '0.04em', color: 'var(--green)' }}>
                            {ret.returnMethod === 'store_dropoff' ? 'Listo para recoger' : 'Devuelto'} el {formatPanamaDateTime(ret.returnedToCustomerAt)}
                          </span>
                        )}
                      </div>
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
                            style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'oklch(0.28 0.055 155)', border: 'none', borderRadius: 8, padding: '6px 10px', cursor: 'pointer', color: 'var(--lime)', fontSize: 12 }}
                          >
                            {pendingStatus === nextAction.next && <ButtonSpinner />}
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
                            style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'oklch(0.28 0.055 155)', border: 'none', borderRadius: 8, padding: '6px 10px', cursor: 'pointer', color: 'var(--lime)', fontSize: 12 }}
                          >
                            {(pendingStatus === 'refunded' || pendingStatus === 'replaced') && <ButtonSpinner />}
                            {ret.desiredResolution === 'replacement'
                              ? (ret.returnMethod === 'store_dropoff' ? 'Preparar producto correcto' : 'Reenviar producto correcto')
                              : 'Reembolsar'}
                          </button>
                        )}
                        {(ret.status === 'requested' || ret.status === 'in_review') && (
                          <button
                            type="button"
                            onClick={() => setConfirmReject({ id: ret._id, customerName: ret.customerName || 'Cliente', orderId: ret.orderId, fromReview: ret.status === 'in_review' })}
                            disabled={updateStatusMut.isPending}
                            style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'transparent', border: '1px solid var(--ink-12)', borderRadius: 8, padding: '6px 10px', cursor: 'pointer', color: 'var(--coral)', fontSize: 12 }}
                          >
                            {pendingStatus === 'rejected' && <ButtonSpinner />}
                            Rechazar
                          </button>
                        )}
                        {ret.status === 'rejected' && ret.rejectedAfterReview && !ret.returnedToCustomerAt && (
                          // El producto quedó en la tienda tras el rechazo por revisión - esto solo
                          // registra que ya se coordinó devolverlo (mensajero de vuelta o que el
                          // cliente lo recoja), la logística en sí sigue siendo manual.
                          <button
                            type="button"
                            onClick={() => returnToCustomerMut.mutate(ret._id)}
                            disabled={returnToCustomerMut.isPending}
                            style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'transparent', border: '1px solid var(--ink-12)', borderRadius: 8, padding: '6px 10px', cursor: 'pointer', color: 'var(--ink-60)', fontSize: 12 }}
                          >
                            {returnToCustomerMut.isPending && returnToCustomerMut.variables === ret._id && <ButtonSpinner />}
                            {ret.returnMethod === 'store_dropoff' ? 'Marcar listo para recoger' : 'Marcar enviado de vuelta'}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {!paginated.items.length && (
                <tr>
                  <td style={{ ...td, textAlign: 'center', color: 'var(--ink-60)' }} colSpan={8}>
                    Sin solicitudes para este filtro.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <PaginationControls
          page={paginated.page}
          totalPages={paginated.totalPages}
          totalItems={displayedReturns.length}
          start={paginated.start}
          end={paginated.end}
          onPageChange={setPage}
        />
      </Card>

      <ModalOverlay open={!!confirmReject} onClose={() => setConfirmReject(null)} zIndex={113} overlayColor="rgba(17, 24, 20, 0.28)">
        <div
          style={{
            width: '100%',
            maxWidth: 460,
            background: 'var(--cream)',
            border: '1px solid var(--ink-06)',
            borderRadius: 24,
            boxShadow: '0 28px 80px -36px rgba(0,0,0,0.32)',
            overflow: 'hidden',
          }}
        >
          <div style={{ padding: '22px 24px 18px', borderBottom: '1px solid var(--ink-06)' }}>
            <div style={{ fontSize: 10, fontFamily: '"JetBrains Mono", monospace', textTransform: 'uppercase', letterSpacing: '0.12em', color: 'var(--ink-60)', marginBottom: 8 }}>
              Confirmar rechazo
            </div>
            <div style={{ fontFamily: '"Instrument Serif", serif', fontSize: 32, lineHeight: 1, letterSpacing: '-0.03em', color: 'var(--ink)' }}>
              Rechazar <em style={{ color: 'var(--coral)' }}>devolución</em>
            </div>
            <p style={{ margin: '12px 0 0', fontSize: 14, lineHeight: 1.55, color: 'var(--ink-80)', fontFamily: '"Geist", sans-serif' }}>
              {confirmReject?.fromReview ? (
                <>
                  Vas a rechazar la devolución de <strong>{confirmReject?.customerName}</strong> para el pedido #{confirmReject?.orderId.slice(-8).toUpperCase()} porque el producto recibido no coincide con lo reportado. El cliente recibirá un email y una notificación - esta acción no se puede deshacer. Recuerda coordinar aparte la devolución del producto físico al cliente.
                </>
              ) : (
                <>
                  Vas a rechazar la solicitud de devolución de <strong>{confirmReject?.customerName}</strong> para el pedido #{confirmReject?.orderId.slice(-8).toUpperCase()}. El cliente recibirá un email y una notificación - esta acción no se puede deshacer.
                </>
              )}
            </p>
          </div>
          <div style={{ padding: 24, display: 'flex', gap: 10, justifyContent: 'flex-end', background: 'var(--cream-2)' }}>
            <AnimatedButton variant="outline" onClick={() => setConfirmReject(null)} disabled={updateStatusMut.isPending} text="Cancelar" />
            <AnimatedButton
              variant="primary"
              onClick={() => {
                if (!confirmReject) return;
                updateStatusMut.mutate(
                  { id: confirmReject.id, status: 'rejected' },
                  { onSuccess: () => setConfirmReject(null) },
                );
              }}
              disabled={updateStatusMut.isPending}
              text={updateStatusMut.isPending ? 'Rechazando...' : 'Sí, rechazar'}
            />
          </div>
        </div>
      </ModalOverlay>
    </>
  );
}
