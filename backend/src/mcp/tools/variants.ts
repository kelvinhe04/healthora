import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { Product } from '../../db/models/Product';
import { productIdSchema, textField } from '../../lib/validation';
import { saveImageFile } from '../../lib/imageStorage';
import { errorResult, jsonResult } from '../toolHelpers';
import { mcpVariantShape } from '../shapes';

export function registerVariantTools(server: McpServer) {
  server.registerTool(
    'variants.upsertVariant',
    {
      title: 'Crear o actualizar variante',
      description:
        'Agrega o actualiza una variante (sabor, aroma, color, tamaño, etc.) dentro de un producto existente, identificada por su id. Requiere rol Admin. Equivalente al editor "Variante simple" / "Variante x Tamaño" del admin (HU-032).',
      inputSchema: {
        productId: productIdSchema,
        variant: mcpVariantShape,
      },
    },
    async ({ productId, variant }) => {
      const product = await Product.findOne({ id: productId });
      if (!product) return errorResult(`Producto "${productId}" no encontrado.`);

      const variants = product.variants ?? [];
      const idx = variants.findIndex((v) => v.id === variant.id);
      if (idx >= 0) {
        Object.assign(variants[idx], variant);
      } else {
        variants.push(variant);
      }
      product.variants = variants;
      product.markModified('variants');
      await product.save();

      return jsonResult({ productId, variantId: variant.id, created: idx < 0 });
    },
  );

  server.registerTool(
    'variants.updateVariantStock',
    {
      title: 'Ajustar el stock de una variante',
      description:
        'Fija el stock (valor absoluto) de una combinación sabor/color x tamaño o de una variante simple. Para un combo usa variantId con formato "primarioId:tamañoId" (ej. "chocolate:5lb"); para una variante simple, solo su id. Requiere rol Admin (HU-034).',
      inputSchema: {
        productId: productIdSchema,
        variantId: textField(200),
        stock: z.coerce.number().int().min(0).max(999999),
      },
    },
    async ({ productId, variantId, stock }) => {
      const product = await Product.findOne({ id: productId });
      if (!product) return errorResult(`Producto "${productId}" no encontrado.`);

      if (variantId.includes(':')) {
        const [primaryId, sizeId] = variantId.split(':');
        const primary = product.variants?.find((v) => v.id === primaryId);
        if (!primary) return errorResult(`Combinación "${variantId}" no encontrada en "${productId}".`);
        primary.stockBySize = { ...(primary.stockBySize ?? {}), [sizeId]: stock };
        product.markModified('variants');
      } else {
        const variant = product.variants?.find((v) => v.id === variantId);
        if (!variant) return errorResult(`Variante "${variantId}" no encontrada en "${productId}".`);
        variant.stock = stock;
      }

      await product.save();
      return jsonResult({ productId, variantId, stock });
    },
  );

  server.registerTool(
    'variants.uploadVariantImage',
    {
      title: 'Subir imagen de una variante',
      description:
        'Sube una imagen (JPEG/PNG/WEBP, maximo 5MB) codificada en base64 y la asigna a una variante existente del producto. Requiere rol Admin.',
      inputSchema: {
        productId: productIdSchema,
        variantId: textField(200),
        imageBase64: z.string().min(1).max(10_000_000),
        mimeType: z.enum(['image/jpeg', 'image/png', 'image/webp']),
        setAsPrimary: z.coerce.boolean().default(true),
      },
    },
    async ({ productId, variantId, imageBase64, mimeType, setAsPrimary }) => {
      const product = await Product.findOne({ id: productId });
      if (!product) return errorResult(`Producto "${productId}" no encontrado.`);

      const variant = product.variants?.find((v) => v.id === variantId);
      if (!variant) return errorResult(`Variante "${variantId}" no encontrada en "${productId}".`);

      let buffer: Buffer;
      try {
        buffer = Buffer.from(imageBase64, 'base64');
      } catch {
        return errorResult('imageBase64 invalido.');
      }
      if (buffer.length === 0) return errorResult('imageBase64 invalido.');

      let url: string;
      try {
        url = await saveImageFile(buffer, mimeType, productId);
      } catch (err) {
        return errorResult(err instanceof Error ? err.message : 'Error al subir imagen.');
      }

      const existingImages = variant.images ?? [];
      variant.images = setAsPrimary
        ? [url, ...existingImages.filter((img) => img !== url)].slice(0, 20)
        : [...existingImages, url].slice(0, 20);
      if (setAsPrimary || !variant.imageUrl) variant.imageUrl = url;

      product.markModified('variants');
      await product.save();

      return jsonResult({ productId, variantId, url });
    },
  );
}
