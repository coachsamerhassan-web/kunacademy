/**
 * KUN Academy — CMS Google Sheet Setup Script
 * Run once from Extensions > Apps Script in the Google Sheet.
 *
 * What it does:
 * 1. Fixes Programs tab (headers were in 1 cell)
 * 2. Creates Pathfinder tab (missing)
 * 3. Adds 2-3 sample rows to each tab
 *
 * Safe to re-run — clears and re-populates each tab.
 */

function setupCMSSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  // ── Tab 1: Page Content ──
  setupTab(ss, 'Page Content', [
    ['slug', 'section', 'key', 'value_ar', 'value_en', 'type', 'meta_title_ar', 'meta_title_en', 'meta_description_ar', 'meta_description_en', 'og_image_url', 'canonical_url', 'hero_image_url', 'cta_text_ar', 'cta_text_en', 'cta_url', 'form_embed', 'published', 'last_edited_by', 'last_edited_at'],
    ['/', 'hero', 'headline', 'كُن: أكاديمية التفكير الحسّي', 'KUN: Somatic Thinking Academy', 'text', 'كُن أكاديمية | التفكير الحسّي', 'KUN Academy | Somatic Thinking', 'أكاديمية كُن للتفكير الحسّي - أول أكاديمية عربية متخصصة في تدريب الكوتشز', 'KUN Academy for Somatic Thinking - The first Arabic academy specialized in coach training', '/images/og-home.jpg', 'https://kunacademy.com', '/images/hero-home.jpg', 'ابدأ رحلتك', 'Start Your Journey', '/programs', '', 'TRUE', 'samer', '2026-03-24'],
    ['/', 'hero', 'subheadline', 'أول أكاديمية عربية متخصصة في تدريب الكوتشز بمنهجية التفكير الحسّي', 'The first Arabic academy specializing in coach training through Somatic Thinking methodology', 'text', '', '', '', '', '', '', '', '', '', '', '', 'TRUE', 'samer', '2026-03-24'],
    ['/about', 'intro', 'headline', 'عن كُن', 'About KUN', 'text', 'عن أكاديمية كُن', 'About KUN Academy', 'تعرّف على قصة أكاديمية كُن ومؤسسها سامر حسن', 'Learn about KUN Academy and its founder Samer Hassan', '/images/og-about.jpg', 'https://kunacademy.com/about', '/images/hero-about.jpg', 'تواصل معنا', 'Contact Us', '/contact', '', 'TRUE', 'samer', '2026-03-24'],
  ]);

  // ── Tab 2: Programs ──
  setupTab(ss, 'Programs', [
    ['slug', 'title_ar', 'title_en', 'subtitle_ar', 'subtitle_en', 'description_ar', 'description_en', 'nav_group', 'type', 'format', 'location', 'instructor_slug', 'duration', 'price_aed', 'price_egp', 'price_usd', 'price_eur', 'early_bird_price_aed', 'early_bird_deadline', 'discount_percentage', 'discount_valid_until', 'installment_enabled', 'is_icf_accredited', 'icf_details', 'cce_units', 'access_duration_days', 'thumbnail_url', 'is_featured', 'is_free', 'display_order', 'meta_title_ar', 'meta_title_en', 'published', 'last_edited_by', 'last_edited_at'],
    ['stce', 'دبلوم التفكير الحسّي في الكوتشنج', 'Somatic Thinking Coaching Excellence Diploma', 'دبلوم شامل معتمد من ICF', 'Comprehensive ICF-accredited diploma', 'برنامج تأسيسي شامل يؤهلك لممارسة الكوتشنج بمنهجية التفكير الحسّي', 'A comprehensive foundational program qualifying you to practice coaching with the Somatic Thinking methodology', 'academy', 'diploma', 'hybrid', 'dubai', 'samer-hassan', '6 months', '18000', '45000', '4900', '4500', '15000', '2026-05-01', '10', '2026-04-15', 'TRUE', 'TRUE', 'ICF Level 1 Accredited', '60', '365', '/images/programs/stce.jpg', 'TRUE', 'FALSE', '1', 'دبلوم التفكير الحسّي في الكوتشنج | كُن', 'STCE Diploma | KUN Academy', 'TRUE', 'samer', '2026-03-24'],
    ['intro-coaching', 'مدخل إلى الكوتشنج', 'Introduction to Coaching', 'ورشة تعريفية مجانية', 'Free introductory workshop', 'ورشة مجانية تعريفية بعالم الكوتشنج ومنهجية التفكير الحسّي', 'A free introductory workshop to the world of coaching and Somatic Thinking methodology', 'coaching', 'workshop', 'online', 'online', 'samer-hassan', '2 hours', '0', '0', '0', '0', '', '', '', '', 'FALSE', 'FALSE', '', '0', '7', '/images/programs/intro.jpg', 'TRUE', 'TRUE', '2', 'مدخل إلى الكوتشنج | كُن', 'Intro to Coaching | KUN', 'TRUE', 'samer', '2026-03-24'],
  ]);

  // ── Tab 3: Services ──
  setupTab(ss, 'Services', [
    ['slug', 'name_ar', 'name_en', 'description_ar', 'description_en', 'category', 'duration_minutes', 'coach_slug', 'sessions_count', 'validity_days', 'price_aed', 'price_egp', 'price_usd', 'price_eur', 'discount_percentage', 'discount_valid_until', 'installment_enabled', 'bundle_id', 'display_order', 'published', 'last_edited_by', 'last_edited_at'],
    ['executive-coaching', 'كوتشنج تنفيذي', 'Executive Coaching', 'جلسات كوتشنج فردية للقيادات والمدراء التنفيذيين', 'Individual coaching sessions for leaders and executives', 'individual', '60', 'samer-hassan', '6', '90', '12000', '30000', '3200', '3000', '', '', 'TRUE', '', '1', 'TRUE', 'samer', '2026-03-24'],
    ['team-facilitation', 'تيسير فرق العمل', 'Team Facilitation', 'ورش تيسير لفرق العمل والقيادة', 'Facilitation workshops for teams and leadership', 'corporate', '480', 'samer-hassan', '1', '30', '25000', '', '6800', '6200', '', '', 'FALSE', '', '2', 'TRUE', 'samer', '2026-03-24'],
    ['mentor-coaching', 'منتور كوتشنج', 'Mentor Coaching', 'ساعات منتور كوتشنج معتمدة لتجديد الاعتماد من ICF', 'Accredited mentor coaching hours for ICF credential renewal', 'mentoring', '60', 'samer-hassan', '10', '180', '8000', '20000', '2200', '2000', '', '', 'TRUE', '', '3', 'TRUE', 'samer', '2026-03-24'],
  ]);

  // ── Tab 4: Team ──
  setupTab(ss, 'Team', [
    ['slug', 'name_ar', 'name_en', 'title_ar', 'title_en', 'bio_ar', 'bio_en', 'photo_url', 'icf_credential', 'credentials', 'specialties', 'coaching_styles', 'languages', 'is_visible', 'is_bookable', 'display_order', 'published', 'last_edited_by', 'last_edited_at'],
    ['samer-hassan', 'سامر حسن', 'Samer Hassan', 'المؤسس والمدرب الرئيسي', 'Founder & Master Coach', 'أول عربي يحصل على اعتماد MCC من ICF. مؤسس منهجية التفكير الحسّي. أكثر من 10,000 ساعة كوتشنج', 'First Arab MCC holder from ICF. Founder of Somatic Thinking methodology. Over 10,000 coaching hours', '/images/team/samer-hassan.jpg', 'master', 'MCC (ICF), ICF Young Leader Award 2019', 'التفكير الحسّي, القيادة, التحول المؤسسي', 'somatic, transformative, systemic', 'ar, en, it', 'TRUE', 'TRUE', '1', 'TRUE', 'samer', '2026-03-24'],
    ['team-placeholder', 'عضو الفريق', 'Team Member', 'كوتش معتمد', 'Certified Coach', 'كوتش معتمد من أكاديمية كُن', 'Certified coach from KUN Academy', '/images/team/placeholder.jpg', 'certified', 'ACC (ICF)', 'التفكير الحسّي', 'somatic', 'ar', 'FALSE', 'FALSE', '99', 'FALSE', 'samer', '2026-03-24'],
  ]);

  // ── Tab 5: Settings ──
  setupTab(ss, 'Settings', [
    ['category', 'key', 'value', 'published', 'last_edited_by', 'last_edited_at'],
    ['site', 'site_name_ar', 'أكاديمية كُن', 'TRUE', 'samer', '2026-03-24'],
    ['site', 'site_name_en', 'KUN Academy', 'TRUE', 'samer', '2026-03-24'],
    ['site', 'tagline_ar', 'أكاديمية التفكير الحسّي', 'TRUE', 'samer', '2026-03-24'],
    ['site', 'tagline_en', 'Somatic Thinking Academy', 'TRUE', 'samer', '2026-03-24'],
    ['contact', 'email', 'info@kunacademy.com', 'TRUE', 'samer', '2026-03-24'],
    ['contact', 'whatsapp', '+971501234567', 'TRUE', 'samer', '2026-03-24'],
    ['social', 'instagram', 'https://instagram.com/kunacademy', 'TRUE', 'samer', '2026-03-24'],
    ['social', 'linkedin', 'https://linkedin.com/company/kunacademy', 'TRUE', 'samer', '2026-03-24'],
    ['pricing', 'default_currency', 'AED', 'TRUE', 'samer', '2026-03-24'],
    ['pricing', 'installment_provider', 'tabby', 'TRUE', 'samer', '2026-03-24'],
  ]);

  // ── Tab 6: Pathfinder (CREATE NEW) ──
  setupTab(ss, 'Pathfinder', [
    ['question_id', 'parent_answer_id', 'question_ar', 'question_en', 'answers', 'video_url', 'recommendation_slug', 'type', 'published', 'last_edited_by', 'last_edited_at'],
    ['q1', '', 'ما الذي يصف وضعك الحالي بشكل أفضل؟', 'What best describes your current situation?', '[{"id":"a1","text_ar":"أريد أن أصبح كوتش محترف","text_en":"I want to become a professional coach"},{"id":"a2","text_ar":"أنا كوتش وأريد تطوير مهاراتي","text_en":"I am a coach and want to develop my skills"},{"id":"a3","text_ar":"أبحث عن كوتشنج لنفسي أو لفريقي","text_en":"I am looking for coaching for myself or my team"}]', '', '', 'individual', 'TRUE', 'samer', '2026-03-24'],
    ['q2', 'a1', 'ما مستوى خبرتك في الكوتشنج؟', 'What is your coaching experience level?', '[{"id":"a4","text_ar":"مبتدئ - لا خبرة سابقة","text_en":"Beginner - no prior experience"},{"id":"a5","text_ar":"لدي بعض الخبرة","text_en":"I have some experience"}]', '', '', 'individual', 'TRUE', 'samer', '2026-03-24'],
    ['q3', 'a4', 'تهانينا! نرشح لك البدء بهذا البرنامج', 'Congratulations! We recommend starting with this program', '[]', 'https://youtube.com/embed/example', 'intro-coaching', 'individual', 'TRUE', 'samer', '2026-03-24'],
  ]);

  SpreadsheetApp.getUi().alert('CMS Sheet setup complete! 6 tabs populated with headers and sample data.');
}

/**
 * Sets up a tab: creates if missing, clears existing data, writes headers + sample rows.
 */
function setupTab(ss, tabName, data) {
  let sheet = ss.getSheetByName(tabName);

  if (!sheet) {
    sheet = ss.insertSheet(tabName);
  }

  // Clear all existing content
  sheet.clear();

  // Write all data (headers + sample rows)
  if (data.length > 0 && data[0].length > 0) {
    const range = sheet.getRange(1, 1, data.length, data[0].length);
    range.setValues(data);

    // Bold the header row
    sheet.getRange(1, 1, 1, data[0].length).setFontWeight('bold');

    // Freeze header row
    sheet.setFrozenRows(1);

    // Auto-resize first 5 columns for readability
    const colsToResize = Math.min(5, data[0].length);
    for (let i = 1; i <= colsToResize; i++) {
      sheet.autoResizeColumn(i);
    }
  }
}
