import { Schema, model } from 'mongoose';

const ProductSchema = new Schema(
  {
    id: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    brand: { type: String, required: true },
    category: { type: String, required: true },
    need: { type: String, required: true },
    price: { type: Number, required: true },
    priceBefore: Number,
    tag: String,
    rating: { type: Number, default: 0 },
    reviews: { type: Number, default: 0 },
    short: String,
    benefits: [String],
    usage: String,
    ingredients: String,
    warnings: String,
    stock: { type: Number, default: 0 },
    color: String,
    swatchColor: String,
    label: String,
    imageUrl: String,
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export const Product = model('Product', ProductSchema);
