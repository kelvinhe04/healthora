# Alertas y monitoreo de uptime

Healthora usa un monitor externo en GitHub Actions para verificar disponibilidad periodicamente.

## Workflow

El workflow `.github/workflows/uptime-monitor.yml` corre cada 10 minutos y tambien se puede ejecutar manualmente.

Configura estas variables del repositorio:

```text
HEALTHORA_API_URL=https://api.tu-dominio.com
HEALTHORA_FRONTEND_URL=https://tu-dominio.com
UPTIME_ALERT_CHANNEL=ops
```

Configura este secreto para activar alertas:

```text
UPTIME_ALERT_WEBHOOK_URL=https://hooks.slack.com/services/...
```

El webhook recibe un payload JSON con los checks fallidos, URL, timestamp y canal configurado.

## Historial

Cada ejecucion genera `uptime-history.jsonl` y lo sube como artifact `uptime-history`.

Cada linea contiene:

- `checkedAt`
- `apiBase`
- `frontendBase`
- `totalChecks`
- `failedChecks`
- `results[]` con `name`, `url`, `up`, `statusCode`, `latencyMs` y `error`

## Ejecucion local

```powershell
./tooling/ops/uptime-monitor.ps1 `
  -ApiBase "http://localhost:3002" `
  -FrontendBase "http://localhost:5173" `
  -HistoryPath "uptime-history.jsonl"
```
