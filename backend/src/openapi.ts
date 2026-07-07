export const openApiDocument = {
  openapi: "3.0.3",
  info: {
    title: "Healthora API",
    version: "1.0.0",
    description:
      "API REST del e-commerce Healthora. Autenticación con Bearer JWT de Clerk en rutas protegidas.",
  },
  servers: [
    { url: "http://localhost:3002", description: "Desarrollo local" },
    { url: "/api", description: "Proxy Vite (frontend en :5173)" },
  ],
  tags: [
    { name: "Health", description: "Estado del servidor" },
    { name: "Products", description: "Catálogo público" },
    { name: "Categories", description: "Categorías" },
    { name: "Cart", description: "Carrito (auth)" },
    { name: "Checkout", description: "Pago Stripe (auth)" },
    { name: "Orders", description: "Órdenes del cliente (auth)" },
    { name: "Account", description: "Cuenta del cliente (auth)" },
    { name: "Reviews", description: "Reseñas de productos" },
    { name: "Newsletter", description: "Suscripción pública" },
    { name: "Webhooks", description: "Integraciones externas" },
    { name: "Admin", description: "Panel administrador (auth + rol admin)" },
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: "http",
        scheme: "bearer",
        bearerFormat: "JWT",
        description: "Token de sesión de Clerk",
      },
    },
    schemas: {
      Error: {
        type: "object",
        properties: { error: { type: "string" } },
      },
      Product: {
        type: "object",
        properties: {
          id: { type: "string" },
          name: { type: "string" },
          brand: { type: "string" },
          category: { type: "string" },
          price: { type: "number" },
          stock: { type: "integer" },
          rating: { type: "number" },
          reviews: { type: "integer" },
          active: { type: "boolean" },
        },
      },
      CartItemInput: {
        type: "object",
        required: ["productId", "qty"],
        properties: {
          productId: { type: "string" },
          qty: { type: "integer", minimum: 1 },
        },
      },
      CartItemResponse: {
        type: "object",
        properties: {
          product: { $ref: "#/components/schemas/Product" },
          qty: { type: "integer" },
        },
      },
      OrderAddress: {
        type: "object",
        properties: {
          name: { type: "string" },
          phone: { type: "string" },
          address: { type: "string" },
          city: { type: "string" },
          postal: { type: "string" },
        },
      },
    },
  },
  paths: {
    "/health": {
      get: {
        tags: ["Health"],
        summary: "Estado del servidor",
        responses: {
          "200": {
            description: "OK",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: { status: { type: "string", example: "ok" } },
                },
              },
            },
          },
        },
      },
    },
    "/products": {
      get: {
        tags: ["Products"],
        summary: "Listar productos activos",
        parameters: [
          { name: "category", in: "query", schema: { type: "string" } },
          { name: "need", in: "query", schema: { type: "string" } },
          { name: "brand", in: "query", schema: { type: "string" } },
          { name: "search", in: "query", schema: { type: "string" }, description: "Búsqueda en nombre, marca, categoría, short y need" },
          { name: "priceMax", in: "query", schema: { type: "number" } },
          { name: "inStock", in: "query", schema: { type: "string", enum: ["1"] } },
          { name: "sort", in: "query", schema: { type: "string", enum: ["price_asc", "price_desc", "rating"] } },
        ],
        responses: {
          "200": {
            description: "Lista de productos",
            content: {
              "application/json": {
                schema: { type: "array", items: { $ref: "#/components/schemas/Product" } },
              },
            },
          },
        },
      },
    },
    "/products/count": {
      get: {
        tags: ["Products"],
        summary: "Contar productos activos",
        responses: {
          "200": {
            description: "Total",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: { count: { type: "integer" } },
                },
              },
            },
          },
        },
      },
    },
    "/products/{id}": {
      get: {
        tags: ["Products"],
        summary: "Detalle de producto",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        responses: {
          "200": { description: "Producto", content: { "application/json": { schema: { $ref: "#/components/schemas/Product" } } } },
          "404": { description: "No encontrado", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
        },
      },
    },
    "/categories": {
      get: {
        tags: ["Categories"],
        summary: "Listar categorías",
        responses: { "200": { description: "Lista de categorías" } },
      },
    },
    "/cart": {
      get: {
        tags: ["Cart"],
        summary: "Obtener carrito del usuario",
        security: [{ bearerAuth: [] }],
        responses: {
          "200": {
            description: "Items con producto hidratado",
            content: {
              "application/json": {
                schema: { type: "array", items: { $ref: "#/components/schemas/CartItemResponse" } },
              },
            },
          },
        },
      },
      put: {
        tags: ["Cart"],
        summary: "Guardar carrito",
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  items: { type: "array", items: { $ref: "#/components/schemas/CartItemInput" } },
                },
              },
            },
          },
        },
        responses: { "200": { description: "Carrito actualizado" }, "404": { description: "Usuario no encontrado" } },
      },
    },
    "/checkout/session": {
      post: {
        tags: ["Checkout"],
        summary: "Crear sesión de pago Stripe",
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["items", "address"],
                properties: {
                  items: { type: "array", items: { $ref: "#/components/schemas/CartItemInput" } },
                  address: { $ref: "#/components/schemas/OrderAddress" },
                  promoCode: { type: "string" },
                  freeSampleId: { type: "string" },
                },
              },
            },
          },
        },
        responses: {
          "200": {
            description: "URL de checkout",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: { url: { type: "string" } },
                },
              },
            },
          },
        },
      },
    },
    "/orders": {
      get: {
        tags: ["Orders"],
        summary: "Listar órdenes del usuario",
        security: [{ bearerAuth: [] }],
        parameters: [{ name: "stripeSessionId", in: "query", schema: { type: "string" } }],
        responses: { "200": { description: "Lista de órdenes" } },
      },
    },
    "/orders/{id}": {
      get: {
        tags: ["Orders"],
        summary: "Detalle de orden",
        security: [{ bearerAuth: [] }],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        responses: { "200": { description: "Orden" }, "404": { description: "No encontrada" } },
      },
    },
    "/orders/{id}/cancel": {
      patch: {
        tags: ["Orders"],
        summary: "Cancelar orden",
        security: [{ bearerAuth: [] }],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        responses: { "200": { description: "Orden cancelada" } },
      },
    },
    "/orders/{id}/address": {
      patch: {
        tags: ["Orders"],
        summary: "Actualizar dirección de envío",
        security: [{ bearerAuth: [] }],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        requestBody: {
          content: { "application/json": { schema: { $ref: "#/components/schemas/OrderAddress" } } },
        },
        responses: { "200": { description: "Orden actualizada" } },
      },
    },
    "/account/addresses": {
      get: {
        tags: ["Account"],
        summary: "Listar direcciones guardadas",
        security: [{ bearerAuth: [] }],
        responses: { "200": { description: "Direcciones" } },
      },
      put: {
        tags: ["Account"],
        summary: "Guardar direcciones",
        security: [{ bearerAuth: [] }],
        responses: { "200": { description: "Direcciones guardadas" } },
      },
    },
    "/reviews/stats": {
      get: {
        tags: ["Reviews"],
        summary: "Estadísticas globales de reseñas",
        responses: { "200": { description: "{ total, avgRating }" } },
      },
    },
    "/reviews": {
      get: {
        tags: ["Reviews"],
        summary: "Reseñas de un producto",
        parameters: [{ name: "productId", in: "query", required: true, schema: { type: "string" } }],
        responses: { "200": { description: "Lista de reseñas" }, "400": { description: "productId requerido" } },
      },
      post: {
        tags: ["Reviews"],
        summary: "Crear reseña",
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["productId", "rating", "body"],
                properties: {
                  productId: { type: "string" },
                  rating: { type: "integer", minimum: 1, maximum: 5 },
                  title: { type: "string" },
                  body: { type: "string" },
                },
              },
            },
          },
        },
        responses: { "201": { description: "Reseña creada" }, "409": { description: "Ya existe reseña" } },
      },
    },
    "/reviews/{id}/helpful": {
      patch: {
        tags: ["Reviews"],
        summary: "Marcar reseña como útil",
        security: [{ bearerAuth: [] }],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        responses: { "200": { description: "Reseña actualizada" } },
      },
    },
    "/newsletter/subscribe": {
      post: {
        tags: ["Newsletter"],
        summary: "Suscribir email al newsletter",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["email"],
                properties: { email: { type: "string", format: "email" } },
              },
            },
          },
        },
        responses: { "200": { description: "Suscripción exitosa" } },
      },
    },
    "/webhooks/stripe": {
      post: {
        tags: ["Webhooks"],
        summary: "Webhook de Stripe (checkout.session.completed)",
        responses: { "200": { description: "Evento procesado" } },
      },
    },
    "/admin/access": {
      get: {
        tags: ["Admin"],
        summary: "Validar acceso admin",
        security: [{ bearerAuth: [] }],
        responses: { "200": { description: "{ allowed: boolean }" } },
      },
    },
    "/admin/dashboard": {
      get: {
        tags: ["Admin"],
        summary: "KPIs y métricas del dashboard",
        security: [{ bearerAuth: [] }],
        responses: { "200": { description: "Datos del dashboard" } },
      },
    },
    "/admin/orders": {
      get: {
        tags: ["Admin"],
        summary: "Listar órdenes (admin)",
        security: [{ bearerAuth: [] }],
        parameters: [{ name: "fulfillmentStatus", in: "query", schema: { type: "string" } }],
        responses: { "200": { description: "Órdenes" } },
      },
    },
    "/admin/orders/{id}/statuses": {
      patch: {
        tags: ["Admin"],
        summary: "Actualizar estados de pago/envío",
        security: [{ bearerAuth: [] }],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        responses: { "200": { description: "Orden actualizada" } },
      },
    },
    "/admin/products": {
      get: {
        tags: ["Admin"],
        summary: "Listar productos (admin)",
        security: [{ bearerAuth: [] }],
        responses: { "200": { description: "Productos" } },
      },
      post: {
        tags: ["Admin"],
        summary: "Crear producto",
        security: [{ bearerAuth: [] }],
        responses: { "201": { description: "Producto creado" } },
      },
      delete: {
        tags: ["Admin"],
        summary: "Eliminar múltiples productos",
        security: [{ bearerAuth: [] }],
        responses: { "200": { description: "Eliminados" } },
      },
    },
    "/admin/products/{id}": {
      put: {
        tags: ["Admin"],
        summary: "Actualizar producto",
        security: [{ bearerAuth: [] }],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        responses: { "200": { description: "Producto actualizado" } },
      },
      delete: {
        tags: ["Admin"],
        summary: "Eliminar producto",
        security: [{ bearerAuth: [] }],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        responses: { "200": { description: "Eliminado" } },
      },
    },
    "/admin/users": {
      get: {
        tags: ["Admin"],
        summary: "Listar usuarios",
        security: [{ bearerAuth: [] }],
        responses: { "200": { description: "Usuarios" } },
      },
    },
    "/admin/users/{id}/role": {
      patch: {
        tags: ["Admin"],
        summary: "Cambiar rol de usuario",
        security: [{ bearerAuth: [] }],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        responses: { "200": { description: "Rol actualizado" } },
      },
    },
    "/admin/users/{id}": {
      delete: {
        tags: ["Admin"],
        summary: "Eliminar usuario",
        security: [{ bearerAuth: [] }],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        responses: { "200": { description: "Eliminado" } },
      },
    },
    "/admin/sales": {
      get: {
        tags: ["Admin"],
        summary: "Top ventas por producto/marca/categoría",
        security: [{ bearerAuth: [] }],
        responses: { "200": { description: "Estadísticas de ventas" } },
      },
    },
    "/admin/earnings": {
      get: {
        tags: ["Admin"],
        summary: "Ingresos mensuales",
        security: [{ bearerAuth: [] }],
        responses: { "200": { description: "Desglose de earnings" } },
      },
    },
  },
} as const;
