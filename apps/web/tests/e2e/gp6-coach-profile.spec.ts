import { test } from '@playwright/test';

test.describe('GP6: Coach → Edit Profile → Submit → Verify Pending Status', () => {
  // Flow:
  // 1. Login as a registered coach
  // 2. Navigate to coach profile/settings
  // 3. Edit profile fields (bio, specializations, photo, availability)
  // 4. Submit profile changes
  // 5. Verify "Pending Review" status shown
  // 6. Verify changes are NOT yet visible on public profile
  // 7. (Admin flow) Approve profile changes
  // 8. Verify public profile now shows updated info

  test('logs in as coach and navigates to profile', () => {
    test.skip(true, 'Not implemented yet');
    // navigate to /login
    // login with coach credentials
    // navigate to /coach/profile or /settings
    // expect current profile data loaded
  });

  test('edits profile fields and submits', () => {
    test.skip(true, 'Not implemented yet');
    // update bio text
    // update specializations
    // change availability slots
    // click save/submit
    // expect success message
  });

  test('sees pending review status after submission', () => {
    test.skip(true, 'Not implemented yet');
    // expect "Pending Review" badge or status message
    // navigate to public coach profile URL
    // verify OLD data still shown (changes not live yet)
  });

  test('profile goes live after admin approval', () => {
    test.skip(true, 'Not implemented yet');
    // (would require admin login in separate context)
    // mock admin approval API call
    // navigate to public coach profile
    // verify updated bio and specializations visible
  });
});
