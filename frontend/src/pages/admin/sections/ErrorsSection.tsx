import {
  Card,
  KpiCard,
  PageHeader,
  Skeleton,
  StatusPill,
  tableStyle,
  td,
  th,
  trStyle,
} from '../../../components/admin';
import { useAdminPanelContext } from '../AdminPanelContext';

export function ErrorsSection() {
  const {
    showErrorsSkeleton,
    errorSourceFilter,
    setErrorSourceFilter,
    errorReports,
  } = useAdminPanelContext();

  return (
    <>
      <PageHeader
        loading={showErrorsSkeleton}
        kicker="Error tracking"
        title={
          <>
            Errores <em style={{ color: 'var(--green)' }}>recientes</em>
          </>
        }
        sub="Excepciones capturadas por PostHog y guardadas para revisión operativa."
        actions={
          <select
            value={errorSourceFilter}
            onChange={(event) =>
              setErrorSourceFilter(event.target.value as '' | 'backend' | 'frontend')
            }
            aria-label="Filtrar errores por origen"
            style={{
              border: '1px solid var(--ink-10)',
              borderRadius: 999,
              background: 'var(--cream)',
              color: 'var(--ink)',
              padding: '10px 14px',
              fontSize: 13,
            }}
          >
            <option value="">Todos</option>
            <option value="backend">Backend</option>
            <option value="frontend">Frontend</option>
          </select>
        }
      />

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 16,
          marginBottom: 24,
        }}
      >
        <KpiCard
          mode="dark"
          label="Errores"
          value={errorReports?.total ?? '—'}
          loading={showErrorsSkeleton}
          animKey="errors_total"
        />
        <KpiCard
          label="Backend"
          value={errorReports?.items.filter((item) => item.source === 'backend').length ?? '—'}
          loading={showErrorsSkeleton}
          animKey="errors_backend"
        />
        <KpiCard
          label="Frontend"
          value={errorReports?.items.filter((item) => item.source === 'frontend').length ?? '—'}
          loading={showErrorsSkeleton}
          animKey="errors_frontend"
        />
      </div>

      <Card
        title="Excepciones capturadas"
        sub="Últimos eventos con ruta, usuario y stack disponible"
        pad={0}
        loading={showErrorsSkeleton}
        skeletonContent={
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <div
                key={i}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '120px 1fr 160px',
                  gap: 16,
                  padding: '16px 24px',
                  borderBottom: '1px solid var(--ink-06)',
                }}
              >
                <Skeleton height={18} borderRadius={4} />
                <Skeleton height={18} borderRadius={4} />
                <Skeleton height={18} borderRadius={4} />
              </div>
            ))}
          </div>
        }
      >
        <div style={{ overflowX: 'auto', width: '100%' }}>
          <table style={{ ...tableStyle, minWidth: 840 }}>
            <thead>
              <tr>
                <th scope="col" style={th}>Origen</th>
                <th scope="col" style={th}>Error</th>
                <th scope="col" style={th}>Ruta</th>
                <th scope="col" style={th}>Usuario</th>
                <th scope="col" style={th}>Fecha</th>
              </tr>
            </thead>
            <tbody>
              {(errorReports?.items || []).map((item) => (
                <tr key={item._id} style={trStyle}>
                  <td style={td}>
                    <StatusPill status={item.source === 'backend' ? 'processing' : 'paid'} />
                  </td>
                  <td style={{ ...td, maxWidth: 320 }}>
                    <div style={{ fontWeight: 600 }}>{item.name || 'Error'}</div>
                    <div
                      style={{
                        color: 'var(--ink-60)',
                        fontSize: 12,
                        marginTop: 4,
                        whiteSpace: 'normal',
                      }}
                    >
                      {item.message}
                    </div>
                  </td>
                  <td style={{ ...td, fontFamily: '"JetBrains Mono", monospace', fontSize: 12 }}>
                    {item.method ? `${item.method} ` : ''}
                    {item.route || '—'}
                  </td>
                  <td style={td}>{item.userEmail || item.userId || '—'}</td>
                  <td style={{ ...td, fontFamily: '"JetBrains Mono", monospace', fontSize: 12 }}>
                    {new Date(item.createdAt).toLocaleString()}
                  </td>
                </tr>
              ))}
              {!errorReports?.items.length && (
                <tr>
                  <td style={{ ...td, textAlign: 'center', color: 'var(--ink-60)' }} colSpan={5}>
                    Sin errores registrados.
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
