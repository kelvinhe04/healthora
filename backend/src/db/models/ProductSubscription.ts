import { Schema, model } from 'mongoose';

/** 7/15/30/60 días, el único menú que pide la HU-101 - Stripe soporta un `interval: 'day'` con
 * cualquier `interval_count` (hasta 365), así que no hace falta mapear a 'week'/'month'. */
export const SUBSCRIPTION_INTERVAL_DAYS = [7, 15, 30, 60] as const;
export type SubscriptionIntervalDays = (typeof SUBSCRIPTION_INTERVAL_DAYS)[number];

const ProductSubscriptionSchema = new Schema(
  {
    customerId: { type: String, required: true },
    customerName: String,
    customerEmail: String,

    // Snapshot del producto/variante y de la tarifa al momento de suscribirse - una reposición
    // automática no debe cambiar de precio silenciosamente si el catálogo cambia después (el
    // precio real cobrado en Stripe queda fijo en el recurring Price creado al suscribirse).
    productId: { type: String, required: true },
    productName: { type: String, required: true },
    variantId: String,
    variantLabel: String,
    imageUrl: String,
    category: String,
    taxExempt: { type: Boolean, default: false },
    qty: { type: Number, required: true, min: 1, default: 1 },
    unitPrice: { type: Number, required: true },
    subtotal: { type: Number, required: true },
    tax: { type: Number, required: true, default: 0 },
    shipping: { type: Number, required: true, default: 0 },
    total: { type: Number, required: true },

    intervalDays: { type: Number, enum: SUBSCRIPTION_INTERVAL_DAYS, required: true },
    status: { type: String, enum: ['active', 'paused', 'canceled'], default: 'active' },
    nextBillingDate: Date,

    stripeSubscriptionId: { type: String, required: true, unique: true },
    stripeCustomerId: { type: String, required: true },

    shippingMethod: { type: String, enum: ['delivery', 'pickup'] },
    shippingLabel: String,
    shippingEta: String,
    address: {
      name: String,
      phone: String,
      address: String,
      city: String,
      postal: String,
    },
  },
  { timestamps: true },
);

ProductSubscriptionSchema.index({ customerId: 1, createdAt: -1 });

export const ProductSubscription = model('ProductSubscription', ProductSubscriptionSchema);
