import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient, createServerClient } from '@kunacademy/db';
import path from 'path';
import fs from 'fs/promises';

// Rate limiting — simple in-memory store (per-instance)
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(userId: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(userId);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(userId, { count: 1, resetAt: now + 1000 });
    return true;
  }
  if (entry.count >= 2) return false; // max 2 pages per second
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

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    const body = await request.json();
    const { page, sample } = body as { page: number; sample?: boolean };

    // Validate book exists
    const book = BOOKS[slug];
    if (!book) {
      return NextResponse.json({ error: 'Book not found' }, { status: 404 });
    }

    // Validate page number
    if (typeof page !== 'number' || page < 1 || !Number.isInteger(page)) {
      return NextResponse.json({ error: 'Invalid page number' }, { status: 400 });
    }

    let userId = 'anonymous';

    // For paid books (non-sample), require authentication
    if (book.isPaid && !sample) {
      const supabase = createServerClient();
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
      }

      userId = user.id;

      // Check book access
      const adminClient = createAdminClient();
      const { data: access } = await adminClient
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
    // In monorepo: process.cwd() may be apps/web or repo root depending on env
    const cwd = process.cwd();
    const contentDir = cwd.endsWith('apps/web')
      ? path.resolve(cwd, '../../content/books')
      : path.resolve(cwd, 'content/books');
    const pdfRelPath = sample ? book.samplePdfPath : book.pdfPath;
    const pdfFullPath = path.join(contentDir, pdfRelPath);

    // Verify file exists
    try {
      await fs.access(pdfFullPath);
    } catch {
      return NextResponse.json({ error: 'PDF file not found' }, { status: 500 });
    }

    // Read PDF and render page to PNG using pdf.js
    const pdfData = await fs.readFile(pdfFullPath);

    // Dynamic import for pdf.js (server-side rendering)
    const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs');

    const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(pdfData.buffer) });
    const pdfDoc = await loadingTask.promise;

    // Validate page range
    if (page > pdfDoc.numPages) {
      return NextResponse.json(
        { error: 'Page out of range', totalPages: pdfDoc.numPages },
        { status: 400 }
      );
    }

    const pdfPage = await pdfDoc.getPage(page);
    const viewport = pdfPage.getViewport({ scale: 2.0 }); // 2x for sharp rendering

    // Use OffscreenCanvas-like approach via node-canvas or sharp
    // Since we're on Node.js, we'll use pdf.js's built-in canvas simulation
    // For server-side, we render to raw pixel data and convert with sharp
    const { createCanvas } = await getCanvasFactory();
    const canvas = createCanvas(Math.floor(viewport.width), Math.floor(viewport.height));
    const context = canvas.getContext('2d');

    await (pdfPage.render({
      canvasContext: context as any,
      viewport,
      canvas: canvas as any,
    } as any)).promise;

    // Convert canvas to PNG buffer using sharp
    const sharp = (await import('sharp')).default;
    const rawPixels = context.getImageData(0, 0, canvas.width, canvas.height);
    const pngBuffer = await sharp(Buffer.from(rawPixels.data.buffer), {
      raw: {
        width: canvas.width,
        height: canvas.height,
        channels: 4,
      },
    })
      .png({ quality: 85 })
      .toBuffer();

    return new NextResponse(new Uint8Array(pngBuffer), {
      status: 200,
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 'private, max-age=3600',
        'X-Total-Pages': String(pdfDoc.numPages),
      },
    });
  } catch (error) {
    console.error('[books/pages] Error:', error);
    return NextResponse.json(
      { error: 'Failed to render page' },
      { status: 500 }
    );
  }
}

// Lightweight canvas factory for Node.js pdf.js rendering
async function getCanvasFactory() {
  // Use a simple canvas polyfill based on ImageData
  return {
    createCanvas(width: number, height: number) {
      const data = new Uint8ClampedArray(width * height * 4);
      // Fill with white background
      for (let i = 0; i < data.length; i += 4) {
        data[i] = 255;     // R
        data[i + 1] = 255; // G
        data[i + 2] = 255; // B
        data[i + 3] = 255; // A
      }
      const imageData = { data, width, height };

      return {
        width,
        height,
        getContext(_type: string) {
          return {
            _imageData: imageData,
            _fillStyle: 'rgba(0,0,0,0)',
            _strokeStyle: 'rgba(0,0,0,0)',
            _lineWidth: 1,
            _globalAlpha: 1,
            _font: '10px sans-serif',
            _textAlign: 'start',
            _textBaseline: 'alphabetic',
            _transform: [1, 0, 0, 1, 0, 0] as number[],

            set fillStyle(v: string) { this._fillStyle = v; },
            get fillStyle() { return this._fillStyle; },
            set strokeStyle(v: string) { this._strokeStyle = v; },
            get strokeStyle() { return this._strokeStyle; },
            set lineWidth(v: number) { this._lineWidth = v; },
            get lineWidth() { return this._lineWidth; },
            set globalAlpha(v: number) { this._globalAlpha = v; },
            get globalAlpha() { return this._globalAlpha; },
            set font(v: string) { this._font = v; },
            get font() { return this._font; },
            set textAlign(v: string) { this._textAlign = v; },
            get textAlign() { return this._textAlign; },
            set textBaseline(v: string) { this._textBaseline = v; },
            get textBaseline() { return this._textBaseline; },

            getImageData(x: number, y: number, w: number, h: number) {
              if (x === 0 && y === 0 && w === width && h === height) {
                return imageData;
              }
              const subset = new Uint8ClampedArray(w * h * 4);
              for (let row = 0; row < h; row++) {
                const srcOffset = ((y + row) * width + x) * 4;
                const destOffset = row * w * 4;
                subset.set(imageData.data.subarray(srcOffset, srcOffset + w * 4), destOffset);
              }
              return { data: subset, width: w, height: h };
            },

            putImageData(imgData: { data: Uint8ClampedArray; width: number; height: number }, dx: number, dy: number) {
              for (let row = 0; row < imgData.height; row++) {
                const srcOffset = row * imgData.width * 4;
                const destOffset = ((dy + row) * width + dx) * 4;
                imageData.data.set(
                  imgData.data.subarray(srcOffset, srcOffset + imgData.width * 4),
                  destOffset
                );
              }
            },

            // Minimal canvas 2D context stubs for pdf.js compatibility
            save() {},
            restore() {},
            transform(a: number, b: number, c: number, d: number, e: number, f: number) {
              this._transform = [a, b, c, d, e, f];
            },
            setTransform(a: number, b: number, c: number, d: number, e: number, f: number) {
              this._transform = [a, b, c, d, e, f];
            },
            resetTransform() {
              this._transform = [1, 0, 0, 1, 0, 0];
            },
            scale() {},
            rotate() {},
            translate() {},
            beginPath() {},
            closePath() {},
            moveTo() {},
            lineTo() {},
            quadraticCurveTo() {},
            bezierCurveTo() {},
            arc() {},
            arcTo() {},
            rect() {},
            ellipse() {},
            fill() {},
            stroke() {},
            clip() {},
            fillRect(x: number, y: number, w: number, h: number) {
              // Basic fillRect for white background fill
              const color = parseColor(this._fillStyle);
              if (!color) return;
              for (let row = Math.max(0, Math.floor(y)); row < Math.min(height, Math.ceil(y + h)); row++) {
                for (let col = Math.max(0, Math.floor(x)); col < Math.min(width, Math.ceil(x + w)); col++) {
                  const idx = (row * width + col) * 4;
                  const alpha = color[3] * this._globalAlpha;
                  imageData.data[idx] = blendChannel(imageData.data[idx]!, color[0]!, alpha);
                  imageData.data[idx + 1] = blendChannel(imageData.data[idx + 1]!, color[1]!, alpha);
                  imageData.data[idx + 2] = blendChannel(imageData.data[idx + 2]!, color[2]!, alpha);
                  imageData.data[idx + 3] = Math.min(255, imageData.data[idx + 3]! + alpha * 255);
                }
              }
            },
            strokeRect() {},
            clearRect(x: number, y: number, w: number, h: number) {
              for (let row = Math.max(0, Math.floor(y)); row < Math.min(height, Math.ceil(y + h)); row++) {
                for (let col = Math.max(0, Math.floor(x)); col < Math.min(width, Math.ceil(x + w)); col++) {
                  const idx = (row * width + col) * 4;
                  imageData.data[idx] = 0;
                  imageData.data[idx + 1] = 0;
                  imageData.data[idx + 2] = 0;
                  imageData.data[idx + 3] = 0;
                }
              }
            },
            fillText() {},
            strokeText() {},
            measureText(text: string) {
              return { width: text.length * 5 };
            },
            drawImage() {},
            createLinearGradient() {
              return { addColorStop() {} };
            },
            createRadialGradient() {
              return { addColorStop() {} };
            },
            createPattern() {
              return {};
            },
            createImageData(w: number, h: number) {
              return { data: new Uint8ClampedArray(w * h * 4), width: w, height: h };
            },
            isPointInPath() { return false; },
            isPointInStroke() { return false; },
            setLineDash() {},
            getLineDash() { return []; },
            get lineDashOffset() { return 0; },
            set lineDashOffset(_v: number) {},
            get globalCompositeOperation() { return 'source-over'; },
            set globalCompositeOperation(_v: string) {},
            get imageSmoothingEnabled() { return true; },
            set imageSmoothingEnabled(_v: boolean) {},
            get lineCap() { return 'butt'; },
            set lineCap(_v: string) {},
            get lineJoin() { return 'miter'; },
            set lineJoin(_v: string) {},
            get miterLimit() { return 10; },
            set miterLimit(_v: number) {},
            get shadowBlur() { return 0; },
            set shadowBlur(_v: number) {},
            get shadowColor() { return 'rgba(0,0,0,0)'; },
            set shadowColor(_v: string) {},
            get shadowOffsetX() { return 0; },
            set shadowOffsetX(_v: number) {},
            get shadowOffsetY() { return 0; },
            set shadowOffsetY(_v: number) {},
          };
        },
        toBuffer() {
          return Buffer.from(imageData.data.buffer);
        },
      };
    },
  };
}

function parseColor(color: string): [number, number, number, number] | null {
  if (color === 'transparent' || color === 'rgba(0,0,0,0)') return null;
  if (color.startsWith('#')) {
    const hex = color.slice(1);
    if (hex.length === 6) {
      return [parseInt(hex.slice(0, 2), 16), parseInt(hex.slice(2, 4), 16), parseInt(hex.slice(4, 6), 16), 1];
    }
    if (hex.length === 8) {
      return [parseInt(hex.slice(0, 2), 16), parseInt(hex.slice(2, 4), 16), parseInt(hex.slice(4, 6), 16), parseInt(hex.slice(6, 8), 16) / 255];
    }
  }
  const rgbaMatch = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
  if (rgbaMatch) {
    return [Number(rgbaMatch[1]), Number(rgbaMatch[2]), Number(rgbaMatch[3]), rgbaMatch[4] !== undefined ? Number(rgbaMatch[4]) : 1];
  }
  if (color === 'white' || color === '#fff' || color === '#FFF') return [255, 255, 255, 1];
  if (color === 'black' || color === '#000') return [0, 0, 0, 1];
  return [0, 0, 0, 1]; // fallback
}

function blendChannel(bg: number, fg: number, alpha: number): number {
  return Math.round(bg * (1 - alpha) + fg * alpha);
}
