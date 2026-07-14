import { Hono } from 'hono';
import { requireAdmin } from '../../middleware/requireAdmin';
import { getCohortReport, getCohortCustomers } from '../../lib/cohortAnalytics';

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
  })
  .get('/cohorts/:cohortMonth/customers', async (c) => {
    const cohortMonth = c.req.param('cohortMonth');
    if (!/^\d{4}-\d{2}$/.test(cohortMonth)) {
      return c.json({ error: 'cohortMonth debe tener el formato AAAA-MM' }, 400);
    }
    const customers = await getCohortCustomers(cohortMonth);
    return c.json({ cohortMonth, customers });
  });
