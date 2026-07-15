import { Schema, model } from 'mongoose';

/** Singleton document (always the same `key: 'global'`) for admin-editable global settings that
 * don't belong to any single product/order/etc. Starts with just `sampleMaxPrice` (issue #151) -
 * add more fields here rather than creating a new singleton model per setting. */
const SettingsSchema = new Schema(
  {
    key: { type: String, required: true, unique: true, default: 'global' },
    /** Club Healthora "muestra gratis": un producto sin override manual
     * (`Product.sampleEligible`) califica automaticamente si su precio (o el de la
     * variante/combo elegida) es menor o igual a este tope. */
    sampleMaxPrice: { type: Number, default: 25, min: 0 },
  },
  { timestamps: true },
);

export const Settings = model('Settings', SettingsSchema);

/** Upserts-on-read so callers never have to worry about the singleton not existing yet (fresh DB,
 * or a field added after other settings were already saved). */
export async function getSettings() {
  return Settings.findOneAndUpdate({ key: 'global' }, {}, { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true }).lean();
}
