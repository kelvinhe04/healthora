import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import {
  Card,
  PageHeader,
  tableStyle,
  td,
  th,
  trStyle,
} from '../../../components/admin';
import { AnimatedButton } from '../../../components/shared/AnimatedButton';
import { ModalOverlay } from '../../../components/shared/ModalOverlay';
import { Checkbox } from '../../../components/shared/Checkbox';
import { Select } from '../../../components/shared/Select';
import { ColorPicker } from '../../../components/shared/ColorPicker';
import { api } from '../../../lib/api';
import type { Category } from '../../../types';
import { useAdminToken } from '../hooks/useAdminToken';

type CategoryForm = {
  id: string;
  label: string;
  sub: string;
  color: string;
  active: boolean;
  reassignTo: string;
};

const CATEGORY_COLOR_PRESETS = [
  { labelKey: 'amber', value: 'oklch(0.92 0.04 75)' },
  { labelKey: 'blue', value: 'oklch(0.92 0.02 200)' },
  { labelKey: 'green', value: 'oklch(0.9 0.04 140)' },
  { labelKey: 'coral', value: 'oklch(0.93 0.03 45)' },
  { labelKey: 'lime', value: 'oklch(0.9 0.05 115)' },
  { labelKey: 'pink', value: 'oklch(0.9 0.04 25)' },
];

const emptyForm = (): CategoryForm => ({
  id: '',
  label: '',
  sub: '',
  color: CATEGORY_COLOR_PRESETS[0].value,
  active: true,
  reassignTo: '',
});

export function CategoriesSection() {
  const { t } = useTranslation();
  const getAdminToken = useAdminToken();
  const queryClient = useQueryClient();
  const [modal, setModal] = useState<'create' | 'edit' | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<CategoryForm>(emptyForm);
  const [error, setError] = useState('');

  const { data: categories = [], isLoading } = useQuery({
    queryKey: ['admin-categories'],
    queryFn: async () => api.admin.categories.list(await getAdminToken()),
  });

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ['admin-categories'] });
    void queryClient.invalidateQueries({ queryKey: ['categories'] });
    void queryClient.invalidateQueries({ queryKey: ['admin-products'] });
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      const token = await getAdminToken();
      const id = form.id.trim();
      if (modal === 'create') {
        return api.admin.categories.create(
          {
            id,
            label: form.label.trim(),
            sub: form.sub.trim() || undefined,
            color: form.color.trim() || undefined,
            active: form.active,
          },
          token,
        );
      }
      if (!editingId) throw new Error(t('admin.categories.noCategorySelectedError'));
      return api.admin.categories.update(
        editingId,
        {
          label: form.label.trim(),
          sub: form.sub.trim() || undefined,
          color: form.color.trim() || undefined,
          active: form.active,
          newId: id && id !== editingId ? id : undefined,
        },
        token,
      );
    },
    onSuccess: () => {
      invalidate();
      setModal(null);
      setEditingId(null);
      setForm(emptyForm());
      setError('');
    },
    onError: (e: Error) => setError(e.message),
  });

  const reassignMutation = useMutation({
    mutationFn: async ({ fromId, toCategoryId }: { fromId: string; toCategoryId: string }) => {
      const token = await getAdminToken();
      return api.admin.categories.reassignProducts(fromId, toCategoryId, token);
    },
    onSuccess: () => invalidate(),
    onError: (e: Error) => setError(e.message),
  });

  const sorted = useMemo(
    () => [...categories].sort((a, b) => a.label.localeCompare(b.label, 'es')),
    [categories],
  );

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm());
    setError('');
    setModal('create');
  };

  const openEdit = (cat: Category) => {
    setEditingId(cat.id);
    setForm({
      id: cat.id,
      label: cat.label,
      sub: cat.sub || '',
      color: cat.color || CATEGORY_COLOR_PRESETS[0].value,
      active: cat.active !== false,
      reassignTo: '',
    });
    setError('');
    setModal('edit');
  };

  return (
    <>
      <PageHeader
        loading={isLoading}
        kicker={isLoading ? undefined : t('admin.categories.kicker', { count: sorted.length })}
        title={
          <>
            {t('admin.categories.titlePrefix')} <em style={{ color: 'var(--green)' }}>{t('admin.categories.titleEmphasis')}</em>
          </>
        }
        sub={t('admin.categories.sub')}
        actions={
          <AnimatedButton variant="primary" onClick={openCreate} text={t('admin.categories.newButton')} />
        }
      />

      <Card>
        <div style={{ overflowX: 'auto' }}>
          <table style={tableStyle}>
            <thead>
              <tr>
                <th style={th}>{t('admin.categories.table.columns.category')}</th>
                <th style={th}>{t('admin.categories.table.columns.id')}</th>
                <th style={th}>{t('admin.categories.table.columns.products')}</th>
                <th style={th}>{t('admin.categories.table.columns.status')}</th>
                <th style={th}>{t('admin.categories.table.columns.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((cat) => (
                <tr key={cat.id} style={trStyle}>
                  <td style={td}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span
                        style={{
                          width: 14,
                          height: 14,
                          borderRadius: 999,
                          background: cat.color || 'var(--green)',
                          border: '1px solid var(--ink-06)',
                          flexShrink: 0,
                        }}
                      />
                      <div>
                        <div style={{ fontWeight: 600 }}>{cat.label}</div>
                        {cat.sub ? (
                          <div style={{ fontSize: 12, color: 'var(--ink-60)' }}>{cat.sub}</div>
                        ) : null}
                      </div>
                    </div>
                  </td>
                  <td style={{ ...td, fontFamily: '"JetBrains Mono", monospace', fontSize: 12 }}>
                    {cat.id}
                  </td>
                  <td style={td}>{cat.productCount ?? 0}</td>
                  <td style={td}>
                    <span
                      style={{
                        fontSize: 11,
                        padding: '4px 10px',
                        borderRadius: 999,
                        background: cat.active === false ? 'var(--ink-06)' : 'color-mix(in oklch, var(--green) 12%, transparent)',
                        color: cat.active === false ? 'var(--ink-60)' : 'var(--green)',
                      }}
                    >
                      {cat.active === false ? t('admin.categories.table.statusInactive') : t('admin.categories.table.statusActive')}
                    </span>
                  </td>
                  <td style={td}>
                    <button
                      type="button"
                      onClick={() => openEdit(cat)}
                      style={{
                        border: '1px solid var(--ink-06)',
                        background: 'var(--cream)',
                        borderRadius: 999,
                        padding: '6px 12px',
                        cursor: 'pointer',
                        fontSize: 12,
                      }}
                    >
                      {t('admin.categories.table.editButton')}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <ModalOverlay open={modal !== null} onClose={() => setModal(null)} zIndex={120}>
        <div
          style={{
            width: '100%',
            maxWidth: 520,
            background: 'var(--cream)',
            borderRadius: 24,
            border: '1px solid var(--ink-06)',
            padding: 24,
          }}
        >
          <h2 style={{ margin: '0 0 16px', fontFamily: '"Instrument Serif", serif', fontSize: 28 }}>
            {modal === 'create' ? t('admin.categories.modal.createTitle') : t('admin.categories.modal.editTitle')}
          </h2>

          <label style={{ display: 'block', marginBottom: 12 }}>
            <span style={{ fontSize: 12, color: 'var(--ink-60)' }}>{t('admin.categories.modal.idLabel')}</span>
            <input
              value={form.id}
              onChange={(e) => setForm((f) => ({ ...f, id: e.target.value }))}
              placeholder={t('admin.categories.modal.idPlaceholder')}
              style={{ width: '100%', marginTop: 6, padding: '10px 12px', borderRadius: 12, border: '1px solid var(--ink-06)', boxSizing: 'border-box' }}
            />
            {modal === 'edit' ? (
              <span style={{ fontSize: 11, color: 'var(--ink-60)', display: 'block', marginTop: 4 }}>
                {t('admin.categories.modal.idEditHint')}
              </span>
            ) : null}
          </label>

          <label style={{ display: 'block', marginBottom: 12 }}>
            <span style={{ fontSize: 12, color: 'var(--ink-60)' }}>{t('admin.categories.modal.labelLabel')}</span>
            <input
              value={form.label}
              onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))}
              style={{ width: '100%', marginTop: 6, padding: '10px 12px', borderRadius: 12, border: '1px solid var(--ink-06)', boxSizing: 'border-box' }}
            />
          </label>

          <label style={{ display: 'block', marginBottom: 12 }}>
            <span style={{ fontSize: 12, color: 'var(--ink-60)' }}>{t('admin.categories.modal.subLabel')}</span>
            <input
              value={form.sub}
              onChange={(e) => setForm((f) => ({ ...f, sub: e.target.value }))}
              style={{ width: '100%', marginTop: 6, padding: '10px 12px', borderRadius: 12, border: '1px solid var(--ink-06)', boxSizing: 'border-box' }}
            />
          </label>

          <div style={{ marginBottom: 12 }}>
            <ColorPicker
              value={form.color}
              onChange={(v) => setForm((f) => ({ ...f, color: v }))}
              label={t('admin.categories.modal.colorLabel')}
              presets={CATEGORY_COLOR_PRESETS.map((preset) => ({
                label: t(`admin.categories.colorPresets.${preset.labelKey}`),
                value: preset.value,
              }))}
            />
          </div>

          <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <Checkbox
              checked={form.active}
              onChange={(e) => setForm((f) => ({ ...f, active: e.target.checked }))}
            />
            <span style={{ fontSize: 13 }}>{t('admin.categories.modal.activeCheckboxLabel')}</span>
          </label>

          {modal === 'edit' ? (
            <div style={{ marginTop: 8, paddingTop: 12, borderTop: '1px solid var(--ink-06)' }}>
              <div style={{ fontSize: 12, color: 'var(--ink-60)', marginBottom: 8 }}>
                {t('admin.categories.modal.reassignSectionLabel')}
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <Select
                  value={form.reassignTo}
                  onChange={(e) => setForm((f) => ({ ...f, reassignTo: e.target.value }))}
                  wrapperStyle={{ flex: 1 }}
                >
                  <option value="">{t('admin.categories.modal.reassignPlaceholder')}</option>
                  {sorted
                    .filter((c) => c.id !== editingId)
                    .map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.label}
                      </option>
                    ))}
                </Select>
                <AnimatedButton
                  variant="secondary"
                  disabled={!form.reassignTo || !editingId || reassignMutation.isPending}
                  onClick={() => {
                    if (!editingId || !form.reassignTo) return;
                    reassignMutation.mutate({ fromId: editingId, toCategoryId: form.reassignTo });
                  }}
                  text={reassignMutation.isPending ? t('admin.categories.modal.moving') : t('admin.categories.modal.reassign')}
                />
              </div>
            </div>
          ) : null}

          {error ? (
            <p style={{ color: 'crimson', fontSize: 13, marginTop: 12 }}>{error}</p>
          ) : null}

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 20 }}>
            <AnimatedButton variant="secondary" onClick={() => setModal(null)} text={t('admin.categories.modal.cancel')} />
            <AnimatedButton
              variant="primary"
              disabled={saveMutation.isPending || !form.label.trim() || !form.id.trim()}
              onClick={() => saveMutation.mutate()}
              text={saveMutation.isPending ? t('admin.categories.modal.saving') : t('admin.categories.modal.save')}
            />
          </div>
        </div>
      </ModalOverlay>
    </>
  );
}
