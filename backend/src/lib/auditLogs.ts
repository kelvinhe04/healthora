import { SecurityAuditLog } from '../db/models/SecurityAuditLog';
import { escapeRegex } from './validation';

export type AuditLogFilters = {
  from?: string;
  to?: string;
  action?: string;
  actorClerkId?: string;
  actorEmail?: string;
  targetClerkId?: string;
  limit?: number;
  page?: number;
};

/** Shared query used by both the admin "Auditoría" page (adminAuditLogs.ts) and the MCP tool
 * audit.getAdminActions (HU-051), so filter semantics never drift between the two callers. */
export async function listAuditLogs(filters: AuditLogFilters) {
  const limit = filters.limit ?? 50;
  const page = filters.page ?? 1;
  const filter: Record<string, unknown> = {};

  if (filters.from || filters.to) {
    filter.createdAt = {
      ...(filters.from ? { $gte: new Date(filters.from) } : {}),
      ...(filters.to ? { $lte: new Date(filters.to) } : {}),
    };
  }
  if (filters.action) filter.action = filters.action;
  if (filters.actorClerkId) filter.actorClerkId = filters.actorClerkId;
  if (filters.actorEmail) filter.actorEmail = { $regex: escapeRegex(filters.actorEmail), $options: 'i' };
  if (filters.targetClerkId) filter.targetClerkId = filters.targetClerkId;

  const skip = (page - 1) * limit;
  const [items, total] = await Promise.all([
    SecurityAuditLog.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    SecurityAuditLog.countDocuments(filter),
  ]);

  return { items, total, page, limit };
}
