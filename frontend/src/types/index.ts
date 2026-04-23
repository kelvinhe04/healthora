export type OrderStatus =
  | 'pending_payment'
  | 'paid'
  | 'processing'
  | 'shipped'
  | 'delivered'
  | 'cancelled'
  | 'refunded';

export interface Product {
  _id: string;
  id: string;
  name: string;
  brand: string;
  category: string;
  need: string;
  price: number;
  priceBefore?: number;
  tag?: string;
  rating: number;
  reviews: number;
  short: string;
  benefits: string[];
  usage: string;
  ingredients: string;
  warnings: string;
  stock: number;
  color: string;
  swatchColor: string;
  label: string;
  imageUrl?: string;
  active: boolean;
}

export interface Category {
  _id: string;
  id: string;
  label: string;
  sub: string;
  color: string;
}

export interface CartItem {
  product: Product;
  qty: number;
}

export interface OrderAddress {
  name: string;
  phone: string;
  address: string;
  city: string;
  postal: string;
}

export interface OrderLineItem {
  productId: string;
  productName: string;
  qty: number;
  price: number;
}

export interface Order {
  _id: string;
  customerId: string;
  customerName: string;
  customerEmail: string;
  items: OrderLineItem[];
  subtotal: number;
  tax: number;
  shipping: number;
  total: number;
  status: OrderStatus;
  stripeSessionId: string;
  stripePaymentIntentId?: string;
  address: OrderAddress;
  createdAt: string;
  updatedAt: string;
}

export interface User {
  _id: string;
  clerkId: string;
  name: string;
  email: string;
  role: 'customer' | 'admin';
  createdAt: string;
}

export interface ProductFilters {
  category?: string;
  need?: string;
  brand?: string;
  priceMax?: number;
  sort?: 'price_asc' | 'price_desc' | 'rating' | 'newest';
  inStock?: boolean;
  search?: string;
}
