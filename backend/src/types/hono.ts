export interface AuthUser {
  clerkId: string;
  role: string;
  name?: string;
  email?: string;
  imageUrl?: string;
  _id?: unknown;
}

/** Cart line as stored in MongoDB and sent in PUT /cart body */
export interface CartItem {
  productId: string;
  qty: number;
  /** Selected variant/combo id (HU-035) - "primary:size" format for a combo, plain id otherwise. */
  variantId?: string;
}

export interface CartRequestBody {
  items?: CartItem[];
}

/** Cart line returned to the client with populated product */
export interface CartResponseItem {
  product: Record<string, unknown>;
  qty: number;
  variantId?: string;
}

export interface AppEnv {
  Variables: {
    user: AuthUser;
    requestId: string;
  };
}
