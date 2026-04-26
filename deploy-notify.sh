#!/bin/bash
# ═══════════════════════════════════════════════════════════
# deploy-notify.sh — Deploy the notify-accepted Edge Function
# ═══════════════════════════════════════════════════════════
#
# PREREQUISITES (one-time setup):
#   npm install -g supabase
#   supabase login
#   supabase link --project-ref ezjfblayhsvxjjbjwyzo
#
# RESEND SETUP (one-time):
#   1. Sign up at https://resend.com (free — 3,000 emails/month)
#   2. Get API key from Resend dashboard → API Keys → Create API Key
#   3. Add your sending domain OR use onboarding@resend.dev for testing
#
# ADD SECRETS TO SUPABASE (one-time):
#   supabase secrets set RESEND_API_KEY=re_your_key_here
#   supabase secrets set FROM_EMAIL=noreply@yourdomain.com
#
#   Or add via Supabase Dashboard:
#   Project → Edge Functions → Manage secrets
#
# DEPLOY:
#   chmod +x deploy-notify.sh
#   ./deploy-notify.sh

set -e

echo "Deploying notify-accepted Edge Function..."
supabase functions deploy notify-accepted --no-verify-jwt

echo ""
echo "Done! Test it:"
echo "  curl -X POST https://ezjfblayhsvxjjbjwyzo.supabase.co/functions/v1/notify-accepted \\"
echo "    -H 'Authorization: Bearer YOUR_ANON_KEY' \\"
echo "    -H 'Content-Type: application/json' \\"
echo "    -d '{\"quoteId\":\"test\",\"userId\":\"YOUR_USER_ID\",\"quoteRef\":\"QT-001\",\"clientName\":\"Test Client\",\"total\":30000,\"currency\":\"INR\"}'"
