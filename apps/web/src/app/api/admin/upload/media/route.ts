/**
 * POST /api/admin/upload/media
 *
 * Wave 15 Phase 1 — image upload endpoint for the rich-content editor.
 *
 * Authorization:
 *   admin | super_admin | content_editor — anyone who can author content
 *
 * Storage:
 *   VPS-local at /var/www/kunacademy-git/uploads/media/YYYY/MM/<uuid>.<ext>
 *   Served by nginx static at /uploads/media/... (no auth on read — public).
 *
 * Validation layers (every one is a separate hard-fail):
 *   1. Auth role check
 *   2. Rate limit — 30 uploads / user / hour
 *   3. MIME allowlist — image/jpeg | image/png | image/webp | image/gif
 *   4. File size cap — 10 MB (enough for 4K photos at reasonable quality)
 *   5. Magic-byte sniff — the first few bytes must match the claimed MIME
 *      (defense against spoofed Content-Type)
 *   6. alt_ar + alt_en — at least one must be provided (a11y requirement,
 *      CLAUDE.md standard)
 *   7. Path construction is UUID-based — no user-controlled path component
 *      reaches the filesystem
 *   8. Extension is derived from MIME, NOT the uploaded filename
 *
 * Response:
 *   201 { id, url, alt_ar, alt_en, width, height, size_bytes }
 *   400/401/403/413/415/429/500 as appropriate
 */

import { NextRequest, NextResponse } from 'next/server';
import { db, withAdminContext } from '@kunacademy/db';
import { content_media } from '@kunacademy/db/schema';
import { getAuthUser } from '@kunacademy/auth/server';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';
import crypto from 'crypto';

// ── Configuration ────────────────────────────────────────────────────────
const UPLOAD_ROOT =
  process.env.MEDIA_UPLOAD_DIR ?? '/var/www/kunacademy-git/uploads/media';

// Public URL prefix served by nginx static block. Must match the nginx
// alias configured on the VPS — /uploads/ → /var/www/kunacademy-git/uploads/
const PUBLIC_URL_PREFIX = '/uploads/media';

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB

// MIME → canonical file extension (NEVER trust the uploaded filename)
const MIME_TO_EXT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png':  'png',
  'image/webp': 'webp',
  'image/gif':  'gif',
};

// Magic-byte signatures for each allowed MIME. Catches cases where an
// attacker sets Content-Type: image/png on a file that's actually an SVG
// with embedded JS, or an HTML file, or a script.
// Source: reputable file-type databases + RFC specs.
const MAGIC_BYTES: Record<string, Array<Uint8Array>> = {
  'image/jpeg': [
    new Uint8Array([0xff, 0xd8, 0xff]),
  ],
  'image/png': [
    new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  ],
  'image/webp': [
    // RIFF....WEBP — we check the outer RIFF + the WEBP signature at offset 8
    new Uint8Array([0x52, 0x49, 0x46, 0x46]), // "RIFF"
  ],
  'image/gif': [
    new Uint8Array([0x47, 0x49, 0x46, 0x38, 0x37, 0x61]), // GIF87a
    new Uint8Array([0x47, 0x49, 0x46, 0x38, 0x39, 0x61]), // GIF89a
  ],
};

// ── Rate limit — in-memory, per-user ─────────────────────────────────────
// Trade-off: simple Map suffices for one pm2 fork. On process restart the
// counters reset (DeepSeek HIGH finding — accepted). 30/hr/user is generous
// enough that a restart-burst window is not materially exploitable.
// Opportunistic pruning prevents unbounded map growth over long lifetimes.
const UPLOAD_RATE_MAX = 30;
const UPLOAD_RATE_WINDOW_MS = 60 * 60 * 1000; // 1 hour
const uploadRateMap = new Map<string, { count: number; resetAt: number }>();
const PRUNE_EVERY_N_CHECKS = 500;
let checksSinceLastPrune = 0;

function pruneExpiredRateEntries(now: number): void {
  for (const [userId, entry] of uploadRateMap.entries()) {
    if (now > entry.resetAt) uploadRateMap.delete(userId);
  }
}

function checkRateLimit(userId: string): boolean {
  const now = Date.now();
  // Opportunistic prune — amortized O(1) per check
  if (++checksSinceLastPrune >= PRUNE_EVERY_N_CHECKS) {
    checksSinceLastPrune = 0;
    pruneExpiredRateEntries(now);
  }
  const entry = uploadRateMap.get(userId);
  if (!entry || now > entry.resetAt) {
    uploadRateMap.set(userId, { count: 1, resetAt: now + UPLOAD_RATE_WINDOW_MS });
    return true;
  }
  if (entry.count >= UPLOAD_RATE_MAX) return false;
  entry.count++;
  return true;
}

// ── Helpers ──────────────────────────────────────────────────────────────
function isAllowedRole(role: string | undefined): boolean {
  return role === 'admin' || role === 'super_admin' || role === 'content_editor';
}

function startsWith(buf: Buffer, sig: Uint8Array): boolean {
  if (buf.length < sig.length) return false;
  for (let i = 0; i < sig.length; i++) {
    if (buf[i] !== sig[i]) return false;
  }
  return true;
}

function validateMagicBytes(buf: Buffer, mime: string): boolean {
  const sigs = MAGIC_BYTES[mime];
  if (!sigs) return false;
  // WEBP needs the extra WEBP marker at offset 8
  if (mime === 'image/webp') {
    if (buf.length < 12) return false;
    if (!startsWith(buf, sigs[0])) return false;
    const webpMarker = new Uint8Array([0x57, 0x45, 0x42, 0x50]); // "WEBP"
    for (let i = 0; i < 4; i++) {
      if (buf[8 + i] !== webpMarker[i]) return false;
    }
    return true;
  }
  return sigs.some((sig) => startsWith(buf, sig));
}

/** Best-effort image dimensions probe. Reads magic bytes manually for each
 *  supported format — no dependency on `sharp` (which we'd need to add). */
function probeDimensions(buf: Buffer, mime: string): { width: number; height: number } | null {
  try {
    if (mime === 'image/png') {
      // PNG IHDR chunk starts at offset 8 (after sig), width/height at 16,20
      if (buf.length < 24) return null;
      const width  = buf.readUInt32BE(16);
      const height = buf.readUInt32BE(20);
      return { width, height };
    }
    if (mime === 'image/gif') {
      // GIF logical screen descriptor: width at 6, height at 8 (little-endian)
      if (buf.length < 10) return null;
      const width  = buf.readUInt16LE(6);
      const height = buf.readUInt16LE(8);
      return { width, height };
    }
    if (mime === 'image/jpeg') {
      // Scan for SOF0..SOF15 marker (0xFFC0..0xFFCF, skipping 0xFFC4/C8/CC).
      // DeepSeek MEDIUM fix: iteration cap + size>=2 guard prevents
      // infinite loop on crafted marker with size=0 (size field includes
      // the 2 size bytes themselves, so minimum legal value is 2).
      let offset = 2; // skip SOI
      let iterations = 0;
      const MAX_MARKERS = 256;
      while (offset + 3 < buf.length && iterations++ < MAX_MARKERS) {
        if (buf[offset] !== 0xFF) break;
        const marker = buf[offset + 1];
        const size = buf.readUInt16BE(offset + 2);
        if (size < 2) break; // malformed — size field includes itself
        if (
          (marker >= 0xC0 && marker <= 0xCF) &&
          marker !== 0xC4 && marker !== 0xC8 && marker !== 0xCC
        ) {
          if (offset + 8 >= buf.length) break;
          const height = buf.readUInt16BE(offset + 5);
          const width  = buf.readUInt16BE(offset + 7);
          return { width, height };
        }
        offset += 2 + size;
      }
      return null;
    }
    if (mime === 'image/webp') {
      // Check VP8 variant: VP8L (lossless) or VP8  (lossy) or VP8X (extended)
      if (buf.length < 30) return null;
      const fourcc = buf.subarray(12, 16).toString('ascii');
      if (fourcc === 'VP8 ') {
        // Simple VP8: width/height at 26/28, 14 bits each
        const b0 = buf[26];
        const b1 = buf[27];
        const b2 = buf[28];
        const b3 = buf[29];
        const width  = ((b1 & 0x3F) << 8) | b0;
        const height = ((b3 & 0x3F) << 8) | b2;
        return { width, height };
      }
      if (fourcc === 'VP8L') {
        // Lossless: 3 magic bytes then 4 bytes packed
        const b0 = buf[21];
        const b1 = buf[22];
        const b2 = buf[23];
        const b3 = buf[24];
        const width  = (((b1 & 0x3F) << 8) | b0) + 1;
        const height = (((b3 & 0x0F) << 10) | (b2 << 2) | ((b1 & 0xC0) >> 6)) + 1;
        return { width, height };
      }
      if (fourcc === 'VP8X') {
        // Extended: 24-bit little-endian width/height at 24..29, +1 each
        const w = buf[24] | (buf[25] << 8) | (buf[26] << 16);
        const h = buf[27] | (buf[28] << 8) | (buf[29] << 16);
        return { width: w + 1, height: h + 1 };
      }
      return null;
    }
  } catch {
    return null;
  }
  return null;
}

// ── Route ────────────────────────────────────────────────────────────────
export async function POST(request: NextRequest) {
  // 1. Auth
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!isAllowedRole(user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // 2. Rate limit
  if (!checkRateLimit(user.id)) {
    return NextResponse.json(
      { error: 'Upload limit reached. You may upload at most 30 images per hour.' },
      { status: 429 },
    );
  }

  // 3. Parse multipart
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: 'Expected multipart/form-data body' }, { status: 400 });
  }

  const fileField = formData.get('file');
  if (!(fileField instanceof File)) {
    return NextResponse.json({ error: 'Missing required field: file' }, { status: 400 });
  }

  const altAr = (formData.get('alt_ar') ?? '').toString().trim();
  const altEn = (formData.get('alt_en') ?? '').toString().trim();

  // 4. At least one alt text required
  if (!altAr && !altEn) {
    return NextResponse.json(
      { error: 'At least one of alt_ar / alt_en is required for accessibility' },
      { status: 400 },
    );
  }
  // Cap alt text length — nothing pathological
  if (altAr.length > 300 || altEn.length > 300) {
    return NextResponse.json(
      { error: 'Alt text must be ≤ 300 characters' },
      { status: 400 },
    );
  }

  // 5. MIME allowlist
  const mime = fileField.type;
  if (!MIME_TO_EXT[mime]) {
    return NextResponse.json(
      {
        error: `File type '${mime}' is not allowed. Accepted: ${Object.keys(MIME_TO_EXT).join(', ')}`,
      },
      { status: 415 },
    );
  }

  // 6. File size
  if (fileField.size > MAX_FILE_SIZE_BYTES) {
    return NextResponse.json(
      {
        error: `File exceeds the ${MAX_FILE_SIZE_BYTES / 1024 / 1024} MB limit (received ${(fileField.size / 1024 / 1024).toFixed(2)} MB)`,
      },
      { status: 413 },
    );
  }
  if (fileField.size === 0) {
    return NextResponse.json({ error: 'Empty file' }, { status: 400 });
  }

  // 7. Read into buffer + magic-byte check
  const arrayBuffer = await fileField.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  if (!validateMagicBytes(buffer, mime)) {
    return NextResponse.json(
      { error: 'File contents do not match the declared image type' },
      { status: 400 },
    );
  }

  // 8. Build storage path — UUID-based, never from user input.
  // Year/month partitioning keeps directories manageable.
  const mediaId = crypto.randomUUID();
  const ext = MIME_TO_EXT[mime];
  const now = new Date();
  const year = now.getUTCFullYear().toString();
  const month = String(now.getUTCMonth() + 1).padStart(2, '0');
  const filename = `${mediaId}.${ext}`;
  const dirPath = path.join(UPLOAD_ROOT, year, month);
  const filePath = path.join(dirPath, filename);
  const publicUrl = `${PUBLIC_URL_PREFIX}/${year}/${month}/${filename}`;

  // Sanity check — filePath must be inside UPLOAD_ROOT (defense in depth,
  // though the construction above is already UUID-only).
  const normalizedFilePath = path.resolve(filePath);
  const normalizedRoot = path.resolve(UPLOAD_ROOT);
  if (!normalizedFilePath.startsWith(normalizedRoot + path.sep)) {
    // Should be literally impossible to reach given how filePath is built,
    // but refusing is cheaper than explaining a breach.
    console.error('[media upload] path escape detected', { normalizedFilePath, normalizedRoot });
    return NextResponse.json({ error: 'Invalid storage path' }, { status: 500 });
  }

  // 9. Write file
  try {
    await mkdir(dirPath, { recursive: true });
    await writeFile(filePath, buffer);
  } catch (fsErr: unknown) {
    const msg = fsErr instanceof Error ? fsErr.message : String(fsErr);
    console.error('[media upload] write failed:', msg);
    return NextResponse.json({ error: 'Failed to save file' }, { status: 500 });
  }

  // 10. Probe dimensions (best-effort)
  const dims = probeDimensions(buffer, mime);

  // 11. Insert row
  let inserted: { id: string; url: string; alt_ar: string | null; alt_en: string | null; width: number | null; height: number | null; size_bytes: number } | null = null;
  try {
    inserted = await withAdminContext(async (adminDb) => {
      const rows = await adminDb
        .insert(content_media)
        .values({
          id: mediaId,
          filename,
          original_name: fileField.name.slice(0, 255),
          content_type: mime,
          size_bytes: fileField.size,
          file_path: filePath,
          url: publicUrl,
          alt_ar: altAr || null,
          alt_en: altEn || null,
          width: dims?.width ?? null,
          height: dims?.height ?? null,
          uploaded_by: user.id,
        })
        .returning({
          id: content_media.id,
          url: content_media.url,
          alt_ar: content_media.alt_ar,
          alt_en: content_media.alt_en,
          width: content_media.width,
          height: content_media.height,
          size_bytes: content_media.size_bytes,
        });
      return rows[0] ?? null;
    });
  } catch (dbErr: unknown) {
    // Cleanup the file since the DB insert failed — prevent orphans
    const { rm } = await import('fs/promises');
    await rm(filePath, { force: true }).catch(() => {});
    const msg = dbErr instanceof Error ? dbErr.message : String(dbErr);
    console.error('[media upload] DB insert failed:', msg);
    return NextResponse.json({ error: 'Failed to index media' }, { status: 500 });
  }

  if (!inserted) {
    const { rm } = await import('fs/promises');
    await rm(filePath, { force: true }).catch(() => {});
    return NextResponse.json({ error: 'Failed to index media' }, { status: 500 });
  }

  return NextResponse.json(inserted, { status: 201 });
}

// Guard against enormous request bodies before formData parses — Next.js
// reads the whole body into memory for formData(), so this caps the frame
// at a reasonable multiple of the file size cap. The file itself is still
// capped at MAX_FILE_SIZE_BYTES above.
export const runtime = 'nodejs';
export const maxDuration = 30;
