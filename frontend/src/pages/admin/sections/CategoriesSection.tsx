import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
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
import { api } from '../../../lib/api';
import type { Category } from '../../../types';
import { useAdminToken } from '../hooks/useAdminToken';

type CategoryForm = {
  id: string;
  label: string;
  sub: string;
  color: string;
  active: boolean;
  newId: string;
  reassignTo: string;
};

const emptyForm = (): CategoryForm => ({
  id: '',
  label: '',
  sub: '',
  color: 'oklch(0.92 0.03 140)',
  active: true,
  newId: '',
  reassignTo: '',
});

export function CategoriesSection() {
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
      if (modal === 'create') {
        return api.admin.categories.create(
          {
            id: form.id.trim(),
            label: form.label.trim(),
            sub: form.sub.trim() || undefined,
            color: form.color.trim() || undefined,
            active: form.active,
          },
          token,
        );
      }
      if (!editingId) throw new Error('Categoría no seleccionada');
      return api.admin.categories.update(
        editingId,
        {
          label: form.label.trim(),
          sub: form.sub.trim() || undefined,
          color: form.color.trim() || undefined,
          active: form.active,
          newId: form.newId.trim() && form.newId.trim() !== editingId ? form.newId.trim() : undefined,
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
      color: cat.color || '',
      active: cat.active !== false,
      newId: '',
      reassignTo: '',
    });
    setError('');
    setModal('edit');
  };

  return (
    <>
      <PageHeader
        loading={isLoading}
        kicker={isLoading ? undefined : `Catálogo · ${sorted.length} categorías`}
        title={
          <>
            Gestión de <em style={{ color: 'var(--green)' }}>categorías</em>
          </>
        }
        sub="Crea, edita, desactiva y reasigna productos entre categorías sin tocar el seed."
        actions={
          <AnimatedButton variant="primary" onClick={openCreate} text="Nueva categoría" />
        }
      />

      <Card>
        <div style={{ overflowX: 'auto' }}>
          <table style={tableStyle}>
            <thead>
              <tr>
                <th style={th}>Categoría</th>
                <th style={th}>ID</th>
                <th style={th}>Productos</th>
                <th style={th}>Estado</th>
                <th style={th}>Acciones</th>
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
                      {cat.active === false ? 'Inactiva' : 'Activa'}
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
                      Editar
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
            {modal === 'create' ? 'Nueva categoría' : 'Editar categoría'}
          </h2>

          {modal === 'create' ? (
            <label style={{ display: 'block', marginBottom: 12 }}>
              <span style={{ fontSize: 12, color: 'var(--ink-60)' }}>ID (slug interno)</span>
              <input
                value={form.id}
                onChange={(e) => setForm((f) => ({ ...f, id: e.target.value }))}
                placeholder="Ej. Vitaminas"
                style={{ width: '100%', marginTop: 6, padding: '10px 12px', borderRadius: 12, border: '1px solid var(--ink-06)' }}
              />
            </label>
          ) : null}

          <label style={{ display: 'block', marginBottom: 12 }}>
            <span style={{ fontSize: 12, color: 'var(--ink-60)' }}>Nombre visible</span>
            <input
              value={form.label}
              onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))}
              style={{ width: '100%', marginTop: 6, padding: '10px 12px', borderRadius: 12, border: '1px solid var(--ink-06)' }}
            />
          </label>

          <label style={{ display: 'block', marginBottom: 12 }}>
            <span style={{ fontSize: 12, color: 'var(--ink-60)' }}>Subtítulo</span>
            <input
              value={form.sub}
              onChange={(e) => setForm((f) => ({ ...f, sub: e.target.value }))}
              style={{ width: '100%', marginTop: 6, padding: '10px 12px', borderRadius: 12, border: '1px solid var(--ink-06)' }}
            />
          </label>

          <label style={{ display: 'block', marginBottom: 12 }}>
            <span style={{ fontSize: 12, color: 'var(--ink-60)' }}>Color (CSS)</span>
            <input
              value={form.color}
              onChange={(e) => setForm((f) => ({ ...f, color: e.target.value }))}
              style={{ width: '100%', marginTop: 6, padding: '10px 12px', borderRadius: 12, border: '1px solid var(--ink-06)' }}
            />
          </label>

          {modal === 'edit' ? (
            <>
              <label style={{ display: 'block', marginBottom: 12 }}>
                <span style={{ fontSize: 12, color: 'var(--ink-60)' }}>Renombrar ID (reasigna productos)</span>
                <input
                  value={form.newId}
                  onChange={(e) => setForm((f) => ({ ...f, newId: e.target.value }))}
                  placeholder={editingId || ''}
                  style={{ width: '100%', marginTop: 6, padding: '10px 12px', borderRadius: 12, border: '1px solid var(--ink-06)' }}
                />
              </label>

              <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                <Checkbox
                  checked={form.active}
                  onChange={(e) => setForm((f) => ({ ...f, active: e.target.checked }))}
                />
                <span style={{ fontSize: 13 }}>Categoría activa en la tienda</span>
              </label>

              <div style={{ marginTop: 8, paddingTop: 12, borderTop: '1px solid var(--ink-06)' }}>
                <div style={{ fontSize: 12, color: 'var(--ink-60)', marginBottom: 8 }}>
                  Reasignar todos los productos a otra categoría
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <Select
                    value={form.reassignTo}
                    onChange={(e) => setForm((f) => ({ ...f, reassignTo: e.target.value }))}
                    wrapperStyle={{ flex: 1 }}
                  >
                    <option value="">Seleccionar destino…</option>
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
                    text={reassignMutation.isPending ? 'Moviendo…' : 'Reasignar'}
                  />
                </div>
              </div>
            </>
          ) : null}

          {error ? (
            <p style={{ color: 'crimson', fontSize: 13, marginTop: 12 }}>{error}</p>
          ) : null}

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 20 }}>
            <AnimatedButton variant="secondary" onClick={() => setModal(null)} text="Cancelar" />
            <AnimatedButton
              variant="primary"
              disabled={saveMutation.isPending || !form.label.trim() || (modal === 'create' && !form.id.trim())}
              onClick={() => saveMutation.mutate()}
              text={saveMutation.isPending ? 'Guardando…' : 'Guardar'}
            />
          </div>
        </div>
      </ModalOverlay>
    </>
  );
}
