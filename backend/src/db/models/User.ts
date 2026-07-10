import { Schema, model } from 'mongoose';

const UserSchema = new Schema(
  {
    clerkId: { type: String, required: true, unique: true },
    name: String,
    email: String,
    role: { type: String, enum: ['customer', 'admin'], default: 'customer' },
    cart: [
      {
        productId: { type: String, required: true },
        qty: { type: Number, required: true, min: 1 },
      },
    ],
    addresses: [
      {
        label: { type: String, default: '' },
        name: { type: String, required: true },
        phone: { type: String, required: true },
        address: { type: String, required: true },
        city: { type: String, required: true },
        postal: { type: String, required: true },
        isDefault: { type: Boolean, default: false },
      },
    ],
  },
  { timestamps: true }
);

export const User = model('User', UserSchema);
