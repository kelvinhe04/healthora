import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { Product } from '../../db/models/Product';
import { escapeRegex, moneyFromInput, optionalTextField, productIdSchema, textField } from '../../lib/validation';
import { errorResult, jsonResult } from '../toolHelpers';
import { mcpVariantShape } from '../shapes';

export function registerCatalogTools(server: McpServer) {
  server.registerTool(
    'catalog.listProducts',
    {
      title: 'Listar catálogo',
      description:
        'Consulta y filtra el catálogo de productos por categoría, marca, stock o texto libre. Equivalente a la vista "Gestión de productos" del admin (HU-001 / HU-016).',
      inputSchema: {
        category: textField(120).optional(),
        brand: textField(120).optional(),
        inStock: z.boolean().optional().describe('Si es true, solo productos con stock > 0'),
        includeInactive: z.boolean().optional().default(false).describe('Incluir productos desactivados'),
        search: textField(120).optional().describe('Busca en nombre, marca y categoría'),
        limit: z.number().int().min(1).max(100).optional().default(20),
      },
    },
    async ({ category, brand, inStock, includeInactive, search, limit }) => {
      const filter: Record<string, unknown> = includeInactive ? {} : { active: true };
      if (category) filter.category = category;
      if (brand) filter.brand = brand;
      if (inStock) filter.stock = { $gt: 0 };
      if (search?.trim()) {
        const term = escapeRegex(search.trim());
        filter.$or = [
          { name: { $regex: term, $options: 'i' } },
          { brand: { $regex: term, $options: 'i' } },
          { category: { $regex: term, $options: 'i' } },
        ];
      }

      const products = await Product.find(filter)
        .select('id name brand category price stock active rating reviews variants')
        .sort({ sortOrder: 1 })
        .limit(limit)
        .lean();

      return jsonResult({
        count: products.length,
        products: products.map((p) => ({
          id: p.id,
          name: p.name,
          brand: p.brand,
          category: p.category,
          price: p.price,
          stock: p.stock,
          active: p.active,
          rating: p.rating,
          reviews: p.reviews,
          combinations: p.variants?.length ?? 0,
        })),
      });
    },
  );

  server.registerTool(
    'catalog.upsertProduct',
    {
      title: 'Crear o actualizar producto',
      description:
        'Crea un producto nuevo (si el id no existe) o actualiza campos de uno existente. Para crear, name/brand/category/price son obligatorios. Requiere rol Admin. Equivalente al modal "Editar producto" del admin (HU-016).',
      inputSchema: {
        id: productIdSchema,
        name: textField(220).optional(),
        brand: textField(140).optional(),
        category: textField(120).optional(),
        price: moneyFromInput().optional(),
        priceBefore: moneyFromInput().optional(),
        stock: z.coerce.number().int().min(0).max(999999).optional(),
        short: optionalTextField(500),
        imageUrl: optionalTextField(400),
        active: z.boolean().optional(),
        variants: z.array(mcpVariantShape).max(100).optional(),
      },
    },
    async ({ id, ...rest }) => {
      const existing = await Product.findOne({ id }).lean();
      if (!existing && (!rest.name || !rest.brand || !rest.category || rest.price === undefined)) {
        return errorResult('Para crear un producto nuevo se requieren name, brand, category y price.');
      }

      const update: Record<string, unknown> = { id };
      for (const [key, value] of Object.entries(rest)) {
        if (value !== undefined) update[key] = value;
      }

      const product = await Product.findOneAndUpdate(
        { id },
        { $set: update },
        { upsert: true, new: true, setDefaultsOnInsert: true },
      ).lean();

      return jsonResult({ created: !existing, product });
    },
  );
}
