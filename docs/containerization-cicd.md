# Containerización y CI/CD (HU-073)

## Docker local

```powershell
docker compose up --build
```

Servicios:

- **mongo** — puerto 27017
- **api** — backend en `http://localhost:3002` (build desde `backend/Dockerfile`)

Variables: copia `backend/.env.example` y ajusta `MONGODB_URI=mongodb://mongo:27017/healthora` para compose.

## Imagen backend (Koyeb)

El `backend/Dockerfile` usa Bun 1, instala dependencias y ejecuta `bun src/index.ts`. En Koyeb:

- Build context: raíz del repo
- Dockerfile path: `backend/Dockerfile`
- `PORT` = 3002 (o el que exponga Koyeb)

## GitHub Actions

Workflow `.github/workflows/ci.yml`:

- En push/PR a `main`: `bun install` + build frontend + install backend
- No despliega solo; Vercel/Koyeb siguen conectados a `main`

## Flujo release

1. PR → CI verde
2. Merge a `main`
3. Vercel/Koyeb redeploy automático
4. Tag opcional: `tooling/ops/tag-release.ps1` (HU-076)
5. `tooling/ops/health-check.ps1` post-deploy

## Frontend en Docker

Hoy el frontend se despliega en Vercel (SSR/build estático). Docker local es solo API + Mongo para desarrollo integrado.
