import type { Metadata } from 'next';
import { setRequestLocale } from 'next-intl/server';
import { GeometricPattern } from '@kunacademy/ui/patterns';
import { Section } from '@kunacademy/ui/section';
import { db } from '@kunacademy/db';
import { profiles, instructors } from '@kunacademy/db/schema';
import { eq } from 'drizzle-orm';
import { getTierLabel } from '@/lib/coach-tier-labels';

async function getProfile(userId: string) {
  const [profile] = await db
    .select()
    .from(profiles)
    .where(eq(profiles.id, userId))
    .limit(1);

  if (!profile) return null;

  const [instructor] = await db
    .select({
      bio_ar: instructors.bio_ar,
      bio_en: instructors.bio_en,
      credentials: instructors.credentials,
      icf_credential: instructors.icf_credential,
      kun_level: instructors.kun_level,
      specialties: instructors.specialties,
      coaching_styles: instructors.coaching_styles,
    })
    .from(instructors)
    .where(eq(instructors.profile_id, userId))
    .limit(1);

  return { ...profile, instructor: instructor || null };
}

interface Props { params: Promise<{ locale: string; slug: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, slug } = await params;
  const isAr = locale === 'ar';
  const profile = await getProfile(slug);
  const name = profile ? (isAr ? profile.full_name_ar : profile.full_name_en) : null;
  return {
    title: name
      ? `${name} | ${isAr ? 'مجتمع كُن' : 'Kun Community'}`
      : (isAr ? 'ملف العضو | أكاديمية كُن' : 'Member Profile | Kun Academy'),
    description: isAr
      ? 'ملف عضو في مجتمع أكاديمية كُن للكوتشينج'
      : 'Member profile in the Kun Coaching Academy community.',
  };
}

export default async function CommunityProfilePage({ params }: { params: Promise<{ locale: string; slug: string }> }) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const isAr = locale === 'ar';
  const profile = await getProfile(slug);

  if (!profile) {
    return <main><Section variant="white"><p className="py-12 text-center">{isAr ? 'الملف غير موجود' : 'Profile not found'}</p></Section></main>;
  }

  return (
    <main>
      <Section variant="white">
        <div className="mx-auto max-w-2xl">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-20 h-20 rounded-full bg-[var(--color-neutral-200)] overflow-hidden">
              {profile.avatar_url ? <img src={profile.avatar_url} alt="" className="w-full h-full object-cover" /> : (
                <div className="w-full h-full flex items-center justify-center text-2xl text-[var(--color-neutral-400)]">{(profile.full_name_en || '?')[0]}</div>
              )}
            </div>
            <div>
              <h1 className="text-xl font-bold">{isAr ? profile.full_name_ar : profile.full_name_en}</h1>
              <span className={`inline-block mt-1 rounded-full px-2 py-0.5 text-xs ${
                profile.role === 'provider' ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'
              }`}>
                {profile.role === 'provider'
                  ? (profile.instructor?.kun_level ? getTierLabel(profile.instructor.kun_level, isAr) : (profile.instructor?.icf_credential || (isAr ? 'كوتش' : 'Coach')))
                  : (isAr ? 'متدرب' : 'Student')}
              </span>
              {profile.country && <span className="text-sm text-[var(--color-neutral-500)] block mt-1">{new Intl.DisplayNames([isAr ? 'ar' : 'en'], { type: 'region' }).of(profile.country) ?? profile.country}</span>}
            </div>
          </div>

          {profile.instructor && (
            <div className="space-y-4">
              {(isAr ? profile.instructor.bio_ar : profile.instructor.bio_en) && (
                <div className="rounded-lg border border-[var(--color-neutral-200)] p-4">
                  <h2 className="font-medium mb-2">{isAr ? 'نبذة' : 'Bio'}</h2>
                  <p className="text-sm text-[var(--color-neutral-600)]" dir={isAr ? 'rtl' : 'ltr'}>
                    {isAr ? profile.instructor.bio_ar : profile.instructor.bio_en}
                  </p>
                </div>
              )}
              {profile.instructor.specialties && profile.instructor.specialties.length > 0 && (
                <div className="rounded-lg border border-[var(--color-neutral-200)] p-4">
                  <h2 className="font-medium mb-2">{isAr ? 'التخصصات' : 'Specialties'}</h2>
                  <div className="flex flex-wrap gap-1">
                    {profile.instructor.specialties.map((s: string) => (
                      <span key={s} className="rounded-full bg-[var(--color-neutral-100)] px-2 py-0.5 text-xs">{s}</span>
                    ))}
                  </div>
                </div>
              )}
              {profile.instructor.credentials && (
                <div className="rounded-lg border border-[var(--color-neutral-200)] p-4">
                  <h2 className="font-medium mb-2">{isAr ? 'المؤهلات' : 'Credentials'}</h2>
                  <p className="text-sm text-[var(--color-neutral-600)]">{profile.instructor.credentials}</p>
                </div>
              )}
            </div>
          )}
        </div>
      </Section>
    </main>
  );
}
