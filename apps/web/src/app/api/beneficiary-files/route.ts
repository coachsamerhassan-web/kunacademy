import { NextRequest, NextResponse } from 'next/server';
import { withAdminContext, withUserContext, eq } from '@kunacademy/db';
import { beneficiaryFiles, packageInstances } from '@kunacademy/db/schema';
import { getAuthUser } from '@kunacademy/auth/server';

/**
 * POST /api/beneficiary-files
 * Create a beneficiary file for a package instance (student action).
 *
 * Source: SPEC-mentoring-package-template.md §6.1
 * Sub-phase: S2-Layer-1 / 1.3
 *
 * Body:
 *   { package_instance_id: string, client_number: 1 | 2, client_alias?: string, first_session_date?: string }
 *
 * Authorization:
 *   - User must be the student on the referenced package_instance.
 *   - Admins can create on behalf of any student (via withAdminContext).
 */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

interface CreateBody {
  package_instance_id: string;
  client_number: 1 | 2;
  client_alias?: string;
  first_session_date?: string;
}

function validateCreateBody(raw: unknown): { data: CreateBody } | { error: string } {
  if (!raw || typeof raw !== 'object') return { error: 'Body must be a JSON object' };
  const b = raw as Record<string, unknown>;

  if (typeof b.package_instance_id !== 'string' || !UUID_RE.test(b.package_instance_id)) {
    return { error: 'package_instance_id must be a valid UUID' };
  }
  if (b.client_number !== 1 && b.client_number !== 2) {
    return { error: 'client_number must be 1 or 2' };
  }
  if (b.client_alias !== undefined && (typeof b.client_alias !== 'string' || b.client_alias.length > 120)) {
    return { error: 'client_alias must be a string ≤ 120 characters' };
  }
  if (b.first_session_date !== undefined && (typeof b.first_session_date !== 'string' || !DATE_RE.test(b.first_session_date))) {
    return { error: 'first_session_date must be YYYY-MM-DD' };
  }

  return {
    data: {
      package_instance_id: b.package_instance_id,
      client_number:       b.client_number as 1 | 2,
      client_alias:        b.client_alias  as string | undefined,
      first_session_date:  b.first_session_date as string | undefined,
    },
  };
}

export async function POST(request: NextRequest) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const validation = validateCreateBody(rawBody);
  if ('error' in validation) {
    return NextResponse.json({ error: validation.error }, { status: 422 });
  }

  const { package_instance_id, client_number, client_alias, first_session_date } = validation.data;

  // Verify the requesting user is the student on this package_instance.
  // Admins bypass this check.
  if (user.role !== 'admin' && user.role !== 'super_admin') {
    const instance = await withAdminContext(async (db) => {
      const rows = await db
        .select({ student_id: packageInstances.student_id })
        .from(packageInstances)
        .where(eq(packageInstances.id, package_instance_id))
        .limit(1);
      return rows[0] ?? null;
    });

    if (!instance) {
      return NextResponse.json({ error: 'Package instance not found' }, { status: 404 });
    }
    if (instance.student_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
  }

  // Insert via user context so RLS INSERT policy validates
  const inserted = await withUserContext(user.id, async (db) => {
    const rows: { id: string }[] = await db
      .insert(beneficiaryFiles)
      .values({
        package_instance_id,
        client_number,
        client_alias:       client_alias   ?? null,
        first_session_date: first_session_date ?? null,
      })
      .returning({ id: beneficiaryFiles.id });
    return rows[0] ?? null;
  });

  if (!inserted) {
    return NextResponse.json({ error: 'Insert failed' }, { status: 500 });
  }

  return NextResponse.json({ beneficiary_file_id: inserted.id }, { status: 201 });
}
