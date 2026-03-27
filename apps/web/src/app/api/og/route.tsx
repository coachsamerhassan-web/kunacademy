import { ImageResponse } from 'next/og';
import { NextRequest } from 'next/server';

export const runtime = 'edge';

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const title = searchParams.get('title') || 'Kun Coaching Academy';
  const subtitle = searchParams.get('subtitle') || 'أكاديمية كُن للكوتشينج';
  const type = searchParams.get('type') || 'default'; // default | program | blog | coaching

  // Color schemes per type
  const schemes: Record<string, { bg: string; accent: string; text: string }> = {
    default:  { bg: '#0A0118', accent: '#7C3AED', text: '#FFFFFF' },
    program:  { bg: '#0F0326', accent: '#A855F7', text: '#FFFFFF' },
    blog:     { bg: '#FEFCE8', accent: '#7C3AED', text: '#1C1917' },
    coaching: { bg: '#0A0118', accent: '#2DD4BF', text: '#FFFFFF' },
    about:    { bg: '#1E1B4B', accent: '#818CF8', text: '#FFFFFF' },
  };

  const scheme = schemes[type] || schemes.default;

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          background: scheme.bg,
          padding: '60px 80px',
          fontFamily: 'system-ui, sans-serif',
        }}
      >
        {/* Decorative accent bar */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: '6px',
            background: `linear-gradient(90deg, ${scheme.accent}, ${scheme.accent}88, transparent)`,
          }}
        />

        {/* Geometric pattern (subtle) */}
        <div
          style={{
            position: 'absolute',
            top: '40px',
            right: '60px',
            width: '120px',
            height: '120px',
            borderRadius: '50%',
            border: `2px solid ${scheme.accent}33`,
            display: 'flex',
          }}
        />
        <div
          style={{
            position: 'absolute',
            top: '60px',
            right: '80px',
            width: '80px',
            height: '80px',
            borderRadius: '50%',
            border: `2px solid ${scheme.accent}55`,
            display: 'flex',
          }}
        />

        {/* Content */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            textAlign: 'center',
            gap: '24px',
            maxWidth: '900px',
          }}
        >
          {/* Title */}
          <div
            style={{
              fontSize: title.length > 40 ? '48px' : '56px',
              fontWeight: 700,
              color: scheme.text,
              lineHeight: 1.2,
              letterSpacing: '-0.02em',
              display: 'flex',
            }}
          >
            {title}
          </div>

          {/* Subtitle */}
          {subtitle && (
            <div
              style={{
                fontSize: '28px',
                color: `${scheme.text}BB`,
                lineHeight: 1.4,
                display: 'flex',
              }}
            >
              {subtitle}
            </div>
          )}
        </div>

        {/* Bottom bar: brand */}
        <div
          style={{
            position: 'absolute',
            bottom: '40px',
            left: '80px',
            right: '80px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <div
            style={{
              fontSize: '20px',
              fontWeight: 600,
              color: scheme.accent,
              display: 'flex',
            }}
          >
            kunacademy.com
          </div>
          <div
            style={{
              fontSize: '18px',
              color: `${scheme.text}88`,
              display: 'flex',
            }}
          >
            Somatic Thinking® | ICF Accredited
          </div>
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
    }
  );
}
