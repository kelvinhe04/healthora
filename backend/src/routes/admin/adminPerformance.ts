import { Hono } from 'hono';
import { z } from 'zod';
import { PerformanceMetric } from '../../db/models/PerformanceMetric';
import { requireAdmin } from '../../middleware/requireAdmin';
import type { AppEnv } from '../../types/hono';
import { intFromInput, optionalTextField, parseQuery } from '../../lib/validation';

const performanceQuerySchema = z
  .object({
    from: optionalTextField(40),
    to: optionalTextField(40),
    minutes: intFromInput(1, 60 * 24 * 30).default(60 * 24),
    limit: intFromInput(1, 100).default(25),
  })
  .superRefine((query, ctx) => {
    for (const field of ['from', 'to'] as const) {
      if (query[field] && Number.isNaN(Date.parse(query[field]))) {
        ctx.addIssue({ code: 'custom', path: [field], message: 'Fecha invalida' });
      }
    }
  });

const slowThresholdMs = Number(process.env.APM_SLOW_REQUEST_MS || 1000);
const p95AlertThresholdMs = Number(process.env.APM_P95_ALERT_MS || 1500);
const errorRateAlertPercent = Number(process.env.APM_ERROR_RATE_ALERT_PERCENT || 5);

function percentile(values: number[], p: number) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, Math.min(sorted.length - 1, index))];
}

export const adminPerformanceRouter = new Hono<AppEnv>()
  .use('*', requireAdmin)
  .get('/', async (c) => {
    const parsed = parseQuery(c, performanceQuerySchema);
    if (!parsed.success) return parsed.response;

    const query = parsed.data;
    const now = new Date();
    const from = query.from ? new Date(query.from) : new Date(now.getTime() - query.minutes * 60 * 1000);
    const to = query.to ? new Date(query.to) : now;
    const filter = { createdAt: { $gte: from, $lte: to } };

    const metrics = await PerformanceMetric.find(filter).sort({ createdAt: -1 }).limit(5000).lean();
    const latencyValues = metrics.map((metric) => metric.latencyMs);
    const totalRequests = metrics.length;
    const errorCount = metrics.filter((metric) => metric.error).length;
    const slowCount = metrics.filter((metric) => metric.slow).length;
    const windowMinutes = Math.max(1, (to.getTime() - from.getTime()) / 60000);
    const errorRate = totalRequests ? (errorCount / totalRequests) * 100 : 0;
    const p95 = percentile(latencyValues, 95);

    const byEndpoint = new Map<string, typeof metrics>();
    for (const metric of metrics) {
      const key = `${metric.method} ${metric.route}`;
      const group = byEndpoint.get(key) || [];
      group.push(metric);
      byEndpoint.set(key, group);
    }

    const endpoints = [...byEndpoint.entries()]
      .map(([endpoint, rows]) => {
        const values = rows.map((row) => row.latencyMs);
        const errors = rows.filter((row) => row.error).length;
        return {
          endpoint,
          requests: rows.length,
          throughputPerMinute: Math.round((rows.length / windowMinutes) * 100) / 100,
          avgLatencyMs: Math.round((values.reduce((sum, value) => sum + value, 0) / values.length) * 100) / 100,
          p95LatencyMs: percentile(values, 95),
          maxLatencyMs: Math.max(...values),
          errorRate: Math.round((errors / rows.length) * 10000) / 100,
          slowRequests: rows.filter((row) => row.slow).length,
        };
      })
      .sort((a, b) => b.requests - a.requests)
      .slice(0, query.limit);

    return c.json({
      summary: {
        totalRequests,
        throughputPerMinute: Math.round((totalRequests / windowMinutes) * 100) / 100,
        avgLatencyMs: latencyValues.length
          ? Math.round((latencyValues.reduce((sum, value) => sum + value, 0) / latencyValues.length) * 100) / 100
          : 0,
        p95LatencyMs: p95,
        errorRate: Math.round(errorRate * 100) / 100,
        slowRequests: slowCount,
      },
      alerts: {
        slowThresholdMs,
        p95ThresholdMs: p95AlertThresholdMs,
        errorRateThresholdPercent: errorRateAlertPercent,
        p95Breached: p95 >= p95AlertThresholdMs,
        errorRateBreached: errorRate >= errorRateAlertPercent,
      },
      endpoints,
      recent: metrics.slice(0, 25),
      window: {
        from: from.toISOString(),
        to: to.toISOString(),
        minutes: Math.round(windowMinutes),
      },
    });
  });
