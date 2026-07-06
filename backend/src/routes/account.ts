import { Hono } from 'hono';
import { z } from 'zod';
import { clerkAuth } from '../middleware/clerkAuth';
import type { AppEnv } from '../types/hono';
import { User } from '../db/models/User';
import { parseJson, savedAddressSchema } from '../lib/validation';

const addressesPayloadSchema = z.object({
  addresses: z.array(savedAddressSchema).max(20).default([]),
});

type Address = z.infer<typeof savedAddressSchema>;

function normalizeAddresses(addresses: Address[]) {
  const sanitized = addresses
    .map((address) => ({
      label: address.label?.trim() || '',
      name: address.name.trim(),
      phone: address.phone.trim(),
      address: address.address.trim(),
      city: address.city.trim(),
      postal: address.postal.trim(),
      isDefault: Boolean(address.isDefault),
    }))
    .filter((address) => address.name && address.phone && address.address && address.city && address.postal);

  const defaultIndex = sanitized.findIndex((address) => address.isDefault);
  const nextAddresses = sanitized.map((address, index) => ({ ...address, isDefault: index === defaultIndex }));

  if (nextAddresses.length > 0 && defaultIndex === -1) {
    nextAddresses[0].isDefault = true;
  }

  return nextAddresses;
}

export const accountRouter = new Hono<AppEnv>()
  .use('*', clerkAuth)
  .get('/addresses', async (c) => {
    const currentUser = await User.findOne({ clerkId: c.get('user').clerkId }).select('addresses').lean();
    return c.json(currentUser?.addresses || []);
  })
  .put('/addresses', async (c) => {
    const parsed = await parseJson(c, addressesPayloadSchema);
    if (!parsed.success) return parsed.response;

    const addresses = normalizeAddresses(parsed.data.addresses);

    const updatedUser = await User.findOneAndUpdate(
      { clerkId: c.get('user').clerkId },
      { $set: { addresses } },
      { returnDocument: 'after' }
    ).select('addresses').lean();

    if (!updatedUser) {
      return c.json({ error: 'User not found' }, 404);
    }

    return c.json(updatedUser.addresses || []);
  });
