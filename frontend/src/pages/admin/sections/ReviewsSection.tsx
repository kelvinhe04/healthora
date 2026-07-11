import { useEffect, useState } from 'react';
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
  useOnceLoading,
} from '../../../components/admin';
import { Icon } from '../../../components/shared/Icon';
import { ModalOverlay } from '../../../components/shared/ModalOverlay';
import { Stars } from '../../../components/shared/Stars';
import { api } from '../../../lib/api';
import type { ReviewStatus } from '../../../types';
import { formatPanamaDateTime } from '../../../lib/dates';
import { PaginationControls } from '../components/PaginationControls';

function BansModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { getToken } = useAuth();
  const queryClient = useQueryClient();

  const bansQuery = useQuery({
    queryKey: ['admin', 'reviews', 'bans'],
    queryFn: async () => {
      const token = await getToken();
      return api.admin.reviews.listBans(token!);
    },
    enabled: open,
  });

  const unbanMut = useMutation({
    mutationFn: async (id: string) => {
      const token = await getToken();
      return api.admin.reviews.unban(id, token!);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin', 'reviews', 'bans'] });
    },
  });

  const bans = bansQuery.data ?? [];

  return (
    <ModalOverlay open={open} onClose={onClose}>
      <div style={{ width: '100%', maxWidth: 520, maxHeight: '80vh', overflowY: 'auto', background: 'var(--cream)', border: '1px solid var(--ink-06)', borderRadius: 20, padding: 24 }}>
        <h3 style={{ fontFamily: '"Instrument Serif", serif', fontSize: 24, margin: '0 0 6px' }}>Usuarios baneados</h3>
        <p style={{ fontSize: 13, color: 'var(--ink-60)', margin: '0 0 16px' }}>
          No pueden dejar nuevas reseñas en el producto indicado. El baneo es por producto, no afecta al resto del catálogo.
        </p>
        {bansQuery.isLoading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[0, 1, 2].map((i) => <Skeleton key={i} height={44} borderRadius={10} />)}
          </div>
        ) : bans.length === 0 ? (
          <div style={{ fontSize: 13, color: 'var(--ink-60)', padding: '12px 0' }}>Ningún usuario baneado por ahora.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {bans.map((ban) => (
              <div key={ban._id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '10px 12px', border: '1px solid var(--ink-06)', borderRadius: 10 }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 13 }}>{ban.userName}</div>
                  <div style={{ fontSize: 12, color: 'var(--ink-60)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ban.productName}</div>
                </div>
                <button
                  type="button"
                  onClick={() => unbanMut.mutate(ban._id)}
                  disabled={unbanMut.isPending}
                  style={{ flexShrink: 0, padding: '7px 12px', borderRadius: 8, background: 'transparent', border: '1px solid var(--ink-12)', color: 'var(--ink)', cursor: 'pointer', fontSize: 12, fontFamily: '"Geist", sans-serif' }}
                >
                  Quitar baneo
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </ModalOverlay>
  );
}

// 'pending' existe en el schema pero ningún flujo lo asigna hoy (las reseñas nacen 'published' -
// post-moderación, no pre-aprobación) - se omite del filtro para no mostrar una opción sin datos.
const STATUS_LABELS: Record<'' | ReviewStatus, string> = {
  '': 'Todos',
  pending: 'Pendiente',
  published: 'Publicada',
  hidden: 'Oculta',
};

const FILTERABLE_STATUSES = ['', 'published', 'hidden'] as const;
const RATING_OPTIONS = [0, 5, 4, 3, 2, 1] as const;

function pillButtonStyle(active: boolean) {
  return {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    padding: '7px 14px',
    borderRadius: 999,
    fontSize: 12,
    cursor: 'pointer' as const,
    border: '1px solid ' + (active ? 'var(--ink)' : 'var(--ink-20)'),
    background: active ? 'var(--ink)' : 'transparent',
    color: active ? 'var(--cream)' : 'var(--ink)',
    fontFamily: '"Geist", sans-serif',
  };
}

export function ReviewsSection() {
  const { getToken } = useAuth();
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<'' | ReviewStatus>('');
  const [ratingFilter, setRatingFilter] = useState(0);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [confirmBanId, setConfirmBanId] = useState<string | null>(null);
  const [bansModalOpen, setBansModalOpen] = useState(false);

  // Debounced: evita un request por cada tecla mientras se escribe.
  useEffect(() => {
    const timeout = setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(timeout);
  }, [searchInput]);

  const reviewsQuery = useQuery({
    queryKey: ['admin', 'reviews', statusFilter, ratingFilter, search, page],
    queryFn: async () => {
      const token = await getToken();
      return api.admin.reviews.list(token!, {
        status: statusFilter || undefined,
        rating: ratingFilter || undefined,
        search: search || undefined,
        page,
      });
    },
  });

  const updateStatusMut = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: ReviewStatus }) => {
      const token = await getToken();
      return api.admin.reviews.updateStatus(id, status, token!);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin', 'reviews'] });
    },
  });

  const deleteMut = useMutation({
    mutationFn: async (id: string) => {
      const token = await getToken();
      return api.admin.reviews.remove(id, token!);
    },
    onSuccess: () => {
      setConfirmDeleteId(null);
      void queryClient.invalidateQueries({ queryKey: ['admin', 'reviews'] });
    },
  });

  const banMut = useMutation({
    mutationFn: async (id: string) => {
      const token = await getToken();
      return api.admin.reviews.ban(id, token!);
    },
    onSuccess: () => {
      setConfirmBanId(null);
      void queryClient.invalidateQueries({ queryKey: ['admin', 'reviews'] });
    },
  });

  const items = reviewsQuery.data?.items ?? [];
  const isLoading = useOnceLoading('section_reviews', reviewsQuery.isLoading);
  const total = reviewsQuery.data?.total ?? 0;

  return (
    <>
      <PageHeader
        loading={isLoading}
        kicker="Moderación"
        title={
          <>
            Reseñas de <em style={{ color: 'var(--green)' }}>clientes</em>
          </>
        }
        sub="Aprueba, oculta o elimina reseñas para mantener contenido apropiado y confiable en las fichas de producto."
        actions={
          isLoading ? (
            <Skeleton height={40} width={168} borderRadius={999} />
          ) : (
            <button
              type="button"
              onClick={() => setBansModalOpen(true)}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '10px 16px', borderRadius: 999, background: 'transparent', border: '1px solid var(--ink-12)', color: 'var(--ink)', cursor: 'pointer', fontSize: 13, fontFamily: '"Geist", sans-serif' }}
            >
              <Icon name="ban" size={14} />
              Usuarios baneados
            </button>
          )
        }
      />
      <BansModal open={bansModalOpen} onClose={() => setBansModalOpen(false)} />

      {isLoading ? (
        <div style={{ display: 'flex', gap: 12, marginBottom: 20, alignItems: 'center' }}>
          <Skeleton height={36} width={296} borderRadius={999} />
          {[110, 90, 80, 70, 60].map((w, i) => (
            <Skeleton key={i} height={32} width={w} borderRadius={999} />
          ))}
        </div>
      ) : (
        <div style={{ display: 'flex', gap: 12, marginBottom: 20, alignItems: 'center', flexWrap: 'wrap' }}>
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
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder="Producto, texto o autor..."
              aria-label="Buscar reseñas por producto, texto o autor"
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
            {searchInput && (
              <button
                onClick={() => setSearchInput('')}
                aria-label="Limpiar búsqueda"
                style={{
                  border: 'none',
                  background: 'transparent',
                  cursor: 'pointer',
                  padding: '2px 4px',
                  display: 'flex',
                  alignItems: 'center',
                  color: 'var(--ink-40)',
                  borderRadius: 4,
                  flexShrink: 0,
                }}
              >
                <Icon name="x" size={13} />
              </button>
            )}
          </div>

          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }} role="group" aria-label="Filtrar por estrellas">
            {RATING_OPTIONS.map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => {
                  setRatingFilter(value);
                  setPage(1);
                }}
                style={pillButtonStyle(ratingFilter === value)}
              >
                {value === 0 ? 'Todas' : `${value}★`}
              </button>
            ))}
          </div>

          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }} role="group" aria-label="Filtrar por estado">
            {FILTERABLE_STATUSES.map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => {
                  setStatusFilter(value);
                  setPage(1);
                }}
                style={pillButtonStyle(statusFilter === value)}
              >
                {STATUS_LABELS[value]}
              </button>
            ))}
          </div>
        </div>
      )}

      <Card
        pad={0}
        loading={isLoading}
        skeletonContent={
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '14px 24px', borderBottom: '1px solid var(--ink-06)', display: 'flex', alignItems: 'center' }}>
              <Skeleton height={12} width={110} borderRadius={4} />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '12px 24px', borderBottom: '1px solid var(--ink-06)' }}>
              <div style={{ flex: 1.6 }}><Skeleton height={9} width={54} borderRadius={3} /></div>
              <div style={{ flex: 1 }}><Skeleton height={9} width={62} borderRadius={3} /></div>
              <div style={{ flexShrink: 0, width: 90 }}><Skeleton height={9} width={48} borderRadius={3} /></div>
              <div style={{ flexShrink: 0, width: 110 }}><Skeleton height={9} width={38} borderRadius={3} /></div>
              <div style={{ flexShrink: 0, width: 80 }}><Skeleton height={9} width={58} borderRadius={3} /></div>
            </div>
            {[0, 1, 2, 3, 4].map((i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '14px 24px', borderBottom: '1px solid var(--ink-06)' }}>
                <div style={{ flex: 1.6, display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <Skeleton height={12} width="40%" borderRadius={4} />
                  <Skeleton height={11} width="80%" borderRadius={4} />
                </div>
                <div style={{ flex: 1 }}><Skeleton height={12} width="65%" borderRadius={4} /></div>
                <div style={{ flexShrink: 0, width: 90 }}><Skeleton height={18} width={70} borderRadius={999} /></div>
                <div style={{ flexShrink: 0, width: 110 }}><Skeleton height={11} width={95} borderRadius={4} /></div>
                <div style={{ flexShrink: 0, width: 80 }}><Skeleton height={24} width={72} borderRadius={8} /></div>
              </div>
            ))}
          </div>
        }
      >
        <div style={{ padding: '16px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--ink-06)' }}>
          <div style={{ fontSize: 12, fontFamily: '"Geist", sans-serif', color: 'var(--ink-60)' }}>
            {search || ratingFilter || statusFilter
              ? `${total} resultado${total !== 1 ? 's' : ''}`
              : `${total} reseña${total !== 1 ? 's' : ''}`}
          </div>
        </div>
        <div style={{ overflowX: 'auto', width: '100%' }}>
          <table style={{ ...tableStyle, minWidth: 960 }}>
            <thead>
              <tr>
                <th scope="col" style={th}>Reseña</th>
                <th scope="col" style={th}>Producto</th>
                <th scope="col" style={th}>Estado</th>
                <th scope="col" style={th}>Fecha</th>
                <th scope="col" style={th}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {items.map((review) => (
                <tr key={review._id} style={trStyle}>
                  <td style={{ ...td, maxWidth: 340 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      <Stars value={review.rating} />
                      <span style={{ fontWeight: 600 }}>{review.userName}</span>
                    </div>
                    {review.title && <div style={{ fontWeight: 500, marginBottom: 2 }}>{review.title}</div>}
                    <div style={{ color: 'var(--ink-60)', fontSize: 12, whiteSpace: 'normal' }}>{review.body}</div>
                  </td>
                  <td style={td}>{review.productName}</td>
                  <td style={td}>
                    <StatusPill status={STATUS_LABELS[review.status || 'published']} />
                  </td>
                  <td style={{ ...td, fontFamily: '"JetBrains Mono", monospace', fontSize: 12 }}>
                    {formatPanamaDateTime(review.createdAt)}
                  </td>
                  <td style={td}>
                    <div style={{ display: 'flex', gap: 6 }}>
                      {(review.status || 'published') !== 'published' && (
                        <button
                          type="button"
                          title="Aprobar / publicar"
                          onClick={() => updateStatusMut.mutate({ id: review._id, status: 'published' })}
                          disabled={updateStatusMut.isPending}
                          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'transparent', border: '1px solid var(--ink-12)', borderRadius: 8, padding: 6, cursor: 'pointer', color: 'var(--green)' }}
                        >
                          <Icon name="check" size={14} />
                        </button>
                      )}
                      {(review.status || 'published') !== 'hidden' && (
                        <button
                          type="button"
                          title="Ocultar"
                          onClick={() => updateStatusMut.mutate({ id: review._id, status: 'hidden' })}
                          disabled={updateStatusMut.isPending}
                          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'transparent', border: '1px solid var(--ink-12)', borderRadius: 8, padding: 6, cursor: 'pointer', color: 'var(--ink-60)' }}
                        >
                          <Icon name="x" size={14} />
                        </button>
                      )}
                      {confirmDeleteId === review._id ? (
                        <>
                          <button
                            type="button"
                            onClick={() => deleteMut.mutate(review._id)}
                            disabled={deleteMut.isPending}
                            style={{ background: 'var(--coral)', border: 'none', borderRadius: 8, padding: '6px 10px', cursor: 'pointer', color: 'white', fontSize: 12 }}
                          >
                            Confirmar
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteId(null)}
                            style={{ background: 'transparent', border: '1px solid var(--ink-12)', borderRadius: 8, padding: '6px 10px', cursor: 'pointer', color: 'var(--ink-60)', fontSize: 12 }}
                          >
                            Cancelar
                          </button>
                        </>
                      ) : (
                        <button
                          type="button"
                          title="Eliminar"
                          onClick={() => setConfirmDeleteId(review._id)}
                          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'transparent', border: '1px solid var(--ink-12)', borderRadius: 8, padding: 6, cursor: 'pointer', color: 'var(--coral)' }}
                        >
                          <Icon name="trash" size={14} />
                        </button>
                      )}
                      {confirmBanId === review._id ? (
                        <>
                          <button
                            type="button"
                            onClick={() => banMut.mutate(review._id)}
                            disabled={banMut.isPending}
                            style={{ background: 'var(--coral)', border: 'none', borderRadius: 8, padding: '6px 10px', cursor: 'pointer', color: 'white', fontSize: 12 }}
                          >
                            Banear
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmBanId(null)}
                            style={{ background: 'transparent', border: '1px solid var(--ink-12)', borderRadius: 8, padding: '6px 10px', cursor: 'pointer', color: 'var(--ink-60)', fontSize: 12 }}
                          >
                            Cancelar
                          </button>
                        </>
                      ) : (
                        <button
                          type="button"
                          title="Banear autor de este producto (elimina la reseña y evita que vuelva a comentar aquí)"
                          onClick={() => setConfirmBanId(review._id)}
                          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'transparent', border: '1px solid var(--ink-12)', borderRadius: 8, padding: 6, cursor: 'pointer', color: 'var(--coral)' }}
                        >
                          <Icon name="ban" size={14} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {!items.length && (
                <tr>
                  <td style={{ ...td, textAlign: 'center', color: 'var(--ink-60)' }} colSpan={5}>
                    Sin reseñas para este filtro.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <PaginationControls
          page={reviewsQuery.data?.page ?? page}
          totalPages={Math.max(1, Math.ceil(total / (reviewsQuery.data?.limit ?? 20)))}
          totalItems={total}
          start={reviewsQuery.data ? (reviewsQuery.data.page - 1) * reviewsQuery.data.limit + (items.length ? 1 : 0) : 0}
          end={reviewsQuery.data ? (reviewsQuery.data.page - 1) * reviewsQuery.data.limit + items.length : 0}
          onPageChange={setPage}
        />
      </Card>
    </>
  );
}
