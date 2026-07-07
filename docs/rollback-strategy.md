# Estrategia de rollback (HU-076)

Procedimiento para volver a una versión estable de Healthora si un despliegue introduce errores.

## Principio

Rollback = **volver al commit/tag conocido bueno**, no parchear en caliente salvo emergencia.

| Capa | Dónde vive | Cómo hacer rollback |
|------|------------|---------------------|
| Frontend | Vercel | Redeploy de un deployment anterior o `git revert` + push a `main` |
| Backend | Koyeb | Redeploy de imagen/commit anterior o rollback en panel Koyeb |
| Base de datos | MongoDB Atlas | **No** se revierte con git; usar backup (HU-074) si hace falta |

## Flujo recomendado

```text
1. Detectar incidente (errores 5xx, checkout roto, admin caído)
2. Congelar merges a main
3. Identificar último tag estable: git tag -l 'v*' --sort=-v:refname
4. Rollback backend/frontend al tag o deployment previo
5. Ejecutar health check: tooling/ops/health-check.ps1
6. Registrar incidente y abrir fix en rama nueva desde main estable
```

## Tags de release

Antes de cada release a producción:

```powershell
git checkout main
git pull origin main
./tooling/ops/tag-release.ps1 v2026.07.06.1 "Release estable post HU-086"
git push origin v2026.07.06.1
```

Convención de tag: `vYYYY.MM.DD.N` (N = release del día).

## Rollback con git revert (sin force push)

Si el problema es **un commit concreto** ya en `main`:

```powershell
git checkout main
git pull origin main
git log --oneline -5
git revert <commit_malo> --no-edit
git push origin main
```

Vercel y Koyeb redeployan automáticamente desde `main`. **No uses** `git reset --hard` en `main` compartido.

## Rollback en Vercel (frontend)

1. Vercel → proyecto Healthora → **Deployments**
2. Buscar último deployment **Ready** antes del incidente
3. ⋯ → **Promote to Production**
4. Verificar `https://<tu-dominio>/` y flujo checkout

## Rollback en Koyeb (backend)

1. Koyeb → servicio API → **Deployments**
2. Seleccionar revisión anterior estable → **Redeploy**
3. Verificar:

```text
GET https://<api-host>/health
GET https://<api-host>/openapi.json
```

## Checklist post-rollback

- [ ] `GET /health` → `{ "status": "ok" }`
- [ ] Catálogo carga en frontend
- [ ] Login Clerk funciona
- [ ] Checkout de prueba (Stripe test mode)
- [ ] Panel admin `/admin` accesible
- [ ] Sin pico nuevo en errores PostHog / panel Errores

## Script de verificación

```powershell
./tooling/ops/health-check.ps1 -ApiBase https://tu-api.koyeb.app -FrontendBase https://tu-app.vercel.app
```

Variables opcionales en `.env` local para el script: ver comentarios en el script.

## Cuándo NO hacer rollback

- Solo falla un feature nuevo aislado → feature flag o revert del PR específico
- Datos corruptos en MongoDB → restaurar backup puntual (HU-074), no redeploy solo
