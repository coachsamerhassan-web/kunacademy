import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@kunacademy/db';
import path from 'path';
import fs from 'fs/promises';

// Rate limiting — simple in-memory store (per-instance)
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(userId: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(userId);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(userId, { count: 1, resetAt: now + 5000 });
    return true;
  }
  if (entry.count >= 3) return false; // max 3 requests per 5 seconds
  entry.count++;
  return true;
}

// Book metadata (hardcoded for now — will move to DB/CMS later)
const BOOKS: Record<string, { pdfPath: string; samplePdfPath: string; isPaid: boolean }> = {
  'balance-to-barakah': {
    pdfPath: 'balance-to-barakah/full.pdf',
    samplePdfPath: 'balance-to-barakah/sample.pdf',
    isPaid: true,
  },
};

/**
 * GET /api/books/[slug]/pages?sample=true
 * Serves the PDF binary for client-side rendering via pdf.js canvas.
 * - Sample: no auth required
 * - Full: requires auth + book_access record
 *
 * The client renders via canvas (no text layer = no copy/download).
 * PDF bytes are consumed by pdf.js, never exposed as a downloadable link.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    const isSample = request.nextUrl.searchParams.get('sample') === 'true';

    // Validate book exists
    const book = BOOKS[slug];
    if (!book) {
      return NextResponse.json({ error: 'Book not found' }, { status: 404 });
    }

    let userId = 'anonymous';

    // For paid books (non-sample), require authentication
    if (book.isPaid && !isSample) {
      const supabase = createServerClient();
      if (!supabase) {
        return NextResponse.json({ error: 'Auth not configured' }, { status: 500 });
      }
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
      }

      userId = user.id;

      // Check book access
      const { data: access } = await supabase
        .from('book_access')
        .select('id')
        .eq('user_id', user.id)
        .eq('book_slug', slug)
        .single();

      if (!access) {
        return NextResponse.json({ error: 'Book access not granted' }, { status: 403 });
      }
    }

    // Rate limit check
    if (!checkRateLimit(userId)) {
      return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
    }

    // Resolve PDF path — content directory is at repo root /content/books/
    const cwd = process.cwd();
    const contentDir = cwd.endsWith('apps/web')
      ? path.resolve(cwd, '../../content/books')
      : path.resolve(cwd, 'content/books');
    const pdfRelPath = isSample ? book.samplePdfPath : book.pdfPath;
    const pdfFullPath = path.join(contentDir, pdfRelPath);

    // Verify file exists
    try {
      await fs.access(pdfFullPath);
    } catch {
      return NextResponse.json({ error: 'PDF file not found' }, { status: 500 });
    }

    // Read and serve PDF
    const pdfData = await fs.readFile(pdfFullPath);

    return new NextResponse(pdfData, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        // Prevent browser from offering download — inline only
        'Content-Disposition': 'inline',
        // Cache for 1 hour, private (per-user)
        'Cache-Control': 'private, max-age=3600',
        // Prevent embedding in iframes on other sites
        'X-Frame-Options': 'SAMEORIGIN',
      },
    });
  } catch (error) {
    console.error('[books/pages] Error:', error);
    return NextResponse.json(
      { error: 'Failed to serve book' },
      { status: 500 }
    );
  }
}
