/**
 * Email template builders for various transactional emails
 */

export interface BookShareEmailData {
  shareUrl: string;
  bookTitle: string;
  senderName: string;
  senderEmail: string;
  recipientEmail: string;
  customMessage?: string;
}

export function renderBookShareEmail(data: BookShareEmailData): { subject_ar: string; subject_en: string; html_ar: string; html_en: string } {
  const { shareUrl, bookTitle, senderName, customMessage } = data;

  return {
    subject_ar: `دعوة لمشاركة كتاب: "${bookTitle}"`,
    subject_en: `Book Share Invitation: "${bookTitle}"`,

    html_ar: `
<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Tajawal', sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { text-align: center; margin-bottom: 30px; }
    .logo { font-size: 24px; font-weight: bold; color: #7C5CFC; }
    .card { background: #f9f5ff; border-radius: 12px; padding: 24px; margin: 20px 0; }
    .button { display: inline-block; background: #7C5CFC; color: white; padding: 12px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; }
    .footer { text-align: center; margin-top: 40px; color: #999; font-size: 12px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="logo">كن — Kun Academy</div>
    </div>

    <p>السلام عليكم ورحمة الله وبركاته،</p>

    <p>
      يسعد <strong>${senderName}</strong> أن يشاركك كتاب <strong>"${bookTitle}"</strong>
    </p>

    ${customMessage ? `<div class="card"><p><em>"${customMessage}"</em></p></div>` : ''}

    <p>انقر على الزر أدناه للوصول إلى الكتاب:</p>

    <div style="text-align: center; margin: 30px 0;">
      <a href="${shareUrl}" class="button">فتح الكتاب</a>
    </div>

    <p style="color: #666; font-size: 14px;">
      الرابط ساري لمدة 30 يومًا من الآن. بعد ذلك قد تحتاج إلى الحصول على نسخة خاصة بك من الكتاب.
    </p>

    <div class="footer">
      <p>© 2026 Kun Academy. جميع الحقوق محفوظة.</p>
    </div>
  </div>
</body>
</html>
    `,

    html_en: `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { text-align: center; margin-bottom: 30px; }
    .logo { font-size: 24px; font-weight: bold; color: #7C5CFC; }
    .card { background: #f9f5ff; border-radius: 12px; padding: 24px; margin: 20px 0; }
    .button { display: inline-block; background: #7C5CFC; color: white; padding: 12px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; }
    .footer { text-align: center; margin-top: 40px; color: #999; font-size: 12px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="logo">كن — Kun Academy</div>
    </div>

    <p>Hello,</p>

    <p>
      <strong>${senderName}</strong> would like to share <strong>"${bookTitle}"</strong> with you.
    </p>

    ${customMessage ? `<div class="card"><p><em>"${customMessage}"</em></p></div>` : ''}

    <p>Click the button below to access the book:</p>

    <div style="text-align: center; margin: 30px 0;">
      <a href="${shareUrl}" class="button">Open Book</a>
    </div>

    <p style="color: #666; font-size: 14px;">
      This link is valid for 30 days from now. After that, you may need to get your own copy of the book.
    </p>

    <div class="footer">
      <p>© 2026 Kun Academy. All rights reserved.</p>
    </div>
  </div>
</body>
</html>
    `,
  };
}
