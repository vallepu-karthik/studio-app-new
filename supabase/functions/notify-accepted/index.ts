/**
 * notify-accepted — Supabase Edge Function
 * ─────────────────────────────────────────
 * Called by accept.html after a client accepts a quotation.
 * Fetches the studio owner's email from profiles.settings,
 * then sends a notification email via Resend.
 *
 * SETUP (one-time):
 * 1. Sign up at https://resend.com (free — 3,000 emails/month)
 * 2. Get your API key from Resend dashboard
 * 3. Add it to Supabase: Dashboard → Edge Functions → Secrets
 *    Name: RESEND_API_KEY   Value: re_xxxxxxxxxxxx
 * 4. Also add your verified sender domain/email:
 *    Name: FROM_EMAIL       Value: noreply@yourdomain.com
 *    (Or use Resend's free shared domain: onboarding@resend.dev for testing)
 *
 * DEPLOY:
 *   supabase functions deploy notify-accepted
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { quoteId, userId, quoteRef, clientName, total, currency } = await req.json();

    if (!quoteId || !userId) {
      return new Response(JSON.stringify({ error: 'Missing quoteId or userId' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ── 1. Fetch studio owner's email and name from profiles ──
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, // service role to bypass RLS
    );

    const { data: profile, error: profileErr } = await supabase
      .from('profiles')
      .select('settings')
      .eq('id', userId)
      .single();

    if (profileErr || !profile) {
      console.error('Profile fetch failed:', profileErr?.message);
      return new Response(JSON.stringify({ error: 'Profile not found' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const settings   = profile.settings || {};
    const toEmail    = settings.email;
    const studioName = settings.studioName || 'Studio App';

    if (!toEmail) {
      // Studio hasn't set their email — skip silently, acceptance still succeeded
      console.warn(`User ${userId} has no email in settings — notification skipped`);
      return new Response(JSON.stringify({ skipped: true, reason: 'no_studio_email' }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ── 2. Format currency ────────────────────────────────────
    const SYMBOLS: Record<string, string> = {
      INR: '₹', USD: '$', GBP: '£', EUR: '€',
      AED: 'AED ', SGD: 'S$', AUD: 'A$',
    };
    const sym        = SYMBOLS[currency || 'INR'] || '₹';
    const totalFmt   = sym + Number(total || 0).toLocaleString('en-IN');
    const acceptedAt = new Date().toLocaleString('en-IN', {
      day: 'numeric', month: 'long', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });

    // ── 3. Send email via Resend ──────────────────────────────
    const RESEND_KEY = Deno.env.get('RESEND_API_KEY');
    const FROM_EMAIL = Deno.env.get('FROM_EMAIL') || 'onboarding@resend.dev';

    if (!RESEND_KEY) {
      console.error('RESEND_API_KEY secret not set');
      return new Response(JSON.stringify({ error: 'Email service not configured' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const emailHtml = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 20px">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e5e5e5">

        <!-- Header -->
        <tr><td style="background:#1a2e14;padding:28px 32px">
          <p style="margin:0;color:#7ec85a;font-size:13px;font-weight:600;letter-spacing:.05em;text-transform:uppercase">Quote accepted</p>
          <p style="margin:8px 0 0;color:#ffffff;font-size:22px;font-weight:700">${studioName}</p>
        </td></tr>

        <!-- Body -->
        <tr><td style="padding:32px">
          <p style="margin:0 0 24px;color:#374151;font-size:16px;line-height:1.6">
            Great news! A client has accepted your quotation.
          </p>

          <!-- Details card -->
          <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;border-radius:8px;border:1px solid #e5e7eb;margin-bottom:24px">
            <tr><td style="padding:20px 24px">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="padding:6px 0;color:#6b7280;font-size:13px;width:40%">Quote ref</td>
                  <td style="padding:6px 0;color:#111827;font-size:13px;font-weight:600">${quoteRef || quoteId}</td>
                </tr>
                <tr>
                  <td style="padding:6px 0;color:#6b7280;font-size:13px">Client</td>
                  <td style="padding:6px 0;color:#111827;font-size:13px;font-weight:600">${clientName || '—'}</td>
                </tr>
                <tr>
                  <td style="padding:6px 0;color:#6b7280;font-size:13px">Amount</td>
                  <td style="padding:6px 0;color:#111827;font-size:13px;font-weight:600">${totalFmt}</td>
                </tr>
                <tr>
                  <td style="padding:6px 0;color:#6b7280;font-size:13px">Accepted on</td>
                  <td style="padding:6px 0;color:#111827;font-size:13px">${acceptedAt}</td>
                </tr>
              </table>
            </td></tr>
          </table>

          <p style="margin:0 0 8px;color:#374151;font-size:14px;line-height:1.6">
            Log in to your Studio App to convert this quote to an invoice and get started.
          </p>
        </td></tr>

        <!-- Footer -->
        <tr><td style="background:#f9fafb;padding:20px 32px;border-top:1px solid #e5e7eb">
          <p style="margin:0;color:#9ca3af;font-size:12px">
            This notification was sent by Studio App. You received this because a client accepted a quotation linked to this email address.
          </p>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;

    const resendRes = await fetch('https://api.resend.com/emails', {
      method:  'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_KEY}`,
        'Content-Type':  'application/json',
      },
      body: JSON.stringify({
        from:    `${studioName} Notifications <${FROM_EMAIL}>`,
        to:      [toEmail],
        subject: `✓ ${clientName || 'Client'} accepted ${quoteRef || 'your quote'} — ${totalFmt}`,
        html:    emailHtml,
      }),
    });

    if (!resendRes.ok) {
      const errBody = await resendRes.text();
      console.error('Resend error:', resendRes.status, errBody);
      return new Response(JSON.stringify({ error: 'Email send failed', detail: errBody }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const resendData = await resendRes.json();
    console.log('Email sent:', resendData.id, '→', toEmail);

    return new Response(JSON.stringify({ sent: true, emailId: resendData.id }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (err) {
    console.error('Unexpected error:', err);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
