/**
 * GET /api/packages
 *
 * Returns all package instances for the authenticated student.
 * Query includes: package_instances, package_templates, latest package_assessments.
 *
 * Auth: session required, student only.
 * Response shape: { packages: [ { instance_id, package_name, journey_state, last_assessment_date, expires_at }, ... ] }
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@kunacademy/auth/server';
import { db } from '@kunacademy/db';
import { packageInstances, packageTemplates, packageAssessments } from '@kunacademy/db/schema';
import { eq, desc } from 'drizzle-orm';

export async function GET(req: NextRequest) {
  try {
    // ── Auth ────────────────────────────────────────────────────────────────
    const user = await getAuthUser();
    if (!user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const studentId = user.id;

    // ── Query student's packages ────────────────────────────────────────────
    // 1. Fetch all package_instances for this student
    const instances = await db
      .select({
        instance_id: packageInstances.id,
        package_template_id: packageInstances.package_template_id,
        journey_state: packageInstances.journey_state,
        expires_at: packageInstances.expires_at,
      })
      .from(packageInstances)
      .where(eq(packageInstances.student_id, studentId));

    if (instances.length === 0) {
      return NextResponse.json({ packages: [] });
    }

    // 2. Fetch template names for each instance
    const templateMap = new Map<string, { name_ar: string; name_en: string }>();
    const templateIds = [...new Set(instances.map((i) => i.package_template_id))];

    for (const templateId of templateIds) {
      const template = await db
        .select({
          id: packageTemplates.id,
          name_ar: packageTemplates.name_ar,
          name_en: packageTemplates.name_en,
        })
        .from(packageTemplates)
        .where(eq(packageTemplates.id, templateId))
        .limit(1);

      if (template.length > 0) {
        templateMap.set(templateId, {
          name_ar: template[0].name_ar,
          name_en: template[0].name_en,
        });
      }
    }

    // 3. Fetch latest assessment for each instance
    const assessmentMap = new Map<string, string | null>();

    for (const instance of instances) {
      const latestAssessment = await db
        .select({
          decided_at: packageAssessments.decided_at,
        })
        .from(packageAssessments)
        .where(eq(packageAssessments.id, instance.instance_id))
        .orderBy(desc(packageAssessments.decided_at))
        .limit(1);

      if (latestAssessment.length > 0 && latestAssessment[0].decided_at) {
        assessmentMap.set(instance.instance_id, latestAssessment[0].decided_at);
      }
    }

    // ── Build response ──────────────────────────────────────────────────────
    const packages = instances.map((inst) => {
      const template = templateMap.get(inst.package_template_id);
      const packageName = template
        ? `${template.name_ar} / ${template.name_en}`
        : `Package ${inst.instance_id.slice(0, 8)}`;

      return {
        instance_id: inst.instance_id,
        package_name: packageName,
        journey_state: inst.journey_state,
        last_assessment_date: assessmentMap.get(inst.instance_id) ?? null,
        expires_at: inst.expires_at,
      };
    });

    return NextResponse.json({ packages });
  } catch (error) {
    console.error('[GET /api/packages]', error);
    return NextResponse.json(
      { error: 'Failed to load packages' },
      { status: 500 }
    );
  }
}
