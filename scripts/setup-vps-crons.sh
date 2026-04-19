#!/bin/bash

###############################################################################
# VPS Cron Setup
#
# Installs cron jobs on the KUN Academy VPS for automated maintenance tasks.
# Run this once after deployment to register all scheduled jobs.
#
# Usage: ./scripts/setup-vps-crons.sh
#
# Assumes:
# - Codebase deployed at /var/www/kunacademy-git
# - Node.js and pnpm are available
# - .env.local is present with CRON_SECRET + database credentials
###############################################################################

set -e

REPO_PATH="/var/www/kunacademy-git"
CRON_SECRET="${CRON_SECRET:-your-secret-here}"  # Override with env var or edit below
APP_URL="http://localhost:3001"  # Staging server (internal only)

echo "Setting up VPS cron jobs for KUN Academy..."

# Verify codebase exists
if [ ! -d "$REPO_PATH" ]; then
  echo "Error: Repository not found at $REPO_PATH"
  exit 1
fi

# Remove old cron entries for kunacademy (if any exist)
echo "Cleaning up old kunacademy cron entries..."
crontab -l 2>/dev/null | grep -v "kunacademy" | crontab - 2>/dev/null || true

# Create new crontab entries
# Note: Times are UTC; adjust TZ environment if needed

CRON_ENTRIES="
# KUN Academy Crons
# ─────────────────

# Booking reminders: 9am UTC daily (send 24h before confirmations)
0 9 * * * cd $REPO_PATH && curl -s -H \"Authorization: Bearer $CRON_SECRET\" $APP_URL/api/cron/booking-reminders >> /var/log/kunacademy-crons.log 2>&1

# Installment payment reminders: 8am UTC daily
0 8 * * * cd $REPO_PATH && curl -s -H \"Authorization: Bearer $CRON_SECRET\" $APP_URL/api/cron/installment-reminders >> /var/log/kunacademy-crons.log 2>&1

# Reap orphaned discount reservations: 9:15am UTC daily (after booking-reminders)
15 9 * * * cd $REPO_PATH && curl -s -H \"Authorization: Bearer $CRON_SECRET\" $APP_URL/api/cron/reap-orphan-reservations >> /var/log/kunacademy-crons.log 2>&1

# ── Phase 1.4 — Mentoring Package Crons (Dubai = UTC+4) ───────────────────

# Cron 1: Package expiry warnings (T+14, T+7, T+1) — 09:00 Dubai = 05:00 UTC
0 5 * * * curl -s -H \"Authorization: Bearer $CRON_SECRET\" $APP_URL/api/cron/package-expiry-warnings >> /var/log/kunacademy-crons.log 2>&1

# Cron 2: Package expiry enforcement — 09:05 Dubai = 05:05 UTC
5 5 * * * curl -s -H \"Authorization: Bearer $CRON_SECRET\" $APP_URL/api/cron/package-expiry-enforcement >> /var/log/kunacademy-crons.log 2>&1

# Cron 3: Upcoming session 24h reminder — 09:10 Dubai = 05:10 UTC
10 5 * * * curl -s -H \"Authorization: Bearer $CRON_SECRET\" $APP_URL/api/cron/upcoming-session-24h >> /var/log/kunacademy-crons.log 2>&1

# Cron 4: Upcoming session 1h reminder — every 15 minutes
*/15 * * * * curl -s -H \"Authorization: Bearer $CRON_SECRET\" $APP_URL/api/cron/upcoming-session-1h >> /var/log/kunacademy-crons.log 2>&1

# Cron 5: Milestone due digest — 09:15 Dubai = 05:15 UTC
15 5 * * * curl -s -H \"Authorization: Bearer $CRON_SECRET\" $APP_URL/api/cron/milestone-due-digest >> /var/log/kunacademy-crons.log 2>&1

# Cron 6: Assessment SLA check (>10 biz days pending) — 09:20 Dubai = 05:20 UTC
20 5 * * * curl -s -H \"Authorization: Bearer $CRON_SECRET\" $APP_URL/api/cron/assessment-sla-check >> /var/log/kunacademy-crons.log 2>&1

# Cron 7: Second-try deadline warnings (T+7, T+3, T+1) — 09:25 Dubai = 05:25 UTC
25 5 * * * curl -s -H \"Authorization: Bearer $CRON_SECRET\" $APP_URL/api/cron/second-try-deadline-warnings >> /var/log/kunacademy-crons.log 2>&1

# Cron 8: Second-try deadline enforcement (terminate) — 09:30 Dubai = 05:30 UTC
30 5 * * * curl -s -H \"Authorization: Bearer $CRON_SECRET\" $APP_URL/api/cron/second-try-deadline-enforcement >> /var/log/kunacademy-crons.log 2>&1

# Cron 9: Mentor prep release (48h gate) — 09:35 Dubai = 05:35 UTC
35 5 * * * curl -s -H \"Authorization: Bearer $CRON_SECRET\" $APP_URL/api/cron/mentor-prep-release >> /var/log/kunacademy-crons.log 2>&1

# ── Zoho CRM Sync ───────────────────────────────────────────────────────────

# Cron 10: Zoho CRM contact batch sync — every 15 minutes
# Syncs new KUN users to Zoho CRM Contacts and drains the retry queue.
*/15 * * * * curl -s -H \"Authorization: Bearer $CRON_SECRET\" $APP_URL/api/cron/zoho-crm-sync >> /var/log/kunacademy-crons.log 2>&1

# Cron 11: Zoho CRM daily status refresh — 06:00 Dubai = 02:00 UTC
# Classifies contacts as New/Active/Passive based on booking/payment activity.
0 2 * * * curl -s -H \"Authorization: Bearer $CRON_SECRET\" $APP_URL/api/cron/zoho-crm-status >> /var/log/kunacademy-crons.log 2>&1
"

# Install crontab entries
(crontab -l 2>/dev/null || true; echo "$CRON_ENTRIES") | crontab -

echo ""
echo "✓ VPS cron jobs installed successfully"
echo ""
echo "Installed jobs:"
crontab -l | grep -A 10 "KUN Academy Crons" || true
echo ""
echo "Log file: /var/log/kunacademy-crons.log"
echo ""
echo "To verify jobs are running, check:"
echo "  tail -f /var/log/kunacademy-crons.log"
