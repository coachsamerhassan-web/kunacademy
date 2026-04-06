import { NextResponse, type NextRequest } from 'next/server';
import { db, withAdminContext } from '@kunacademy/db';
import { uploadFile, getPublicUrl } from '@kunacademy/db/storage';
import { pathfinder_responses, custom_benefit_submissions } from '@kunacademy/db/schema';
import { cms } from '@kunacademy/cms/server';
import { calculateCorporateRoi } from '@kunacademy/cms';
import type { SelectedBenefit } from '@kunacademy/cms';
import { sendProposalEmail, createZohoCrmContact, alertNewProposal } from '@kunacademy/email';
import { generateProposalPdf } from '@/lib/pathfinder/proposal-pdf';
import { generateRadarChartSvg } from '@/lib/pathfinder/radar-chart-svg';

// ── Rate limiting (shared in-memory, same pattern as /api/pathfinder) ─────────

const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_MAX = 20;
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000; // 1 hour

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

// Prune stale entries every 10 minutes
setInterval(() => {
  const now = Date.now();
  for (const [ip, entry] of rateLimitMap) {
    if (now > entry.resetAt) rateLimitMap.delete(ip);
  }
}, 10 * 60 * 1000);

// ── Hardcoded corporate settings (matches engine defaults) ────────────────────

const DEFAULT_CORPORATE_SETTINGS = {
  corporate_multiplier: 2,
  per_leader_session_rate: 2000,
  per_leader_package_sessions: 6,
  base_program_price_aed: 15000,
};

// ── Types ─────────────────────────────────────────────────────────────────────

interface SelfAssessmentItem {
  benefit_id: string;
  current: number;
  target_3m: number;
  target_6m: number;
}

interface ProposalRequestBody {
  contact: {
    name: string;
    email: string;
    job_title: string;
  };
  direction: string;
  direction_label_ar: string;
  direction_label_en: string;
  selected_benefits: SelectedBenefit[];
  self_assessment: SelfAssessmentItem[];
  roi_inputs: {
    team_size: number;
    avg_salary: number;
    turnover_rate: number;
    absenteeism_days: number;
    engagement_score: number;
  };
  custom_benefit_text?: string;
  locale: 'ar' | 'en';
}

// ── Input sanitization ────────────────────────────────────────────────────────

/** Strip HTML tags, trim, enforce max length. */
function sanitize(input: string, maxLen = 500): string {
  return input
    .replace(/<[^>]*>/g, '')   // strip tags
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .trim()
    .slice(0, maxLen);
}

// ── Validation ────────────────────────────────────────────────────────────────

function validate(body: ProposalRequestBody): string | null {
  const { contact, direction, selected_benefits, roi_inputs } = body;

  if (!contact?.name || !contact?.email) {
    return 'name and email are required';
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(contact.email))) {
    return 'Invalid email address';
  }
  if (!contact.job_title) {
    return 'job_title is required';
  }
  if (!direction) {
    return 'direction is required';
  }
  if (!Array.isArray(selected_benefits) || selected_benefits.length < 1 || selected_benefits.length > 5) {
    return 'selected_benefits must contain 1–5 items';
  }
  if (!roi_inputs || typeof roi_inputs !== 'object') {
    return 'roi_inputs is required';
  }
  const { team_size, avg_salary, turnover_rate, absenteeism_days, engagement_score } = roi_inputs;
  if (
    typeof team_size !== 'number' ||
    typeof avg_salary !== 'number' ||
    typeof turnover_rate !== 'number' ||
    typeof absenteeism_days !== 'number' ||
    typeof engagement_score !== 'number'
  ) {
    return 'roi_inputs fields must be numbers';
  }

  // Range validation
  if (team_size < 1 || team_size > 10000) return 'team_size must be 1–10,000';
  if (avg_salary < 1000 || avg_salary > 10000000) return 'avg_salary must be 1,000–10,000,000';
  if (turnover_rate < 0 || turnover_rate > 100) return 'turnover_rate must be 0–100';
  if (absenteeism_days < 0 || absenteeism_days > 365) return 'absenteeism_days must be 0–365';
  if (engagement_score < 0 || engagement_score > 100) return 'engagement_score must be 0–100';

  // self_assessment array length cap
  if (!Array.isArray(body.self_assessment) || body.self_assessment.length < 1 || body.self_assessment.length > 20) {
    return 'self_assessment must contain 1–20 items';
  }

  // custom_benefit_text length guard
  if (body.custom_benefit_text && String(body.custom_benefit_text).length > 2000) {
    return 'custom_benefit_text must be under 2000 characters';
  }

  // Max string lengths
  if (
    String(contact.name).length > 200 ||
    String(contact.email).length > 254 ||
    String(contact.job_title).length > 200 ||
    String(direction).length > 200
  ) {
    return 'Input too long';
  }

  return null;
}

// ── Storage helper ────────────────────────────────────────────────────────────

async function uploadToStorage(
  bucket: string,
  filePath: string,
  data: Uint8Array,
  contentType: string
): Promise<string> {
  const buffer = Buffer.from(data);
  await uploadFile(bucket, filePath, buffer, { contentType, upsert: true });
  return getPublicUrl(bucket, filePath);
}

// ── POST handler ──────────────────────────────────────────────────────────────

/**
 * POST /api/pathfinder/proposal
 * Public endpoint — no auth required.
 * Generates a corporate coaching proposal PDF, stores it, fires side effects.
 */
export async function POST(request: NextRequest) {
  // 1. Rate limit
  const ip =
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    'unknown';

  if (isRateLimited(ip)) {
    return NextResponse.json(
      {
        error: 'Too many requests. Please try again later.',
        error_ar: 'طلبات كثيرة. يرجى المحاولة لاحقًا.',
      },
      { status: 429 }
    );
  }

  try {
    const body = (await request.json()) as ProposalRequestBody;

    // 2. Validate
    const validationError = validate(body);
    if (validationError) {
      return NextResponse.json({ error: validationError }, { status: 400 });
    }

    const {
      contact,
      direction,
      direction_label_ar,
      direction_label_en,
      selected_benefits,
      self_assessment,
      roi_inputs,
      custom_benefit_text,
      locale = 'ar',
    } = body;

    const name = sanitize(contact.name, 200);
    const email = sanitize(contact.email, 254);
    const jobTitle = sanitize(contact.job_title, 200);
    const directionSanitized = sanitize(direction, 200);
    const directionArSanitized = sanitize(direction_label_ar ?? '', 200);
    const directionEnSanitized = sanitize(direction_label_en ?? '', 200);

    // 3. Calculate ROI
    const roiResult = calculateCorporateRoi(roi_inputs, selected_benefits, DEFAULT_CORPORATE_SETTINGS);

    // 4. Generate radar chart SVG
    //    3 datasets: current (purple, dashed), 3-month (orange), 6-month (green)
    const benefitLabels = selected_benefits.map(b =>
      locale === 'ar' ? b.label_ar : b.label_en
    );

    const radarSvg = generateRadarChartSvg({
      labels: benefitLabels,
      isAr: locale === 'ar',
      datasets: [
        {
          label: locale === 'ar' ? 'الحالي' : 'Current',
          color: '#474099',
          opacity: 0.15,
          dashed: true,
          values: self_assessment.map(s => s.current),
        },
        {
          label: locale === 'ar' ? 'بعد 3 أشهر' : '3 months',
          color: '#E4601E',
          opacity: 0.2,
          values: self_assessment.map(s => s.target_3m),
        },
        {
          label: locale === 'ar' ? 'بعد 6 أشهر' : '6 months',
          color: '#22C55E',
          opacity: 0.25,
          values: self_assessment.map(s => s.target_6m),
        },
      ],
    });

    // 5. Fetch optional testimonial (first featured one; no `type` field on Testimonial)
    let testimonial: { text_ar?: string; text_en?: string; author?: string } | undefined;
    try {
      const testimonials = await cms.getFeaturedTestimonials();
      const first = testimonials?.[0];
      if (first) {
        testimonial = {
          text_ar: first.content_ar,
          text_en: first.content_en,
          author: locale === 'ar' ? first.name_ar : first.name_en,
        };
      }
    } catch (err) {
      console.error('[api/pathfinder/proposal] Testimonial fetch failed (non-fatal):', err);
    }

    // 6. Generate PDF
    const benefitsForPdf = roiResult.per_benefit_savings.map((savingsItem, i) => {
      const src = selected_benefits[i];
      return {
        label_ar: src?.label_ar ?? '',
        label_en: src?.label_en ?? '',
        annual_savings: savingsItem.annual_savings,
        improvement_pct: src?.benchmark_improvement_pct ?? 0,
        citation_ar: src?.citation_ar ?? '',
        citation_en: src?.citation_en ?? '',
      };
    });

    let pdfBytes: Uint8Array;
    try {
      pdfBytes = await generateProposalPdf({
        name,
        email,
        jobTitle,
        direction: directionEnSanitized || directionSanitized,
        directionAr: directionArSanitized,
        selectedBenefits: benefitsForPdf,
        selfAssessment: self_assessment,
        totalAnnualSavings: roiResult.total_annual_savings,
        fullProgramCost: roiResult.full_program_cost,
        perLeaderCost: roiResult.per_leader_cost,
        fullProgramRoiMultiple: roiResult.full_program_roi_multiple,
        perLeaderRoiMultiple: roiResult.per_leader_roi_multiple,
        radarSvg,
        testimonial,
        locale,
      });
    } catch (err) {
      console.error('[api/pathfinder/proposal] PDF generation failed:', err);
      return NextResponse.json({ error: 'Failed to generate proposal' }, { status: 500 });
    }

    // 7. Upload to local storage
    const timestamp = Date.now();
    const sanitizedEmail = email.replace(/[^a-zA-Z0-9]/g, '_').slice(0, 40);
    const fileName = `proposal_${timestamp}_${sanitizedEmail}.pdf`;

    let proposalPdfUrl: string;
    try {
      proposalPdfUrl = await uploadToStorage('proposals', fileName, pdfBytes, 'application/pdf');
    } catch (err) {
      console.error('[api/pathfinder/proposal] Storage upload failed:', err);
      return NextResponse.json({ error: 'Failed to store proposal' }, { status: 500 });
    }

    // 8. Insert DB record using Drizzle
    let responseRecord: { id: string };
    try {
      const [inserted] = await db
        .insert(pathfinder_responses)
        .values({
          name,
          email,
          phone: null,
          type: 'corporate',
          answers_json: [],
          recommendations: [],
          roi_inputs,
          journey_stage: 'corporate',
          locale,
          direction: directionSanitized,
          selected_benefits,
          self_assessment,
          custom_benefits: custom_benefit_text ? [sanitize(custom_benefit_text, 1000)] : null,
          proposal_pdf_url: proposalPdfUrl,
          job_title: jobTitle,
        })
        .returning({ id: pathfinder_responses.id });

      if (!inserted) {
        console.error('[api/pathfinder/proposal] DB insert returned no data');
        return NextResponse.json({ error: 'Failed to save proposal' }, { status: 500 });
      }
      responseRecord = inserted;
    } catch (insertError) {
      console.error('[api/pathfinder/proposal] DB insert failed:', insertError);
      return NextResponse.json({ error: 'Failed to save proposal' }, { status: 500 });
    }

    // 9. Fire-and-forget side effects
    const pdfBase64 = Buffer.from(pdfBytes).toString('base64');

    Promise.allSettled([
      sendProposalEmail(
        email,
        {
          name,
          direction: directionEnSanitized || directionSanitized,
          directionAr: directionArSanitized,
          totalSavings: roiResult.total_annual_savings,
          roiMultiple: roiResult.full_program_roi_multiple,
        },
        pdfBase64,
        locale
      ),

      createZohoCrmContact(name, email, undefined, 'Pathfinder Corporate'),

      alertNewProposal({
        name,
        email,
        jobTitle,
        direction: directionEnSanitized || directionSanitized,
        totalSavings: roiResult.total_annual_savings,
        roiMultiple: roiResult.full_program_roi_multiple,
      }),

      // SCHEMA NOTE: custom_benefit_submissions schema uses (pathfinder_response_id, direction, benefit_text)
      // The old Supabase insert used (name, email, benefit_text, direction) which doesn't match the Drizzle schema.
      // Inserting with the correct schema fields:
      ...(custom_benefit_text
        ? [
            withAdminContext(async (adminDb) => {
              await adminDb.insert(custom_benefit_submissions).values({
                pathfinder_response_id: responseRecord.id,
                direction: directionSanitized,
                benefit_text: sanitize(custom_benefit_text, 1000),
              });
            }),
          ]
        : []),
    ]).then(results => {
      results.forEach((result, i) => {
        if (result.status === 'rejected') {
          console.error(`[api/pathfinder/proposal] Side effect ${i} failed:`, result.reason);
        }
      });
    });

    // 10. Return
    return NextResponse.json({
      id: responseRecord.id,
      proposal_pdf_url: proposalPdfUrl,
    });
  } catch (err) {
    console.error('[api/pathfinder/proposal] Unhandled error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
