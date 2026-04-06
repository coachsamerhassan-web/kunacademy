-- Webhook event idempotency table
-- Tracks every inbound webhook by its gateway-assigned event ID (Stripe evt_xxx, Tabby event ID).
-- Prevents duplicate processing even across concurrent retries.

CREATE TABLE webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id TEXT NOT NULL UNIQUE,           -- Stripe evt_xxx or Tabby event ID
  gateway TEXT NOT NULL,                    -- 'stripe' or 'tabby'
  event_type TEXT NOT NULL,                 -- 'checkout.session.completed', etc.
  status TEXT NOT NULL DEFAULT 'processing', -- processing | completed | failed
  payment_id UUID REFERENCES payments(id),
  metadata JSONB DEFAULT '{}',
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX idx_webhook_events_event_id ON webhook_events(event_id);
CREATE INDEX idx_webhook_events_gateway ON webhook_events(gateway, created_at DESC);

-- RLS: Only admins can view, only service_role can write (no INSERT policy for authenticated users)
ALTER TABLE webhook_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view webhook events"
  ON webhook_events FOR SELECT
  TO authenticated
  USING (is_admin());

-- No INSERT/UPDATE policy for authenticated users — writes go through service_role (admin client)
