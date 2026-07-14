import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { Product } from '../../db/models/Product';
import { getWishlistForUserLookup } from '../../lib/wishlist';
import { emailField, textField } from '../../lib/validation';
import { errorResult, jsonResult } from '../toolHelpers';

export function registerWishlistTools(server: McpServer) {
  server.registerTool(
    'wishlist.getUserWishlist',
    {
      title: 'Wishlist de un usuario',
      description:
        'Lista los productos guardados en la wishlist de un usuario (email o customerId/clerkId). Equivalente a la página Mi wishlist del cliente (HU-044).',
      inputSchema: {
        email: emailField().optional(),
        customerId: textField(120).optional(),
      },
    },
    async ({ email, customerId }) => {
      if (!email && !customerId) return errorResult('Debe indicar email o customerId.');

      const result = await getWishlistForUserLookup({ email, customerId });
      if (!result) return errorResult('Usuario no encontrado.');

      const products = await Product.find({ id: { $in: result.productIds }, active: true })
        .select('id name brand category price imageUrl')
        .lean();

      const productMap = new Map(products.map((p) => [p.id, p]));
      const items = result.productIds
        .map((id) => productMap.get(id))
        .filter(Boolean);

      return jsonResult({
        customerId: result.clerkId,
        email: result.email,
        count: result.productIds.length,
        productIds: result.productIds,
        products: items,
      });
    },
  );
}
