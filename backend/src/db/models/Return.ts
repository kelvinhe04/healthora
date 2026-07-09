import { Schema, model } from 'mongoose';

const ReturnSchema = new Schema(
  {
    orderId: { type: Schema.Types.ObjectId, ref: 'Order', required: true },
    customerId: { type: String, required: true },
    customerName: String,
    customerEmail: String,
    reason: { type: String, required: true },
    items: [
      {
        productId: String,
        productName: String,
        qty: Number,
      },
    ],
    refundAmount: { type: Number, required: true },
    status: {
      type: String,
      enum: ['requested', 'approved', 'in_transit', 'refunded', 'rejected'],
      default: 'requested',
    },
    stripeRefundId: String,
  },
  { timestamps: true }
);

ReturnSchema.index({ orderId: 1 });
ReturnSchema.index({ customerId: 1, createdAt: -1 });
ReturnSchema.index({ status: 1, createdAt: -1 });

export const Return = model('Return', ReturnSchema);
