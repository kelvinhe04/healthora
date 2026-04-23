import { Schema, model } from 'mongoose';

const CategorySchema = new Schema({
  id: { type: String, required: true, unique: true },
  label: { type: String, required: true },
  sub: String,
  color: String,
});

export const Category = model('Category', CategorySchema);
