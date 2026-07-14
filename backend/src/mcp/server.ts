import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';
import { registerCatalogTools } from './tools/catalog';
import { registerVariantTools } from './tools/variants';
import { registerInventoryTools } from './tools/inventory';
import { registerOrderTools } from './tools/orders';
import { registerUserTools } from './tools/users';
import { registerAnalyticsTools } from './tools/analytics';
import { registerReviewTools } from './tools/reviews';
import { registerRecommendationTools } from './tools/recommendations';
import { registerNotificationTools } from './tools/notifications';
import { registerCategoryTools } from './tools/categories';
import { registerPromotionTools } from './tools/promotions';
import { registerAuditTools } from './tools/audit';
import { registerReturnTools } from './tools/returns';
import { registerSearchTools } from './tools/search';
import { registerCouponTools } from './tools/coupons';

function createMcpServer(): McpServer {
  const server = new McpServer({ name: 'healthora', version: '1.0.0' });
  registerCatalogTools(server);
  registerVariantTools(server);
  registerInventoryTools(server);
  registerOrderTools(server);
  registerUserTools(server);
  registerAnalyticsTools(server);
  registerReviewTools(server);
  registerRecommendationTools(server);
  registerNotificationTools(server);
  registerCategoryTools(server);
  registerPromotionTools(server);
  registerAuditTools(server);
  registerReturnTools(server);
  registerSearchTools(server);
  registerCouponTools(server);
  return server;
}

/** A `Protocol` (the class `McpServer` wraps) can only ever be connected to one transport at a
 * time - a second `connect()` call throws "Already connected". And in stateless mode (no
 * `sessionIdGenerator`), a `WebStandardStreamableHTTPServerTransport` can only handle a single
 * request before refusing further ones ("Create a new transport per request" - reusing one would
 * let message IDs from different callers collide). So there is no server+transport pair that can
 * safely be shared as a module-level singleton across concurrent HTTP requests: build both fresh
 * per request instead. Tool registration is pure/cheap (building a Map, no I/O), so this costs
 * nothing meaningful compared to the DB round-trip each tool call makes anyway. */
export async function handleMcpRequest(req: Request): Promise<Response> {
  const server = createMcpServer();
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });
  await server.connect(transport);
  try {
    return await transport.handleRequest(req);
  } finally {
    await server.close();
  }
}
