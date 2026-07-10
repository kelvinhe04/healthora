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
} from '../../../components/admin';
import { Icon } from '../../../components/shared/Icon';
import { Stars } from '../../../components/shared/Stars';
import { api } from '../../../lib/api';
import type { ReviewStatus } from '../../../types';
import { formatPanamaDateTime } from '../../../lib/dates';
import { PaginationControls } from '../components/PaginationControls';

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

export function ReviewsSection() {
  const { getToken } = useAuth();
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<'' | ReviewStatus>('');
  const [ratingFilter, setRatingFilter] = useState(0);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

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

  const items = reviewsQuery.data?.items ?? [];
  const isLoading = reviewsQuery.isLoading;

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
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <div style={{ position: 'relative' }}>
              <Icon name="search" size={13} stroke="var(--ink-40)" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
              <input
                type="text"
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
                placeholder="Producto, texto o autor..."
                aria-label="Buscar reseñas por producto, texto o autor"
                style={{
                  border: '1px solid var(--ink-10)',
                  borderRadius: 999,
                  background: 'var(--cream)',
                  color: 'var(--ink)',
                  padding: '10px 14px 10px 32px',
                  fontSize: 13,
                  width: 220,
                }}
              />
            </div>
            <select
              value={ratingFilter}
              onChange={(event) => {
                setRatingFilter(Number(event.target.value));
                setPage(1);
              }}
              aria-label="Filtrar reseñas por cantidad de estrellas"
              style={{
                border: '1px solid var(--ink-10)',
                borderRadius: 999,
                background: 'var(--cream)',
                color: 'var(--ink)',
                padding: '10px 14px',
                fontSize: 13,
              }}
            >
              {RATING_OPTIONS.map((value) => (
                <option key={value} value={value}>{value === 0 ? 'Todas las estrellas' : `${value} estrella${value === 1 ? '' : 's'}`}</option>
              ))}
            </select>
            <select
              value={statusFilter}
              onChange={(event) => {
                setStatusFilter(event.target.value as '' | ReviewStatus);
                setPage(1);
              }}
              aria-label="Filtrar reseñas por estado"
              style={{
                border: '1px solid var(--ink-10)',
                borderRadius: 999,
                background: 'var(--cream)',
                color: 'var(--ink)',
                padding: '10px 14px',
                fontSize: 13,
              }}
            >
              {FILTERABLE_STATUSES.map((value) => (
                <option key={value} value={value}>{STATUS_LABELS[value]}</option>
              ))}
            </select>
          </div>
        }
      />

      <Card
        title="Reseñas"
        sub={`${reviewsQuery.data?.total ?? 0} reseña(s)${statusFilter ? ` · ${STATUS_LABELS[statusFilter]}` : ''}`}
        pad={0}
        loading={isLoading}
        skeletonContent={
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {[0, 1, 2, 3, 4].map((i) => (
              <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 200px 120px 160px', gap: 16, padding: '16px 24px', borderBottom: '1px solid var(--ink-06)' }}>
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
                    <StatusPill status={review.status || 'published'} />
                  </td>
                  <td style={{ ...td, fontFamily: '"JetBrains Mono", monospace', fontSize: 12 }}>
                    {formatPanamaDateTime(review.createdAt)}
                  </td>
                  <td style={td}>
                    <div style={{ display: 'flex', gap: 6 }}>
                      {review.status !== 'published' && (
                        <button
                          type="button"
                          title="Aprobar / publicar"
                          onClick={() => updateStatusMut.mutate({ id: review._id, status: 'published' })}
                          disabled={updateStatusMut.isPending}
                          style={{ background: 'transparent', border: '1px solid var(--ink-12)', borderRadius: 8, padding: 6, cursor: 'pointer', color: 'var(--green)' }}
                        >
                          <Icon name="check" size={14} />
                        </button>
                      )}
                      {review.status !== 'hidden' && (
                        <button
                          type="button"
                          title="Ocultar"
                          onClick={() => updateStatusMut.mutate({ id: review._id, status: 'hidden' })}
                          disabled={updateStatusMut.isPending}
                          style={{ background: 'transparent', border: '1px solid var(--ink-12)', borderRadius: 8, padding: 6, cursor: 'pointer', color: 'var(--ink-60)' }}
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
                          style={{ background: 'transparent', border: '1px solid var(--ink-12)', borderRadius: 8, padding: 6, cursor: 'pointer', color: 'var(--coral)' }}
                        >
                          <Icon name="trash" size={14} />
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
          totalPages={Math.max(1, Math.ceil((reviewsQuery.data?.total ?? 0) / (reviewsQuery.data?.limit ?? 20)))}
          totalItems={reviewsQuery.data?.total ?? 0}
          start={reviewsQuery.data ? (reviewsQuery.data.page - 1) * reviewsQuery.data.limit + (items.length ? 1 : 0) : 0}
          end={reviewsQuery.data ? (reviewsQuery.data.page - 1) * reviewsQuery.data.limit + items.length : 0}
          onPageChange={setPage}
        />
      </Card>
    </>
  );
}
