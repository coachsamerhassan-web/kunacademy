/**
 * Local filesystem storage utility — replaces Supabase Storage (Wave 6.75d).
 *
 * In production: files are written under STORAGE_DIR (e.g. /var/www/kunacademy/shared/storage/)
 *   and served by Nginx at NEXT_PUBLIC_STORAGE_URL.
 *
 * In development: files are written to ./storage/ relative to the project root
 *   and served by the Next.js API route at /api/storage/[...path].
 */

import fs from 'fs/promises';
import path from 'path';

// ── Config ────────────────────────────────────────────────────────────────────

function getStorageDir(): string {
  if (process.env.STORAGE_DIR) {
    return process.env.STORAGE_DIR;
  }
  // In dev, fall back to <project-root>/storage/
  // __dirname resolves to packages/db/src, so walk up 3 levels to monorepo root
  return path.join(__dirname, '..', '..', '..', 'storage');
}

function getStorageUrl(): string {
  return process.env.NEXT_PUBLIC_STORAGE_URL ?? '/storage/';
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Resolve the absolute path for a given bucket + file path. */
function resolvePath(bucket: string, filePath: string): string {
  // Sanitize: strip leading slashes from filePath to prevent directory traversal
  const safeFilePath = filePath.replace(/^\/+/, '');
  return path.join(getStorageDir(), bucket, safeFilePath);
}

/** Ensure the directory for a file exists, creating it recursively if needed. */
async function ensureDir(filePath: string): Promise<void> {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
}

// ── Public API ────────────────────────────────────────────────────────────────

export interface UploadOptions {
  contentType?: string;
  upsert?: boolean;
}

/**
 * Write a file to local storage.
 *
 * @param bucket  Logical bucket name (becomes a sub-directory, e.g. "proposals", "avatars")
 * @param filePath  Path within the bucket (e.g. "proposal_123_foo.pdf")
 * @param data  File contents — Buffer or File object
 * @param options  Optional contentType + upsert flag
 * @returns  { url } — the public URL for the stored file
 */
export async function uploadFile(
  bucket: string,
  filePath: string,
  data: Buffer | File,
  options?: UploadOptions,
): Promise<{ url: string }> {
  const dest = resolvePath(bucket, filePath);

  if (!options?.upsert) {
    // Default: allow overwrite (upsert behaviour is on by default; pass upsert:false to throw on conflict)
  }

  await ensureDir(dest);

  let buffer: Buffer;
  if (data instanceof File) {
    const ab = await data.arrayBuffer();
    buffer = Buffer.from(ab);
  } else {
    buffer = data;
  }

  await fs.writeFile(dest, buffer);

  return { url: getPublicUrl(bucket, filePath) };
}

/**
 * Return the public URL for a stored file without writing anything.
 * Used when you need the URL before or after upload.
 */
export function getPublicUrl(bucket: string, filePath: string): string {
  const safeFilePath = filePath.replace(/^\/+/, '');
  const base = getStorageUrl().replace(/\/$/, '');
  return `${base}/${bucket}/${safeFilePath}`;
}

/**
 * Delete a file from local storage.
 * Silently succeeds if the file does not exist.
 */
export async function deleteFile(bucket: string, filePath: string): Promise<void> {
  const dest = resolvePath(bucket, filePath);
  try {
    await fs.unlink(dest);
  } catch (err: any) {
    if (err?.code !== 'ENOENT') {
      throw err;
    }
  }
}
