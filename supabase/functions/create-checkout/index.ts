/**
 * create-checkout — Supabase Edge Function
 * ─────────────────────────────────────────
 * Creates a Stripe Checkout session for the Pro plan.
 * Called by pricing.html when user clicks "Upgrade to Pro".
 *
 * SETUP (one-time):
 * 1. Sign up at https://stripe.com
 * 2. Create a Product → Price in Stripe dashboard:
 *    - Product name: "Studio App Pro"
 *    - Price: e.g. ₹999/month or ₹9,999/year (recurring)
 *    - Copy the Price ID: price_xxxxxxxxxxxxx
 * 3. Add secrets in Supabase → Edge Functions → Manage secrets:
 *    STRIPE_SECRET_KEY  = sk_live_xxx  (or sk_test_xxx for testing)
 *    STRIPE_PRICE_ID    = price_xxx
 *    APP_URL            = https://your-app.vercel.app
 *
 * DEPLOY:
 *   supabase functions deploy create-checkout
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import Stripe from 'https://esm.sh/stripe@14?target=deno';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // ── 1. Verify the user is logged in ──────────────────
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userErr } = await supabase.auth.getUser();
    if (userErr || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ── 2. Get or create Stripe customer ─────────────────
    const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, {
      apiVersion: '2024-06-20',
    });

    // Check if user already has a Stripe customer ID
    const sbAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const { data: profile } = await sbAdmin
      .from('profiles')
      .select('stripe_customer_id, settings')
      .eq('id', user.id)
      .single();

    let customerId = profile?.stripe_customer_id;

    if (!customerId) {
      // Create a new Stripe customer
      const customer = await stripe.customers.create({
        email: user.email,
        name:  profile?.settings?.studioName || user.email,
        metadata: { supabase_user_id: user.id },
      });
      customerId = customer.id;

      // Save customer ID to profile
      await sbAdmin.from('profiles')
        .update({ stripe_customer_id: customerId })
        .eq('id', user.id);
    }

    // ── 3. Create Checkout session ────────────────────────
    const APP_URL   = Deno.env.get('APP_URL') || 'http://localhost:3000';
    const PRICE_ID  = Deno.env.get('STRIPE_PRICE_ID')!;

    const session = await stripe.checkout.sessions.create({
      customer:             customerId,
      payment_method_types: ['card'],
      line_items: [{
        price:    PRICE_ID,
        quantity: 1,
      }],
      mode:        'subscription',
      success_url: `${APP_URL}/pages/upgrade-success.html?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url:  `${APP_URL}/pricing.html?cancelled=1`,
      metadata: {
        supabase_user_id: user.id,
      },
      subscription_data: {
        metadata: { supabase_user_id: user.id },
      },
      allow_promotion_codes: true,
      billing_address_collection: 'auto',
    });

    return new Response(JSON.stringify({ url: session.url }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (err) {
    console.error('create-checkout error:', err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
