// @ts-nocheck — DB types resolve to `never` for download_tokens/digital_assets. Fix with: supabase gen types
import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@kunacademy/db';

const supabase = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;

    // Look up the download token
    const { data: downloadToken, error } = await supabase
      .from('download_tokens')
      .select('*')
      .eq('token', token)
      .single();

    if (error || !downloadToken) {
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
    if (downloadToken.download_count >= downloadToken.max_downloads) {
      return NextResponse.json(
        {
          error: 'Maximum download limit reached',
          error_ar: 'تم الوصول إلى الحد الأقصى للتحميل',
        },
        { status: 410 }
      );
    }

    // Get the digital asset
    const { data: asset, error: assetError } = await supabase
      .from('digital_assets')
      .select('*')
      .eq('id', downloadToken.asset_id)
      .single();

    if (assetError || !asset) {
      return NextResponse.json(
        {
          error: 'Digital asset not found',
          error_ar: 'الملف الرقمي غير موجود',
        },
        { status: 404 }
      );
    }

    // Increment download count
    await supabase
      .from('download_tokens')
      .update({ download_count: downloadToken.download_count + 1 })
      .eq('id', downloadToken.id);

    // Redirect to the actual file URL
    return NextResponse.redirect(asset.file_url);
  } catch (err: any) {
    console.error('[downloads/token]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
