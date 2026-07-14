import { Schema, model } from 'mongoose';

/** One reminder email sent for a given (customer, product, last purchase) cycle - HU-102. The
 * unique index is what prevents re-sending for the same purchase: if the customer buys the
 * product again, `lastPurchaseDate` moves forward and a new reminder becomes eligible for that
 * new cycle, but the same cycle is never reminded twice. */
const RepurchaseReminderSchema = new Schema(
  {
    customerId: { type: String, required: true, index: true },
    customerEmail: { type: String, required: true },
    productId: { type: String, required: true },
    productName: String,
    lastPurchaseDate: { type: Date, required: true },
    estimatedRunOutDate: { type: Date, required: true },
    reorderCycleDays: { type: Number, required: true },
    sentAt: { type: Date, default: () => new Date() },
  },
  { timestamps: true },
);

RepurchaseReminderSchema.index({ customerId: 1, productId: 1, lastPurchaseDate: 1 }, { unique: true });
RepurchaseReminderSchema.index({ createdAt: -1 });

export const RepurchaseReminder = model('RepurchaseReminder', RepurchaseReminderSchema);
