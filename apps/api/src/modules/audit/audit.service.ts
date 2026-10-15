import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import type { PaginatedResult } from '@ck/types';
import { AuditLog, type AuditLogDocument } from '@/database/schemas';
import { paginated } from '@/common/utils/pagination.util';
import type { AuthenticatedRequest } from '@/common/types/authenticated-request';

export interface AuditEntryInput {
  campusId?: string;
  actorId?: string;
  actorEmail?: string;
  action: string;
  resource: string;
  resourceId?: string;
  ip?: string;
  userAgent?: string;
  outcome?: 'success' | 'failure';
  requestId?: string;
  metadata?: Record<string, unknown>;
}

/** Field names whose values must never reach the audit trail. */
const REDACTED_KEYS = new Set([
  'password',
  'newPassword',
  'currentPassword',
  'token',
  'refreshToken',
  'otp',
  'passwordHash',
  'secret',
  'cardNumber',
  'cvv',
]);

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(
    @InjectModel(AuditLog.name) private readonly auditModel: Model<AuditLogDocument>,
  ) {}

  /**
   * Never throws. A failure to write the audit trail is reported but must not turn
   * a completed privileged action into a 500 for the operator.
   */
  async record(entry: AuditEntryInput): Promise<void> {
    try {
      await this.auditModel.create({
        campusId: entry.campusId ? new Types.ObjectId(entry.campusId) : undefined,
        actorId: entry.actorId ? new Types.ObjectId(entry.actorId) : undefined,
        actorEmail: entry.actorEmail,
        action: entry.action,
        resource: entry.resource,
        resourceId: entry.resourceId,
        ip: entry.ip,
        userAgent: entry.userAgent?.slice(0, 300),
        outcome: entry.outcome ?? 'success',
        requestId: entry.requestId,
        metadata: this.redact(entry.metadata),
      });
    } catch (error) {
      this.logger.error({ err: error, action: entry.action }, 'Failed to write audit entry');
    }
  }

  /** Convenience wrapper that pulls actor and request metadata off the request. */
  async recordFromRequest(
    request: AuthenticatedRequest,
    entry: Omit<AuditEntryInput, 'actorId' | 'ip' | 'userAgent' | 'requestId' | 'campusId'> &
      Partial<Pick<AuditEntryInput, 'campusId'>>,
  ): Promise<void> {
    await this.record({
      ...entry,
      campusId: entry.campusId ?? request.tenantId ?? request.user?.campusId,
      actorId: request.user?.id,
      ip: request.ip,
      userAgent: request.headers['user-agent'],
      requestId: request.requestId,
    });
  }

  async list(params: {
    campusId?: string;
    actorId?: string;
    action?: string;
    resource?: string;
    page: number;
    limit: number;
  }): Promise<PaginatedResult<unknown>> {
    const filter: Record<string, unknown> = {};
    if (params.campusId) filter.campusId = new Types.ObjectId(params.campusId);
    if (params.actorId && Types.ObjectId.isValid(params.actorId)) {
      filter.actorId = new Types.ObjectId(params.actorId);
    }
    if (params.action) filter.action = params.action;
    if (params.resource) filter.resource = params.resource;

    const [items, total] = await Promise.all([
      this.auditModel
        .find(filter)
        .sort({ createdAt: -1 })
        .skip((params.page - 1) * params.limit)
        .limit(params.limit)
        .lean(),
      this.auditModel.countDocuments(filter),
    ]);

    return paginated(items, total, params.page, params.limit);
  }

  private redact(metadata?: Record<string, unknown>): Record<string, unknown> | undefined {
    if (!metadata) return undefined;
    const output: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(metadata)) {
      if (REDACTED_KEYS.has(key)) {
        output[key] = '[redacted]';
      } else if (value && typeof value === 'object' && !Array.isArray(value)) {
        output[key] = this.redact(value as Record<string, unknown>);
      } else {
        output[key] = value;
      }
    }
    return output;
  }
}
