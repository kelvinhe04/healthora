import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, PageHeader } from '../../../components/admin';
import { AnimatedButton } from '../../../components/shared/AnimatedButton';
import { ModalOverlay } from '../../../components/shared/ModalOverlay';
import { Select } from '../../../components/shared/Select';
import { api } from '../../../lib/api';
import { resolveBannerText } from '../../../lib/bannerText';
import type { Banner, BannerSlot } from '../../../types';
import { useAdminToken } from '../hooks/useAdminToken';

type BannerForm = {
  kicker: string;
  title: string;
  highlightWord: string;
  description: string;
  ctaText: string;
  backgroundColor: string;
  categoryId: string;
  startDate: string;
  endDate: string;
};

/** Plantilla que se aplica al título/descripción/CTA cuando se elige una categoría, siempre y
 * cuando el campo no tenga ya un token propio (para no pisar una redacción ya dinámica al
 * simplemente cambiar de categoría - ahí solo hace falta que el token se resuelva de nuevo). */
const PROMO_TEMPLATE = {
  title: '25% OFF en productos de {categoria}',
  description: 'Aplica en productos de {categoria}. Vigente del {fechaDesde} al {fechaHasta} con el código PIEL25.',
  ctaText: 'Comprar {categoria}',
};

const COLOR_PRESETS = [
  { label: 'Lima', value: 'var(--lime)' },
  { label: 'Verde', value: 'var(--green)' },
  { label: 'Coral', value: 'var(--coral)' },
  { label: 'Crema', value: 'var(--cream-2)' },
];

const emptyForm = (): BannerForm => ({
  kicker: '',
  title: '',
  highlightWord: '',
  description: '',
  ctaText: '',
  backgroundColor: COLOR_PRESETS[0].value,
  categoryId: '',
  startDate: '',
  endDate: '',
});

const inputStyle = { width: '100%', marginTop: 6, padding: '10px 12px', borderRadius: 12, border: '1px solid var(--ink-06)', boxSizing: 'border-box' as const };
const labelStyle = { fontSize: 12, color: 'var(--ink-60)' };

function ColorPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const isCustom = !COLOR_PRESETS.some((p) => p.value === value);
  const hexValue = /^#[0-9a-f]{6}$/i.test(value) ? value : '#e4f248';

  return (
    <div>
      <span style={labelStyle}>Color de fondo</span>
      <div style={{ display: 'flex', gap: 8, marginTop: 6, alignItems: 'center', flexWrap: 'wrap' }}>
        {COLOR_PRESETS.map((preset) => (
          <button
            key={preset.value}
            type="button"
            title={preset.label}
            onClick={() => onChange(preset.value)}
            style={{
              width: 30,
              height: 30,
              borderRadius: 999,
              background: preset.value,
              border: value === preset.value ? '2px solid var(--ink)' : '1px solid var(--ink-12)',
              cursor: 'pointer',
              padding: 0,
            }}
          />
        ))}
        <button
          type="button"
          title="Personalizado"
          onClick={() => onChange(hexValue)}
          style={{
            width: 30,
            height: 30,
            borderRadius: 999,
            background: 'conic-gradient(red, yellow, lime, cyan, blue, magenta, red)',
            border: isCustom ? '2px solid var(--ink)' : '1px solid var(--ink-12)',
            cursor: 'pointer',
            padding: 0,
          }}
        />
        {isCustom && (
          <input
            type="color"
            value={hexValue}
            onChange={(e) => onChange(e.target.value)}
            style={{ width: 40, height: 30, padding: 0, border: '1px solid var(--ink-12)', borderRadius: 8, cursor: 'pointer' }}
          />
        )}
      </div>
    </div>
  );
}

function BannerPreviewCard({ banner, label, onEdit }: { banner?: Banner; label: string; onEdit: () => void }) {
  return (
    <Card>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <span
          style={{
            width: 40,
            height: 40,
            borderRadius: 12,
            background: banner?.backgroundColor || 'var(--ink-06)',
            border: '1px solid var(--ink-06)',
            flexShrink: 0,
          }}
        />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 11, color: 'var(--ink-60)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</div>
          <div style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{banner?.title || 'Sin configurar'}</div>
        </div>
      </div>
      <div style={{ marginTop: 16 }}>
        <AnimatedButton variant="secondary" onClick={onEdit} text="Editar" />
      </div>
    </Card>
  );
}

export function BannersSection() {
  const getAdminToken = useAdminToken();
  const queryClient = useQueryClient();
  const [editingSlot, setEditingSlot] = useState<BannerSlot | null>(null);
  const [form, setForm] = useState<BannerForm>(emptyForm);
  const [error, setError] = useState('');

  const { data: banners = [], isLoading } = useQuery({
    queryKey: ['admin-banners'],
    queryFn: async () => api.admin.banners.list(await getAdminToken()),
  });

  const { data: categories = [] } = useQuery({
    queryKey: ['categories'],
    queryFn: () => api.categories.list(),
  });

  const promoBanner = banners.find((b) => b.slot === 'promo');
  const clubBanner = banners.find((b) => b.slot === 'club');

  const invalidate = () => void queryClient.invalidateQueries({ queryKey: ['admin-banners'] });

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!editingSlot) throw new Error('Banner no seleccionado');
      const token = await getAdminToken();
      return api.admin.banners.update(
        editingSlot,
        {
          kicker: form.kicker.trim() || undefined,
          title: form.title.trim(),
          highlightWord: form.highlightWord.trim() || undefined,
          description: form.description.trim() || undefined,
          ctaText: form.ctaText.trim(),
          backgroundColor: form.backgroundColor,
          categoryId: editingSlot === 'promo' ? form.categoryId : undefined,
          startDate: form.startDate ? new Date(form.startDate).toISOString() : null,
          endDate: form.endDate ? new Date(form.endDate).toISOString() : null,
        },
        token,
      );
    },
    onSuccess: () => {
      invalidate();
      setEditingSlot(null);
      setError('');
    },
    onError: (e: Error) => setError(e.message),
  });

  const openEdit = (slot: BannerSlot, banner?: Banner) => {
    setEditingSlot(slot);
    setForm({
      kicker: banner?.kicker || '',
      title: banner?.title || '',
      highlightWord: banner?.highlightWord || '',
      description: banner?.description || '',
      ctaText: banner?.ctaText || '',
      backgroundColor: banner?.backgroundColor || COLOR_PRESETS[0].value,
      categoryId: banner?.categoryId || '',
      startDate: banner?.startDate ? banner.startDate.slice(0, 10) : '',
      endDate: banner?.endDate ? banner.endDate.slice(0, 10) : '',
    });
    setError('');
  };

  const handleCategoryChange = (categoryId: string) => {
    setForm((f) => ({
      ...f,
      categoryId,
      title: f.title.includes('{categoria}') ? f.title : PROMO_TEMPLATE.title,
      description: f.description.includes('{categoria}') || f.description.includes('{fechaDesde}') || f.description.includes('{fechaHasta}') ? f.description : PROMO_TEMPLATE.description,
      ctaText: f.ctaText.includes('{categoria}') ? f.ctaText : PROMO_TEMPLATE.ctaText,
    }));
  };

  const previewCategoryLabel = categories.find((c) => c.id === form.categoryId)?.label;
  const previewParams = { categoryLabel: previewCategoryLabel, startDate: form.startDate || null, endDate: form.endDate || null };
  const resolvedPreview = {
    title: resolveBannerText(form.title, previewParams) || '—',
    description: resolveBannerText(form.description, previewParams) || '—',
    ctaText: resolveBannerText(form.ctaText, previewParams) || '—',
  };

  const categoryOptions = useMemo(
    () => [...categories].sort((a, b) => a.label.localeCompare(b.label, 'es')),
    [categories],
  );

  return (
    <>
      <PageHeader
        loading={isLoading}
        kicker="Landing"
        title={
          <>
            Gestión de <em style={{ color: 'var(--green)' }}>banners</em>
          </>
        }
        sub="Edita los 2 banners de la sección Ofertas del landing sin necesitar deploy."
      />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 16 }}>
        <BannerPreviewCard banner={promoBanner} label="Promoción destacada" onEdit={() => openEdit('promo', promoBanner)} />
        <BannerPreviewCard banner={clubBanner} label="Club Healthora" onEdit={() => openEdit('club', clubBanner)} />
      </div>

      <ModalOverlay open={editingSlot !== null} onClose={() => setEditingSlot(null)} zIndex={120}>
        <div style={{ width: '100%', maxWidth: 560, maxHeight: '86vh', overflowY: 'auto', background: 'var(--cream)', borderRadius: 24, border: '1px solid var(--ink-06)', padding: 24 }}>
          <h2 style={{ margin: '0 0 16px', fontFamily: '"Instrument Serif", serif', fontSize: 28 }}>
            Editar banner {editingSlot === 'promo' ? '· Promoción destacada' : '· Club Healthora'}
          </h2>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <label style={{ display: 'block', gridColumn: '1 / -1' }}>
              <span style={labelStyle}>Kicker (etiqueta pequeña)</span>
              <input value={form.kicker} onChange={(e) => setForm((f) => ({ ...f, kicker: e.target.value }))} style={inputStyle} />
            </label>

            <label style={{ display: 'block', gridColumn: '1 / -1' }}>
              <span style={labelStyle}>Título</span>
              <input value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} spellCheck={false} style={inputStyle} />
              {editingSlot === 'promo' && (
                <span style={{ display: 'block', marginTop: 6, fontSize: 11, color: 'var(--ink-40)' }}>
                  Usa <code>{'{categoria}'}</code>, <code>{'{fechaDesde}'}</code> y <code>{'{fechaHasta}'}</code> donde quieras que se actualicen solas al cambiar la categoría o las fechas de vigencia.
                </span>
              )}
            </label>

            {editingSlot === 'promo' && (
              <label style={{ display: 'block', gridColumn: '1 / -1' }}>
                <span style={labelStyle}>Categoría (define las 2 fotos del banner y a dónde lleva el botón)</span>
                <Select value={form.categoryId} onChange={(e) => handleCategoryChange(e.target.value)} wrapperStyle={{ marginTop: 6 }}>
                  <option value="">Seleccionar categoría…</option>
                  {categoryOptions.map((cat) => (
                    <option key={cat.id} value={cat.id}>{cat.label}</option>
                  ))}
                </Select>
              </label>
            )}

            <label style={{ display: 'block', gridColumn: '1 / -1' }}>
              <span style={labelStyle}>Descripción</span>
              <textarea value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} rows={3} spellCheck={false} style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit' }} />
            </label>

            {editingSlot === 'promo' && (
              <div style={{ gridColumn: '1 / -1', background: 'var(--cream-2)', borderRadius: 12, padding: 14 }}>
                <div style={{ fontSize: 11, color: 'var(--ink-60)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>
                  Vista previa (con la categoría y fecha elegidas)
                </div>
                <div style={{ fontWeight: 600, marginBottom: 4 }}>{resolvedPreview.title}</div>
                <div style={{ fontSize: 13, color: 'var(--ink-60)', marginBottom: 8 }}>{resolvedPreview.description}</div>
                <div style={{ fontSize: 12, fontFamily: '"JetBrains Mono", monospace' }}>[{resolvedPreview.ctaText}]</div>
              </div>
            )}

            <div style={{ gridColumn: '1 / -1' }}>
              <ColorPicker value={form.backgroundColor} onChange={(v) => setForm((f) => ({ ...f, backgroundColor: v }))} />
            </div>

            <label style={{ display: 'block' }}>
              <span style={labelStyle}>Vigente desde{editingSlot === 'promo' ? '' : ' (opcional)'}</span>
              <input type="date" value={form.startDate} onChange={(e) => setForm((f) => ({ ...f, startDate: e.target.value }))} style={inputStyle} />
            </label>

            <label style={{ display: 'block' }}>
              <span style={labelStyle}>Vigente hasta{editingSlot === 'promo' ? '' : ' (opcional)'}</span>
              <input type="date" value={form.endDate} onChange={(e) => setForm((f) => ({ ...f, endDate: e.target.value }))} style={inputStyle} />
            </label>
          </div>

          {error ? <p style={{ color: 'crimson', fontSize: 13, marginTop: 12 }}>{error}</p> : null}

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 20 }}>
            <AnimatedButton variant="secondary" onClick={() => setEditingSlot(null)} text="Cancelar" />
            <AnimatedButton
              variant="primary"
              disabled={
                saveMutation.isPending ||
                !form.title.trim() ||
                !form.ctaText.trim() ||
                (editingSlot === 'promo' && (!form.categoryId || !form.startDate || !form.endDate))
              }
              onClick={() => saveMutation.mutate()}
              text={saveMutation.isPending ? 'Guardando…' : 'Guardar'}
            />
          </div>
        </div>
      </ModalOverlay>
    </>
  );
}
