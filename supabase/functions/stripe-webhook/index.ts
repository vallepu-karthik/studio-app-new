/**
 * stripe-webhook — Supabase Edge Function
 * ─────────────────────────────────────────
 * Listens for Stripe events and updates the user's plan in DB.
 *
 * SETUP (one-time):
 * 1. In Stripe Dashboard → Webhooks → Add endpoint:
 *    URL: https://your-project-ref.supabase.co/functions/v1/stripe-webhook
 *    Events to listen for:
 *      - checkout.session.completed
 *      - customer.subscription.deleted
 *      - customer.subscription.updated
 * 2. Copy the Webhook Signing Secret (whsec_xxx)
 * 3. Add to Supabase secrets:
 *    STRIPE_WEBHOOK_SECRET = whsec_xxx
 *
 * DEPLOY:
 *   supabase functions deploy stripe-webhook --no-verify-jwt
 *   (--no-verify-jwt because Stripe calls this, not your users)
 */

import Stripe from 'https://esm.sh/stripe@14?target=deno';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

Deno.serve(async (req: Request) => {
  const signature = req.headers.get('stripe-signature');
  if (!signature) {
    return new Response('Missing stripe-signature', { status: 400 });
  }

  const body = await req.text();

  // ── Verify webhook signature ──────────────────────────
  const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, {
    apiVersion: '2024-06-20',
  });

  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(
      body,
      signature,
      Deno.env.get('STRIPE_WEBHOOK_SECRET')!,
    );
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return new Response(`Webhook Error: ${err.message}`, { status: 400 });
  }

  const sbAdmin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  // ── Handle events ─────────────────────────────────────
  switch (event.type) {

    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session;
      const userId  = session.metadata?.supabase_user_id;
      if (!userId) { console.error('No supabase_user_id in session metadata'); break; }

      // Fetch subscription to get period end
      let expiresAt: string | null = null;
      if (session.subscription) {
        const sub = await stripe.subscriptions.retrieve(session.subscription as string);
        expiresAt = new Date(sub.current_period_end * 1000).toISOString();
      }

      const { error } = await sbAdmin.from('profiles').update({
        plan:            'pro',
        plan_expires_at: expiresAt,
      }).eq('id', userId);

      if (error) console.error('DB update failed:', error.message);
      else console.log(`✓ User ${userId} upgraded to Pro (expires ${expiresAt})`);
      break;
    }

    case 'customer.subscription.updated': {
      const sub    = event.data.object as Stripe.Subscription;
      const userId = sub.metadata?.supabase_user_id;
      if (!userId) break;

      const isActive  = sub.status === 'active' || sub.status === 'trialing';
      const expiresAt = new Date(sub.current_period_end * 1000).toISOString();

      await sbAdmin.from('profiles').update({
        plan:            isActive ? 'pro' : 'free',
        plan_expires_at: isActive ? expiresAt : null,
      }).eq('id', userId);

      console.log(`✓ Subscription updated for ${userId}: ${sub.status}`);
      break;
    }

    case 'customer.subscription.deleted': {
      // Subscription cancelled or expired — downgrade to free
      const sub    = event.data.object as Stripe.Subscription;
      const userId = sub.metadata?.supabase_user_id;
      if (!userId) break;

      await sbAdmin.from('profiles').update({
        plan:            'free',
        plan_expires_at: null,
      }).eq('id', userId);

      console.log(`✓ User ${userId} downgraded to free (subscription cancelled)`);
      break;
    }

    default:
      console.log(`Unhandled event type: ${event.type}`);
  }

  return new Response(JSON.stringify({ received: true }), {
    status: 200, headers: { 'Content-Type': 'application/json' },
  });
});
