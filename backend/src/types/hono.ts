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
}

export interface CartRequestBody {
  items?: CartItem[];
}

/** Cart line returned to the client with populated product */
export interface CartResponseItem {
  product: Record<string, unknown>;
  qty: number;
}

export interface AppEnv {
  Variables: {
    user: AuthUser;
  };
}
