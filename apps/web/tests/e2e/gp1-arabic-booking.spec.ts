import { test } from '@playwright/test';

test.describe('GP1: Arabic Visitor → Browse Programs → Book Coaching → Payment', () => {
  // Flow:
  // 1. Land on Arabic homepage (RTL layout verified)
  // 2. Navigate to programs page via main nav
  // 3. Browse program cards (STCE, Menhajak, etc.)
  // 4. Select a 1:1 coaching session
  // 5. View coaching details page (coach bio, availability, pricing)
  // 6. Click "احجز الآن" (Book Now) CTA
  // 7. Fill booking form (name, email, phone, preferred date)
  // 8. Proceed to payment (Stripe checkout)
  // 9. Verify booking confirmation page renders
  // 10. Verify confirmation email trigger (check API mock)

  test('loads Arabic homepage with RTL layout', () => {
    test.skip(true, 'Not implemented yet');
    // expect page to have dir="rtl"
    // expect hero section to render in Arabic
    // expect navigation links in Arabic
  });

  test('browses programs page and sees program cards', () => {
    test.skip(true, 'Not implemented yet');
    // navigate to /ar/programs
    // expect at least 3 program cards visible
    // expect card titles in Arabic
  });

  test('selects coaching session and views details', () => {
    test.skip(true, 'Not implemented yet');
    // click on a coaching program card
    // expect details page with coach info
    // expect pricing displayed in AED
  });

  test('completes booking form', () => {
    test.skip(true, 'Not implemented yet');
    // click book now button
    // fill name, email, phone fields
    // select preferred date from calendar
    // submit form
  });

  test('proceeds to payment and sees confirmation', () => {
    test.skip(true, 'Not implemented yet');
    // verify redirect to Stripe checkout (or embedded form)
    // mock successful payment
    // verify confirmation page renders with booking details
  });
});
