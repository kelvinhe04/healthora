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

export interface ProductVariant {
  id: string;
  label: string;
  type: 'size' | 'color' | 'weight' | 'count' | 'flavor' | 'scent';
  price: number;
  priceBefore?: number | null;
  discountStartsAt?: string | null;
  discountEndsAt?: string | null;
  stock: number;
  sku?: string;
  color?: string;
  imageUrl?: string;
  images?: string[];
  imagesBySize?: Record<string, string[]>;
  /** For a `flavor`/`scent` variant: stock specific to a sabor+tamaño combo, keyed by size variant id. Omit to share the size's own stock across all flavors. */
  stockBySize?: Record<string, number>;
  /** Price override for a specific sabor+tamaño combo, keyed by size variant id. Omit to use the tamaño's base price (sabores no longer add their own price extra). */
  priceBySize?: Record<string, number>;
  /** "Was $X" price for a specific sabor+tamaño combo (set by a category/individual discount), keyed by size variant id. Vigencia comes from this variant's own discountStartsAt/discountEndsAt. */
  priceBeforeBySize?: Record<string, number>;
  /** Whether this variant's discount came from the bulk "Descuento por categoría" admin tool (vs. hand-set on this variant's own editor). Never admin-editable directly. */
  categoryDiscount?: boolean;
  /** Snapshot of this variant's price/priceBefore/vigencia from just before the category discount tool first touched it, so removing the category discount can restore a hand-set discount exactly. Never admin-editable directly. */
  categoryDiscountRestore?: { price: number; priceBefore?: number; discountStartsAt?: string; discountEndsAt?: string };
  /** Same idea as categoryDiscountRestore, per sabor+tamaño combo (keyed by size variant id) for matrix mode. Never admin-editable directly. */
  categoryDiscountRestoreBySize?: Record<string, { price: number; priceBefore?: number }>;
  isDefault?: boolean;
  /** For a `size` variant paired with a `flavor`/`scent` variant: restricts this size to the given primary variant ids. Omit to make it available for all. */
  availableFor?: string[];
}

export interface Product {
  _id: string;
  id: string;
  name: string;
  brand: string;
  category: string;
  need: string;
  price: number;
  priceBefore?: number | null;
  discountStartsAt?: string | null;
  discountEndsAt?: string | null;
  /** Whether this product's discount came from the bulk "Descuento por categoría" admin tool (vs. hand-set on this product's own editor). Never admin-editable directly. */
  categoryDiscount?: boolean;
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
  variants?: ProductVariant[];
  active: boolean;
  taxExempt?: boolean;
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
  variant?: ProductVariant;
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
  imageUrl?: string;
  variantId?: string;
  variantLabel?: string;
  isSample?: boolean;
}

export interface Order {
  _id: string;
  customerId: string;
  customerName: string;
  customerEmail: string;
  items: OrderLineItem[];
  subtotal: number;
  discountCode?: string;
  discountAmount?: number;
  tax: number;
  shipping: number;
  shippingMethod?: 'delivery' | 'pickup';
  shippingLabel?: string;
  shippingEta?: string;
  carrier?: string;
  trackingNumber?: string;
  total: number;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  fulfillmentStatus: FulfillmentStatus;
  stripeSessionId: string;
  stripePaymentIntentId?: string;
  /** Set when this order is a no-charge replacement shipment created from a Return resolved as
   * "replaced" (wrong/damaged item) instead of refunded. */
  replacesOrderId?: string;
  address: OrderAddress;
  createdAt: string;
  updatedAt: string;
}

export type ReturnStatus = 'requested' | 'approved' | 'in_transit' | 'in_review' | 'refund_pending' | 'refunded' | 'replaced' | 'rejected';

/** How the product physically comes back: a courier picks it up (delivery orders) or the customer
 * drops it off in person (pickup orders never had a courier on the way out either). */
export type ReturnMethod = 'courier_pickup' | 'store_dropoff';

/** What the customer asked for when requesting the return - the admin resolves toward this. */
export type ReturnResolution = 'refund' | 'replacement';

export interface ReturnItem {
  productId: string;
  productName: string;
  qty: number;
}

export interface OrderReturn {
  _id: string;
  orderId: string;
  customerId: string;
  customerName?: string;
  customerEmail?: string;
  reason: string;
  items: ReturnItem[];
  refundAmount: number;
  status: ReturnStatus;
  returnMethod: ReturnMethod;
  desiredResolution: ReturnResolution;
  pickupAddress?: OrderAddress;
  replacementOrderId?: string;
  stripeRefundId?: string;
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

export type ReviewStatus = 'pending' | 'published' | 'hidden';

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
  status?: ReviewStatus;
  createdAt: string;
  updatedAt: string;
}

export interface AdminReview extends Review {
  productName: string;
}

export interface ReviewBan {
  _id: string;
  productId: string;
  productName: string;
  userId: string;
  userName: string;
  bannedBy: string;
  createdAt: string;
}

export interface ErrorReport {
  _id: string;
  source: 'backend' | 'frontend';
  name?: string;
  message: string;
  stack?: string;
  severity: 'error' | 'fatal';
  route?: string;
  method?: string;
  statusCode?: number;
  userId?: string;
  userEmail?: string;
  posthogDistinctId?: string;
  posthogSessionId?: string;
  userAgent?: string;
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

export type NotificationType =
  | 'order_paid'
  | 'order_shipped'
  | 'order_status'
  | 'new_order'
  | 'low_stock'
  | 'new_review'
  | 'return_requested'
  | 'return_status'
  | 'broadcast';

/** A real-time notification (HU-061) as delivered by the REST inbox and the WebSocket channel. */
export interface AppNotification {
  id: string;
  type: NotificationType;
  audience: 'user' | 'admin' | 'all';
  title: string;
  body: string;
  link: string | null;
  data: Record<string, unknown>;
  read: boolean;
  createdAt: string;
}

export interface NotificationInbox {
  notifications: AppNotification[];
  unread: number;
}
