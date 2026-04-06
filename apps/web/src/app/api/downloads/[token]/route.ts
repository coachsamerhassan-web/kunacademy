import { NextResponse, type NextRequest } from 'next/server';
import { withAdminContext } from '@kunacademy/db';
import { download_tokens, digital_assets } from '@kunacademy/db/schema';
import { eq } from 'drizzle-orm';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;

    // Look up the download token
    const [downloadToken] = await withAdminContext(async (db) => {
      return db.select()
        .from(download_tokens)
        .where(eq(download_tokens.token, token))
        .limit(1);
    });

    if (!downloadToken) {
      return NextResponse.json(
        {
          error: 'Invalid download link',
          error_ar: 'رابط التحميل غير صالح',
        },
        { status: 403 }
      );
    }

    // Check expiration
    if (new Date(downloadToken.expires_at) < new Date()) {
      return NextResponse.json(
        {
          error: 'This download link has expired',
          error_ar: 'انتهت صلاحية رابط التحميل',
        },
        { status: 410 }
      );
    }

    // Check download count
    if ((downloadToken.download_count ?? 0) >= (downloadToken.max_downloads ?? Infinity)) {
      return NextResponse.json(
        {
          error: 'Maximum download limit reached',
          error_ar: 'تم الوصول إلى الحد الأقصى للتحميل',
        },
        { status: 410 }
      );
    }

    // Get the digital asset
    const [asset] = await withAdminContext(async (db) => {
      return db.select()
        .from(digital_assets)
        .where(eq(digital_assets.id, downloadToken.asset_id))
        .limit(1);
    });

    if (!asset) {
      return NextResponse.json(
        {
          error: 'Digital asset not found',
          error_ar: 'الملف الرقمي غير موجود',
        },
        { status: 404 }
      );
    }

    // Increment download count
    await withAdminContext(async (db) => {
      await db.update(download_tokens)
        .set({ download_count: (downloadToken.download_count ?? 0) + 1 })
        .where(eq(download_tokens.id, downloadToken.id));
    });

    // Redirect to the actual file URL
    return NextResponse.redirect(asset.file_url);
  } catch (err: any) {
    console.error('[downloads/token]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
