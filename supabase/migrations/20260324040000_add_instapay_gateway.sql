-- Add 'instapay' to payments.gateway CHECK constraint
-- InstaPay: Egypt's instant payment network via CIB
ALTER TABLE payments DROP CONSTRAINT IF EXISTS payments_gateway_check;
ALTER TABLE payments ADD CONSTRAINT payments_gateway_check
  CHECK (gateway IN ('stripe', 'paytabs', 'tabby', 'instapay'));
