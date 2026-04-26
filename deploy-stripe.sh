#!/bin/bash
# ═══════════════════════════════════════════════════════════
# deploy-stripe.sh — Deploy Stripe Edge Functions
# ═══════════════════════════════════════════════════════════
#
# PREREQUISITES:
#   npm install -g supabase
#   supabase login
#   supabase link --project-ref ezjfblayhsvxjjbjwyzo
#
# STRIPE SETUP (one-time, ~10 minutes):
# 1. Sign up at https://stripe.com
# 2. Dashboard → Products → Add Product
#    Name: "Studio App Pro"
#    Price: ₹999/month (recurring) → copy price_xxx ID
# 3. Dashboard → Developers → API Keys → copy sk_live_xxx
# 4. Dashboard → Webhooks → Add endpoint:
#    URL: https://ezjfblayhsvxjjbjwyzo.supabase.co/functions/v1/stripe-webhook
#    Events: checkout.session.completed, customer.subscription.deleted, customer.subscription.updated
#    → copy whsec_xxx signing secret
#
# ADD SECRETS (run these first):
#   supabase secrets set STRIPE_SECRET_KEY=sk_live_xxx
#   supabase secrets set STRIPE_PRICE_ID=price_xxx
#   supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_xxx
#   supabase secrets set APP_URL=https://your-app.vercel.app
#
# RUN SCHEMA MIGRATION in Supabase SQL Editor:
#   (copy the alter table lines from supabase-schema.sql)
#
# THEN DEPLOY:
#   chmod +x deploy-stripe.sh
#   ./deploy-stripe.sh

set -e

echo "Deploying Stripe Edge Functions..."

supabase functions deploy create-checkout
supabase functions deploy stripe-webhook --no-verify-jwt

echo ""
echo "✓ Done!"
echo ""
echo "Next: Update pricing.html with your actual price amount if different from ₹999"
echo "Next: Test with Stripe test mode (use sk_test_xxx and card 4242 4242 4242 4242)"
