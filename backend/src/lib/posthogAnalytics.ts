/** Queries PostHog's HogQL Query API for the checkout funnel / cart abandonment panel (HU-054).
 * Distinct from `lib/posthog.ts` (the ingestion client used for exception tracking): reading
 * events back out requires a Personal API Key with query access and a numeric project id, not the
 * write-only project token used to send events. Degrades to `configured: false` when those aren't
 * set, instead of failing the whole admin panel. */

const FUNNEL_EVENTS = ['checkout_started', 'checkout_completed', 'add_to_cart'] as const;

function getQueryConfig() {
  const personalApiKey = process.env.POSTHOG_PERSONAL_API_KEY;
  const projectId = process.env.POSTHOG_PROJECT_ID;
  const host = process.env.POSTHOG_HOST || 'https://us.i.posthog.com';
  if (!personalApiKey || !projectId) return null;
  return { personalApiKey, projectId, host };
}

export function isPostHogQueryConfigured(): boolean {
  return getQueryConfig() !== null;
}

async function runHogQL<Row extends unknown[]>(query: string): Promise<Row[]> {
  const config = getQueryConfig();
  if (!config) throw new Error('PostHog no está configurado (POSTHOG_PERSONAL_API_KEY / POSTHOG_PROJECT_ID)');

  const response = await fetch(`${config.host}/api/projects/${config.projectId}/query/`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.personalApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query: { kind: 'HogQLQuery', query } }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`PostHog query falló (${response.status}): ${body.slice(0, 300)}`);
  }

  const data = (await response.json()) as { results?: Row[] };
  return data.results ?? [];
}

export type ProductAnalytics = {
  configured: boolean;
  periodDays: number;
  funnel: { checkoutStarted: number; checkoutCompleted: number; conversionRate: number };
  cartAbandonment: { addedToCart: number; completedCheckout: number; abandonmentRate: number };
  recentEvents: { event: string; timestamp: string; distinctId: string }[];
  error?: string;
};

function emptyAnalytics(days: number): ProductAnalytics {
  return {
    configured: false,
    periodDays: days,
    funnel: { checkoutStarted: 0, checkoutCompleted: 0, conversionRate: 0 },
    cartAbandonment: { addedToCart: 0, completedCheckout: 0, abandonmentRate: 0 },
    recentEvents: [],
  };
}

/** `days` must already be a validated integer (see adminAnalytics.ts's zod schema) before it
 * reaches this string-interpolated HogQL - there's no parameterized query support for the
 * `INTERVAL` clause in PostHog's HogQL. */
export async function getProductAnalytics(days: number): Promise<ProductAnalytics> {
  if (!isPostHogQueryConfigured()) return emptyAnalytics(days);

  try {
    const [summaryRow] = await runHogQL<[number, number, number]>(`
      SELECT
        countIf(event = 'checkout_started') AS checkoutStarted,
        countIf(event = 'checkout_completed') AS checkoutCompleted,
        countIf(event = 'add_to_cart') AS addToCart
      FROM events
      WHERE event IN (${FUNNEL_EVENTS.map((e) => `'${e}'`).join(', ')})
        AND timestamp >= now() - INTERVAL ${days} DAY
    `);
    const [checkoutStarted, checkoutCompleted, addToCart] = summaryRow ?? [0, 0, 0];

    const recentRows = await runHogQL<[string, string, string]>(`
      SELECT event, toString(timestamp), distinct_id
      FROM events
      WHERE event IN (${FUNNEL_EVENTS.map((e) => `'${e}'`).join(', ')})
        AND timestamp >= now() - INTERVAL ${days} DAY
      ORDER BY timestamp DESC
      LIMIT 25
    `);

    return {
      configured: true,
      periodDays: days,
      funnel: {
        checkoutStarted,
        checkoutCompleted,
        conversionRate: checkoutStarted > 0 ? Math.round((checkoutCompleted / checkoutStarted) * 10000) / 100 : 0,
      },
      // Approximate, event-count based (not deduped by session/user) - "abandono" is everyone who
      // added something to the cart but whose session never produced a completed checkout event.
      cartAbandonment: {
        addedToCart: addToCart,
        completedCheckout: checkoutCompleted,
        abandonmentRate: addToCart > 0 ? Math.round((1 - checkoutCompleted / addToCart) * 10000) / 100 : 0,
      },
      recentEvents: recentRows.map(([event, timestamp, distinctId]) => ({ event, timestamp, distinctId })),
    };
  } catch (err) {
    return { ...emptyAnalytics(days), configured: true, error: err instanceof Error ? err.message : String(err) };
  }
}
