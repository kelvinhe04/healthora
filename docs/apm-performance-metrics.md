# APM y metricas de rendimiento

Healthora registra una metrica por request del backend en MongoDB para calcular latencia y throughput por endpoint.

## Variables

```env
APM_SLOW_REQUEST_MS=1000
APM_P95_ALERT_MS=1500
APM_ERROR_RATE_ALERT_PERCENT=5
```

## Panel

El panel admin consume:

```text
GET /admin/performance
GET /admin/performance?minutes=60
GET /admin/performance?minutes=1440
```

La respuesta incluye resumen global, tabla por endpoint, ultimas requests y banderas de alerta.

## Umbrales de alerta

Se consideran condiciones de alerta cuando:

- `p95LatencyMs >= APM_P95_ALERT_MS`
- `errorRate >= APM_ERROR_RATE_ALERT_PERCENT`
- Una request supera `APM_SLOW_REQUEST_MS`, queda marcada como `slow`

Estos umbrales deben reflejarse tambien en cualquier monitor externo que se conecte al endpoint de metricas.
