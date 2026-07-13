import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
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

/** Traduce el nombre tecnico de la accion (guardado en ingles/dot-notation en Mongo, ej.
 * "products.update") a una etiqueta legible en español para la tabla y el filtro. El valor crudo
 * sigue siendo lo que viaja al backend (comparacion exacta en `listAuditLogs`) - el <select> del
 * filtro mapea la etiqueta en español de vuelta al valor crudo por su `value`. */
const ACTION_LABELS: Record<string, string> = {
  'admin.access': 'Acceso al panel',
  'admin.access_denied': 'Acceso denegado',
  'auth.login': 'Inicio de sesión',
  'user.role_changed': 'Rol de usuario cambiado',
  'products.create': 'Producto creado',
  'products.update': 'Producto actualizado',
  'products.delete': 'Producto eliminado',
  'categories.create': 'Categoría creada',
  'categories.update': 'Categoría actualizada',
  'categories.delete': 'Categoría eliminada',
  'orders.create': 'Pedido creado',
  'orders.update': 'Pedido actualizado',
  'orders.delete': 'Pedido eliminado',
  'reviews.create': 'Reseña creada / autor baneado',
  'reviews.update': 'Reseña moderada',
  'reviews.delete': 'Reseña eliminada / baneo quitado',
  'returns.create': 'Devolución creada',
  'returns.update': 'Devolución actualizada',
  'returns.delete': 'Devolución eliminada',
  'uploads.create': 'Imagen subida',
  'uploads.update': 'Imagen actualizada',
  'uploads.delete': 'Imagen eliminada',
};

function translateAction(action: string): string {
  return ACTION_LABELS[action] ?? action;
}

export function AuditLogsSection() {
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
        kicker={data ? `${total} registro${total !== 1 ? 's' : ''}` : undefined}
        title={
          <>
            Auditoría de <em style={{ color: 'var(--green)' }}>administradores</em>
          </>
        }
        sub="Registro append-only de acciones administrativas: quién, qué y cuándo (HU-051)."
        actions={
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <input
              value={actorEmailInput}
              onChange={(e) => setActorEmailInput(e.target.value)}
              placeholder="Buscar por email de admin…"
              aria-label="Filtrar por email del actor"
              style={{ ...inputStyle, width: 220 }}
            />
            <select
              value={action}
              onChange={(e) => { setAction(e.target.value); setPage(1); }}
              aria-label="Filtrar por acción"
              style={{ ...inputStyle, width: 200 }}
            >
              <option value="">Todas las acciones</option>
              {Object.entries(ACTION_LABELS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
            <input
              type="date"
              value={from}
              onChange={(e) => { setFrom(e.target.value); setPage(1); }}
              aria-label="Desde"
              style={inputStyle}
            />
            <input
              type="date"
              value={to}
              onChange={(e) => { setTo(e.target.value); setPage(1); }}
              aria-label="Hasta"
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
                <th scope="col" style={th}>Fecha</th>
                <th scope="col" style={th}>Actor</th>
                <th scope="col" style={th}>Acción</th>
                <th scope="col" style={th}>Recurso</th>
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
                    Sin registros para estos filtros.
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
