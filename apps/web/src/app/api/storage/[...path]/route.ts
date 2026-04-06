/**
 * Development storage file server — /api/storage/[...path]
 *
 * In production, Nginx serves files directly from the storage directory.
 * In development, this handler reads from the local storage directory and
 * streams the file back with an appropriate Content-Type header.
 *
 * URL format: /storage/<bucket>/<filePath>
 * Handled here as:  /api/storage/<bucket>/<filePath>
 *
 * The NEXT_PUBLIC_STORAGE_URL env var should be set to /api/storage/ in dev
 * and to the Nginx-served URL (e.g. https://kunacademy.com/storage/) in prod.
 */

import { NextResponse, type NextRequest } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

// ── MIME type map (covers all expected file types) ────────────────────────────

const MIME_TYPES: Record<string, string> = {
  '.pdf':  'application/pdf',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif':  'image/gif',
  '.webp': 'image/webp',
  '.svg':  'image/svg+xml',
  '.mp4':  'video/mp4',
  '.webm': 'video/webm',
  '.mp3':  'audio/mpeg',
  '.json': 'application/json',
  '.txt':  'text/plain',
};

// ── Config (mirrors packages/db/src/storage.ts) ───────────────────────────────

function getStorageDir(): string {
  if (process.env.STORAGE_DIR) {
    return process.env.STORAGE_DIR;
  }
  // apps/web is 2 levels below monorepo root; storage/ lives at monorepo root
  return path.join(process.cwd(), '..', '..', 'storage');
}

// ── GET handler ───────────────────────────────────────────────────────────────

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  // params.path is the [...path] segments: ['avatars', 'abc123.jpg']
  const { path: segments } = await params;

  if (!segments || segments.length === 0) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  // Prevent directory traversal
  const joined = segments.join('/');
  if (joined.includes('..') || path.isAbsolute(joined)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const filePath = path.join(getStorageDir(), joined);

  let data: Buffer;
  try {
    data = await fs.readFile(filePath);
  } catch (err: any) {
    if (err?.code === 'ENOENT') {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    console.error('[api/storage] Read error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }

  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[ext] ?? 'application/octet-stream';

  return new NextResponse(new Uint8Array(data), {
    status: 200,
    headers: {
      'Content-Type': contentType,
      'Cache-Control': 'public, max-age=86400',
    },
  });
}
