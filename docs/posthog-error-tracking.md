# PostHog error tracking

Healthora captura excepciones de backend y frontend con PostHog y guarda una copia operativa en MongoDB para el panel admin.

## Variables

Backend:

```env
POSTHOG_PROJECT_API_KEY=phc_...
POSTHOG_HOST=https://us.i.posthog.com
```

Frontend:

```env
VITE_POSTHOG_PROJECT_TOKEN=phc_...
VITE_POSTHOG_HOST=https://us.i.posthog.com
```

Si las variables no existen, la app sigue funcionando y solo se omite el envio a PostHog.

## Alertas

En PostHog, activa Error tracking para el proyecto y crea alertas desde la vista de Issues o Insights:

1. Filtra eventos `$exception` por `source = backend` o `source = frontend`.
2. Crea una alerta para nuevos issues criticos.
3. Crea una alerta adicional por volumen, por ejemplo cuando `$exception` suba por encima del umbral esperado en 15 minutos.
4. Conecta el destino de notificacion del equipo, como Slack o email.

## Admin

Los errores recientes se consultan en:

```text
GET /admin/error-reports
GET /admin/error-reports?source=backend
GET /admin/error-reports?source=frontend
```

La interfaz admin muestra la seccion `Errores` con origen, ruta, usuario y fecha.
