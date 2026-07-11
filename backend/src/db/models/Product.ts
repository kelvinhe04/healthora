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
    tag: String,
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
        stock: { type: Number, required: true },
        sku: String,
        color: String,
        imageUrl: String,
        images: [String],
        imagesBySize: { type: Object },
        stockBySize: { type: Object },
        priceBySize: { type: Object },
        isDefault: { type: Boolean, default: false },
        // Mongoose auto-defaults array paths to `[]` when omitted, which would collapse "no
        // restriction" (key absent) and "active for no one" (explicit empty array) into the same
        // persisted value. `default: undefined` keeps an omitted `availableFor` truly absent.
        availableFor: { type: [String], default: undefined },
      },
    ],
    active: { type: Boolean, default: true },
    sortOrder: { type: Number, default: 0 },
    // ITBMS (Panama VAT) exemption - certain medications/health items don't pay the 7% tax at
    // checkout. Derived automatically from `category` (see hooks below), not admin-editable.
    taxExempt: { type: Boolean, default: false },
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
