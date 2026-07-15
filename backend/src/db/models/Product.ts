import { Schema, model } from 'mongoose';
import { isTaxExemptCategory } from '../../lib/tax';

const ProductSchema = new Schema(
  {
    id: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    brand: { type: String, required: true },
    category: { type: String, required: true },
    need: String,
    price: { type: Number, required: true },
    priceBefore: Number,
    discountStartsAt: Date,
    discountEndsAt: Date,
    // Marks a priceBefore that was set by the bulk "Descuento por categoria" admin tool, so
    // `removeCategoryDiscount` can revert only those and leave a discount an admin set by hand
    // (on this product's own editor, or baked into seed data) untouched. Never sent by the
    // individual product/variant editor - see backend/src/lib/discounts.ts.
    categoryDiscount: Boolean,
    // Snapshot of {price, priceBefore, discountStartsAt, discountEndsAt} taken the moment
    // categoryDiscount first flips on, so a category discount applied on top of a discount an
    // admin already set by hand can be reverted back to that exact hand-set state - not just
    // "no discount at all". Captured once per bulk-discount window (not re-captured on re-apply),
    // so re-applying still discounts from the true original, avoiding compounding.
    categoryDiscountRestore: { type: Object },
    tag: String,
    // Unidades vendidas en los ultimos 30 dias (ordenes pagadas), recalculado periodicamente -
    // ver recalculatePurchasesLastMonth en lib/bestsellers.ts. Usado por el badge estilo Amazon
    // "X compraron el ultimo mes" (HU-104); el frontend decide el umbral/formato de despliegue.
    purchasesLastMonth: { type: Number, default: 0 },
    rating: { type: Number, default: 0 },
    reviews: { type: Number, default: 0 },
    short: String,
    benefits: [String],
    usage: String,
    ingredients: String,
    warnings: String,
    nutritionFacts: String,
    certifications: [String],
    interactions: String,
    faq: [{ q: String, a: String }],
    shadeTips: String,
    applicationTips: String,
    formulaDetails: String,
    skinTypes: [String],
    stock: { type: Number, default: 0 },
    color: String,
    swatchColor: String,
    label: String,
    imageUrl: String,
    images: [
      {
        url: { type: String, required: true },
        alt: String,
        isPrimary: { type: Boolean, default: false },
      },
    ],
    extraTabs: [
      {
        id: { type: String, required: true },
        label: { type: String, required: true },
        content: { type: String, required: true },
      },
    ],
    variants: [
      {
        id: { type: String, required: true },
        label: { type: String, required: true },
        type: { type: String, enum: ['size', 'color', 'weight', 'count', 'flavor', 'scent'], required: true },
        price: { type: Number, required: true },
        priceBefore: Number,
        discountStartsAt: Date,
        discountEndsAt: Date,
        // Same bulk-vs-manual origin marker as the product-level field above, at variant/primary
        // granularity (a combo's marker lives here too, shared across all of that primary's
        // priceBeforeBySize entries - same granularity as its discountStartsAt/discountEndsAt).
        categoryDiscount: Boolean,
        // Same as the product-level categoryDiscountRestore above, for a simple variant's own
        // price/priceBefore.
        categoryDiscountRestore: { type: Object },
        // Same idea, per sabor×tamaño combo (keyed by size variant id) for matrix mode - each
        // combo's own {price, priceBefore} from just before the category discount first touched it.
        categoryDiscountRestoreBySize: { type: Object },
        stock: { type: Number, required: true },
        sku: String,
        color: String,
        imageUrl: String,
        images: [String],
        imagesBySize: { type: Object },
        stockBySize: { type: Object },
        priceBySize: { type: Object },
        priceBeforeBySize: { type: Object },
        isDefault: { type: Boolean, default: false },
        // Mongoose auto-defaults array paths to `[]` when omitted, which would collapse "no
        // restriction" (key absent) and "active for no one" (explicit empty array) into the same
        // persisted value. `default: undefined` keeps an omitted `availableFor` truly absent.
        availableFor: { type: [String], default: undefined },
      },
    ],
    active: { type: Boolean, default: true },
    sortOrder: { type: Number, default: 0 },
    // Umbral de stock bajo especifico de este producto (HU-055). Sin definir, se usa el default
    // global LOW_STOCK_THRESHOLD (backend/src/lib/realtime.ts) tanto para las alertas en tiempo
    // real como para el widget "Stock bajo" del dashboard.
    lowStockThreshold: Number,
    // Cuantos dias le dura a un cliente este producto desde la compra, usado para estimar cuando
    // se le esta por acabar y mandarle un recordatorio de recompra (HU-102). Sin definir, se usa
    // el default por categoria - ver CATEGORY_REORDER_CYCLE_DAYS en lib/repurchase.ts.
    reorderCycleDays: Number,
    // ITBMS (Panama VAT) exemption - certain medications/health items don't pay the 7% tax at
    // checkout. Derived automatically from `category` (see hooks below), not admin-editable.
    taxExempt: { type: Boolean, default: false },
    // Club Healthora "muestra gratis" (issue #151): tri-state manual override on top of the
    // automatic price-based rule (Settings.sampleMaxPrice, see lib/sampleEligibility.ts).
    // undefined/unset (no default here on purpose) = automatic, decided per variant/combo by
    // price. true = force every cell of this product eligible regardless of price. false = force
    // every cell ineligible regardless of price.
    sampleEligible: { type: Boolean },
  },
  { timestamps: true }
);

// taxExempt siempre se deriva de category, nunca se acepta del cliente - evita que un admin
// deje un producto de "Medicamentos" gravado (o viceversa) por error u omision en el payload.
ProductSchema.pre('save', function () {
  this.taxExempt = isTaxExemptCategory(this.category);
});

ProductSchema.pre('findOneAndUpdate', function () {
  const update = this.getUpdate() as { category?: string } | null;
  if (update && typeof update.category === 'string') {
    (update as { taxExempt?: boolean }).taxExempt = isTaxExemptCategory(update.category);
  }
});

export const Product = model('Product', ProductSchema);
