import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
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
import { api } from '../../../lib/api';
import type { Category, Coupon } from '../../../types';
import { useAdminToken } from '../hooks/useAdminToken';

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
  const getAdminToken = useAdminToken();
  const queryClient = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState<CouponForm>(emptyForm);
  const [error, setError] = useState('');

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

  const createMutation = useMutation({
    mutationFn: async () => {
      const token = await getAdminToken();
      const body = {
        code: form.code.trim(),
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
      return api.admin.coupons.create(body, token);
    },
    onSuccess: () => {
      invalidate();
      setModalOpen(false);
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

  const toggleCategory = (category: string) => {
    setForm((prev) => ({
      ...prev,
      eligibleCategories: prev.eligibleCategories.includes(category)
        ? prev.eligibleCategories.filter((c) => c !== category)
        : [...prev.eligibleCategories, category],
    }));
  };

  return (
    <>
      <PageHeader
        loading={isLoading}
        kicker="Promociones"
        title={
          <>
            Gestión de <em style={{ color: 'var(--green)' }}>cupones</em>
          </>
        }
        sub="Crea y administra códigos de descuento para el checkout."
        actions={
          <AnimatedButton variant="primary" onClick={() => { setForm(emptyForm()); setError(''); setModalOpen(true); }} text="+ Nuevo cupón" />
        }
      />

      <Card>
        <table style={tableStyle}>
          <thead>
            <tr>
              <th style={th}>Código</th>
              <th style={th}>Etiqueta</th>
              <th style={th}>Descuento</th>
              <th style={th}>Categorías</th>
              <th style={th}>Usos</th>
              <th style={th}>Estado</th>
              <th style={th}>Acciones</th>
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
                    : `$${(coupon.amountOff ?? 0).toFixed(2)}`}
                </td>
                <td style={td}>
                  {coupon.eligibleCategories?.length
                    ? coupon.eligibleCategories.join(', ')
                    : 'Todas'}
                </td>
                <td style={td}>
                  {coupon.usesCount ?? 0}
                  {coupon.maxUses ? ` / ${coupon.maxUses}` : ''}
                </td>
                <td style={td}>
                  <StatusPill tone={coupon.active ? 'success' : 'neutral'}>
                    {coupon.active ? 'Activo' : 'Inactivo'}
                  </StatusPill>
                </td>
                <td style={td}>
                  <button
                    type="button"
                    onClick={() => toggleMutation.mutate({ coupon, active: !coupon.active })}
                    style={{ background: 'transparent', border: '1px solid var(--ink-12)', borderRadius: 999, padding: '6px 12px', cursor: 'pointer', fontSize: 12 }}
                  >
                    {coupon.active ? 'Desactivar' : 'Activar'}
                  </button>
                </td>
              </tr>
            ))}
            {!isLoading && coupons.length === 0 && (
              <tr>
                <td style={{ ...td, padding: 24, textAlign: 'center', color: 'var(--ink-60)' }} colSpan={7}>
                  No hay cupones creados todavía.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>

      <ModalOverlay open={modalOpen} onClose={() => setModalOpen(false)} zIndex={120}>
        <div style={{ width: '100%', maxWidth: 520, background: 'var(--cream)', borderRadius: 20, padding: 24 }}>
          <h3 style={{ margin: '0 0 16px', fontFamily: '"Instrument Serif", serif', fontSize: 28 }}>Nuevo cupón</h3>
          {error && <p style={{ color: 'var(--red)', fontSize: 13 }}>{error}</p>}
          <div style={{ display: 'grid', gap: 12 }}>
            <input placeholder="Código (ej. SAVE10)" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} style={{ padding: 10, borderRadius: 10, border: '1px solid var(--ink-20)' }} />
            <input placeholder="Etiqueta visible" value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} style={{ padding: 10, borderRadius: 10, border: '1px solid var(--ink-20)' }} />
            <select value={form.discountType} onChange={(e) => setForm({ ...form, discountType: e.target.value as 'percent' | 'fixed' })} style={{ padding: 10, borderRadius: 10, border: '1px solid var(--ink-20)' }}>
              <option value="percent">Porcentaje</option>
              <option value="fixed">Monto fijo</option>
            </select>
            {form.discountType === 'percent' ? (
              <input type="number" min={1} max={100} placeholder="Porcentaje" value={form.percentOff} onChange={(e) => setForm({ ...form, percentOff: e.target.value })} style={{ padding: 10, borderRadius: 10, border: '1px solid var(--ink-20)' }} />
            ) : (
              <input type="number" min={0.01} step="0.01" placeholder="Monto" value={form.amountOff} onChange={(e) => setForm({ ...form, amountOff: e.target.value })} style={{ padding: 10, borderRadius: 10, border: '1px solid var(--ink-20)' }} />
            )}
            <input type="date" value={form.expiresAt} onChange={(e) => setForm({ ...form, expiresAt: e.target.value })} style={{ padding: 10, borderRadius: 10, border: '1px solid var(--ink-20)' }} />
            <input type="number" min={1} placeholder="Máximo de usos (opcional)" value={form.maxUses} onChange={(e) => setForm({ ...form, maxUses: e.target.value })} style={{ padding: 10, borderRadius: 10, border: '1px solid var(--ink-20)' }} />
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
              <input type="checkbox" checked={form.firstPurchaseOnly} onChange={(e) => setForm({ ...form, firstPurchaseOnly: e.target.checked })} />
              Solo primera compra
            </label>
            <div>
              <div style={{ fontSize: 12, color: 'var(--ink-60)', marginBottom: 8 }}>Categorías elegibles (vacío = todas)</div>
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
                    {category}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 20 }}>
            <AnimatedButton variant="secondary" onClick={() => setModalOpen(false)} text="Cancelar" />
            <AnimatedButton variant="primary" onClick={() => createMutation.mutate()} text={createMutation.isPending ? 'Guardando…' : 'Crear cupón'} />
          </div>
        </div>
      </ModalOverlay>
    </>
  );
}
