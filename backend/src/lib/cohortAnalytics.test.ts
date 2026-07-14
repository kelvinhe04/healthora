import { describe, expect, test } from 'bun:test';
import { buildCohortReport } from './cohortAnalytics';

const NOW = new Date('2026-03-15T00:00:00.000Z');

describe('buildCohortReport', () => {
  test('groups customers by the month of their first paid order', () => {
    const report = buildCohortReport(
      [
        { customerId: 'a', orders: [{ date: new Date('2026-01-05'), total: 100 }] },
        { customerId: 'b', orders: [{ date: new Date('2026-01-20'), total: 50 }] },
        { customerId: 'c', orders: [{ date: new Date('2026-02-10'), total: 30 }] },
      ],
      { now: NOW },
    );

    expect(report.cohorts.map((c) => c.cohortMonth)).toEqual(['2026-01', '2026-02']);
    expect(report.cohorts[0].customers).toBe(2);
    expect(report.cohorts[1].customers).toBe(1);
  });

  test('retention counts customers who ordered again in a later month, not just any order', () => {
    const report = buildCohortReport(
      [
        {
          customerId: 'a',
          orders: [
            { date: new Date('2026-01-05'), total: 100 },
            { date: new Date('2026-02-05'), total: 40 },
          ],
        },
        { customerId: 'b', orders: [{ date: new Date('2026-01-20'), total: 50 }] },
      ],
      { now: NOW },
    );

    const cohort = report.cohorts[0];
    expect(cohort.cohortMonth).toBe('2026-01');
    expect(cohort.retention[0]).toMatchObject({ offset: 0, activeCustomers: 2, percent: 100 });
    // Only "a" came back in month offset 1 (Feb) -> 1 of 2 customers = 50%.
    expect(cohort.retention[1]).toMatchObject({ offset: 1, activeCustomers: 1, percent: 50, revenue: 40 });
  });

  test('cumulative LTV is per-starting-customer revenue accrued over time, not per-active-customer', () => {
    const report = buildCohortReport(
      [
        {
          customerId: 'a',
          orders: [
            { date: new Date('2026-01-05'), total: 100 },
            { date: new Date('2026-02-05'), total: 40 },
          ],
        },
        { customerId: 'b', orders: [{ date: new Date('2026-01-20'), total: 50 }] },
      ],
      { now: NOW },
    );

    const cohort = report.cohorts[0];
    // offset 0: (100 + 50) / 2 customers = 75
    expect(cohort.cumulativeLtv[0].value).toBe(75);
    // offset 1: (100 + 50 + 40) / 2 customers = 95
    expect(cohort.cumulativeLtv[1].value).toBe(95);
  });

  test('caps the retention curve at "now" so future months are not fabricated', () => {
    const report = buildCohortReport(
      [{ customerId: 'a', orders: [{ date: new Date('2026-03-01'), total: 20 }] }],
      { now: NOW },
    );
    // Cohort started the same month as "now" -> only offset 0 is knowable.
    expect(report.cohorts[0].retention).toHaveLength(1);
  });

  test('filters cohorts by their start month, not by when later orders happened', () => {
    const report = buildCohortReport(
      [
        {
          customerId: 'a',
          orders: [
            { date: new Date('2026-01-05'), total: 100 },
            { date: new Date('2026-02-05'), total: 40 },
          ],
        },
        { customerId: 'b', orders: [{ date: new Date('2026-02-20'), total: 50 }] },
      ],
      { now: NOW, from: new Date('2026-02-01') },
    );

    expect(report.cohorts.map((c) => c.cohortMonth)).toEqual(['2026-02']);
    expect(report.cohorts[0].customers).toBe(1);
  });

  test('overall averages divide by paying customers, not by orders', () => {
    const report = buildCohortReport(
      [
        {
          customerId: 'a',
          orders: [
            { date: new Date('2026-01-05'), total: 100 },
            { date: new Date('2026-02-05'), total: 40 },
          ],
        },
        { customerId: 'b', orders: [{ date: new Date('2026-01-20'), total: 50 }] },
      ],
      { now: NOW },
    );

    expect(report.overall.totalCustomers).toBe(2);
    expect(report.overall.averageOrdersPerCustomer).toBe(1.5);
    expect(report.overall.averageRevenuePerCustomer).toBe(95);
    expect(report.overall.averageOrderValue).toBeCloseTo(63.33, 2);
  });

  test('ignores customers with no orders', () => {
    const report = buildCohortReport([{ customerId: 'a', orders: [] }], { now: NOW });
    expect(report.cohorts).toHaveLength(0);
    expect(report.overall.totalCustomers).toBe(0);
  });
});
