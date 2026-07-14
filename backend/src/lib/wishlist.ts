import { User } from '../db/models/User';
import { Product } from '../db/models/Product';

const MAX_WISHLIST_ITEMS = 200;

export async function normalizeWishlistProductIds(productIds: string[]): Promise<string[]> {
  const unique = [...new Set(productIds.map((id) => id.trim()).filter(Boolean))].slice(0, MAX_WISHLIST_ITEMS);
  if (unique.length === 0) return [];

  const active = await Product.find({ id: { $in: unique }, active: true }).select('id').lean();
  const activeIds = new Set(active.map((p) => p.id));
  return unique.filter((id) => activeIds.has(id));
}

export async function getWishlistForClerkId(clerkId: string): Promise<string[]> {
  const user = await User.findOne({ clerkId }).select('wishlist').lean();
  return (user?.wishlist ?? []) as string[];
}

export async function setWishlistForClerkId(clerkId: string, productIds: string[]): Promise<string[]> {
  const normalized = await normalizeWishlistProductIds(productIds);
  const updated = await User.findOneAndUpdate(
    { clerkId },
    { $set: { wishlist: normalized } },
    { returnDocument: 'after' },
  ).lean();
  if (!updated) throw new Error('User not found');
  return (updated.wishlist ?? []) as string[];
}

export async function getWishlistForUserLookup(opts: {
  email?: string;
  customerId?: string;
}): Promise<{ clerkId: string; email?: string; productIds: string[] } | null> {
  const filter: Record<string, string> = {};
  if (opts.customerId?.trim()) filter.clerkId = opts.customerId.trim();
  else if (opts.email?.trim()) filter.email = opts.email.trim().toLowerCase();
  else return null;

  const user = await User.findOne(filter).select('clerkId email wishlist').lean();
  if (!user) return null;
  return {
    clerkId: user.clerkId,
    email: user.email ?? undefined,
    productIds: (user.wishlist ?? []) as string[],
  };
}
