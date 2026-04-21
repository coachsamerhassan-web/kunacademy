import { NextResponse, type NextRequest } from 'next/server';
import { db } from '@kunacademy/db';
import { pathfinder_responses } from '@kunacademy/db/schema';
import { cms } from '@kunacademy/cms/server';
import { scoreAnswers } from '@/lib/pathfinder-scorer';

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
    const {
      answers,
      contact,
      type,
      roi_inputs,
      locale = 'ar',
      // Samer decision #6 (2026-04-21): email consent is opt-in; default false.
      email_consent = false,
      // Samer decision #7 (2026-04-21): only book-call clickers upsert a CRM
      // lead. The client POSTs this flag true only when the user actually
      // clicked the book-call CTA — not on completion.
      book_call_intent = false,
    } = body;

    if (!contact?.name || !contact?.email || !type) {
      return NextResponse.json(
        { error: 'name, email, and type are required' },
        { status: 400 }
      );
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(contact.email))) {
      return NextResponse.json({ error: 'Invalid email address' }, { status: 400 });
    }

    if (
      String(contact.name).length > 200 ||
      String(contact.email).length > 254 ||
      (contact.phone && String(contact.phone).length > 30) ||
      String(type).length > 50 ||
      (Array.isArray(answers) && answers.length > 100)
    ) {
      return NextResponse.json({ error: 'Input too long' }, { status: 400 });
    }

    if (!answers || !Array.isArray(answers) || answers.length === 0) {
      return NextResponse.json(
        { error: 'answers array is required' },
        { status: 400 }
      );
    }

    // Score recommendations from the answer trail (already top-3 ranked)
    const allPrograms = await cms.getAllPrograms();
    const recommendations = scoreAnswers(answers, allPrograms, type).slice(0, 3);

    // Determine journey stage from answers
    const journeyStage = determineJourneyStage(answers);

    // Migration 0045 — pin this response to the active tree version so
    // analytics can ask "of users who saw v2, how many enrolled in STCE?".
    // Nullable for legacy safety; getActivePathfinderVersion returns null
    // only if the DB was never seeded (shouldn't happen post-0045).
    const activeVersion = await cms.getActivePathfinderVersion();
    const treeVersionId = activeVersion?.id ?? null;

    // Store in DB using Drizzle
    const [data] = await db
      .insert(pathfinder_responses)
      .values({
        name: sanitize(contact.name),
        email: sanitize(contact.email),
        phone: contact.phone ? sanitize(contact.phone) : null,
        type,
        answers_json: answers,
        recommendations,
        roi_inputs: roi_inputs || null,
        journey_stage: journeyStage,
        locale,
        tree_version_id: treeVersionId,
      })
      .returning({ id: pathfinder_responses.id });

    if (!data) {
      console.error('[api/pathfinder] Insert returned no data');
      return NextResponse.json({ error: 'Failed to save response' }, { status: 500 });
    }

    // Fire-and-forget side effects. These failures must not block the response.
    // (Decisions locked by Samer 2026-04-21: email opt-in only; CRM on book-call only.)
    if (email_consent === true) {
      // Hook point — when a pathfinder summary email template exists in @kunacademy/email,
      // wire it here. Deferred until the template ships (separate micro-wave).
      console.info(`[api/pathfinder] email_consent=true for ${contact.email} — summary email deferred (template pending)`);
    }
    if (book_call_intent === true) {
      console.info(`[api/pathfinder] book_call_intent=true for ${contact.email} — CRM lead upsert hook (template pending)`);
    }

    return NextResponse.json({
      id: data.id,
      recommendations,
      journey_stage: journeyStage,
      tree_version_id: treeVersionId,
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
