import { db } from '@kunacademy/db';
import { sql } from 'drizzle-orm';

/**
 * Auto-assign services to a coach based on their kun_level.
 * Called when:
 * 1. A new coach is created (admin upgrades user to provider)
 * 2. A coach's kun_level changes
 * 3. A new service is created by admin
 *
 * Logic:
 * - For each active service where eligible_kun_levels includes the coach's level (or is null):
 *   - If coach_control is 'mandatory' or 'optional': upsert coach_services with is_active=true, assigned_by='auto'
 *   - If coach_control is 'admin_only': skip (admin must assign manually)
 * - Does NOT deactivate existing manual assignments
 * - Uses ON CONFLICT DO NOTHING to avoid overwriting manual changes
 */
export async function autoAssignServices(providerId: string, kunLevel: string): Promise<void> {
  // 1. Get all active services eligible for this coach level
  //    eligible_kun_levels IS NULL means unrestricted (all levels)
  const eligibleServices = await db.execute(sql`
    SELECT id, coach_control
    FROM services
    WHERE is_active = true
      AND coach_control IN ('mandatory', 'optional')
      AND (
        eligible_kun_levels IS NULL
        OR ${kunLevel} = ANY(eligible_kun_levels)
      )
  `);

  if (!eligibleServices.rows.length) return;

  // 2. Upsert each eligible service into coach_services
  //    ON CONFLICT DO NOTHING preserves existing manual assignments (assigned_by='manual', custom prices)
  for (const row of eligibleServices.rows as { id: string; coach_control: string }[]) {
    await db.execute(sql`
      INSERT INTO coach_services (provider_id, service_id, is_active, assigned_by)
      VALUES (${providerId}, ${row.id}, true, 'auto')
      ON CONFLICT (provider_id, service_id) DO NOTHING
    `);
  }
}
