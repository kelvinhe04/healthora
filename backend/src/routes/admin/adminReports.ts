import { Hono } from 'hono';
import { requireAdmin } from '../../middleware/requireAdmin';
import { getCohortReport } from '../../lib/cohortAnalytics';

function parseDateParam(value: string | undefined): Date | undefined {
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

export const adminReportsRouter = new Hono()
  .use('*', requireAdmin)
  .get('/cohorts', async (c) => {
    const from = parseDateParam(c.req.query('from'));
    const to = parseDateParam(c.req.query('to'));
    const report = await getCohortReport({ from, to });
    return c.json(report);
  });
