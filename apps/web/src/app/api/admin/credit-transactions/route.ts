import { NextResponse } from 'next/server';
import { db } from '@kunacademy/db';
import { getAuthUser } from '@kunacademy/auth/server';
import { eq, desc } from 'drizzle-orm';
import { credit_transactions, profiles } from '@kunacademy/db/schema';

async function requireAdmin() {
  const user = await getAuthUser();
  if (!user) return null;
  const rows = await db
    .select({ role: profiles.role })
    .from(profiles)
    .where(eq(profiles.id, user.id))
    .limit(1);
  const role = rows[0]?.role;
  if (role !== 'admin' && role !== 'super_admin') return null;
  return user;
}

export async function GET() {
  const user = await requireAdmin();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const transactions = await db
    .select({
      id: credit_transactions.id,
      user_id: credit_transactions.user_id,
      amount: credit_transactions.amount,
      type: credit_transactions.type,
      source_type: credit_transactions.source_type,
      balance_after: credit_transactions.balance_after,
      note: credit_transactions.note,
      created_at: credit_transactions.created_at,
      user: {
        full_name_ar: profiles.full_name_ar,
        full_name_en: profiles.full_name_en,
        email: profiles.email,
      },
    })
    .from(credit_transactions)
    .leftJoin(profiles, eq(credit_transactions.user_id, profiles.id))
    .orderBy(desc(credit_transactions.created_at))
    .limit(500);

  return NextResponse.json({ transactions });
}
