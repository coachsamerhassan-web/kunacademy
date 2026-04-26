/**
 * GET /api/admin/scholarships/programs — Wave E.5 admin canon program list.
 *
 * Returns programs.scholarship_eligible=true rows for the admin manual-entry
 * dropdown. Auth-gated to admin role.
 */

import { NextResponse } from 'next/server';
import { getAuthUser } from '@kunacademy/auth/server';
import { listEligibleScholarshipPrograms } from '@/lib/scholarship-application';

function isAdmin(role: string | undefined): boolean {
  return role === 'admin' || role === 'super_admin';
}

export async function GET() {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!isAdmin(user.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  try {
    const programs = await listEligibleScholarshipPrograms();
    return NextResponse.json({ programs });
  } catch (err) {
    console.error('[admin-scholarships-programs] lookup failed:', err);
    return NextResponse.json({ error: 'lookup-failed' }, { status: 500 });
  }
}
