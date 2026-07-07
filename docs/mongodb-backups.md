# Backups MongoDB Atlas (HU-074)

Procedimiento de respaldo y restauración para la base de datos de Healthora.

## Estrategia recomendada

| Método | Cuándo | Retención |
|--------|--------|-----------|
| **Atlas Cloud Backup** (M10+) | Producción | Política Atlas (ej. 7–30 días) |
| **mongodump** manual/script | Staging o M0 sin backup continuo | Copia en disco seguro |
| **Export JSON** (`mongoexport`) | Tablas puntuales / auditoría | Según necesidad |

## Atlas (producción)

1. Atlas → Cluster → **Backup** → activar **Cloud Backup** si el tier lo permite.
2. Configurar ventana y retención.
3. Prueba de restore anual en cluster **de prueba** (no sobre prod).

Restaurar desde Atlas UI: Backup → **Restore** → nuevo cluster o punto en el tiempo.

## Backup manual con script

Requisito: [MongoDB Database Tools](https://www.mongodb.com/try/download/database-tools) (`mongodump` en PATH).

```powershell
$env:MONGODB_URI = "mongodb+srv://..."
./tooling/ops/mongodb-backup.ps1 -OutDir ./backups
```

Genera carpeta `backups/healthora-YYYYMMDD-HHmmss/` con BSON. **No subir backups a git** (contienen datos sensibles).

## Restaurar mongodump

```powershell
mongorestore --uri="$env:MONGODB_URI" --db=healthora ./backups/healthora-20260706-120000/healthora
```

Usar `--drop` solo en entornos de prueba para reemplazar colecciones.

## Checklist operativo

- [ ] Backup automático Atlas activo en prod
- [ ] URI de backup con usuario de solo lectura si es posible
- [ ] Copias cifradas fuera del repo (S3, Drive equipo, etc.)
- [ ] Documentar RPO/RTO del equipo (ej. RPO 24h, RTO 2h)
- [ ] Tras incidente grave: coordinar con HU-076 rollback **y** restore DB si hubo corrupción

## Variables

El script lee `MONGODB_URI` y opcionalmente `MONGODB_DB_NAME` (default `healthora`).
