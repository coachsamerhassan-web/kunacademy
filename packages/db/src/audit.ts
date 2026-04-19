import { withAdminContext } from './pool';
import { sql } from 'drizzle-orm';

export type AuditAction =
  | 'CREATE_BOOKING' | 'UPDATE_BOOKING' | 'CANCEL_BOOKING' | 'REVOKE_GUEST_TOKEN'
  | 'APPROVE_PAYOUT' | 'REJECT_PAYOUT' | 'COMPLETE_PAYOUT'
  | 'UPDATE_ORDER' | 'REFUND_ORDER'
  | 'UPDATE_ENROLLMENT' | 'CREATE_ENROLLMENT'
  | 'UPDATE_COMMISSION' | 'CREATE_COMMISSION'
  | 'DELETE_POST' | 'UPDATE_POST'
  | 'APPROVE_COACH' | 'REJECT_COACH'
  | 'DECRYPT_BANK_DETAILS'
  | 'UPDATE_PROFILE_ROLE'
  | 'CREATE_BLOG_POST' | 'UPDATE_BLOG_POST' | 'DELETE_BLOG_POST'
  | 'UPDATE_TESTIMONIAL' | 'DELETE_TESTIMONIAL'
  | 'SUBMIT_ASSESSMENT'
  | 'OVERRIDE_ASSESSMENT_DECISION'
  | 'REQUEST_SECOND_OPINION'
  | 'PAUSE_JOURNEY'
  | 'UNPAUSE_JOURNEY';

/** Manual type matching the admin_audit_log migration schema */
export interface AdminAuditLog {
  id: string;
  admin_id: string | null;
  action: AuditAction;
  target_type: string | null;
  target_id: string | null;
  metadata: Record<string, unknown>;
  ip_address: string | null;
  created_at: string;
}

/**
 * Log an admin action to the audit log.
 * NON-BLOCKING — failures are logged to console but never throw or reject.
 * Writes use withAdminContext (bypasses RLS INSERT restriction).
 */
export async function logAdminAction(params: {
  adminId: string;
  action: AuditAction;
  targetType: string;
  targetId?: string;
  metadata?: Record<string, unknown>;
  ipAddress?: string;
}): Promise<void> {
  try {
    await withAdminContext(async (db) => {
      await db.execute(
        sql`INSERT INTO admin_audit_log (admin_id, action, target_type, target_id, metadata, ip_address) VALUES (${params.adminId}, ${params.action}, ${params.targetType}, ${params.targetId ?? null}, ${JSON.stringify(params.metadata ?? {})}, ${params.ipAddress ?? null})`
      );
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error('[AUDIT] Failed to log admin action:', msg);
    // Non-blocking — never let audit failures break the main operation
  }
}
