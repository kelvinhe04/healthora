import { Schema, model } from 'mongoose';

const OrderSchema = new Schema(
  {
    customerId: { type: String, required: true },
    customerName: String,
    customerEmail: String,
    items: [
      {
        productId: String,
        productName: String,
        qty: Number,
        price: Number,
        imageUrl: String,
        category: String,
        variantId: String,
        variantLabel: String,
        isSample: { type: Boolean, default: false },
      },
    ],
    subtotal: Number,
    discountCode: String,
    discountAmount: { type: Number, default: 0 },
    tax: Number,
    shipping: Number,
    shippingMethod: { type: String, enum: ['delivery', 'pickup'] },
    shippingLabel: String,
    shippingEta: String,
    total: Number,
    paymentStatus: {
      type: String,
      enum: ['pending_payment', 'paid', 'cancelled', 'refunded'],
      default: 'pending_payment',
    },
    fulfillmentStatus: {
      type: String,
      enum: ['unfulfilled', 'processing', 'shipped', 'delivered', 'cancelled'],
      default: 'unfulfilled',
    },
    status: {
      type: String,
      enum: ['pending_payment', 'paid', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded'],
      default: 'pending_payment',
    },
    stripeSessionId: { type: String, unique: true, sparse: true },
    stripePaymentIntentId: String,
    address: {
      name: String,
      phone: String,
      address: String,
      city: String,
      postal: String,
    },
  },
  { timestamps: true }
);

OrderSchema.index({ customerId: 1, createdAt: -1 });
OrderSchema.index({ status: 1, createdAt: -1 });
OrderSchema.index({ paymentStatus: 1, createdAt: -1 });
OrderSchema.index({ fulfillmentStatus: 1, createdAt: -1 });

export const Order = model('Order', OrderSchema);
