import { test } from '@playwright/test';

test.describe('GP2: English Visitor → Find Course → Enroll → Lesson Player', () => {
  // Flow:
  // 1. Land on English homepage (LTR layout)
  // 2. Browse or search for a micro-course
  // 3. View course landing page (syllabus, duration, price)
  // 4. Click "Enroll Now" CTA
  // 5. Complete enrollment (account creation or login)
  // 6. Redirect to course dashboard
  // 7. Open first lesson in the lesson player
  // 8. Verify video/content loads
  // 9. Verify progress tracking initializes

  test('loads English homepage with LTR layout', () => {
    test.skip(true, 'Not implemented yet');
    // expect page to have dir="ltr" or no dir attribute
    // expect hero section in English
    // expect navigation links in English
  });

  test('finds a micro-course via browse or search', () => {
    test.skip(true, 'Not implemented yet');
    // navigate to /en/courses
    // expect course cards to render
    // optionally use search to filter
  });

  test('views course landing page with details', () => {
    test.skip(true, 'Not implemented yet');
    // click a course card
    // expect syllabus section
    // expect duration and price displayed
    // expect "Enroll Now" CTA visible
  });

  test('enrolls in course and reaches dashboard', () => {
    test.skip(true, 'Not implemented yet');
    // click enroll
    // complete signup/login flow
    // verify redirect to student dashboard
    // verify course appears in "My Courses"
  });

  test('opens lesson player and tracks progress', () => {
    test.skip(true, 'Not implemented yet');
    // click first lesson
    // expect lesson player to load (video or content)
    // verify progress bar initializes at 0%
  });
});
