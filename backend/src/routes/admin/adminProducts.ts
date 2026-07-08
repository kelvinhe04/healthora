import { Hono } from "hono";
import { z } from "zod";
import { requireAdmin } from "../../middleware/requireAdmin";
import type { AppEnv } from "../../types/hono";
import { Product } from "../../db/models/Product";
import { Category } from "../../db/models/Category";
import { recalculateNew } from "../../lib/bestsellers";
import {
  moneyFromInput,
  objectIdSchema,
  optionalTextField,
  parseJson,
  parseParams,
  productIdSchema,
  textField,
} from "../../lib/validation";

const productImageSchema = z.object({
  url: textField(400),
  alt: optionalTextField(180),
  isPrimary: z.coerce.boolean().default(false),
});

const faqSchema = z.object({
  q: textField(300),
  a: textField(2000),
});

const extraTabSchema = z.object({
  id: productIdSchema,
  label: textField(120),
  content: textField(4000),
});

const productVariantSchema = z.object({
  id: productIdSchema,
  label: textField(160),
  type: z.enum(["size", "color", "weight", "count", "flavor", "scent"]),
  price: moneyFromInput(),
  priceBefore: moneyFromInput().optional(),
  stock: z.coerce.number().int().min(0).max(999999),
  sku: optionalTextField(120),
  color: optionalTextField(80),
  imageUrl: optionalTextField(400),
  images: z.array(textField(400)).max(20).optional(),
  imagesBySize: z.record(z.string(), z.array(textField(400)).max(20)).optional(),
  stockBySize: z.record(z.string(), z.coerce.number().int().min(0).max(999999)).optional(),
  priceBySize: z.record(z.string(), moneyFromInput()).optional(),
  isDefault: z.coerce.boolean().default(false),
  availableFor: z.array(productIdSchema).max(50).optional(),
});

const stockSchema = z.coerce.number().int().min(0).max(999999);
const sortOrderSchema = z.coerce.number().int().min(-999999).max(999999);

const productPayloadSchema = z.object({
  id: productIdSchema,
  name: textField(220),
  brand: textField(140),
  category: textField(120),
  need: optionalTextField(120),
  price: moneyFromInput(),
  priceBefore: moneyFromInput().optional(),
  tag: optionalTextField(80),
  rating: moneyFromInput(0, 5).optional(),
  reviews: z.coerce.number().int().min(0).max(999999).optional(),
  short: optionalTextField(500),
  benefits: z.array(textField(220)).max(30).optional(),
  usage: optionalTextField(4000),
  ingredients: optionalTextField(4000),
  warnings: optionalTextField(4000),
  nutritionFacts: optionalTextField(4000),
  certifications: z.array(textField(160)).max(30).optional(),
  interactions: optionalTextField(4000),
  faq: z.array(faqSchema).max(50).optional(),
  shadeTips: optionalTextField(4000),
  applicationTips: optionalTextField(4000),
  formulaDetails: optionalTextField(4000),
  skinTypes: z.array(textField(120)).max(30).optional(),
  stock: stockSchema.default(0),
  color: optionalTextField(80),
  swatchColor: optionalTextField(80),
  label: optionalTextField(120),
  imageUrl: optionalTextField(400),
  images: z.array(productImageSchema).max(30).optional(),
  extraTabs: z.array(extraTabSchema).max(20).optional(),
  variants: z.array(productVariantSchema).max(100).optional(),
  active: z.coerce.boolean().default(true),
  sortOrder: sortOrderSchema.default(0),
});

const productUpdateSchema = productPayloadSchema
  .extend({
    stock: stockSchema.optional(),
    active: z.coerce.boolean().optional(),
    sortOrder: sortOrderSchema.optional(),
  })
  .partial()
  .refine((body) => Object.keys(body).length > 0, {
    message: "Debe enviar al menos un campo para actualizar",
  });

const mongoIdParamsSchema = z.object({
  id: objectIdSchema,
});

export const adminProductsRouter = new Hono<AppEnv>()
  .use("*", requireAdmin)
  .get("/count", async (c) => c.json({ count: await Product.countDocuments() }))
  .get("/", async (c) => c.json(await Product.find().sort({ createdAt: -1 }).lean()))
  .post("/", async (c) => {
    try {
      const parsed = await parseJson(c, productPayloadSchema);
      if (!parsed.success) return parsed.response;

      const product = await Product.create(parsed.data);
      recalculateNew().catch((e) => console.error('[new-products] recalc error:', e));
      return c.json(product.toObject(), 201);
    } catch (error: unknown) {
      if (
        typeof error === "object" &&
        error &&
        "code" in error &&
        error.code === 11000
      ) {
        return c.json(
          { error: "Ya existe un producto con ese nombre o id." },
          409,
        );
      }
      return c.json(
        { error: error instanceof Error ? error.message : "Error" },
        400,
      );
    }
  })
  .put("/:id", async (c) => {
    try {
      const parsedParams = parseParams(c, mongoIdParamsSchema);
      if (!parsedParams.success) return parsedParams.response;

      const parsedBody = await parseJson(c, productUpdateSchema);
      if (!parsedBody.success) return parsedBody.response;

      const product = await Product.findByIdAndUpdate(parsedParams.data.id, parsedBody.data, {
        returnDocument: "after",
      }).lean();
      if (!product) return c.json({ error: "Not found" }, 404);
      return c.json(product);
    } catch (error: unknown) {
      if (
        typeof error === "object" &&
        error &&
        "code" in error &&
        error.code === 11000
      ) {
        return c.json(
          { error: "Ya existe un producto con ese nombre o id." },
          409,
        );
      }
      return c.json(
        { error: error instanceof Error ? error.message : "Error" },
        400,
      );
    }
  })
  .delete("/:id", async (c) => {
    const parsedParams = parseParams(c, mongoIdParamsSchema);
    if (!parsedParams.success) return parsedParams.response;

    await Product.findByIdAndDelete(parsedParams.data.id);
    recalculateNew().catch((e) => console.error('[new-products] recalc error:', e));
    return c.body(null, 204);
  })
  .delete("/", async (c) => {
    const result = await Product.deleteMany({});
    const CATEGORIES = [
      {
        id: "Vitaminas",
        label: "Vitaminas",
        sub: "Nutricion diaria",
        color: "oklch(0.92 0.04 75)",
      },
      {
        id: "Cuidado personal",
        label: "Cuidado personal",
        sub: "Rutina esencial",
        color: "oklch(0.92 0.02 200)",
      },
      {
        id: "Cuidado del bebé",
        label: "Cuidado del bebé",
        sub: "Delicado y seguro",
        color: "oklch(0.95 0.02 85)",
      },
      {
        id: "Suplementos",
        label: "Suplementos",
        sub: "Rendimiento total",
        color: "oklch(0.9 0.04 140)",
      },
      {
        id: "Salud de la piel",
        label: "Salud de la piel",
        sub: "Rutina avanzada",
        color: "oklch(0.93 0.03 45)",
      },
      {
        id: "Fitness",
        label: "Fitness",
        sub: "Energia y recuperacion",
        color: "oklch(0.9 0.05 115)",
      },
      {
        id: "Medicamentos",
        label: "Medicamentos",
        sub: "Botiquin de casa",
        color: "oklch(0.93 0.02 200)",
      },
      {
        id: "Hidratantes",
        label: "Hidratantes",
        sub: "Barrera reforzada",
        color: "oklch(0.95 0.015 85)",
      },
      {
        id: "Fragancias",
        label: "Fragancias",
        sub: "Aromas limpios",
        color: "oklch(0.9 0.04 140)",
      },
      {
        id: "Maquillaje",
        label: "Maquillaje",
        sub: "Toque natural",
        color: "oklch(0.9 0.04 25)",
      },
    ];
    await Category.deleteMany({});
    await Category.insertMany(CATEGORIES);
    return c.json({
      deletedCount: result.deletedCount,
      categoriesCount: CATEGORIES.length,
    });
  });
