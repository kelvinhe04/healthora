# Product Variants — Implementación

Rama: `feat/product-variants`

---

## Qué se implementó

Sistema de variantes de producto de punta a punta. Cuando un producto tiene variantes, el usuario las elige en el detalle de producto antes de agregar al carrito. El precio, stock y botón se actualizan en tiempo real según la variante seleccionada.

---

## Tipos de variante soportados

| Tipo | Uso | UI |
|---|---|---|
| `color` | Tonos de maquillaje | Swatches circulares con color hex real |
| `size` | Fragancias (ml), cremas (oz/ml) | Botones pill |
| `count` | Vitaminas (30ct, 90ct, 200ct) | Botones pill |
| `flavor` | Proteínas, pre-workouts, BCAAs | Botones pill |
| `weight` | Creatina, proteínas a granel | Botones pill |
| `scent` | Desodorantes, jabones | Botones pill |

**Comportamiento de la UI:**
- La variante marcada como `isDefault: true` se pre-selecciona al abrir el producto
- El precio, el stock y el contador de cantidad reaccionan inmediatamente al cambiar de variante
- Variantes sin stock aparecen tachadas y deshabilitadas
- Variantes de color muestran el nombre en tooltip (hover) y en la etiqueta superior al seleccionar

---

## Archivos modificados

### Frontend

**`frontend/src/types/index.ts`**
- Nueva interfaz `ProductVariant`:
  ```ts
  interface ProductVariant {
    id: string
    label: string
    type: 'size' | 'color' | 'weight' | 'count' | 'flavor' | 'scent'
    price: number
    priceBefore?: number
    stock: number
    sku?: string
    color?: string      // hex, solo para type: 'color'
    isDefault?: boolean
  }
  ```
- Campo `variants?: ProductVariant[]` agregado a `Product`
- Campo `variant?: ProductVariant` agregado a `CartItem`

**`frontend/src/pages/ProductDetail.tsx`**
- Estado `selectedVariant` inicializado con la variante `isDefault` (o la primera)
- Se resetea al cambiar de producto (`useEffect` en `product.id`)
- Variables reactivas: `effectivePrice`, `effectivePriceBefore`, `effectiveStock`
- Bloque de selector de variantes insertado entre la descripción corta y el precio:
  - `type === 'color'` → swatches circulares 34×34px con outline al seleccionar
  - otros tipos → botones pill con fondo negro al seleccionar
- `onAdd` y `onBuyNow` pasan la variante seleccionada

**`frontend/src/store/cartStore.ts`**
- `add(product, qty?, variant?)` — unicidad por `productId + variantId`
- `update(productId, qty, variantId?)` — actualiza el item correcto
- `remove(productId, variantId?)` — elimina el item correcto
- `subtotal()` usa `variant?.price ?? product.price`
- Helper interno `itemKey()` exportado

**`frontend/src/pages/CartDrawer.tsx`**
- `key` del item es `productId + variantId` para soportar mismo producto con distintas variantes
- Muestra label de variante debajo del nombre (con dot de color si `type === 'color'`)
- Precio por item usa precio de variante
- Subtotal usa precio de variante
- `update` y `remove` pasan `variant?.id`

**`frontend/src/pages/Checkout.tsx`**
- Subtotal usa `variant?.price ?? product.price`

**`frontend/src/App.tsx`**
- Callbacks `onAdd` y `onBuyNow` en `ProductDetail` propagan la variante al store y a `checkoutItems`

---

### Backend

**`backend/src/db/models/Product.ts`**
- Array `variants` agregado al schema de Mongoose con todos los campos del tipo

**`backend/src/db/seed.ts`**
- Variantes agregadas a ~50 productos (ver tabla abajo)

---

## Productos con variantes en el seed

### Fragancias — 20 productos (type: `size`)
Todos los productos de la categoría tienen 2–4 tallas con precios escalonados.

| Producto | Tallas |
|---|---|
| Dior Sauvage EDT | 30 ml · 60 ml · 100 ml · 200 ml |
| Versace Bright Crystal EDT | 30 ml · 50 ml · 90 ml · 200 ml |
| Victoria's Secret Bombshell EDP | 30 ml · 50 ml · 100 ml |
| Sol de Janeiro Cheirosa 62 | 90 ml · 240 ml |
| Ariana Grande Cloud EDP | 30 ml · 50 ml · 100 ml |
| Billie Eilish Eilish EDP | 30 ml · 50 ml · 100 ml |
| Glossier You EDP | 5 ml Rollerball · 50 ml |
| Valentino Born in Roma EDP | 30 ml · 50 ml · 100 ml |
| YSL Libre EDP | 30 ml · 50 ml · 90 ml |
| Prada Paradoxe EDP | 30 ml · 50 ml · 90 ml |
| Carolina Herrera Good Girl EDP | 30 ml · 50 ml · 80 ml |
| Dolce & Gabbana Light Blue EDT | 25 ml · 50 ml · 100 ml |
| Giorgio Armani Acqua di Giò Profondo | 40 ml · 75 ml · 125 ml |
| Jean Paul Gaultier Le Male Le Parfum | 40 ml · 75 ml · 125 ml |
| Maison Margiela Replica By the Fireplace | 10 ml · 30 ml · 100 ml |
| Kayali Vanilla 28 EDP | 10 ml · 50 ml · 100 ml |
| Burberry Her EDP | 30 ml · 50 ml · 100 ml |
| Tom Ford Ombré Leather EDP | 50 ml · 100 ml |
| YSL Black Opium EDP | 30 ml · 50 ml · 90 ml |
| Versace Eros EDT | 30 ml · 50 ml · 100 ml · 200 ml |

### Maquillaje — 16 productos (type: `color`)
Swatches con color hex real basado en los tonos reales del producto.

| Producto | Variantes |
|---|---|
| Maybelline Sky High Mascara | Very Black · Black · Brownish Black · Cosmic Black |
| e.l.f. Halo Glow Liquid Filter | 8 tonos (1 Fair → 8 Rich/Deep) |
| NARS Radiant Creamy Concealer | Vanilla · Chantilly · Biscuit · Custard · Caramel · Walnut |
| Too Faced Better Than Sex Mascara | Black · Black Velvet · Pinky Nude |
| Fenty Beauty Gloss Bomb | Fenty Glow · Hot Chocolit · Glass Slipper · Fu$$y · Honey Nut |
| Rare Beauty Soft Pinch Liquid Blush | Hope · Joy · Bliss · Luck · Encourage · Nearly Neutral |
| NYX Fat Oil Lip Drip | Glazen Eye · Mood Frosting · That's Cheeky · Missed Call · On A Mission |
| NYX Butter Gloss | Praline · Crème Brûlée · Angel Food Cake · Sugar Cookie · Cherry Cheesecake · Éclair |
| Charlotte Tilbury Airbrush Flawless Foundation | 6 tonos (1 Fair → 20 Deep) |
| Estée Lauder Double Wear Foundation | 6 tonos (1N1 Ivory → 7N1 Soft Mocha) |
| Huda Beauty Easy Bake Loose Powder | Sugar Cookie · Banana · Honey · Gingerbread · Cinnamon |
| Fenty Beauty Pro Filt'r Foundation | 6 tonos (100W → 490N) |
| Anastasia Beverly Hills Brow Wiz | Blonde · Taupe · Soft Brown · Medium Brown · Dark Brown · Ebony |
| Benefit Hoola Matte Bronzer | Hoola Light · Hoola · Hoola Medium · Hoola Toasted |
| Charlotte Tilbury Pillow Talk Lipstick | Pillow Talk · Walk of No Shame · Supermodel · Chloé · So Marilyn |
| Tarte Shape Tape Concealer | 6 tonos (12S Light Sand → 53G Rich) |

### Fitness — 10 productos (type: `flavor`)

| Producto | Sabores |
|---|---|
| Optimum Nutrition Gold Standard Whey | Double Rich Chocolate · Vanilla Ice Cream · Strawberry Banana · Rocky Road · White Choc Raspberry |
| BSN SYNTHA-6 | Chocolate Milkshake · Vanilla Ice Cream · Strawberry Milkshake · Choc Peanut Butter · Banana |
| Cellucor C4 Original Pre-Workout | Fruit Punch · Watermelon · Orange Burst · Pink Lemonade · Blue Razz |
| Dymatize ISO100 | Gourmet Chocolate · Dunkin Cappuccino · Fruity Pebbles · Gourmet Vanilla · Birthday Cake |
| GHOST Legend Pre-Workout | Sour Patch Redberry · Warheads Watermelon · Swedish Fish · Peach · Lemon Crush |
| XTEND Original BCAA | Blue Raspberry · Watermelon · Mango Madness · Italian Blood Orange · Freedom Ice |
| Myprotein Impact Whey | Chocolate Brownie · Vanilla Crème · Strawberry Cream · Cookies & Cream · Unflavored |
| Alani Nu Pre-Workout | Breezeberry · Cosmic Stardust · Rainbow Candy · Carnival Candy Grape · Hawaiian Shaved Ice |
| ON Serious Mass | Chocolate · Vanilla · Strawberry · Banana |
| Legion Whey+ | Dutch Chocolate · Vanilla Bean · Strawberry Banana · Cookies & Cream · French Vanilla |

### Vitaminas — 16 productos (type: `count` / `flavor`)

**Con variantes de sabor (type: `flavor`):**

| Producto | Sabores |
|---|---|
| Emergen-C 1000mg Vitamin C Powder | Orange · Pink Lemonade · Raspberry · Strawberry Kiwi · Tangerine · Tropical (sin stock) |

> Todos los sabores comparten la imagen base del producto (Super Orange). Las imágenes locales están en `frontend/public/products/vitaminas/emergen-c-super-orange-{1-4}.jpg`.

**Con variantes de cantidad (type: `count`):**

Todos los títulos fueron actualizados para remover el conteo fijo (ej. "90 Ct") ya que el conteo pasó a ser una variante seleccionable. Cada variante tiene `imageUrl` con imagen real del CDN de iHerb o NatureMade.

**Calidad de imágenes:**
- iHerb Cloudinary CDN: todas las URLs usan `f_auto,q_auto:good,w_800/` → 800×800 px
- NatureMade Shopify CDN: todas las URLs usan sufijo `_1500x.png` → 1500×1500 px

**Productos con múltiples variantes + imágenes por variante:**

| Producto | Presentaciones | Fuente imágenes |
|---|---|---|
| Nature Made Vitamin D3 5000 IU Softgels | 90 ct · 180 ct · 360 ct | iHerb CDN / NatureMade |
| Centrum Women Multivitamin Tablets | 100 ct · 200 ct · 300 ct | iHerb CDN |
| Nature's Way Alive! Women's Ultra Multivitamin | 60 ct · 150 ct | iHerb CDN |
| NOW Foods Methyl B-12 1000 mcg Lozenges | 60 ct · 100 ct · 250 ct | iHerb CDN |
| Garden of Life Vitamin Code Women | 120 ct · 240 ct | iHerb CDN |
| Nature Made Advanced Multivitamin Gummies For Her | 90 ct · 150 ct | NatureMade CDN |
| Nature Made Multivitamin For Her Gummies | 70 ct · 150 ct | NatureMade CDN |
| Nature Made Multi For Her + Omega-3 Gummies | 80 ct · 150 ct | NatureMade CDN |
| Nature Made Vitamin D3 2000 IU Softgels | 90 ct · 250 ct | iHerb CDN |
| Nature's Bounty Biotin 10000 mcg Rapid Release Softgels | 90 ct · 120 ct · 180 ct | iHerb CDN |

**Productos de presentación única (solo imagen de producto agregada):**

| Producto | Presentación | Fuente imagen |
|---|---|---|
| Nature Made Vitamin D3 + K2 Softgels | 30 ct | NatureMade CDN |
| Nature Made Extra Strength Vitamin C 500 mg Gummies | 60 ct | NatureMade CDN |
| Nature Made Advanced Multivitamin Gummies For Her 50+ | 84 ct | NatureMade CDN |
| Vitafusion Men's Multivitamin Gummy | 120 ct | iHerb CDN |
| Nature's Bounty Super B-Complex with Folic Acid + Vitamin C | 150 ct | iHerb CDN |
| Vitafusion Power Plus Men's Multivitamin Gummy | 90 ct | vitafusion.com Shopify CDN |

> **Correcciones aplicadas:**
> - Alive! Women's Ultra: seed tenía 30/60/90 ct → corregido a 60/150 ct (tamaños reales del producto)
> - NOW Methyl B-12: seed tenía 50/100/200 ct → corregido a 60/100/250 ct (tamaños reales del producto)
> - D3 5000 IU 360ct: imagen mostraba botella 90ct → reemplazada con imagen hi-res Amazon (`B0828JGTXB`)
> - Centrum Women 300ct: imagen duplicada de 200ct → reemplazada con imagen oficial Centrum
> - Advanced For Her 150ct: sin imagen propia (solo en Costco/Sam's Club); usa `product.imageUrl` como fallback
> - Vitafusion Power Plus Men: imageUrl agregado desde Shopify CDN de vitafusion.com
> - 8 descripciones cortas de productos con variantes: eliminado el conteo hardcodeado del texto

**Nota sobre `imageUrl` en variantes:**
Cuando el usuario selecciona una variante, `ProductDetail.tsx` reemplaza la imagen principal del gallery con `selectedVariant.imageUrl`. Si la variante no tiene `imageUrl`, se mantiene la imagen base del producto.

### Suplementos — 6 productos (type: `size` / `flavor` / `count` / `weight`)

| Producto | Variantes |
|---|---|
| Vital Proteins Collagen Peptides | 7 oz sin sabor · 10 oz sin sabor · 10 oz vainilla · 20 oz sin sabor |
| Nuun Sport Hydration | 5 sabores (Strawberry Lemonade, Citrus Fruit, Tri-Berry, Watermelon, Grape) |
| Sports Research Creatine Monohydrate | 500 g · 1 kg |
| Nordic Naturals Ultimate Omega | 60 ct · 120 ct · 180 ct |
| OLLY Sleep | Blackberry Zen 50 ct · Blackberry Zen 100 ct · Tropical Mango 50 ct |
| LMNT Recharge | Citrus Salt · Orange Salt · Raspberry Salt · Mango Chili · Watermelon Salt |

### Hidratantes + Salud de la piel — 8 productos (type: `size`)

| Producto | Tallas |
|---|---|
| CeraVe Moisturizing Cream | 8 oz · 16 oz · 19 oz tarro |
| Cetaphil Moisturizing Cream | 8 oz · 16 oz · 20 oz |
| Neutrogena Hydro Boost Water Gel | 1.7 oz · 3 oz |
| La Roche-Posay Toleriane Double Repair | 40 ml · 75 ml |
| The Ordinary Natural Moisturizing Factors + HA | 30 ml · 100 ml |
| The Ordinary Hyaluronic Acid 2% + B5 | 30 ml · 60 ml |
| Paula's Choice 2% BHA Liquid Exfoliant | 30 ml Travel · 118 ml · 237 ml |
| The Ordinary Niacinamide 10% + Zinc 1% | 30 ml · 60 ml |

---

## Para activar en base de datos

```bash
cd backend
bun run seed
```

> Esto borra y recrea los 200 productos. Las reseñas y órdenes existentes no se ven afectadas.

---

## Pendiente / Lo que falta

- **Reseed** — correr `bun run seed` desde `/backend` para aplicar todos los cambios a MongoDB
- **ProductCard** — actualmente agrega sin variante; podría mostrar "Elige una opción →" si el producto tiene variantes
- **OrderLineItem** — la variante no se persiste en el pedido (solo en carrito/checkout); agregar `variantLabel?` al tipo y al backend de órdenes
- **Admin panel** — sin UI para crear o editar variantes
- **Cuidado personal** — deodorants (Old Spice, Native, Secret, Degree) con fragancias; body washes con tamaños; Dr. Teal's con fragancias
- **Más maquillaje** — `urban-decay-all-nighter-setting-spray`, `loreal-lash-paradise-mascara`, `maybelline-fit-me-foundation` (shades), `elf-power-grip-primer`
- **Vitaminas** — Advanced For Her 150ct sin imagen de variante propia (imagen real solo en Costco/Sam's Club; usa product-level imageUrl como fallback)
