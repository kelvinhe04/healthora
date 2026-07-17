import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Card, PageHeader } from '../../../components/admin';
import { AnimatedButton } from '../../../components/shared/AnimatedButton';
import { ModalOverlay } from '../../../components/shared/ModalOverlay';
import { Select } from '../../../components/shared/Select';
import { api } from '../../../lib/api';
import { resolveBannerText } from '../../../lib/bannerText';
import { translatedCategoryLabel } from '../../../lib/categoryLabels';
import type { Banner, BannerSlot } from '../../../types';
import { useAdminToken } from '../hooks/useAdminToken';

type BannerForm = {
  kicker: string;
  title: string;
  highlightWord: string;
  description: string;
  ctaText: string;
  kickerEn: string;
  titleEn: string;
  highlightWordEn: string;
  descriptionEn: string;
  ctaTextEn: string;
  backgroundColor: string;
  categoryId: string;
  startDate: string;
  endDate: string;
};

type FormLang = 'es' | 'en';

/** Plantilla que se aplica al título/descripción/CTA cuando se elige una categoría, siempre y
 * cuando el campo no tenga ya un token propio (para no pisar una redacción ya dinámica al
 * simplemente cambiar de categoría - ahí solo hace falta que el token se resuelva de nuevo). */
const PROMO_TEMPLATE = {
  title: '25% OFF en productos de {categoria}',
  description: 'Aplica en productos de {categoria}. Vigente del {fechaDesde} al {fechaHasta} con el código PIEL25.',
  ctaText: 'Comprar {categoria}',
};

const PROMO_TEMPLATE_EN = {
  title: '25% OFF on {categoria} products',
  description: 'Applies to {categoria} products. Valid from {fechaDesde} to {fechaHasta} with code PIEL25.',
  ctaText: 'Shop {categoria}',
};

const COLOR_PRESETS = [
  { labelKey: 'lime', value: 'var(--lime)' },
  { labelKey: 'green', value: 'var(--green)' },
  { labelKey: 'coral', value: 'var(--coral)' },
  { labelKey: 'cream', value: 'var(--cream-2)' },
];

const emptyForm = (): BannerForm => ({
  kicker: '',
  title: '',
  highlightWord: '',
  description: '',
  ctaText: '',
  kickerEn: '',
  titleEn: '',
  highlightWordEn: '',
  descriptionEn: '',
  ctaTextEn: '',
  backgroundColor: COLOR_PRESETS[0].value,
  categoryId: '',
  startDate: '',
  endDate: '',
});

const inputStyle = { width: '100%', marginTop: 6, padding: '10px 12px', borderRadius: 12, border: '1px solid var(--ink-06)', boxSizing: 'border-box' as const };
const labelStyle = { fontSize: 12, color: 'var(--ink-60)' };

function ColorPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const { t } = useTranslation();
  const isCustom = !COLOR_PRESETS.some((p) => p.value === value);
  const hexValue = /^#[0-9a-f]{6}$/i.test(value) ? value : '#e4f248';

  return (
    <div>
      <span style={labelStyle}>{t('admin.banners.colorPicker.backgroundColorLabel')}</span>
      <div style={{ display: 'flex', gap: 8, marginTop: 6, alignItems: 'center', flexWrap: 'wrap' }}>
        {COLOR_PRESETS.map((preset) => (
          <button
            key={preset.value}
            type="button"
            title={t(`admin.banners.colorPresets.${preset.labelKey}`)}
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
          title={t('admin.banners.colorPresets.custom')}
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
  const { t } = useTranslation();
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
          <div style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{banner?.title || t('admin.banners.preview.notConfigured')}</div>
        </div>
      </div>
      <div style={{ marginTop: 16 }}>
        <AnimatedButton variant="secondary" onClick={onEdit} text={t('admin.banners.preview.editButton')} />
      </div>
    </Card>
  );
}

export function BannersSection() {
  const { t, i18n } = useTranslation();
  const getAdminToken = useAdminToken();
  const queryClient = useQueryClient();
  const [editingSlot, setEditingSlot] = useState<BannerSlot | null>(null);
  const [form, setForm] = useState<BannerForm>(emptyForm);
  const [formLang, setFormLang] = useState<FormLang>('es');
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
      if (!editingSlot) throw new Error(t('admin.banners.noSlotSelectedError'));
      const token = await getAdminToken();
      return api.admin.banners.update(
        editingSlot,
        {
          kicker: form.kicker.trim() || undefined,
          title: form.title.trim(),
          highlightWord: form.highlightWord.trim() || undefined,
          description: form.description.trim() || undefined,
          ctaText: form.ctaText.trim(),
          kickerEn: form.kickerEn.trim() || undefined,
          titleEn: form.titleEn.trim() || undefined,
          highlightWordEn: form.highlightWordEn.trim() || undefined,
          descriptionEn: form.descriptionEn.trim() || undefined,
          ctaTextEn: form.ctaTextEn.trim() || undefined,
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
    setFormLang('es');
    setForm({
      kicker: banner?.kicker || '',
      title: banner?.title || '',
      highlightWord: banner?.highlightWord || '',
      description: banner?.description || '',
      ctaText: banner?.ctaText || '',
      kickerEn: banner?.kickerEn || '',
      titleEn: banner?.titleEn || '',
      highlightWordEn: banner?.highlightWordEn || '',
      descriptionEn: banner?.descriptionEn || '',
      ctaTextEn: banner?.ctaTextEn || '',
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
      titleEn: f.titleEn.includes('{categoria}') ? f.titleEn : PROMO_TEMPLATE_EN.title,
      descriptionEn: f.descriptionEn.includes('{categoria}') || f.descriptionEn.includes('{fechaDesde}') || f.descriptionEn.includes('{fechaHasta}') ? f.descriptionEn : PROMO_TEMPLATE_EN.description,
      ctaTextEn: f.ctaTextEn.includes('{categoria}') ? f.ctaTextEn : PROMO_TEMPLATE_EN.ctaText,
    }));
  };

  // The preview must reflect the tab's language (formLang), not the admin's own active UI
  // language (i18n.language) - those are independent, so `t()` (bound to the latter) and
  // formatPanamaDate's default locale can't be used here. i18n.getFixedT pins translation to
  // whichever language the tab is showing, and resolveBannerText's explicit locale arg does the
  // same for the {fechaDesde}/{fechaHasta} tokens.
  const previewCategoryRaw = categories.find((c) => c.id === form.categoryId)?.label;
  const previewLocale = formLang === 'en' ? 'en-US' : 'es-PA';
  const previewCategoryLabel = translatedCategoryLabel(i18n.getFixedT(formLang), previewCategoryRaw);
  const previewParams = { categoryLabel: previewCategoryLabel, startDate: form.startDate || null, endDate: form.endDate || null };
  const resolvedPreview = formLang === 'en'
    ? {
        title: resolveBannerText(form.titleEn || form.title, previewParams, previewLocale) || '—',
        description: resolveBannerText(form.descriptionEn || form.description, previewParams, previewLocale) || '—',
        ctaText: resolveBannerText(form.ctaTextEn || form.ctaText, previewParams, previewLocale) || '—',
      }
    : {
        title: resolveBannerText(form.title, previewParams, previewLocale) || '—',
        description: resolveBannerText(form.description, previewParams, previewLocale) || '—',
        ctaText: resolveBannerText(form.ctaText, previewParams, previewLocale) || '—',
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
            {t('admin.banners.titlePrefix')} <em style={{ color: 'var(--green)' }}>{t('admin.banners.titleEmphasis')}</em>
          </>
        }
        sub={t('admin.banners.sub')}
      />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 16 }}>
        <BannerPreviewCard banner={promoBanner} label={t('admin.banners.preview.promoLabel')} onEdit={() => openEdit('promo', promoBanner)} />
        <BannerPreviewCard banner={clubBanner} label={t('admin.banners.preview.clubLabel')} onEdit={() => openEdit('club', clubBanner)} />
      </div>

      <ModalOverlay open={editingSlot !== null} onClose={() => setEditingSlot(null)} zIndex={120}>
        <div style={{ width: '100%', maxWidth: 560, maxHeight: '86vh', overflowY: 'auto', background: 'var(--cream)', borderRadius: 24, border: '1px solid var(--ink-06)', padding: 24 }}>
          <h2 style={{ margin: '0 0 16px', fontFamily: '"Instrument Serif", serif', fontSize: 28 }}>
            {t('admin.banners.modal.editTitlePrefix')} {editingSlot === 'promo' ? `· ${t('admin.banners.preview.promoLabel')}` : `· ${t('admin.banners.preview.clubLabel')}`}
          </h2>

          <div style={{ display: 'flex', gap: 4, padding: 4, background: 'var(--ink-06)', borderRadius: 12, marginBottom: 16, width: 'fit-content' }}>
            <button
              type="button"
              onClick={() => setFormLang('es')}
              style={{ padding: '6px 16px', borderRadius: 9, border: 'none', cursor: 'pointer', fontSize: 13, fontFamily: '"Geist", sans-serif', fontWeight: 500, background: formLang === 'es' ? 'var(--cream)' : 'transparent', color: formLang === 'es' ? 'var(--ink)' : 'var(--ink-60)', boxShadow: formLang === 'es' ? '0 1px 4px rgba(0,0,0,0.08)' : 'none' }}
            >
              {t('admin.banners.modal.langTab.es')}
            </button>
            <button
              type="button"
              onClick={() => setFormLang('en')}
              style={{ padding: '6px 16px', borderRadius: 9, border: 'none', cursor: 'pointer', fontSize: 13, fontFamily: '"Geist", sans-serif', fontWeight: 500, background: formLang === 'en' ? 'var(--cream)' : 'transparent', color: formLang === 'en' ? 'var(--ink)' : 'var(--ink-60)', boxShadow: formLang === 'en' ? '0 1px 4px rgba(0,0,0,0.08)' : 'none' }}
            >
              {t('admin.banners.modal.langTab.en')}
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            {formLang === 'es' ? (
              <>
                <label style={{ display: 'block', gridColumn: '1 / -1' }}>
                  <span style={labelStyle}>{t('admin.banners.modal.kickerLabel')}</span>
                  <input value={form.kicker} onChange={(e) => setForm((f) => ({ ...f, kicker: e.target.value }))} style={inputStyle} />
                </label>

                <label style={{ display: 'block', gridColumn: '1 / -1' }}>
                  <span style={labelStyle}>{t('admin.banners.modal.titleLabel')}</span>
                  <input value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} spellCheck={false} style={inputStyle} />
                  {editingSlot === 'promo' && (
                    <span style={{ display: 'block', marginTop: 6, fontSize: 11, color: 'var(--ink-40)' }}>
                      {t('admin.banners.modal.titleHintPrefix')} <code>{'{categoria}'}</code>, <code>{'{fechaDesde}'}</code> {t('admin.banners.modal.titleHintJoiner')} <code>{'{fechaHasta}'}</code> {t('admin.banners.modal.titleHintSuffix')}
                    </span>
                  )}
                </label>
              </>
            ) : (
              <>
                <label style={{ display: 'block', gridColumn: '1 / -1' }}>
                  <span style={labelStyle}>{t('admin.banners.modal.kickerLabel')}</span>
                  <input value={form.kickerEn} onChange={(e) => setForm((f) => ({ ...f, kickerEn: e.target.value }))} style={inputStyle} />
                </label>

                <label style={{ display: 'block', gridColumn: '1 / -1' }}>
                  <span style={labelStyle}>{t('admin.banners.modal.titleLabel')}</span>
                  <input value={form.titleEn} onChange={(e) => setForm((f) => ({ ...f, titleEn: e.target.value }))} spellCheck={false} style={inputStyle} />
                  {editingSlot === 'promo' && (
                    <span style={{ display: 'block', marginTop: 6, fontSize: 11, color: 'var(--ink-40)' }}>
                      {t('admin.banners.modal.titleHintPrefix')} <code>{'{categoria}'}</code>, <code>{'{fechaDesde}'}</code> {t('admin.banners.modal.titleHintJoiner')} <code>{'{fechaHasta}'}</code> {t('admin.banners.modal.titleHintSuffix')}
                    </span>
                  )}
                </label>
              </>
            )}

            {editingSlot === 'promo' && (
              <label style={{ display: 'block', gridColumn: '1 / -1' }}>
                <span style={labelStyle}>{t('admin.banners.modal.categoryLabel')}</span>
                <Select value={form.categoryId} onChange={(e) => handleCategoryChange(e.target.value)} wrapperStyle={{ marginTop: 6 }}>
                  <option value="">{t('admin.banners.modal.categoryPlaceholder')}</option>
                  {categoryOptions.map((cat) => (
                    <option key={cat.id} value={cat.id}>{translatedCategoryLabel(t, cat.label)}</option>
                  ))}
                </Select>
              </label>
            )}

            {formLang === 'es' ? (
              <>
                <label style={{ display: 'block', gridColumn: '1 / -1' }}>
                  <span style={labelStyle}>{t('admin.banners.modal.descriptionLabel')}</span>
                  <textarea value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} rows={3} spellCheck={false} style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit' }} />
                </label>
                <label style={{ display: 'block', gridColumn: '1 / -1' }}>
                  <span style={labelStyle}>{t('admin.banners.modal.ctaTextLabel')}</span>
                  <input value={form.ctaText} onChange={(e) => setForm((f) => ({ ...f, ctaText: e.target.value }))} spellCheck={false} style={inputStyle} />
                </label>
              </>
            ) : (
              <>
                <label style={{ display: 'block', gridColumn: '1 / -1' }}>
                  <span style={labelStyle}>{t('admin.banners.modal.descriptionLabel')}</span>
                  <textarea value={form.descriptionEn} onChange={(e) => setForm((f) => ({ ...f, descriptionEn: e.target.value }))} rows={3} spellCheck={false} style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit' }} />
                </label>
                <label style={{ display: 'block', gridColumn: '1 / -1' }}>
                  <span style={labelStyle}>{t('admin.banners.modal.ctaTextLabel')}</span>
                  <input value={form.ctaTextEn} onChange={(e) => setForm((f) => ({ ...f, ctaTextEn: e.target.value }))} spellCheck={false} style={inputStyle} />
                </label>
              </>
            )}

            {editingSlot === 'promo' && (
              <div style={{ gridColumn: '1 / -1', background: 'var(--cream-2)', borderRadius: 12, padding: 14 }}>
                <div style={{ fontSize: 11, color: 'var(--ink-60)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>
                  {t('admin.banners.modal.previewLabel')}
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
              <span style={labelStyle}>{t('admin.banners.modal.startDateLabel')}{editingSlot === 'promo' ? '' : t('admin.banners.modal.optionalSuffix')}</span>
              <input type="date" value={form.startDate} onChange={(e) => setForm((f) => ({ ...f, startDate: e.target.value }))} style={inputStyle} />
            </label>

            <label style={{ display: 'block' }}>
              <span style={labelStyle}>{t('admin.banners.modal.endDateLabel')}{editingSlot === 'promo' ? '' : t('admin.banners.modal.optionalSuffix')}</span>
              <input type="date" value={form.endDate} onChange={(e) => setForm((f) => ({ ...f, endDate: e.target.value }))} style={inputStyle} />
            </label>
          </div>

          {error ? <p style={{ color: 'crimson', fontSize: 13, marginTop: 12 }}>{error}</p> : null}

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 20 }}>
            <AnimatedButton variant="secondary" onClick={() => setEditingSlot(null)} text={t('admin.banners.modal.cancel')} />
            <AnimatedButton
              variant="primary"
              disabled={
                saveMutation.isPending ||
                !form.title.trim() ||
                !form.ctaText.trim() ||
                (editingSlot === 'promo' && (!form.categoryId || !form.startDate || !form.endDate))
              }
              onClick={() => saveMutation.mutate()}
              text={saveMutation.isPending ? t('admin.banners.modal.saving') : t('admin.banners.modal.save')}
            />
          </div>
        </div>
      </ModalOverlay>
    </>
  );
}
