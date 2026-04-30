import { Hono } from "hono";
import { requireAdmin } from "../../middleware/requireAdmin";
import type { AppEnv } from "../../types/hono";
import { Product } from "../../db/models/Product";
import { Category } from "../../db/models/Category";

export const adminProductsRouter = new Hono<AppEnv>()
  .use("*", requireAdmin)
  .get("/count", async (c) => c.json({ count: await Product.countDocuments() }))
  .get("/", async (c) => c.json(await Product.find().lean()))
  .post("/", async (c) => {
    try {
      const body = await c.req.json<object>();
      const product = await Product.create(body);
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
      const body = await c.req.json<object>();
      const product = await Product.findByIdAndUpdate(c.req.param("id"), body, {
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
    await Product.findByIdAndDelete(c.req.param("id"));
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
