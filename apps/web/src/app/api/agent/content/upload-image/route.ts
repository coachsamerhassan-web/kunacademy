/**
 * POST /api/agent/content/upload-image
 *
 * Wave 15 Wave 2 — agent-authenticated image upload.
 *
 * Mirrors /api/admin/upload/media but:
 *   - Authenticates via Bearer agent token (not session cookie)
 *   - Stamps content_media.uploaded_by_agent_token to the agent's token id
 *   - Uses a per-agent rate-limit bucket
 *
 * Validation layers (every one is a separate hard-fail; matching admin route):
 *   1. Auth — valid agent token
 *   2. Rate limit — uses standard agent rate-limit bucket (60/min default)
 *   3. MIME allowlist — image/jpeg | image/png | image/webp | image/gif | image/svg+xml
 *   4. File size cap — 5 MB (tighter than admin's 10 MB; agents shouldn't ingest large)
 *   5. Magic-byte sniff — first bytes must match claimed MIME
 *   6. alt_ar + alt_en — at least one required
 *   7. Path construction is UUID-based
 *
 * Response: 201 { id, url, alt_ar, alt_en, width, height, size_bytes }
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAdminContext } from '@kunacademy/db';
import { content_media } from '@kunacademy/db/schema';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import {
  authenticateAgent,
  extractBearer,
  checkRateLimit,
  clientIpFromRequest,
} from '@/lib/agent-api/auth';

const UPLOAD_ROOT = process.env.MEDIA_UPLOAD_DIR ?? '/var/www/kunacademy-git/uploads/media';
const PUBLIC_URL_PREFIX = '/uploads/media';
const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB — tighter than admin

const MIME_TO_EXT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png':  'png',
  'image/webp': 'webp',
  'image/gif':  'gif',
  'image/svg+xml': 'svg',
};

const MAGIC_BYTES: Record<string, Array<Uint8Array>> = {
  'image/jpeg': [new Uint8Array([0xff, 0xd8, 0xff])],
  'image/png':  [new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])],
  'image/webp': [new Uint8Array([0x52, 0x49, 0x46, 0x46])], // "RIFF"
  'image/gif':  [
    new Uint8Array([0x47, 0x49, 0x46, 0x38, 0x37, 0x61]),
    new Uint8Array([0x47, 0x49, 0x46, 0x38, 0x39, 0x61]),
  ],
};

function startsWith(buf: Buffer, sig: Uint8Array): boolean {
  if (buf.length < sig.length) return false;
  for (let i = 0; i < sig.length; i++) {
    if (buf[i] !== sig[i]) return false;
  }
  return true;
}

function validateMagicBytes(buf: Buffer, mime: string): boolean {
  // SVG is text-based; we accept it but require the literal `<svg` token at
  // start (after optional XML prolog / BOM whitespace) AND scan for script tags
  // — a malicious SVG can carry inline JS. A more thorough sanitize would
  // pass through DOMPurify, but for v1 we reject SVGs containing <script.
  if (mime === 'image/svg+xml') {
    const text = buf.toString('utf-8', 0, Math.min(buf.length, 8192));
    if (!/<svg[\s>]/i.test(text)) return false;
    if (/<script\b/i.test(text)) return false;
    if (/\bon\w+\s*=/i.test(text)) return false; // onclick / onload / etc.
    return true;
  }
  const sigs = MAGIC_BYTES[mime];
  if (!sigs) return false;
  if (mime === 'image/webp') {
    if (buf.length < 12) return false;
    if (!startsWith(buf, sigs[0])) return false;
    const webpMarker = new Uint8Array([0x57, 0x45, 0x42, 0x50]);
    for (let i = 0; i < 4; i++) {
      if (buf[8 + i] !== webpMarker[i]) return false;
    }
    return true;
  }
  return sigs.some((sig) => startsWith(buf, sig));
}

function probeDimensions(buf: Buffer, mime: string): { width: number; height: number } | null {
  try {
    if (mime === 'image/png') {
      if (buf.length < 24) return null;
      return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
    }
    if (mime === 'image/gif') {
      if (buf.length < 10) return null;
      return { width: buf.readUInt16LE(6), height: buf.readUInt16LE(8) };
    }
    if (mime === 'image/jpeg') {
      let offset = 2;
      let iter = 0;
      while (offset + 3 < buf.length && iter++ < 256) {
        if (buf[offset] !== 0xFF) break;
        const marker = buf[offset + 1];
        const size = buf.readUInt16BE(offset + 2);
        if (size < 2) break;
        if ((marker >= 0xC0 && marker <= 0xCF) && marker !== 0xC4 && marker !== 0xC8 && marker !== 0xCC) {
          if (offset + 8 >= buf.length) break;
          return { height: buf.readUInt16BE(offset + 5), width: buf.readUInt16BE(offset + 7) };
        }
        offset += 2 + size;
      }
      return null;
    }
    // SVG / WebP dim probe deferred — server stores them as-is.
  } catch {
    return null;
  }
  return null;
}

export async function POST(request: NextRequest) {
  // 1. Auth
  const clientIp = clientIpFromRequest(request);
  const token = extractBearer(request.headers.get('authorization'));
  const agent = await authenticateAgent(token, clientIp);
  if (!agent) {
    return NextResponse.json(
      { error: 'Unauthorized — invalid, missing, or revoked token' },
      { status: 401 },
    );
  }

  // 2. Rate limit
  const rl = checkRateLimit(agent.agentNameKey, agent.rateLimitPerMin);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: `Rate limit exceeded. Resets at ${new Date(rl.resetAt).toISOString()}` },
      {
        status: 429,
        headers: {
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': Math.floor(rl.resetAt / 1000).toString(),
        },
      },
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

  if (!altAr && !altEn) {
    return NextResponse.json(
      { error: 'At least one of alt_ar / alt_en is required for accessibility' },
      { status: 400 },
    );
  }
  if (altAr.length > 300 || altEn.length > 300) {
    return NextResponse.json({ error: 'Alt text must be ≤ 300 characters' }, { status: 400 });
  }

  const mime = fileField.type;
  if (!MIME_TO_EXT[mime]) {
    return NextResponse.json(
      {
        error: `File type '${mime}' is not allowed. Accepted: ${Object.keys(MIME_TO_EXT).join(', ')}`,
      },
      { status: 415 },
    );
  }

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

  const arrayBuffer = await fileField.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  if (!validateMagicBytes(buffer, mime)) {
    return NextResponse.json(
      { error: 'File contents do not match the declared image type (or SVG contained <script> / on* attributes)' },
      { status: 400 },
    );
  }

  const mediaId = crypto.randomUUID();
  const ext = MIME_TO_EXT[mime];
  const now = new Date();
  const year = now.getUTCFullYear().toString();
  const month = String(now.getUTCMonth() + 1).padStart(2, '0');
  const filename = `${mediaId}.${ext}`;
  const dirPath = path.join(UPLOAD_ROOT, year, month);
  const filePath = path.join(dirPath, filename);
  const publicUrl = `${PUBLIC_URL_PREFIX}/${year}/${month}/${filename}`;

  const normalizedFilePath = path.resolve(filePath);
  const normalizedRoot = path.resolve(UPLOAD_ROOT);
  if (!normalizedFilePath.startsWith(normalizedRoot + path.sep)) {
    console.error('[agent media upload] path escape detected');
    return NextResponse.json({ error: 'Invalid storage path' }, { status: 500 });
  }

  try {
    await mkdir(dirPath, { recursive: true });
    await writeFile(filePath, buffer);
  } catch (fsErr) {
    console.error('[agent media upload] write failed:', fsErr);
    return NextResponse.json({ error: 'Failed to save file' }, { status: 500 });
  }

  const dims = probeDimensions(buffer, mime);

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
          uploaded_by_agent_token: agent.tokenId,
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
  } catch (dbErr) {
    const { rm } = await import('fs/promises');
    await rm(filePath, { force: true }).catch(() => {});
    console.error('[agent media upload] DB insert failed:', dbErr);
    return NextResponse.json({ error: 'Failed to index media' }, { status: 500 });
  }

  if (!inserted) {
    const { rm } = await import('fs/promises');
    await rm(filePath, { force: true }).catch(() => {});
    return NextResponse.json({ error: 'Failed to index media' }, { status: 500 });
  }

  return NextResponse.json(
    {
      ...inserted,
      uploaded_by_agent_token: agent.tokenId,
      agent: agent.agentName,
    },
    {
      status: 201,
      headers: {
        'X-RateLimit-Remaining': rl.remaining.toString(),
        'X-RateLimit-Reset': Math.floor(rl.resetAt / 1000).toString(),
      },
    },
  );
}

export const runtime = 'nodejs';
export const maxDuration = 30;
