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
import { formatPanamaDateTime } from '../../../lib/dates';
import { PaginationControls } from '../components/PaginationControls';
import { emailJobStatusLabels, emailJobTypeLabels } from '../types';
import type { EmailJobStatus, EmailJobType } from '../../../types';

const inputStyle = {
  border: '1px solid var(--ink-10)',
  borderRadius: 999,
  background: 'var(--cream)',
  color: 'var(--ink)',
  padding: '10px 14px',
  fontSize: 13,
};

export function JobsSection() {
  const {
    showJobsSkeleton,
    jobStatusFilter,
    setJobStatusFilter,
    jobTypeFilter,
    setJobTypeFilter,
    jobsPage,
    setJobsPage,
    jobs,
    jobsSummary,
    retryJobMutation,
  } = useAdminPanelContext();

  const items = jobs?.items ?? [];
  const total = jobs?.total ?? 0;
  const limit = jobs?.limit ?? 10;
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const start = total === 0 ? 0 : (jobsPage - 1) * limit + 1;
  const end = Math.min(jobsPage * limit, total);
  const byStatus = jobsSummary?.byStatus;

  return (
    <>
      <PageHeader
        loading={showJobsSkeleton}
        kicker="Cola en segundo plano"
        title={
          <>
            Trabajos de <em style={{ color: 'var(--green)' }}>email</em>
          </>
        }
        sub="Envíos de correo procesados de forma asíncrona, con reintento automático y backoff (HU-079)."
        actions={
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <select
              value={jobStatusFilter}
              onChange={(e) => setJobStatusFilter(e.target.value as '' | EmailJobStatus)}
              aria-label="Filtrar por estado"
              style={inputStyle}
            >
              <option value="">Todos los estados</option>
              {(Object.entries(emailJobStatusLabels) as [EmailJobStatus, string][]).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
            <select
              value={jobTypeFilter}
              onChange={(e) => setJobTypeFilter(e.target.value as '' | EmailJobType)}
              aria-label="Filtrar por tipo"
              style={inputStyle}
            >
              <option value="">Todos los tipos</option>
              {(Object.entries(emailJobTypeLabels) as [EmailJobType, string][]).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>
        }
      />

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: 16,
          marginBottom: 24,
        }}
      >
        <KpiCard mode="dark" label="Pendientes" value={byStatus?.pending ?? '—'} loading={showJobsSkeleton} animKey="jobs_pending" />
        <KpiCard label="Procesando" value={byStatus?.processing ?? '—'} loading={showJobsSkeleton} animKey="jobs_processing" />
        <KpiCard label="Completados" value={byStatus?.completed ?? '—'} loading={showJobsSkeleton} animKey="jobs_completed" />
        <KpiCard label="Fallidos" value={byStatus?.failed ?? '—'} loading={showJobsSkeleton} animKey="jobs_failed" />
      </div>

      <Card
        title="Trabajos encolados"
        sub="Cada intento fallido reprograma el siguiente con backoff exponencial hasta agotar el máximo de reintentos"
        pad={0}
        loading={showJobsSkeleton}
        skeletonContent={
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <div
                key={i}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '160px 140px 100px 1fr 160px',
                  gap: 16,
                  padding: '16px 24px',
                  borderBottom: '1px solid var(--ink-06)',
                }}
              >
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
          <table style={{ ...tableStyle, minWidth: 900 }}>
            <thead>
              <tr>
                <th scope="col" style={th}>Tipo</th>
                <th scope="col" style={th}>Estado</th>
                <th scope="col" style={th}>Intentos</th>
                <th scope="col" style={th}>Último error</th>
                <th scope="col" style={th}>Próximo intento</th>
                <th scope="col" style={th}></th>
              </tr>
            </thead>
            <tbody>
              {items.map((job) => (
                <tr key={job._id} style={trStyle}>
                  <td style={td}>{emailJobTypeLabels[job.type]}</td>
                  <td style={td}>
                    <StatusPill status={emailJobStatusLabels[job.status]} />
                  </td>
                  <td style={td}>{job.attempts} / {job.maxAttempts}</td>
                  <td style={{ ...td, maxWidth: 320, color: 'var(--ink-60)', fontSize: 12 }}>
                    {job.lastError || '—'}
                  </td>
                  <td style={{ ...td, fontFamily: '"JetBrains Mono", monospace', fontSize: 12 }}>
                    {job.status === 'completed' && job.completedAt
                      ? formatPanamaDateTime(job.completedAt)
                      : formatPanamaDateTime(job.nextAttemptAt)}
                  </td>
                  <td style={td}>
                    {job.status === 'failed' && (
                      <button
                        type="button"
                        onClick={() => retryJobMutation.mutate(job._id)}
                        disabled={retryJobMutation.isPending}
                        style={{
                          padding: '6px 14px',
                          borderRadius: 999,
                          border: '1px solid var(--ink-10)',
                          background: 'transparent',
                          color: 'var(--ink)',
                          fontSize: 12,
                          fontWeight: 600,
                          cursor: retryJobMutation.isPending ? 'not-allowed' : 'pointer',
                        }}
                      >
                        Reintentar
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {!items.length && (
                <tr>
                  <td style={{ ...td, textAlign: 'center', color: 'var(--ink-60)' }} colSpan={6}>
                    Sin trabajos para estos filtros.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <PaginationControls
          page={jobsPage}
          totalPages={totalPages}
          totalItems={total}
          start={start}
          end={end}
          onPageChange={setJobsPage}
        />
      </Card>
    </>
  );
}
