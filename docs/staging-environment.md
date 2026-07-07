# Entorno staging (HU-075)

Healthora usa tres entornos lógicos controlados por `APP_ENV`:

| Entorno | `APP_ENV` | Uso |
|---------|-----------|-----|
| Desarrollo | `development` (default) | Local con Vite + Bun |
| Staging | `staging` | QA pre-producción, datos de prueba |
| Producción | `production` | Vercel + Koyeb + Atlas prod |

## Despliegue recomendado

```text
Producción:  main → Vercel (frontend) + Koyeb (backend) + Atlas cluster prod
Staging:     rama staging o preview Vercel → Koyeb staging + Atlas cluster staging
Local:       bun run dev (dev.js levanta ambos)
```

## Variables backend (staging)

Copia `backend/.env.staging.example` a `backend/.env` en el servidor staging o configúralas en Koyeb:

- `APP_ENV=staging`
- `MONGODB_URI` → cluster **staging** (nunca compartir con prod)
- `CLERK_SECRET_KEY` / Stripe → claves **test** o proyecto Clerk staging
- `CORS_ORIGINS` → URL del frontend staging (y preview si aplica)
- `FRONTEND_URL` → URL principal del frontend staging (checkout redirects)

## Variables frontend (staging)

Copia `frontend/.env.staging.example` en Vercel **Preview** o proyecto staging:

- `VITE_API_URL` → API staging (ej. `https://healthora-api-staging.koyeb.app`)
- Clerk publishable key de staging/test
- PostHog opcional con proyecto separado para no mezclar métricas

## CORS multi-origen

El backend acepta varios orígenes si defines:

```env
CORS_ORIGINS=https://healthora-staging.vercel.app,https://healthora-git-staging.vercel.app
```

Si solo hay uno, basta `FRONTEND_URL`.

## Checklist al crear staging

1. Cluster MongoDB Atlas nuevo (o DB separada) + usuario con permisos mínimos
2. Servicio Koyeb apuntando a rama/tag staging con `APP_ENV=staging`
3. Proyecto o entorno Vercel con variables de `.env.staging.example`
4. Stripe webhooks apuntando a URL staging (`/webhooks`)
5. Clerk allowed origins incluyen dominio staging
6. Verificar: `tooling/ops/health-check.ps1 -ApiBase ... -FrontendBase ...`

## Diferencias vs producción

- No usar claves live de Stripe en staging
- Seeds de prueba permitidos (`bun run seed` solo en staging/dev)
- Logs y PostHog en proyecto separado para depurar sin ruido de prod
