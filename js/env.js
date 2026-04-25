/* ═══════════════════════════════════════════════════════════
   js/env.js  —  Runtime environment configuration
   ─────────────────────────────────────────────────────────
   HOW TO SET UP (one-time):
   1. Go to Vercel Dashboard → Your Project → Settings → Environment Variables
   2. Add these two variables:
        Name: SUPABASE_URL
        Value: https://your-project-ref.supabase.co   ← NO /rest/v1/ suffix

        Name: SUPABASE_ANON_KEY
        Value: eyJ...  ← your anon/public key from Supabase → Settings → API

   3. In vercel.json, add a build step to inject them (see vercel.json comments)
      OR use the simple approach below: replace the placeholders before deploy
      using a build script.

   SIMPLE APPROACH (no build step needed):
   Replace __SUPABASE_URL__ and __SUPABASE_ANON_KEY__ below with your actual
   values using a Vercel build command:
     sed -i "s|__SUPABASE_URL__|$SUPABASE_URL|g" js/env.js
     sed -i "s|__SUPABASE_ANON_KEY__|$SUPABASE_ANON_KEY|g" js/env.js

   Add to vercel.json:
     "buildCommand": "sed -i \"s|__SUPABASE_URL__|$SUPABASE_URL|g\" js/env.js && sed -i \"s|__SUPABASE_ANON_KEY__|$SUPABASE_ANON_KEY|g\" js/env.js"
═══════════════════════════════════════════════════════════ */

window.__ENV = {
  SUPABASE_URL:      '__SUPABASE_URL__',
  SUPABASE_ANON_KEY: '__SUPABASE_ANON_KEY__',
};
