import { test } from '@playwright/test';

test.describe('GP3: Returning Student → Login → Resume Course → Certificate', () => {
  // Flow:
  // 1. Navigate to login page
  // 2. Login with existing student credentials
  // 3. Redirect to student dashboard
  // 4. See in-progress courses with progress indicators
  // 5. Click "Resume" on partially completed course
  // 6. Land on the next incomplete lesson
  // 7. Complete remaining lessons (mock/fast-forward)
  // 8. Trigger course completion
  // 9. Verify certificate generation page renders
  // 10. Verify certificate download link

  test('logs in with existing student credentials', () => {
    test.skip(true, 'Not implemented yet');
    // navigate to /login
    // fill email and password
    // submit login form
    // verify redirect to dashboard
  });

  test('sees in-progress courses on dashboard', () => {
    test.skip(true, 'Not implemented yet');
    // expect dashboard to show enrolled courses
    // expect progress percentage on at least one course
    // expect "Resume" button visible
  });

  test('resumes course at last incomplete lesson', () => {
    test.skip(true, 'Not implemented yet');
    // click resume on in-progress course
    // verify landing on the correct lesson (not lesson 1)
    // verify previous lessons marked as complete
  });

  test('completes course and sees certificate', () => {
    test.skip(true, 'Not implemented yet');
    // mock completion of remaining lessons
    // verify course completion state
    // expect certificate page to render
    // expect download link for PDF certificate
  });
});
