# Imagenes de productos

Coloca aqui las imagenes reales de los productos del seed.

## Convencion

- Cada imagen debe usar el `id` del producto como nombre de archivo.
- Cada producto vive dentro de la carpeta de su categoria.
- Cada producto usa 4 imagenes.
- Formato esperado por defecto: `.jpg`
- Rutas publicas:
  - `/products/<carpeta-categoria>/<id>-1.jpg`
  - `/products/<carpeta-categoria>/<id>-2.jpg`
  - `/products/<carpeta-categoria>/<id>-3.jpg`
  - `/products/<carpeta-categoria>/<id>-4.jpg`

Carpetas actuales:

- `vitaminas`
- `suplementos`
- `salud-piel`
- `hidratantes`
- `cuidado-bebe`
- `fitness`
- `medicamentos`
- `cuidado-personal`
- `fragancias`
- `maquillaje`

Ejemplo:

- `frontend/public/products/hidratantes/cerave-moisturizing-cream-1.jpg`
- `frontend/public/products/hidratantes/cerave-moisturizing-cream-2.jpg`
- `frontend/public/products/hidratantes/cerave-moisturizing-cream-3.jpg`
- `frontend/public/products/hidratantes/cerave-moisturizing-cream-4.jpg`

Si una imagen no existe todavia, la app seguira mostrando el mock visual generado con `color`, `swatchColor` y `label`.
