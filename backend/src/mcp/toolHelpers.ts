/** Every MCP tool callback returns this shape - a single text block with the JSON payload.
 * Structured `content` (vs. a bespoke `outputSchema` per tool) keeps every tool trivially easy
 * for an agent to consume without needing per-tool result typing. */
export function jsonResult(data: unknown) {
  return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
}

/** Marks the result as a tool-level error (invalid input, not-found, etc.) without failing the
 * whole JSON-RPC call - the agent sees the message and can retry with corrected arguments. */
export function errorResult(message: string) {
  return { content: [{ type: 'text' as const, text: message }], isError: true };
}
