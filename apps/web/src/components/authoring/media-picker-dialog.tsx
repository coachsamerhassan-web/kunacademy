/**
 * Wave 15 Wave 3 canary v2 — Media picker dialog (Issue 1).
 *
 * Three-tab modal mirroring WordPress's "Add Media" pattern (see
 * `Workspace/CTO/output/2026-04-28-wp-ux-research.md` §1):
 *   - Upload   → drag-drop zone + click-to-browse → POST /api/admin/upload/media
 *   - Library  → grid of previously-uploaded content_media → GET /api/admin/media
 *   - URL      → free-text URL input (fallback for external imagery)
 *
 * On selection: returns `{ src, alt_ar, alt_en, mediaId? }` to caller.
 *
 * All three tabs honour the same accessibility contract:
 *   - alt_ar OR alt_en is required at insertion (matching the upload route's
 *     server-side guard)
 *   - file size cap 10 MB; magic-byte sniff happens server-side
 *   - URL tab requires http(s):// scheme
 *
 * Used by: image section affordance (Issue 2 styling panel) + per-element
 * background panel (Issue 3) — both call <MediaPickerDialog onSelect={...}>.
 */

'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

export interface MediaPickerSelection {
  src: string;
  alt_ar?: string | null;
  alt_en?: string | null;
  mediaId?: string;
  width?: number | null;
  height?: number | null;
}

interface MediaItem {
  id: string;
  url: string;
  alt_ar: string | null;
  alt_en: string | null;
  original_name: string;
  content_type: string;
  width: number | null;
  height: number | null;
  size_bytes: number;
  uploaded_at: string;
  source: 'human' | 'agent' | 'unknown';
}

type TabId = 'upload' | 'library' | 'url';

interface MediaPickerDialogProps {
  open: boolean;
  onClose: () => void;
  onSelect: (selection: MediaPickerSelection) => void;
  /** UI locale (admin-side). Affects labels only. */
  locale: 'ar' | 'en';
  /** Initial tab — default 'library' (most-common path). */
  initialTab?: TabId;
}

export function MediaPickerDialog(props: MediaPickerDialogProps) {
  // Re-mount the inner dialog body on every open so internal state resets.
  // Using a `key` here is cheaper than effect-driven resetting + plays nicely
  // with the set-state-in-effect lint.
  if (!props.open) return null;
  return <MediaPickerDialogInner key={`open-${props.initialTab ?? 'library'}`} {...props} />;
}

function MediaPickerDialogInner({
  open,
  onClose,
  onSelect,
  locale,
  initialTab = 'library',
}: MediaPickerDialogProps) {
  const isAr = locale === 'ar';
  const [tab, setTab] = useState<TabId>(initialTab);

  // Esc to close.
  useEffect(() => {
    if (!open) return;
    function handleEsc(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={isAr ? 'إضافة وسائط' : 'Add Media'}
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      dir={isAr ? 'rtl' : 'ltr'}
    >
      <div className="w-full max-w-4xl h-[80vh] flex flex-col rounded-2xl bg-white shadow-2xl border border-[var(--color-neutral-200)] overflow-hidden">
        {/* Header */}
        <header className="flex items-center justify-between px-4 py-3 border-b border-[var(--color-neutral-100)]">
          <h2 className="text-base font-semibold text-[var(--text-primary)]">
            {isAr ? 'إضافة وسائط' : 'Add Media'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label={isAr ? 'إغلاق' : 'Close'}
            className="rounded-lg p-2 hover:bg-[var(--color-neutral-100)] text-[var(--color-neutral-500)] min-w-11 min-h-11 flex items-center justify-center"
          >
            ×
          </button>
        </header>

        {/* Tabs */}
        <div role="tablist" className="flex items-center border-b border-[var(--color-neutral-200)] bg-[var(--color-neutral-50)] px-2">
          <TabBtn id="upload" active={tab === 'upload'} onClick={() => setTab('upload')}>
            {isAr ? 'رفع' : 'Upload'}
          </TabBtn>
          <TabBtn id="library" active={tab === 'library'} onClick={() => setTab('library')}>
            {isAr ? 'المكتبة' : 'Library'}
          </TabBtn>
          <TabBtn id="url" active={tab === 'url'} onClick={() => setTab('url')}>
            {isAr ? 'رابط' : 'URL'}
          </TabBtn>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-hidden">
          {tab === 'upload' && (
            <UploadTab onPicked={onSelect} onClose={onClose} isAr={isAr} />
          )}
          {tab === 'library' && (
            <LibraryTab onPicked={onSelect} onClose={onClose} isAr={isAr} />
          )}
          {tab === 'url' && (
            <UrlTab onPicked={onSelect} onClose={onClose} isAr={isAr} />
          )}
        </div>
      </div>
    </div>
  );
}

function TabBtn({
  id,
  active,
  onClick,
  children,
}: {
  id: string;
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      role="tab"
      type="button"
      aria-selected={active}
      aria-controls={`media-tab-${id}`}
      onClick={onClick}
      className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors min-h-11 ${
        active
          ? 'border-[var(--color-accent,#F47E42)] text-[var(--text-primary)]'
          : 'border-transparent text-[var(--color-neutral-500)] hover:text-[var(--color-neutral-800)]'
      }`}
    >
      {children}
    </button>
  );
}

// DeepSeek extra-care QA (2026-04-28) — explicit MIME allowlist on the
// drop path. The `accept` attribute on <input> only filters the file
// picker dialog; drag-drop bypasses it entirely. Mirror the server-side
// allowlist (image/jpeg|png|webp|gif) so SVGs / scripts / executables
// never reach the upload step.
const ACCEPT_MIME: ReadonlyArray<string> = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const ACCEPT_LABEL = 'JPEG / PNG / WebP / GIF';

// ─── UPLOAD TAB ──────────────────────────────────────────────────────────
function UploadTab({
  onPicked,
  onClose,
  isAr,
}: {
  onPicked: (s: MediaPickerSelection) => void;
  onClose: () => void;
  isAr: boolean;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [altAr, setAltAr] = useState('');
  const [altEn, setAltEn] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files?.[0];
    if (!f) return;
    if (!ACCEPT_MIME.includes(f.type)) {
      setError(
        isAr
          ? `نوع الملف غير مدعوم. مقبول: ${ACCEPT_LABEL}`
          : `File type not supported. Accepted: ${ACCEPT_LABEL}`,
      );
      return;
    }
    setError(null);
    setFile(f);
  }, [isAr]);

  const onUpload = useCallback(async () => {
    if (!file) return;
    if (!altAr && !altEn) {
      setError(isAr ? 'مطلوب نصّ بديل بالعربية أو الإنجليزية' : 'Alt text required (AR or EN)');
      return;
    }
    setBusy(true);
    setError(null);
    setProgress(10);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('alt_ar', altAr);
      fd.append('alt_en', altEn);
      // Manual XHR to surface upload progress (fetch can't track upload).
      const res: Response = await new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('POST', '/api/admin/upload/media');
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) {
            setProgress(Math.round((e.loaded / e.total) * 90)); // leave 10% for indexing
          }
        };
        xhr.onload = () => {
          setProgress(100);
          // Fabricate a Response so we can use the standard JSON parse path.
          resolve(
            new Response(xhr.responseText, {
              status: xhr.status,
              headers: { 'content-type': 'application/json' },
            }),
          );
        };
        xhr.onerror = () => reject(new Error('Network error'));
        xhr.send(fd);
      });
      if (!res.ok) {
        const j: { error?: string } = await res.json().catch(() => ({}));
        throw new Error(j.error ?? `HTTP ${res.status}`);
      }
      const j = (await res.json()) as {
        id: string;
        url: string;
        alt_ar: string | null;
        alt_en: string | null;
        width?: number | null;
        height?: number | null;
      };
      onPicked({
        src: j.url,
        alt_ar: j.alt_ar,
        alt_en: j.alt_en,
        mediaId: j.id,
        width: j.width ?? null,
        height: j.height ?? null,
      });
      onClose();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Upload failed');
    } finally {
      setBusy(false);
    }
  }, [file, altAr, altEn, isAr, onPicked, onClose]);

  return (
    <div id="media-tab-upload" className="h-full flex flex-col p-4 gap-3 overflow-y-auto">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        onClick={() => inputRef.current?.click()}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            inputRef.current?.click();
          }
        }}
        className={`flex-1 min-h-48 rounded-2xl border-2 border-dashed flex flex-col items-center justify-center gap-2 cursor-pointer transition-colors ${
          dragOver
            ? 'border-[var(--color-accent,#F47E42)] bg-[var(--color-accent,#F47E42)]/5'
            : 'border-[var(--color-neutral-300)] hover:border-[var(--color-neutral-400)] hover:bg-[var(--color-neutral-50)]'
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (!f) return;
            if (!ACCEPT_MIME.includes(f.type)) {
              setError(
                isAr
                  ? `نوع الملف غير مدعوم. مقبول: ${ACCEPT_LABEL}`
                  : `File type not supported. Accepted: ${ACCEPT_LABEL}`,
              );
              return;
            }
            setError(null);
            setFile(f);
          }}
        />
        <div className="text-3xl text-[var(--color-neutral-400)]">⬆</div>
        <div className="text-sm text-[var(--color-neutral-700)] font-medium">
          {file
            ? file.name
            : isAr
            ? 'اسحب ملفًا هنا أو انقر للاختيار'
            : 'Drag a file here, or click to select'}
        </div>
        <div className="text-xs text-[var(--color-neutral-500)]">
          {isAr ? 'JPEG · PNG · WebP · GIF · حدّ أقصى 10 ميجابايت' : 'JPEG · PNG · WebP · GIF · max 10 MB'}
        </div>
        {file && (
          <div className="text-xs text-[var(--color-neutral-500)]">
            {(file.size / 1024 / 1024).toFixed(2)} MB
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <label className="flex flex-col gap-1">
          <span className="text-xs font-semibold text-[var(--color-neutral-700)]">
            {isAr ? 'النصّ البديل (عربي)' : 'Alt text (Arabic)'} <span className="text-red-600">*</span>
          </span>
          <input
            type="text"
            value={altAr}
            dir="rtl"
            onChange={(e) => setAltAr(e.target.value)}
            className="rounded-lg border border-[var(--color-neutral-200)] px-3 py-2 text-sm focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary-50)] focus:outline-none"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs font-semibold text-[var(--color-neutral-700)]">
            {isAr ? 'النصّ البديل (إنجليزي)' : 'Alt text (English)'} <span className="text-red-600">*</span>
          </span>
          <input
            type="text"
            value={altEn}
            dir="ltr"
            onChange={(e) => setAltEn(e.target.value)}
            className="rounded-lg border border-[var(--color-neutral-200)] px-3 py-2 text-sm focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary-50)] focus:outline-none"
          />
        </label>
      </div>
      <p className="text-[11px] text-[var(--color-neutral-500)]">
        {isAr ? 'مطلوب أحدهما على الأقل (للوصول).' : 'At least one is required (accessibility).'}
      </p>

      {error && (
        <div role="alert" className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-800">
          {error}
        </div>
      )}

      {busy && progress > 0 && (
        <div className="flex flex-col gap-1">
          <div className="text-xs text-[var(--color-neutral-600)]">
            {isAr ? 'جارٍ الرفع...' : 'Uploading...'} {progress}%
          </div>
          <div className="h-1 bg-[var(--color-neutral-200)] rounded-full overflow-hidden">
            <div
              className="h-full bg-[var(--color-accent,#F47E42)] transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}

      <div className="flex justify-end gap-2 pt-2 border-t border-[var(--color-neutral-100)]">
        <button
          type="button"
          onClick={onClose}
          disabled={busy}
          className="rounded-lg border border-[var(--color-neutral-300)] px-4 py-2 text-sm text-[var(--color-neutral-700)] hover:bg-[var(--color-neutral-50)] min-h-11"
        >
          {isAr ? 'إلغاء' : 'Cancel'}
        </button>
        <button
          type="button"
          onClick={onUpload}
          disabled={!file || busy}
          className="rounded-lg bg-[var(--color-primary)] px-4 py-2 text-sm font-semibold text-white hover:bg-[var(--color-primary-700)] disabled:opacity-50 disabled:cursor-not-allowed min-h-11"
        >
          {busy ? (isAr ? 'جارٍ الرفع...' : 'Uploading...') : isAr ? 'رفع وإدراج' : 'Upload & insert'}
        </button>
      </div>
    </div>
  );
}

// ─── LIBRARY TAB ─────────────────────────────────────────────────────────
function LibraryTab({
  onPicked,
  onClose,
  isAr,
}: {
  onPicked: (s: MediaPickerSelection) => void;
  onClose: () => void;
  isAr: boolean;
}) {
  const [items, setItems] = useState<MediaItem[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [source, setSource] = useState<'all' | 'human' | 'agent'>('all');
  const [cursor, setCursor] = useState<{ iso: string; id: string } | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [selected, setSelected] = useState<MediaItem | null>(null);

  const reload = useCallback(
    async (opts?: { append?: boolean; cursor?: { iso: string; id: string } | null }) => {
      setBusy(true);
      setError(null);
      try {
        const params = new URLSearchParams();
        if (q.trim()) params.set('q', q.trim());
        if (source !== 'all') params.set('source', source);
        if (opts?.cursor) {
          params.set('cursor', opts.cursor.iso);
          params.set('cursor_id', opts.cursor.id);
        }
        const res = await fetch(`/api/admin/media?${params.toString()}`, {
          credentials: 'same-origin',
        });
        if (!res.ok) {
          const j: { error?: string } = await res.json().catch(() => ({}));
          throw new Error(j.error ?? `HTTP ${res.status}`);
        }
        const j = (await res.json()) as {
          items: MediaItem[];
          next_cursor: string | null;
          next_cursor_id: string | null;
        };
        setItems((cur) => (opts?.append ? [...cur, ...j.items] : j.items));
        setHasMore(!!j.next_cursor && !!j.next_cursor_id);
        if (j.next_cursor && j.next_cursor_id) {
          setCursor({ iso: j.next_cursor, id: j.next_cursor_id });
        } else {
          setCursor(null);
        }
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : 'Failed to load library');
      } finally {
        setBusy(false);
      }
    },
    [q, source],
  );

  useEffect(() => {
    void reload();
    // intentional — only fire on filter changes; not on every reload reference change
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, source]);

  const onConfirm = () => {
    if (!selected) return;
    onPicked({
      src: selected.url,
      alt_ar: selected.alt_ar,
      alt_en: selected.alt_en,
      mediaId: selected.id,
      width: selected.width,
      height: selected.height,
    });
    onClose();
  };

  return (
    <div id="media-tab-library" className="h-full flex flex-col">
      {/* Filters */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-[var(--color-neutral-100)] flex-wrap">
        <input
          type="search"
          placeholder={isAr ? 'بحث...' : 'Search filename + alt text...'}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="flex-1 min-w-40 rounded-lg border border-[var(--color-neutral-200)] px-3 py-2 text-sm focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary-50)] focus:outline-none"
        />
        <select
          value={source}
          onChange={(e) => setSource(e.target.value as 'all' | 'human' | 'agent')}
          className="rounded-lg border border-[var(--color-neutral-200)] px-3 py-2 text-sm bg-white"
        >
          <option value="all">{isAr ? 'الكلّ' : 'All sources'}</option>
          <option value="human">{isAr ? 'بشريّ' : 'Human upload'}</option>
          <option value="agent">{isAr ? 'وكيل' : 'Agent upload'}</option>
        </select>
      </div>

      {/* Grid */}
      <div className="flex-1 overflow-y-auto p-4">
        {error && (
          <div role="alert" className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-800 mb-3">
            {error}
          </div>
        )}
        {!error && items.length === 0 && !busy && (
          <div className="text-center text-sm text-[var(--color-neutral-500)] py-12">
            {isAr ? 'لا توجد وسائط بعد. ارفع شيئًا من تبويب «رفع».' : 'No media yet. Upload from the "Upload" tab.'}
          </div>
        )}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
          {items.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setSelected(item)}
              onDoubleClick={() => {
                setSelected(item);
                onPicked({
                  src: item.url,
                  alt_ar: item.alt_ar,
                  alt_en: item.alt_en,
                  mediaId: item.id,
                  width: item.width,
                  height: item.height,
                });
                onClose();
              }}
              className={`relative aspect-square rounded-xl overflow-hidden border-2 transition-all ${
                selected?.id === item.id
                  ? 'border-[var(--color-accent,#F47E42)] shadow-md'
                  : 'border-[var(--color-neutral-200)] hover:border-[var(--color-neutral-400)]'
              }`}
              title={item.original_name}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={item.url}
                alt={item.alt_en ?? item.alt_ar ?? ''}
                className="absolute inset-0 w-full h-full object-cover bg-[var(--color-neutral-100)]"
                loading="lazy"
              />
              {selected?.id === item.id && (
                <div className="absolute top-1 inset-inline-end-1 bg-[var(--color-accent,#F47E42)] text-white rounded-full w-5 h-5 flex items-center justify-center text-[10px] font-bold">
                  ✓
                </div>
              )}
              {item.source === 'agent' && (
                <div
                  className="absolute bottom-1 inset-inline-start-1 bg-[var(--color-info,#82C4E8)]/90 text-white rounded-full px-1.5 py-0.5 text-[9px] font-medium"
                  title={isAr ? 'مرفوع بواسطة وكيل' : 'Uploaded by agent'}
                >
                  {isAr ? 'وكيل' : 'Agent'}
                </div>
              )}
            </button>
          ))}
        </div>
        {hasMore && (
          <div className="flex justify-center mt-4">
            <button
              type="button"
              disabled={busy}
              onClick={() => void reload({ append: true, cursor })}
              className="rounded-lg border border-[var(--color-neutral-300)] px-4 py-2 text-sm hover:bg-[var(--color-neutral-50)] disabled:opacity-50"
            >
              {busy ? (isAr ? 'جارٍ التحميل...' : 'Loading...') : isAr ? 'تحميل المزيد' : 'Load more'}
            </button>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between gap-3 px-4 py-3 border-t border-[var(--color-neutral-100)] bg-[var(--color-neutral-50)]">
        <div className="text-xs text-[var(--color-neutral-600)] truncate">
          {selected ? (
            <>
              <span className="font-semibold">{selected.original_name}</span>
              {selected.width && selected.height && (
                <span className="ms-2 font-mono">
                  {selected.width}×{selected.height}
                </span>
              )}
            </>
          ) : (
            <span className="italic">
              {isAr ? 'اختر صورة من المكتبة' : 'Select an image from the library'}
            </span>
          )}
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-[var(--color-neutral-300)] px-4 py-2 text-sm text-[var(--color-neutral-700)] hover:bg-[var(--color-neutral-50)] min-h-11"
          >
            {isAr ? 'إلغاء' : 'Cancel'}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={!selected}
            className="rounded-lg bg-[var(--color-primary)] px-4 py-2 text-sm font-semibold text-white hover:bg-[var(--color-primary-700)] disabled:opacity-50 disabled:cursor-not-allowed min-h-11"
          >
            {isAr ? 'إدراج' : 'Insert'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── URL TAB ─────────────────────────────────────────────────────────────
function UrlTab({
  onPicked,
  onClose,
  isAr,
}: {
  onPicked: (s: MediaPickerSelection) => void;
  onClose: () => void;
  isAr: boolean;
}) {
  const [url, setUrl] = useState('');
  const [altAr, setAltAr] = useState('');
  const [altEn, setAltEn] = useState('');
  const [error, setError] = useState<string | null>(null);

  const onConfirm = () => {
    setError(null);
    if (!url.trim()) {
      setError(isAr ? 'الرابط مطلوب' : 'URL is required');
      return;
    }
    if (!/^https?:\/\//i.test(url.trim())) {
      setError(isAr ? 'يجب أن يبدأ الرابط بـ http:// أو https://' : 'URL must start with http:// or https://');
      return;
    }
    if (!altAr && !altEn) {
      setError(isAr ? 'مطلوب نصّ بديل بالعربية أو الإنجليزية' : 'Alt text required (AR or EN)');
      return;
    }
    onPicked({ src: url.trim(), alt_ar: altAr || null, alt_en: altEn || null });
    onClose();
  };

  return (
    <div id="media-tab-url" className="h-full flex flex-col p-6 gap-4 overflow-y-auto">
      <label className="flex flex-col gap-1">
        <span className="text-sm font-semibold text-[var(--color-neutral-700)]">
          {isAr ? 'رابط الصورة' : 'Image URL'}
        </span>
        <input
          type="url"
          value={url}
          dir="ltr"
          placeholder="https://example.com/image.jpg"
          onChange={(e) => setUrl(e.target.value)}
          className="rounded-lg border border-[var(--color-neutral-200)] px-3 py-2 text-sm focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary-50)] focus:outline-none"
        />
        <span className="text-[11px] text-[var(--color-neutral-500)]">
          {isAr
            ? 'استخدم هذا للصور الموجودة على نطاقات خارجية موثوقة. للصور الجديدة، استخدم تبويب «رفع».'
            : 'Use for images already hosted on trusted external domains. For new uploads, use the Upload tab.'}
        </span>
      </label>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <label className="flex flex-col gap-1">
          <span className="text-xs font-semibold text-[var(--color-neutral-700)]">
            {isAr ? 'النصّ البديل (عربي)' : 'Alt text (Arabic)'} <span className="text-red-600">*</span>
          </span>
          <input
            type="text"
            value={altAr}
            dir="rtl"
            onChange={(e) => setAltAr(e.target.value)}
            className="rounded-lg border border-[var(--color-neutral-200)] px-3 py-2 text-sm focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary-50)] focus:outline-none"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs font-semibold text-[var(--color-neutral-700)]">
            {isAr ? 'النصّ البديل (إنجليزي)' : 'Alt text (English)'} <span className="text-red-600">*</span>
          </span>
          <input
            type="text"
            value={altEn}
            dir="ltr"
            onChange={(e) => setAltEn(e.target.value)}
            className="rounded-lg border border-[var(--color-neutral-200)] px-3 py-2 text-sm focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary-50)] focus:outline-none"
          />
        </label>
      </div>

      {error && (
        <div role="alert" className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-800">
          {error}
        </div>
      )}

      <div className="flex justify-end gap-2 pt-2 border-t border-[var(--color-neutral-100)] mt-auto">
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg border border-[var(--color-neutral-300)] px-4 py-2 text-sm text-[var(--color-neutral-700)] hover:bg-[var(--color-neutral-50)] min-h-11"
        >
          {isAr ? 'إلغاء' : 'Cancel'}
        </button>
        <button
          type="button"
          onClick={onConfirm}
          className="rounded-lg bg-[var(--color-primary)] px-4 py-2 text-sm font-semibold text-white hover:bg-[var(--color-primary-700)] min-h-11"
        >
          {isAr ? 'إدراج' : 'Insert'}
        </button>
      </div>
    </div>
  );
}
