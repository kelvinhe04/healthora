import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import {
  Card,
  PageHeader,
  StatusPill,
  tableStyle,
  td,
  th,
  trStyle,
} from '../../../components/admin';
import { AnimatedButton } from '../../../components/shared/AnimatedButton';
import { ModalOverlay } from '../../../components/shared/ModalOverlay';
import { Checkbox } from '../../../components/shared/Checkbox';
import { Select } from '../../../components/shared/Select';
import { api } from '../../../lib/api';
import type { Category, Coupon } from '../../../types';
import { useAdminToken } from '../hooks/useAdminToken';
import { formatCurrency } from '../../../lib/currency';
import { translatedCategoryLabel } from '../../../lib/categoryLabels';

type CouponForm = {
  code: string;
  label: string;
  discountType: 'percent' | 'fixed';
  percentOff: string;
  amountOff: string;
  eligibleCategories: string[];
  expiresAt: string;
  maxUses: string;
  firstPurchaseOnly: boolean;
  active: boolean;
};

const emptyForm = (): CouponForm => ({
  code: '',
  label: '',
  discountType: 'percent',
  percentOff: '10',
  amountOff: '5',
  eligibleCategories: [],
  expiresAt: '',
  maxUses: '',
  firstPurchaseOnly: false,
  active: true,
});

export function CouponsSection() {
  const { t } = useTranslation();
  const getAdminToken = useAdminToken();
  const queryClient = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingCode, setEditingCode] = useState<string | null>(null);
  const [form, setForm] = useState<CouponForm>(emptyForm);
  const [error, setError] = useState('');
  const [confirmDeleteCode, setConfirmDeleteCode] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState('');

  const { data: coupons = [], isLoading } = useQuery({
    queryKey: ['admin-coupons'],
    queryFn: async () => api.admin.coupons.list(await getAdminToken()),
  });

  const { data: categories = [] } = useQuery({
    queryKey: ['categories'],
    queryFn: () => api.categories.list(),
  });

  const categoryNames = useMemo(
    () => categories.map((c: Category) => c.id).sort((a, b) => a.localeCompare(b, 'es')),
    [categories],
  );

  const invalidate = () => void queryClient.invalidateQueries({ queryKey: ['admin-coupons'] });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const token = await getAdminToken();
      const body = {
        label: form.label.trim(),
        discountType: form.discountType,
        percentOff: form.discountType === 'percent' ? Number(form.percentOff) : undefined,
        amountOff: form.discountType === 'fixed' ? Number(form.amountOff) : undefined,
        eligibleCategories: form.eligibleCategories,
        expiresAt: form.expiresAt ? new Date(form.expiresAt).toISOString() : null,
        maxUses: form.maxUses ? Number(form.maxUses) : null,
        firstPurchaseOnly: form.firstPurchaseOnly,
        active: form.active,
      };
      if (editingCode) return api.admin.coupons.update(editingCode, body, token);
      return api.admin.coupons.create({ ...body, code: form.code.trim() }, token);
    },
    onSuccess: () => {
      invalidate();
      setModalOpen(false);
      setEditingCode(null);
      setForm(emptyForm());
      setError('');
    },
    onError: (err: Error) => setError(err.message),
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ coupon, active }: { coupon: Coupon; active: boolean }) => {
      const token = await getAdminToken();
      return api.admin.coupons.update(coupon.code, { active }, token);
    },
    onSuccess: invalidate,
  });

  const deleteMutation = useMutation({
    mutationFn: async (code: string) => {
      const token = await getAdminToken();
      return api.admin.coupons.remove(code, token);
    },
    onSuccess: () => {
      invalidate();
      setConfirmDeleteCode(null);
      setDeleteError('');
    },
    onError: (err: Error) => setDeleteError(err.message),
  });

  const toggleCategory = (category: string) => {
    setForm((prev) => ({
      ...prev,
      eligibleCategories: prev.eligibleCategories.includes(category)
        ? prev.eligibleCategories.filter((c) => c !== category)
        : [...prev.eligibleCategories, category],
    }));
  };

  const openCreate = () => {
    setEditingCode(null);
    setForm(emptyForm());
    setError('');
    setModalOpen(true);
  };

  const openEdit = (coupon: Coupon) => {
    setEditingCode(coupon.code);
    setForm({
      code: coupon.code,
      label: coupon.label,
      discountType: coupon.discountType,
      percentOff: String(coupon.percentOff ?? '10'),
      amountOff: String(coupon.amountOff ?? '5'),
      eligibleCategories: coupon.eligibleCategories ?? [],
      expiresAt: coupon.expiresAt ? coupon.expiresAt.slice(0, 10) : '',
      maxUses: coupon.maxUses != null ? String(coupon.maxUses) : '',
      firstPurchaseOnly: coupon.firstPurchaseOnly ?? false,
      active: coupon.active,
    });
    setError('');
    setModalOpen(true);
  };

  return (
    <>
      <PageHeader
        loading={isLoading}
        kicker={t('admin.coupons.kicker')}
        title={
          <>
            {t('admin.coupons.titlePrefix')} <em style={{ color: 'var(--green)' }}>{t('admin.coupons.titleEmphasis')}</em>
          </>
        }
        sub={t('admin.coupons.sub')}
        actions={
          <AnimatedButton variant="primary" onClick={openCreate} text={t('admin.coupons.newButton')} />
        }
      />

      <Card>
        <table style={tableStyle}>
          <thead>
            <tr>
              <th style={th}>{t('admin.coupons.table.columns.code')}</th>
              <th style={th}>{t('admin.coupons.table.columns.label')}</th>
              <th style={th}>{t('admin.coupons.table.columns.discount')}</th>
              <th style={th}>{t('admin.coupons.table.columns.categories')}</th>
              <th style={th}>{t('admin.coupons.table.columns.uses')}</th>
              <th style={th}>{t('admin.coupons.table.columns.status')}</th>
              <th style={th}>{t('admin.coupons.table.columns.actions')}</th>
            </tr>
          </thead>
          <tbody>
            {coupons.map((coupon) => (
              <tr key={coupon.code} style={trStyle}>
                <td style={td}><code>{coupon.code}</code></td>
                <td style={td}>{coupon.label}</td>
                <td style={td}>
                  {coupon.discountType === 'percent'
                    ? `${coupon.percentOff ?? 0}%`
                    : formatCurrency(coupon.amountOff ?? 0)}
                </td>
                <td style={td}>
                  {coupon.eligibleCategories?.length
                    ? coupon.eligibleCategories.join(', ')
                    : t('admin.coupons.table.allCategories')}
                </td>
                <td style={td}>
                  {coupon.usesCount ?? 0}
                  {coupon.maxUses ? ` / ${coupon.maxUses}` : ''}
                </td>
                <td style={td}>
                  <StatusPill
                    status={coupon.active ? 'Activo' : 'Inactivo'}
                    label={coupon.active ? t('admin.coupons.table.statusActive') : t('admin.coupons.table.statusInactive')}
                  />
                </td>
                <td style={td}>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <button
                      type="button"
                      onClick={() => openEdit(coupon)}
                      style={{ background: 'transparent', border: '1px solid var(--ink-12)', borderRadius: 999, padding: '6px 12px', cursor: 'pointer', fontSize: 12 }}
                    >
                      {t('admin.coupons.table.editButton')}
                    </button>
                    <button
                      type="button"
                      onClick={() => toggleMutation.mutate({ coupon, active: !coupon.active })}
                      style={{ background: 'transparent', border: '1px solid var(--ink-12)', borderRadius: 999, padding: '6px 12px', cursor: 'pointer', fontSize: 12 }}
                    >
                      {coupon.active ? t('admin.coupons.table.deactivate') : t('admin.coupons.table.activate')}
                    </button>
                    <button
                      type="button"
                      onClick={() => { setDeleteError(''); setConfirmDeleteCode(coupon.code); }}
                      style={{ background: 'transparent', border: '1px solid var(--ink-12)', borderRadius: 999, padding: '6px 12px', cursor: 'pointer', fontSize: 12, color: 'var(--red)' }}
                    >
                      {t('admin.coupons.table.deleteButton')}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {!isLoading && coupons.length === 0 && (
              <tr>
                <td style={{ ...td, padding: 24, textAlign: 'center', color: 'var(--ink-60)' }} colSpan={7}>
                  {t('admin.coupons.table.empty')}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>

      <ModalOverlay open={modalOpen} onClose={() => setModalOpen(false)} zIndex={120}>
        <div style={{ width: '100%', maxWidth: 520, background: 'var(--cream)', borderRadius: 20, padding: 24 }}>
          <h3 style={{ margin: '0 0 16px', fontFamily: '"Instrument Serif", serif', fontSize: 28 }}>
            {editingCode ? t('admin.coupons.modal.editTitle') : t('admin.coupons.modal.title')}
          </h3>
          {error && <p style={{ color: 'var(--red)', fontSize: 13 }}>{error}</p>}
          <div style={{ display: 'grid', gap: 12 }}>
            <input
              placeholder={t('admin.coupons.modal.codePlaceholder')}
              value={form.code}
              disabled={!!editingCode}
              onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
              style={{ padding: 10, borderRadius: 10, border: '1px solid var(--ink-20)', opacity: editingCode ? 0.6 : 1 }}
            />
            <input placeholder={t('admin.coupons.modal.labelPlaceholder')} value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} style={{ padding: 10, borderRadius: 10, border: '1px solid var(--ink-20)' }} />
            <Select value={form.discountType} onChange={(e) => setForm({ ...form, discountType: e.target.value as 'percent' | 'fixed' })}>
              <option value="percent">{t('admin.coupons.modal.discountTypePercent')}</option>
              <option value="fixed">{t('admin.coupons.modal.discountTypeFixed')}</option>
            </Select>
            {form.discountType === 'percent' ? (
              <input type="number" min={1} max={100} placeholder={t('admin.coupons.modal.percentPlaceholder')} value={form.percentOff} onChange={(e) => setForm({ ...form, percentOff: e.target.value })} style={{ padding: 10, borderRadius: 10, border: '1px solid var(--ink-20)' }} />
            ) : (
              <input type="number" min={0.01} step="0.01" placeholder={t('admin.coupons.modal.amountPlaceholder')} value={form.amountOff} onChange={(e) => setForm({ ...form, amountOff: e.target.value })} style={{ padding: 10, borderRadius: 10, border: '1px solid var(--ink-20)' }} />
            )}
            <input type="date" value={form.expiresAt} onChange={(e) => setForm({ ...form, expiresAt: e.target.value })} style={{ padding: 10, borderRadius: 10, border: '1px solid var(--ink-20)' }} />
            <input type="number" min={1} placeholder={t('admin.coupons.modal.maxUsesPlaceholder')} value={form.maxUses} onChange={(e) => setForm({ ...form, maxUses: e.target.value })} style={{ padding: 10, borderRadius: 10, border: '1px solid var(--ink-20)' }} />
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
              <Checkbox checked={form.firstPurchaseOnly} onChange={(e) => setForm({ ...form, firstPurchaseOnly: e.target.checked })} />
              {t('admin.coupons.modal.firstPurchaseOnly')}
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
              <Checkbox checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} />
              {t('admin.coupons.modal.activeLabel')}
            </label>
            <div>
              <div style={{ fontSize: 12, color: 'var(--ink-60)', marginBottom: 8 }}>{t('admin.coupons.modal.eligibleCategoriesLabel')}</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {categoryNames.map((category) => (
                  <button
                    key={category}
                    type="button"
                    onClick={() => toggleCategory(category)}
                    style={{
                      padding: '6px 10px',
                      borderRadius: 999,
                      border: '1px solid var(--ink-12)',
                      background: form.eligibleCategories.includes(category) ? 'var(--green)' : 'transparent',
                      color: form.eligibleCategories.includes(category) ? 'var(--cream)' : 'var(--ink)',
                      cursor: 'pointer',
                      fontSize: 12,
                    }}
                  >
                    {translatedCategoryLabel(t, category)}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 20 }}>
            <AnimatedButton variant="secondary" onClick={() => setModalOpen(false)} text={t('admin.coupons.modal.cancel')} />
            <AnimatedButton
              variant="primary"
              onClick={() => saveMutation.mutate()}
              text={
                saveMutation.isPending
                  ? t('admin.coupons.modal.saving')
                  : editingCode
                    ? t('admin.coupons.modal.save')
                    : t('admin.coupons.modal.create')
              }
            />
          </div>
        </div>
      </ModalOverlay>

      <ModalOverlay open={!!confirmDeleteCode} onClose={() => setConfirmDeleteCode(null)} zIndex={130}>
        <div style={{ width: '100%', maxWidth: 420, background: 'var(--cream)', borderRadius: 20, padding: 24 }}>
          <h3 style={{ margin: '0 0 12px', fontFamily: '"Instrument Serif", serif', fontSize: 24 }}>
            {t('admin.coupons.deleteModal.title')}
          </h3>
          <p style={{ fontSize: 14, color: 'var(--ink-60)', margin: '0 0 16px' }}>
            {t('admin.coupons.deleteModal.body', { code: confirmDeleteCode })}
          </p>
          {deleteError && <p style={{ color: 'var(--red)', fontSize: 13 }}>{deleteError}</p>}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
            <AnimatedButton variant="secondary" onClick={() => setConfirmDeleteCode(null)} text={t('admin.coupons.modal.cancel')} />
            <AnimatedButton
              variant="primary"
              onClick={() => confirmDeleteCode && deleteMutation.mutate(confirmDeleteCode)}
              disabled={deleteMutation.isPending}
              text={deleteMutation.isPending ? t('admin.coupons.deleteModal.deleting') : t('admin.coupons.deleteModal.confirm')}
            />
          </div>
        </div>
      </ModalOverlay>
    </>
  );
}
