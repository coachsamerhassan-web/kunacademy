import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { cms, scoreAnswers } from '@kunacademy/cms';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_MAX = 20;
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return false;
  }
  entry.count++;
  if (entry.count > RATE_LIMIT_MAX) return true;
  return false;
}

setInterval(() => {
  const now = Date.now();
  for (const [ip, entry] of rateLimitMap) {
    if (now > entry.resetAt) rateLimitMap.delete(ip);
  }
}, 10 * 60 * 1000);

/**
 * GET /api/pathfinder?parent_answer_id=xxx
 * Fetches child questions for a given parent answer (lazy branch loading).
 * Also: GET /api/pathfinder?type=individual|corporate — fetches root questions.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const parentAnswerId = searchParams.get('parent_answer_id');
  const type = searchParams.get('type') as 'individual' | 'corporate' | null;

  if (parentAnswerId) {
    const children = await cms.getPathfinderChildren(parentAnswerId);
    return NextResponse.json({ questions: children });
  }

  if (type) {
    const roots = await cms.getPathfinderRoots(type);
    return NextResponse.json({ questions: roots });
  }

  // Default: all root questions
  const roots = await cms.getPathfinderRoots();
  return NextResponse.json({ questions: roots });
}

/**
 * POST /api/pathfinder
 * Stores a completed assessment and returns recommendations.
 * Body: { answers: [{question_id, answer_id, category_weights}], contact: {name, email, phone?}, type, roi_inputs?, locale? }
 */
export async function POST(request: NextRequest) {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || request.headers.get('x-real-ip') || 'unknown';
  if (isRateLimited(ip)) {
    return NextResponse.json({ error: 'Too many requests. Please try again later.', error_ar: 'طلبات كثيرة. يرجى المحاولة لاحقًا.' }, { status: 429 });
  }

  try {
    const body = await request.json();
    const { answers, contact, type, roi_inputs, locale = 'ar' } = body;

    if (!contact?.name || !contact?.email || !type) {
      return NextResponse.json(
        { error: 'name, email, and type are required' },
        { status: 400 }
      );
    }

    if (!answers || !Array.isArray(answers) || answers.length === 0) {
      return NextResponse.json(
        { error: 'answers array is required' },
        { status: 400 }
      );
    }

    // Score recommendations from the answer trail
    const allPrograms = await cms.getAllPrograms();
    const recommendations = scoreAnswers(answers, allPrograms, type);

    // Determine journey stage from answers
    const journeyStage = determineJourneyStage(answers);

    // Store in Supabase
    const { data, error } = await supabase
      .from('pathfinder_responses')
      .insert({
        name: sanitize(contact.name),
        email: sanitize(contact.email),
        phone: contact.phone ? sanitize(contact.phone) : null,
        type,
        answers_json: answers,
        recommendations,
        roi_inputs: roi_inputs || null,
        journey_stage: journeyStage,
        locale,
      })
      .select('id')
      .single();

    if (error) {
      console.error('[api/pathfinder] Insert error:', error);
      return NextResponse.json({ error: 'Failed to save response' }, { status: 500 });
    }

    return NextResponse.json({
      id: data.id,
      recommendations,
      journey_stage: journeyStage,
    });
  } catch (err) {
    console.error('[api/pathfinder] Error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/** Determine journey stage based on experience-related answers */
function determineJourneyStage(
  answers: Array<{ question_id: string; answer_id: string; category_weights?: Record<string, number> }>
): string {
  // Look for experience-level indicators in the category weights
  let certificationScore = 0;
  let freeScore = 0;
  let totalWeight = 0;

  for (const a of answers) {
    if (a.category_weights) {
      certificationScore += a.category_weights.certification || 0;
      freeScore += a.category_weights.free || 0;
      totalWeight += Object.values(a.category_weights).reduce((s, v) => s + v, 0);
    }
  }

  // High free/exploratory intent → Explorer
  // Moderate certification interest → Seeker
  // Strong certification path → Practitioner
  // Already certified + seeking more → Master
  if (totalWeight === 0) return 'explorer';
  const certRatio = certificationScore / totalWeight;
  if (freeScore > certificationScore) return 'explorer';
  if (certRatio < 0.3) return 'seeker';
  if (certRatio < 0.6) return 'practitioner';
  return 'master';
}

/** Basic sanitization to prevent XSS in stored data */
function sanitize(input: string): string {
  return input
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .trim()
    .slice(0, 500); // Max length
}
