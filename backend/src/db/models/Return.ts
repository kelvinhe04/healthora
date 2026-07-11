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
    // in_review = the product is physically back (courier delivered it, or the customer dropped
    // it off) and staff is inspecting it before resolving. refund_pending is an internal-only
    // state: the Stripe refund was requested but not yet confirmed by the `refund.updated`
    // webhook (the source of truth, same pattern as order payment confirmation) - never set
    // directly by the admin PATCH, only by the server while it waits on Stripe.
    status: {
      type: String,
      enum: ['requested', 'approved', 'in_transit', 'in_review', 'refund_pending', 'refunded', 'replaced', 'rejected'],
      default: 'requested',
    },
    // What the *customer* asked for when requesting the return - refund is the default (fits
    // "changed my mind"/damaged-with-no-need-for-it cases); replacement is what they'd pick for
    // "this isn't what I ordered". The admin resolves toward this, not their own call - see
    // adminReturns.ts.
    desiredResolution: {
      type: String,
      enum: ['refund', 'replacement'],
      default: 'refund',
    },
    // Set once the admin resolves the return as `replaced` instead of `refunded` (wrong/damaged
    // item) - points at the no-charge replacement Order created for it.
    replacementOrderId: { type: Schema.Types.ObjectId, ref: 'Order' },
    // Snapshot of the order's shippingMethod at request time (delivery -> courier_pickup, pickup ->
    // store_dropoff). Determines whether the flow goes through `in_transit` (a courier is bringing
    // it back) or skips straight to the customer dropping it off in person.
    returnMethod: {
      type: String,
      enum: ['courier_pickup', 'store_dropoff'],
      required: true,
    },
    // Snapshot of the order's delivery address at request time - only set for courier_pickup, so
    // admin knows where to send the courier without a join back to Order. Irrelevant for
    // store_dropoff (the customer brings it in, no pickup location to schedule).
    pickupAddress: {
      name: String,
      phone: String,
      address: String,
      city: String,
      postal: String,
    },
    stripeRefundId: String,
  },
  { timestamps: true }
);

ReturnSchema.index({ orderId: 1 });
ReturnSchema.index({ customerId: 1, createdAt: -1 });
ReturnSchema.index({ status: 1, createdAt: -1 });

export const Return = model('Return', ReturnSchema);
