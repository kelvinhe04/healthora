export type PaymentStatus = 'pending_payment' | 'paid' | 'cancelled' | 'refunded';

export type FulfillmentStatus = 'unfulfilled' | 'processing' | 'shipped' | 'delivered' | 'cancelled';

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
  nutritionFacts?: string;
  certifications?: string[];
  interactions?: string;
  faq?: { q: string; a: string }[];
  shadeTips?: string;
  applicationTips?: string;
  formulaDetails?: string;
  skinTypes?: string[];
  imageUrl?: string;
  images?: {
    url: string;
    alt?: string;
    isPrimary?: boolean;
  }[];
  extraTabs?: {
    id: string;
    label: string;
    content: string;
  }[];
  active: boolean;
  createdAt?: string;
  updatedAt?: string;
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

export interface SavedAddress extends OrderAddress {
  label?: string;
  isDefault: boolean;
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
  paymentStatus: PaymentStatus;
  fulfillmentStatus: FulfillmentStatus;
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

export interface Review {
  _id: string;
  productId: string;
  userId: string;
  userName: string;
  rating: number;
  title?: string;
  body: string;
  userAvatar?: string;
  helpfulVoters: string[];
  createdAt: string;
  updatedAt: string;
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
