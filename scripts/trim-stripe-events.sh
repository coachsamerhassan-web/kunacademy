#!/usr/bin/env bash
# =============================================================================
# trim-stripe-events.sh
#
# Trims the Stripe webhook endpoint's subscribed events down to ONLY the
# event types that are actually handled in apps/web/src/app/api/webhooks/payment/route.ts
#
# HANDLED EVENT TYPES (from switch branches in route.ts):
#   1. checkout.session.completed
#   2. invoice.paid
#   3. invoice.payment_failed
#   4. checkout.session.expired
#
# USAGE:
#   DO NOT run this script autonomously — it modifies the live Stripe webhook config.
#   Review the WEBHOOK_ID detection below, confirm it is the correct endpoint,
#   then run:
#
#     STRIPE_SECRET_KEY=sk_live_... bash scripts/trim-stripe-events.sh
#
# PREREQUISITES:
#   - curl (standard on macOS/Linux)
#   - STRIPE_SECRET_KEY env var must be set (live key for production)
#
# ROLLBACK:
#   If you need to restore the original 236-event subscription, go to:
#   https://dashboard.stripe.com/webhooks → your endpoint → Edit → "Select events"
#   and re-enable the events you want, or re-run with an expanded EVENTS list.
# =============================================================================

set -euo pipefail

STRIPE_API="https://api.stripe.com/v1"

# ── Validate env ──────────────────────────────────────────────────────────────
if [[ -z "${STRIPE_SECRET_KEY:-}" ]]; then
  echo "ERROR: STRIPE_SECRET_KEY is not set."
  echo "Run: STRIPE_SECRET_KEY=sk_live_... bash scripts/trim-stripe-events.sh"
  exit 1
fi

echo ""
echo "=== Stripe Webhook Event Trim ==="
echo "Using key prefix: ${STRIPE_SECRET_KEY:0:12}..."
echo ""

# ── Discover the webhook endpoint ─────────────────────────────────────────────
# We look for the endpoint whose URL contains our handler path.
# The script lists all endpoints and picks the one matching /api/webhooks/payment.
echo "Step 1: Listing Stripe webhook endpoints..."
ENDPOINTS_JSON=$(curl -s -G "$STRIPE_API/webhook_endpoints" \
  -u "$STRIPE_SECRET_KEY:" \
  -d "limit=20")

# Extract the endpoint ID matching our handler URL
WEBHOOK_ID=$(echo "$ENDPOINTS_JSON" | \
  python3 -c "
import sys, json
data = json.load(sys.stdin)
endpoints = data.get('data', [])
for ep in endpoints:
    url = ep.get('url', '')
    if '/api/webhooks/payment' in url or '/webhooks/payment' in url:
        print(ep['id'])
        break
")

if [[ -z "$WEBHOOK_ID" ]]; then
  echo ""
  echo "ERROR: Could not auto-detect webhook endpoint URL matching '/api/webhooks/payment'."
  echo ""
  echo "Available endpoints:"
  echo "$ENDPOINTS_JSON" | python3 -c "
import sys, json
data = json.load(sys.stdin)
for ep in data.get('data', []):
    print(f\"  {ep['id']}  {ep['url']}  (enabled_events: {len(ep.get('enabled_events', []))})\")
"
  echo ""
  echo "Set WEBHOOK_ID manually and re-run:"
  echo "  STRIPE_SECRET_KEY=... WEBHOOK_ID=we_xxx bash scripts/trim-stripe-events.sh"
  # Check if caller passed WEBHOOK_ID explicitly
  if [[ -n "${WEBHOOK_ID_OVERRIDE:-}" ]]; then
    WEBHOOK_ID="$WEBHOOK_ID_OVERRIDE"
    echo "Using WEBHOOK_ID_OVERRIDE=$WEBHOOK_ID"
  else
    exit 1
  fi
fi

echo "Found webhook endpoint: $WEBHOOK_ID"
echo ""

# ── Show current state ────────────────────────────────────────────────────────
echo "Step 2: Current endpoint config..."
CURRENT=$(curl -s "$STRIPE_API/webhook_endpoints/$WEBHOOK_ID" \
  -u "$STRIPE_SECRET_KEY:")
CURRENT_COUNT=$(echo "$CURRENT" | python3 -c "
import sys, json
data = json.load(sys.stdin)
events = data.get('enabled_events', [])
print(len(events))
")
echo "Currently subscribed to: $CURRENT_COUNT events"
echo ""

# ── The 4 events we actually handle ──────────────────────────────────────────
# Source of truth: apps/web/src/app/api/webhooks/payment/route.ts
# Lines 91, 292, 652, 753
EVENTS="checkout.session.completed invoice.paid invoice.payment_failed checkout.session.expired"

echo "Step 3: Trimming to handled events only..."
echo "  Keeping: $EVENTS"
echo ""

# Build the curl form data for enabled_events[]
EVENTS_PARAMS=""
for EVENT in $EVENTS; do
  EVENTS_PARAMS="$EVENTS_PARAMS -d enabled_events[]=$EVENT"
done

echo "FINAL CONFIRMATION:"
echo "  Webhook ID : $WEBHOOK_ID"
echo "  Events in  : $CURRENT_COUNT → 4"
echo ""
echo "  This will REMOVE all other event subscriptions from the live Stripe config."
echo "  Press ENTER to proceed, or Ctrl+C to abort."
read -r

# ── Execute the update ────────────────────────────────────────────────────────
RESPONSE=$(eval curl -s -X POST "$STRIPE_API/webhook_endpoints/$WEBHOOK_ID" \
  -u "$STRIPE_SECRET_KEY:" \
  $EVENTS_PARAMS)

UPDATED_COUNT=$(echo "$RESPONSE" | python3 -c "
import sys, json
data = json.load(sys.stdin)
if 'error' in data:
    print('ERROR: ' + data['error'].get('message', str(data['error'])))
    sys.exit(1)
events = data.get('enabled_events', [])
print(len(events))
")

echo ""
echo "Done. Webhook now subscribed to $UPDATED_COUNT event(s):"
echo "$RESPONSE" | python3 -c "
import sys, json
data = json.load(sys.stdin)
for e in data.get('enabled_events', []):
    print('  -', e)
"
echo ""
echo "Stripe will no longer deliver the other ~232 event types to our endpoint."
echo "Re-run if you add a new event.type handler to route.ts."
