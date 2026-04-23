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
      },
    ],
    subtotal: Number,
    tax: Number,
    shipping: Number,
    total: Number,
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

export const Order = model('Order', OrderSchema);
