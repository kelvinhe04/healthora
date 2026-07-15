import { Schema, model } from 'mongoose';

/** Banners promocionales del landing (seccion "Ofertas", issue #265) - antes hardcodeados en
 * Landing.tsx, ahora editables desde el admin sin necesitar deploy. `order` decide que banner
 * ocupa el slot grande (izquierda) vs el chico (derecha) cuando hay 2+ activos; `startDate`/
 * `endDate` son opcionales para promos con vigencia (ej. "valido hasta el 30 de mayo"). */
const BannerSchema = new Schema(
  {
    kicker: { type: String, default: '' },
    title: { type: String, required: true },
    /** Palabra/frase dentro de `title` a resaltar en cursiva/color acento (ej. "gratis" en "Una
     * muestra gratis en ordenes premium"). Vacio = sin resaltado. */
    highlightWord: { type: String, default: '' },
    description: { type: String, default: '' },
    ctaText: { type: String, required: true },
    /** Ruta interna (ej. "/catalog", "/club") o URL externa completa. */
    ctaHref: { type: String, required: true },
    backgroundColor: { type: String, default: '#e4f248' },
    imageUrl: { type: String, default: '' },
    active: { type: Boolean, default: true },
    order: { type: Number, default: 0 },
    startDate: { type: Date, default: null },
    endDate: { type: Date, default: null },
  },
  { timestamps: true },
);

export const Banner = model('Banner', BannerSchema);
