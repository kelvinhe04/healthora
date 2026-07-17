import { useTranslation } from 'react-i18next';
import { ADMIN_PAGE_SIZE } from '../utils';

export function PaginationControls({
  page,
  totalPages,
  totalItems,
  start,
  end,
  onPageChange,
}: {
  page: number;
  totalPages: number;
  totalItems: number;
  start: number;
  end: number;
  onPageChange: (page: number) => void;
}) {
  const { t } = useTranslation();
  if (totalItems <= ADMIN_PAGE_SIZE) return null;

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "14px 24px",
        borderTop: "1px solid var(--ink-06)",
        fontFamily: '"Geist", sans-serif',
        fontSize: 12,
        color: "var(--ink-60)",
      }}
    >
      <span>
        {t('catalog.showingRange', { from: start, to: end, total: totalItems })}
      </span>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <button
          type="button"
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
          aria-label={t('admin.pagination.previousAria')}
          style={{
            padding: "7px 12px",
            borderRadius: 999,
            border: "1px solid var(--ink-10)",
            background: "transparent",
            color: "var(--ink)",
            cursor: page <= 1 ? "not-allowed" : "pointer",
            opacity: page <= 1 ? 0.42 : 1,
          }}
        >
          {t('catalog.previous')}
        </button>
        <span
          style={{
            fontFamily: '"JetBrains Mono", monospace',
            color: "var(--ink-60)",
          }}
        >
          {page} / {totalPages}
        </span>
        <button
          type="button"
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages}
          aria-label={t('admin.pagination.nextAria')}
          style={{
            padding: "7px 12px",
            borderRadius: 999,
            border: "1px solid var(--ink-10)",
            background: "transparent",
            color: "var(--ink)",
            cursor: page >= totalPages ? "not-allowed" : "pointer",
            opacity: page >= totalPages ? 0.42 : 1,
          }}
        >
          {t('catalog.next')}
        </button>
      </div>
    </div>
  );
}
