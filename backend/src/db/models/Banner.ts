import { Schema, model } from 'mongoose';

/** Los 2 banners fijos del landing (seccion "Ofertas", issue #265) - antes hardcodeados en
 * Landing.tsx, ahora editables desde el admin sin necesitar deploy. No es una coleccion de
 * banners arbitrarios: `slot` identifica cual de los 2 es (unico, sin crear/eliminar desde el
 * admin - ver adminBanners.ts). `ctaHref` no se edita a mano: se calcula solo en el backend
 * (slot 'promo' -> catalogo filtrado por `categoryId`; slot 'club' -> siempre "/club"). */
const BannerSchema = new Schema(
  {
    slot: { type: String, enum: ['promo', 'club'], required: true, unique: true },
    kicker: { type: String, default: '' },
    title: { type: String, required: true },
    /** Palabra/frase dentro de `title` a resaltar en cursiva/color acento (ej. "gratis" en "Una
     * muestra gratis en ordenes premium"). Vacio = sin resaltado. */
    highlightWord: { type: String, default: '' },
    description: { type: String, default: '' },
    ctaText: { type: String, required: true },
    ctaHref: { type: String, required: true },
    /** Solo aplica al slot 'promo': categoria (Category.id) cuyos primeros 2 productos con foto
     * se muestran flotando sobre el banner (ver Landing.tsx) y que arma `ctaHref` solo. */
    categoryId: { type: String, default: null },
    backgroundColor: { type: String, default: '#e4f248' },
    startDate: { type: Date, default: null },
    endDate: { type: Date, default: null },
  },
  { timestamps: true },
);

export const Banner = model('Banner', BannerSchema);
