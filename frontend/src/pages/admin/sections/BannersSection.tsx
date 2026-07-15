import { useState } from 'react';
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
import type { Banner } from '../../../types';
import { useAdminToken } from '../hooks/useAdminToken';

type BannerForm = {
  kicker: string;
  title: string;
  highlightWord: string;
  description: string;
  ctaText: string;
  ctaHref: string;
  backgroundColor: string;
  imageUrl: string;
  active: boolean;
  order: string;
  startDate: string;
  endDate: string;
};

const emptyForm = (): BannerForm => ({
  kicker: '',
  title: '',
  highlightWord: '',
  description: '',
  ctaText: '',
  ctaHref: '/catalog',
  backgroundColor: 'var(--lime)',
  imageUrl: '',
  active: true,
  order: '0',
  startDate: '',
  endDate: '',
});

const inputStyle = { width: '100%', marginTop: 6, padding: '10px 12px', borderRadius: 12, border: '1px solid var(--ink-06)', boxSizing: 'border-box' as const };
const labelStyle = { fontSize: 12, color: 'var(--ink-60)' };

export function BannersSection() {
  const getAdminToken = useAdminToken();
  const queryClient = useQueryClient();
  const [modal, setModal] = useState<'create' | 'edit' | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<BannerForm>(emptyForm);
  const [error, setError] = useState('');

  const { data: banners = [], isLoading } = useQuery({
    queryKey: ['admin-banners'],
    queryFn: async () => api.admin.banners.list(await getAdminToken()),
  });

  const invalidate = () => void queryClient.invalidateQueries({ queryKey: ['admin-banners'] });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const token = await getAdminToken();
      const body = {
        kicker: form.kicker.trim() || undefined,
        title: form.title.trim(),
        highlightWord: form.highlightWord.trim() || undefined,
        description: form.description.trim() || undefined,
        ctaText: form.ctaText.trim(),
        ctaHref: form.ctaHref.trim(),
        backgroundColor: form.backgroundColor.trim() || undefined,
        imageUrl: form.imageUrl.trim() || undefined,
        active: form.active,
        order: form.order ? Number(form.order) : 0,
        startDate: form.startDate ? new Date(form.startDate).toISOString() : null,
        endDate: form.endDate ? new Date(form.endDate).toISOString() : null,
      };
      if (modal === 'create') return api.admin.banners.create(body, token);
      if (!editingId) throw new Error('Banner no seleccionado');
      return api.admin.banners.update(editingId, body, token);
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

  const toggleMutation = useMutation({
    mutationFn: async (banner: Banner) => {
      const token = await getAdminToken();
      return api.admin.banners.update(
        banner._id,
        {
          kicker: banner.kicker,
          title: banner.title,
          highlightWord: banner.highlightWord,
          description: banner.description,
          ctaText: banner.ctaText,
          ctaHref: banner.ctaHref,
          backgroundColor: banner.backgroundColor,
          imageUrl: banner.imageUrl,
          active: !banner.active,
          order: banner.order,
          startDate: banner.startDate,
          endDate: banner.endDate,
        },
        token,
      );
    },
    onSuccess: invalidate,
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => api.admin.banners.remove(id, await getAdminToken()),
    onSuccess: invalidate,
  });

  const openCreate = () => {
    setForm(emptyForm());
    setError('');
    setModal('create');
  };

  const openEdit = (banner: Banner) => {
    setEditingId(banner._id);
    setForm({
      kicker: banner.kicker || '',
      title: banner.title,
      highlightWord: banner.highlightWord || '',
      description: banner.description || '',
      ctaText: banner.ctaText,
      ctaHref: banner.ctaHref,
      backgroundColor: banner.backgroundColor || '',
      imageUrl: banner.imageUrl || '',
      active: banner.active,
      order: String(banner.order ?? 0),
      startDate: banner.startDate ? banner.startDate.slice(0, 10) : '',
      endDate: banner.endDate ? banner.endDate.slice(0, 10) : '',
    });
    setError('');
    setModal('edit');
  };

  return (
    <>
      <PageHeader
        loading={isLoading}
        kicker={isLoading ? undefined : `Landing · ${banners.length} banners`}
        title={
          <>
            Gestión de <em style={{ color: 'var(--green)' }}>banners</em>
          </>
        }
        sub="Edita los banners promocionales de la sección Ofertas del landing sin necesitar deploy."
        actions={<AnimatedButton variant="primary" onClick={openCreate} text="Nuevo banner" />}
      />

      <Card>
        <div style={{ overflowX: 'auto' }}>
          <table style={tableStyle}>
            <thead>
              <tr>
                <th style={th}>Orden</th>
                <th style={th}>Banner</th>
                <th style={th}>CTA</th>
                <th style={th}>Vigencia</th>
                <th style={th}>Estado</th>
                <th style={th}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {banners.map((banner) => (
                <tr key={banner._id} style={trStyle}>
                  <td style={td}>{banner.order}</td>
                  <td style={td}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span
                        style={{
                          width: 14,
                          height: 14,
                          borderRadius: 999,
                          background: banner.backgroundColor || 'var(--green)',
                          border: '1px solid var(--ink-06)',
                          flexShrink: 0,
                        }}
                      />
                      <div>
                        {banner.kicker ? (
                          <div style={{ fontSize: 11, color: 'var(--ink-60)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{banner.kicker}</div>
                        ) : null}
                        <div style={{ fontWeight: 600 }}>{banner.title}</div>
                      </div>
                    </div>
                  </td>
                  <td style={td}>
                    {banner.ctaText}
                    <div style={{ fontSize: 12, color: 'var(--ink-60)', fontFamily: '"JetBrains Mono", monospace' }}>{banner.ctaHref}</div>
                  </td>
                  <td style={td}>
                    {banner.startDate || banner.endDate ? (
                      <span style={{ fontSize: 12 }}>
                        {banner.startDate ? new Date(banner.startDate).toLocaleDateString('es-PA') : '—'}
                        {' → '}
                        {banner.endDate ? new Date(banner.endDate).toLocaleDateString('es-PA') : '—'}
                      </span>
                    ) : (
                      <span style={{ fontSize: 12, color: 'var(--ink-60)' }}>Sin límite</span>
                    )}
                  </td>
                  <td style={td}>
                    <StatusPill tone={banner.active ? 'success' : 'neutral'}>
                      {banner.active ? 'Activo' : 'Inactivo'}
                    </StatusPill>
                  </td>
                  <td style={td}>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button
                        type="button"
                        onClick={() => openEdit(banner)}
                        style={{ border: '1px solid var(--ink-06)', background: 'var(--cream)', borderRadius: 999, padding: '6px 12px', cursor: 'pointer', fontSize: 12 }}
                      >
                        Editar
                      </button>
                      <button
                        type="button"
                        onClick={() => toggleMutation.mutate(banner)}
                        style={{ border: '1px solid var(--ink-12)', background: 'transparent', borderRadius: 999, padding: '6px 12px', cursor: 'pointer', fontSize: 12 }}
                      >
                        {banner.active ? 'Desactivar' : 'Activar'}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (confirm(`¿Eliminar el banner "${banner.title}"?`)) deleteMutation.mutate(banner._id);
                        }}
                        style={{ border: '1px solid var(--ink-12)', background: 'transparent', color: 'var(--red, crimson)', borderRadius: 999, padding: '6px 12px', cursor: 'pointer', fontSize: 12 }}
                      >
                        Eliminar
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {!isLoading && banners.length === 0 && (
                <tr>
                  <td style={{ ...td, padding: 24, textAlign: 'center', color: 'var(--ink-60)' }} colSpan={6}>
                    No hay banners creados todavía.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <ModalOverlay open={modal !== null} onClose={() => setModal(null)} zIndex={120}>
        <div style={{ width: '100%', maxWidth: 560, maxHeight: '86vh', overflowY: 'auto', background: 'var(--cream)', borderRadius: 24, border: '1px solid var(--ink-06)', padding: 24 }}>
          <h2 style={{ margin: '0 0 16px', fontFamily: '"Instrument Serif", serif', fontSize: 28 }}>
            {modal === 'create' ? 'Nuevo banner' : 'Editar banner'}
          </h2>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <label style={{ display: 'block', gridColumn: '1 / -1' }}>
              <span style={labelStyle}>Kicker (etiqueta pequeña)</span>
              <input value={form.kicker} onChange={(e) => setForm((f) => ({ ...f, kicker: e.target.value }))} placeholder="Ej. Promoción destacada" style={inputStyle} />
            </label>

            <label style={{ display: 'block', gridColumn: '1 / -1' }}>
              <span style={labelStyle}>Título</span>
              <input value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} placeholder="Ej. 25% OFF en tu rutina de skincare" style={inputStyle} />
            </label>

            <label style={{ display: 'block', gridColumn: '1 / -1' }}>
              <span style={labelStyle}>Palabra a resaltar (opcional, debe aparecer en el título)</span>
              <input value={form.highlightWord} onChange={(e) => setForm((f) => ({ ...f, highlightWord: e.target.value }))} placeholder="Ej. gratis" style={inputStyle} />
            </label>

            <label style={{ display: 'block', gridColumn: '1 / -1' }}>
              <span style={labelStyle}>Descripción</span>
              <textarea value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} rows={3} style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit' }} />
            </label>

            <label style={{ display: 'block' }}>
              <span style={labelStyle}>Texto del botón (CTA)</span>
              <input value={form.ctaText} onChange={(e) => setForm((f) => ({ ...f, ctaText: e.target.value }))} placeholder="Ej. Comprar rutina" style={inputStyle} />
            </label>

            <label style={{ display: 'block' }}>
              <span style={labelStyle}>Link del botón</span>
              <input value={form.ctaHref} onChange={(e) => setForm((f) => ({ ...f, ctaHref: e.target.value }))} placeholder="/catalog o https://…" style={inputStyle} />
            </label>

            <label style={{ display: 'block' }}>
              <span style={labelStyle}>Color de fondo (CSS)</span>
              <input value={form.backgroundColor} onChange={(e) => setForm((f) => ({ ...f, backgroundColor: e.target.value }))} placeholder="var(--lime) o #e4f248" style={inputStyle} />
            </label>

            <label style={{ display: 'block' }}>
              <span style={labelStyle}>Orden (menor va primero)</span>
              <input type="number" min={0} value={form.order} onChange={(e) => setForm((f) => ({ ...f, order: e.target.value }))} style={inputStyle} />
            </label>

            <label style={{ display: 'block', gridColumn: '1 / -1' }}>
              <span style={labelStyle}>Imagen (URL, opcional)</span>
              <input value={form.imageUrl} onChange={(e) => setForm((f) => ({ ...f, imageUrl: e.target.value }))} placeholder="https://…" style={inputStyle} />
            </label>

            <label style={{ display: 'block' }}>
              <span style={labelStyle}>Vigente desde (opcional)</span>
              <input type="date" value={form.startDate} onChange={(e) => setForm((f) => ({ ...f, startDate: e.target.value }))} style={inputStyle} />
            </label>

            <label style={{ display: 'block' }}>
              <span style={labelStyle}>Vigente hasta (opcional)</span>
              <input type="date" value={form.endDate} onChange={(e) => setForm((f) => ({ ...f, endDate: e.target.value }))} style={inputStyle} />
            </label>

            <label style={{ display: 'flex', alignItems: 'center', gap: 8, gridColumn: '1 / -1' }}>
              <input type="checkbox" checked={form.active} onChange={(e) => setForm((f) => ({ ...f, active: e.target.checked }))} />
              <span style={{ fontSize: 13 }}>Banner activo en el landing</span>
            </label>
          </div>

          {error ? <p style={{ color: 'crimson', fontSize: 13, marginTop: 12 }}>{error}</p> : null}

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 20 }}>
            <AnimatedButton variant="secondary" onClick={() => setModal(null)} text="Cancelar" />
            <AnimatedButton
              variant="primary"
              disabled={saveMutation.isPending || !form.title.trim() || !form.ctaText.trim() || !form.ctaHref.trim()}
              onClick={() => saveMutation.mutate()}
              text={saveMutation.isPending ? 'Guardando…' : 'Guardar'}
            />
          </div>
        </div>
      </ModalOverlay>
    </>
  );
}
