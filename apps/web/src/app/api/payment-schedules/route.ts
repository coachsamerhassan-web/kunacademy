// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * Payment Schedules API
 * GET — list schedules for current user (or all for admin)
 * POST — create a deposit/installment schedule
 * PATCH — record a payment against a schedule
 */
export async function GET(req: NextRequest) {
  try {
    const token = req.headers.get('authorization')?.replace('Bearer ', '');
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: { user } } = await supabase.auth.getUser(token);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    const isAdmin = profile?.role === 'admin';

    let query = supabase
      .from('payment_schedules')
      .select(`
        id, payment_id, total_amount, paid_amount, remaining_amount,
        schedule_type, installments, currency, created_at,
        payment:payments(id, course_id, status),
        user:profiles!payment_schedules_user_id_fkey(id, full_name, email)
      `)
      .order('created_at', { ascending: false });

    if (!isAdmin) {
      query = query.eq('user_id', user.id);
    }

    const { data, error } = await query;
    if (error) throw error;

    return NextResponse.json({ schedules: data || [] });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const token = req.headers.get('authorization')?.replace('Bearer ', '');
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: { user } } = await supabase.auth.getUser(token);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { payment_id, schedule_type, installment_count, currency = 'AED' } = body;

    if (!payment_id || !schedule_type) {
      return NextResponse.json({ error: 'payment_id and schedule_type required' }, { status: 400 });
    }

    // Get payment details
    const { data: payment } = await supabase
      .from('payments')
      .select('id, amount, currency, user_id')
      .eq('id', payment_id)
      .single();

    if (!payment) {
      return NextResponse.json({ error: 'Payment not found' }, { status: 404 });
    }

    const totalAmount = payment.amount;
    let installments: Array<{ due_date: string; amount: number; status: string; paid_at: string | null }> = [];

    if (schedule_type === 'deposit_balance') {
      // 30% deposit now, remaining before program start
      const deposit = Math.round(totalAmount * 0.3);
      const balance = totalAmount - deposit;
      const balanceDue = new Date();
      balanceDue.setDate(balanceDue.getDate() + 30); // 30 days for balance

      installments = [
        { due_date: new Date().toISOString(), amount: deposit, status: 'paid', paid_at: new Date().toISOString() },
        { due_date: balanceDue.toISOString(), amount: balance, status: 'pending', paid_at: null },
      ];
    } else if (schedule_type === 'installment') {
      // Split evenly across installment_count (2-6)
      const count = Math.min(Math.max(installment_count || 3, 2), 6);
      const perInstallment = Math.floor(totalAmount / count);
      const remainder = totalAmount - perInstallment * count;

      for (let i = 0; i < count; i++) {
        const dueDate = new Date();
        dueDate.setMonth(dueDate.getMonth() + i);
        installments.push({
          due_date: dueDate.toISOString(),
          amount: perInstallment + (i === 0 ? remainder : 0), // first installment absorbs rounding
          status: i === 0 ? 'paid' : 'pending',
          paid_at: i === 0 ? new Date().toISOString() : null,
        });
      }
    }

    const paidAmount = installments.filter(i => i.status === 'paid').reduce((s, i) => s + i.amount, 0);

    const { data: schedule, error } = await supabase
      .from('payment_schedules')
      .insert({
        payment_id,
        user_id: payment.user_id,
        total_amount: totalAmount,
        paid_amount: paidAmount,
        remaining_amount: totalAmount - paidAmount,
        schedule_type,
        installments: JSON.stringify(installments),
        currency,
      })
      .select('id')
      .single();

    if (error) throw error;

    return NextResponse.json({ schedule_id: schedule!.id, installments }, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const token = req.headers.get('authorization')?.replace('Bearer ', '');
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: { user } } = await supabase.auth.getUser(token);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { schedule_id, installment_index, payment_amount } = body;

    if (!schedule_id || installment_index === undefined) {
      return NextResponse.json({ error: 'schedule_id and installment_index required' }, { status: 400 });
    }

    // Get current schedule
    const { data: schedule } = await supabase
      .from('payment_schedules')
      .select('*')
      .eq('id', schedule_id)
      .single();

    if (!schedule) {
      return NextResponse.json({ error: 'Schedule not found' }, { status: 404 });
    }

    const installments = typeof schedule.installments === 'string'
      ? JSON.parse(schedule.installments)
      : schedule.installments;

    if (installment_index < 0 || installment_index >= installments.length) {
      return NextResponse.json({ error: 'Invalid installment index' }, { status: 400 });
    }

    // Mark installment as paid
    installments[installment_index].status = 'paid';
    installments[installment_index].paid_at = new Date().toISOString();

    const paidAmount = installments.filter((i: any) => i.status === 'paid').reduce((s: number, i: any) => s + i.amount, 0);

    const { error } = await supabase
      .from('payment_schedules')
      .update({
        installments: JSON.stringify(installments),
        paid_amount: paidAmount,
        remaining_amount: schedule.total_amount - paidAmount,
      })
      .eq('id', schedule_id);

    if (error) throw error;

    return NextResponse.json({ success: true, paid_amount: paidAmount, remaining: schedule.total_amount - paidAmount });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
