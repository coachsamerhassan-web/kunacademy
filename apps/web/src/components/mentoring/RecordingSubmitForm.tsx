'use client';

/**
 * RecordingSubmitForm — student UI for submitting a coaching recording + transcript.
 *
 * Sub-phase: S2-Layer-1 / 1.5 (recording) + 2.2 (transcript)
 *
 * Features:
 *   - File picker (audio/* + video/webm)
 *   - Client-side MIME + size validation (≤ 500 MB)
 *   - HTML5 Audio/Video element for client-side duration check (< 3600 s)
 *   - Transcript file picker (PDF / TXT / MD, ≤ 2 MB, required)
 *   - 6 required attestation checkboxes
 *   - XHR upload with progress tracking
 *   - Submit disabled until all attestations checked + valid file + valid transcript
 *   - Success state shows assessor-assigned confirmation
 *   - Bilingual (ar + en)
 */

import React, { useRef, useState, useCallback, ChangeEvent } from 'react';

// ── Constants ─────────────────────────────────────────────────────────────────

const MAX_FILE_SIZE_BYTES = 500 * 1024 * 1024; // 500 MB
const MAX_DURATION_SECONDS = 3600;              // 60 minutes

const ALLOWED_MIME_TYPES = new Set([
  'audio/mp4',
  'audio/x-m4a',
  'video/webm',
  'audio/webm',
  'audio/mpeg',
  'audio/mp3',
  // Some browsers report slightly different MIME for .m4a
  'audio/aac',
]);

// ── Transcript constants (Phase 2.2) ──────────────────────────────────────────

const MAX_TRANSCRIPT_SIZE_BYTES = 2 * 1024 * 1024; // 2 MB

const ALLOWED_TRANSCRIPT_MIME_TYPES = new Set([
  'application/pdf',
  'text/plain',
  'text/markdown',
]);

const ATTESTATIONS: string[] = [
  'The person being coached is not a peer or colleague',
  'The person being coached is not a family member or close relative',
  'This is an audio recording only (no video)',
  'The recording is under 60 minutes',
  'The recording has not been edited or interrupted',
  'The voice quality is clear throughout',
];

// ── Types ─────────────────────────────────────────────────────────────────────

type SubmitState =
  | { kind: 'idle' }
  | { kind: 'uploading'; progressPct: number }
  | { kind: 'success'; assessorAssigned: boolean }
  | { kind: 'error'; message: string };

interface FileValidation {
  valid: boolean;
  error?: string;
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface RecordingSubmitFormProps {
  instanceId: string;
  locale?: string;
  /** Called after successful submission with the new recording UUID */
  onSuccess?: (recordingId: string) => void;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function RecordingSubmitForm({ instanceId, locale = 'en', onSuccess }: RecordingSubmitFormProps) {
  const isAr = locale === 'ar';

  const fileInputRef       = useRef<HTMLInputElement>(null);
  const transcriptInputRef = useRef<HTMLInputElement>(null);
  const mediaRef           = useRef<HTMLAudioElement | null>(null);

  const [selectedFile,       setSelectedFile]       = useState<File | null>(null);
  const [fileError,          setFileError]           = useState<string | null>(null);
  const [selectedTranscript, setSelectedTranscript] = useState<File | null>(null);
  const [transcriptError,    setTranscriptError]    = useState<string | null>(null);
  const [attestations,       setAttestations]       = useState<boolean[]>(
    Array(ATTESTATIONS.length).fill(false),
  );
  const [submitState,   setSubmitState]   = useState<SubmitState>({ kind: 'idle' });

  // ── Derived ─────────────────────────────────────────────────────────────────

  const allAttested = attestations.every(Boolean);
  const canSubmit   = selectedFile !== null && fileError === null &&
                      selectedTranscript !== null && transcriptError === null &&
                      allAttested && submitState.kind !== 'uploading';

  // ── File selection + validation ──────────────────────────────────────────────

  const validateFile = useCallback((file: File): Promise<FileValidation> => {
    // MIME check
    if (!ALLOWED_MIME_TYPES.has(file.type)) {
      return Promise.resolve({
        valid: false,
        error: `File type "${file.type}" is not supported. Please upload an audio recording (M4A, MP3, WebM).`,
      });
    }

    // Size check
    if (file.size > MAX_FILE_SIZE_BYTES) {
      const mb = (file.size / 1024 / 1024).toFixed(1);
      return Promise.resolve({
        valid: false,
        error: `File is too large (${mb} MB). Maximum allowed size is 500 MB.`,
      });
    }

    // Duration check via HTML5 media element (best-effort)
    return new Promise((resolve) => {
      const url = URL.createObjectURL(file);
      const el  = new Audio(url);
      mediaRef.current = el;

      const cleanup = () => {
        URL.revokeObjectURL(url);
        el.src = '';
        mediaRef.current = null;
      };

      el.onloadedmetadata = () => {
        const duration = el.duration;
        cleanup();
        if (Number.isFinite(duration) && duration > MAX_DURATION_SECONDS) {
          const minutes = Math.floor(duration / 60);
          resolve({
            valid: false,
            error: `Recording is ${minutes} minutes long. Maximum allowed duration is 60 minutes.`,
          });
        } else {
          resolve({ valid: true });
        }
      };

      el.onerror = () => {
        // Can't read duration (some formats/browsers) — let server validate
        cleanup();
        resolve({ valid: true });
      };

      // Timeout fallback: 5 seconds to load metadata
      setTimeout(() => {
        cleanup();
        resolve({ valid: true });
      }, 5000);
    });
  }, []);

  const handleFileChange = useCallback(
    async (e: ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0] ?? null;
      setSelectedFile(null);
      setFileError(null);

      if (!file) return;

      const result = await validateFile(file);
      if (!result.valid) {
        setFileError(result.error ?? 'Invalid file');
        if (fileInputRef.current) fileInputRef.current.value = '';
        return;
      }

      setSelectedFile(file);
    },
    [validateFile],
  );

  // ── Transcript selection + validation (Phase 2.2) ────────────────────────────

  const validateTranscript = useCallback((file: File): FileValidation => {
    if (!ALLOWED_TRANSCRIPT_MIME_TYPES.has(file.type)) {
      return {
        valid: false,
        error: isAr
          ? `نوع الملف "${file.type}" غير مدعوم. يرجى رفع ملف PDF أو TXT أو MD.`
          : `File type "${file.type}" is not supported. Please upload a PDF, TXT, or Markdown file.`,
      };
    }
    if (file.size > MAX_TRANSCRIPT_SIZE_BYTES) {
      const mb = (file.size / 1024 / 1024).toFixed(2);
      return {
        valid: false,
        error: isAr
          ? `حجم النص كبير جداً (${mb} MB). الحد الأقصى ٢ ميغابايت.`
          : `Transcript is too large (${mb} MB). Maximum allowed size is 2 MB.`,
      };
    }
    return { valid: true };
  }, [isAr]);

  const handleTranscriptChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0] ?? null;
      setSelectedTranscript(null);
      setTranscriptError(null);

      if (!file) return;

      const result = validateTranscript(file);
      if (!result.valid) {
        setTranscriptError(result.error ?? 'Invalid transcript');
        if (transcriptInputRef.current) transcriptInputRef.current.value = '';
        return;
      }

      setSelectedTranscript(file);
    },
    [validateTranscript],
  );

  // ── Attestation toggle ──────────────────────────────────────────────────────

  const handleAttestationChange = useCallback((index: number) => {
    setAttestations((prev) => {
      const next = [...prev];
      next[index] = !next[index];
      return next;
    });
  }, []);

  // ── Submit ───────────────────────────────────────────────────────────────────

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!canSubmit || !selectedFile || !selectedTranscript) return;

      setSubmitState({ kind: 'uploading', progressPct: 0 });

      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('transcript', selectedTranscript);
      formData.append('attestation', JSON.stringify(attestations));

      try {
        await new Promise<void>((resolve, reject) => {
          const xhr = new XMLHttpRequest();

          xhr.upload.addEventListener('progress', (event) => {
            if (event.lengthComputable) {
              const pct = Math.round((event.loaded / event.total) * 100);
              setSubmitState({ kind: 'uploading', progressPct: pct });
            }
          });

          xhr.addEventListener('load', () => {
            if (xhr.status === 201) {
              try {
                const body = JSON.parse(xhr.responseText) as {
                  recordingId: string;
                  assessorAssigned: boolean;
                };
                setSubmitState({
                  kind: 'success',
                  assessorAssigned: body.assessorAssigned,
                });
                onSuccess?.(body.recordingId);
              } catch {
                reject(new Error('Unexpected server response'));
              }
              resolve();
            } else {
              try {
                const body = JSON.parse(xhr.responseText) as { error?: string };
                reject(new Error(body.error ?? `Server error ${xhr.status}`));
              } catch {
                reject(new Error(`Server error ${xhr.status}`));
              }
            }
          });

          xhr.addEventListener('error',  () => reject(new Error('Network error — please check your connection and try again.')));
          xhr.addEventListener('abort',  () => reject(new Error('Upload was cancelled.')));
          xhr.addEventListener('timeout', () => reject(new Error('Upload timed out. Please try again.')));

          xhr.timeout = 30 * 60 * 1000; // 30 minutes timeout for large files
          xhr.open('POST', `/api/packages/${instanceId}/recordings`);
          xhr.send(formData);
        });
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'An unexpected error occurred.';
        setSubmitState({ kind: 'error', message });
      }
    },
    [canSubmit, selectedFile, selectedTranscript, attestations, instanceId, onSuccess],
  );

  // ── Render ───────────────────────────────────────────────────────────────────

  if (submitState.kind === 'success') {
    return (
      <div className="rounded-lg border border-green-200 bg-green-50 p-6 text-center">
        <div className="mb-3 text-3xl">&#10003;</div>
        <h3 className="mb-2 text-lg font-semibold text-green-800">
          {isAr ? 'تم الإرسال بنجاح' : 'Recording Submitted Successfully'}
        </h3>
        {submitState.assessorAssigned ? (
          <p className="text-sm text-green-700">
            {isAr
              ? 'تم استلام تسجيلك ونصّه، وقد تمّ تعيين مقيّم. ستتلقى إشعاراً فور اكتمال التقييم.'
              : 'Your recording and transcript have been received and an assessor has been assigned. You will be notified once the assessment is complete.'}
          </p>
        ) : (
          <p className="text-sm text-green-700">
            {isAr
              ? 'تم استلام تسجيلك ونصّه. سيتمّ تعيين مقيّم قريباً من قِبَل الفريق.'
              : 'Your recording and transcript have been received. An assessor will be assigned shortly by the program team.'}
          </p>
        )}
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-6">
      {/* ── Recording file picker ── */}
      <div>
        <label
          htmlFor="recording-file"
          className="mb-1 block text-sm font-medium text-gray-700"
        >
          {isAr ? 'ارفع تسجيلك الصوتي' : 'Upload your coaching recording'}
          <span className="ml-1 text-red-500" aria-hidden="true">*</span>
        </label>
        <p className="mb-2 text-xs text-gray-500">
          {isAr
            ? 'الصيغ المقبولة: M4A، MP3، WebM. الحد الأقصى: 500 MB. المدة الأقصى: 60 دقيقة.'
            : 'Accepted formats: M4A, MP3, WebM audio. Maximum size: 500 MB. Maximum duration: 60 minutes.'}
        </p>
        <input
          ref={fileInputRef}
          id="recording-file"
          type="file"
          accept="audio/*,video/webm"
          onChange={handleFileChange}
          className="block w-full cursor-pointer rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 file:mr-3 file:cursor-pointer file:rounded file:border-0 file:bg-blue-50 file:px-3 file:py-1 file:text-sm file:font-medium file:text-blue-700 hover:file:bg-blue-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
          aria-describedby={fileError ? 'file-error' : undefined}
        />
        {fileError && (
          <p id="file-error" role="alert" className="mt-1 text-sm text-red-600">
            {fileError}
          </p>
        )}
        {selectedFile && !fileError && (
          <p className="mt-1 text-xs text-gray-500">
            {isAr ? 'المختار:' : 'Selected:'} {selectedFile.name} ({(selectedFile.size / 1024 / 1024).toFixed(1)} MB)
          </p>
        )}
      </div>

      {/* ── Transcript file picker (Phase 2.2) ── */}
      <div>
        <label
          htmlFor="transcript-file"
          className="mb-1 block text-sm font-medium text-gray-700"
        >
          {isAr ? 'ارفع نص الجلسة (Transcript)' : 'Upload session transcript'}
          <span className="ml-1 text-red-500" aria-hidden="true">*</span>
        </label>
        <p className="mb-2 text-xs text-gray-500">
          {isAr
            ? 'الصيغ المقبولة: PDF، TXT، MD. الحد الأقصى: 2 MB. يقرأه المقيّم أثناء الاستماع.'
            : 'Accepted formats: PDF, TXT, MD. Maximum size: 2 MB. The assessor reads this while listening to your recording.'}
        </p>
        <input
          ref={transcriptInputRef}
          id="transcript-file"
          type="file"
          accept="application/pdf,text/plain,text/markdown,.md,.txt,.pdf"
          onChange={handleTranscriptChange}
          className="block w-full cursor-pointer rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 file:mr-3 file:cursor-pointer file:rounded file:border-0 file:bg-green-50 file:px-3 file:py-1 file:text-sm file:font-medium file:text-green-700 hover:file:bg-green-100 focus:outline-none focus:ring-2 focus:ring-green-500"
          aria-describedby={transcriptError ? 'transcript-error' : undefined}
        />
        {transcriptError && (
          <p id="transcript-error" role="alert" className="mt-1 text-sm text-red-600">
            {transcriptError}
          </p>
        )}
        {selectedTranscript && !transcriptError && (
          <p className="mt-1 text-xs text-gray-500">
            {isAr ? 'المختار:' : 'Selected:'} {selectedTranscript.name} ({(selectedTranscript.size / 1024).toFixed(1)} KB)
          </p>
        )}
      </div>

      {/* ── Attestation checkboxes ── */}
      <fieldset>
        <legend className="mb-3 text-sm font-medium text-gray-700">
          Recording attestation
          <span className="ml-1 text-red-500" aria-hidden="true">*</span>
        </legend>
        <p className="mb-3 text-xs text-gray-500">
          Please confirm all of the following before submitting:
        </p>
        <div className="space-y-3">
          {ATTESTATIONS.map((label, index) => (
            <label
              key={index}
              className="flex cursor-pointer items-start gap-3 rounded-md border border-gray-200 bg-gray-50 px-4 py-3 hover:bg-gray-100"
            >
              <input
                type="checkbox"
                checked={attestations[index]}
                onChange={() => handleAttestationChange(index)}
                className="mt-0.5 h-4 w-4 flex-shrink-0 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                aria-label={label}
              />
              <span className="text-sm text-gray-700">{label}</span>
            </label>
          ))}
        </div>
      </fieldset>

      {/* ── Upload progress ── */}
      {submitState.kind === 'uploading' && (
        <div role="status" aria-live="polite">
          <div className="mb-1 flex items-center justify-between text-xs text-gray-600">
            <span>Uploading recording…</span>
            <span>{submitState.progressPct}%</span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-gray-200">
            <div
              className="h-full rounded-full bg-blue-500 transition-all duration-200"
              style={{ width: `${submitState.progressPct}%` }}
            />
          </div>
        </div>
      )}

      {/* ── Error state ── */}
      {submitState.kind === 'error' && (
        <div
          role="alert"
          className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700"
        >
          <strong className="font-medium">Submission failed: </strong>
          {submitState.message}
        </div>
      )}

      {/* ── Submit button ── */}
      <button
        type="submit"
        disabled={!canSubmit}
        className="inline-flex min-h-[44px] w-full items-center justify-center rounded-lg bg-blue-600 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:bg-gray-300 disabled:text-gray-500"
        aria-describedby={!canSubmit ? 'submit-hint' : undefined}
      >
        {submitState.kind === 'uploading'
          ? (isAr ? 'جارٍ الرفع…' : 'Uploading…')
          : (isAr ? 'إرسال التسجيل والنص' : 'Submit Recording & Transcript')}
      </button>

      {!canSubmit && submitState.kind === 'idle' && (
        <p id="submit-hint" className="text-center text-xs text-gray-500">
          {!selectedFile
            ? (isAr ? 'يرجى اختيار ملف تسجيل صالح.' : 'Please select a valid recording file.')
            : !selectedTranscript
            ? (isAr ? 'يرجى اختيار ملف النص (Transcript).' : 'Please select a valid transcript file.')
            : !allAttested
            ? (isAr ? 'يرجى تأكيد جميع البنود أعلاه.' : 'Please confirm all attestations above.')
            : ''}
        </p>
      )}
    </form>
  );
}
