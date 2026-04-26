/* ═══════════════════════════════════════════════════════════
   js/supabase.js
   Supabase client, auth helpers, and all DB/storage ops.
   ─────────────────────────────────────────────────────────
   SETUP: Replace SUPABASE_URL and SUPABASE_ANON_KEY below
   with your project values from:
   Supabase Dashboard → Settings → API
═══════════════════════════════════════════════════════════ */

'use strict';

// ── ⚙️  CONFIG ─────────────────────────────────────────────
// Values are injected at runtime from window.__ENV (set by env.js).
// Never hardcode credentials here — add them to Vercel Environment Variables:
//   SUPABASE_URL      → your project URL (no /rest/v1/ suffix)
//   SUPABASE_ANON_KEY → your anon/public key
// ──────────────────────────────────────────────────────────
const SUPABASE_URL      = (window.__ENV && window.__ENV.SUPABASE_URL)      || '';
const SUPABASE_ANON_KEY = (window.__ENV && window.__ENV.SUPABASE_ANON_KEY) || '';

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('[Studio] Missing Supabase config. Add SUPABASE_URL and SUPABASE_ANON_KEY to Vercel Environment Variables and redeploy.');
}

const _sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    autoRefreshToken:  true,
    persistSession:    true,
    detectSessionInUrl:true,
  }
});

// ── Auth ──────────────────────────────────────────────────

async function sbSignUp(email, password) {
  const { data, error } = await _sb.auth.signUp({ email, password });
  if (error) throw error;
  return data;
}

async function sbSignIn(email, password) {
  const { data, error } = await _sb.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}

async function sbSignOut() {
  const { error } = await _sb.auth.signOut();
  if (error) throw error;
}

async function sbGetSession() {
  const { data } = await _sb.auth.getSession();
  return data.session;
}

function sbOnAuthChange(callback) {
  return _sb.auth.onAuthStateChange((_event, session) => callback(session));
}

function sbUserId() {
  // Sync read — only valid after session is confirmed
  const session = _sb.auth.session?.() || null;
  return session?.user?.id || null;
}

// ── Generic CRUD helpers ──────────────────────────────────

async function _dbUpsert(table, record) {
  const { error } = await _sb.from(table).upsert(record, { onConflict: 'id' });
  if (error) {
    // Surface trial-limit errors from DB trigger to the UI
    if (error.message && error.message.includes('Trial limit')) {
      showLimitBanner('over');
    }
    throw error;
  }
}

async function _dbDelete(table, id) {
  const { error } = await _sb.from(table).delete().eq('id', id);
  if (error) throw error;
}

async function _dbFetchAll(table, userId) {
  const { data, error } = await _sb.from(table).select('data').eq('user_id', userId);
  if (error) throw error;
  return (data || []).map(r => r.data);
}

// ── Settings / Profile ────────────────────────────────────

async function sbLoadPlan(userId) {
  const { data } = await _sb.from('profiles')
    .select('plan, plan_expires_at')
    .eq('id', userId)
    .single();
  return data || { plan: 'free', plan_expires_at: null };
}

async function sbLoadSettings(userId) {
  const { data, error } = await _sb.from('profiles').select('settings').eq('id', userId).single();
  if (error && error.code !== 'PGRST116') throw error; // PGRST116 = no rows
  return data?.settings || null;
}

async function sbSaveSettings(userId, settings) {
  // Strip logo (goes to Storage) and theme (local-only preference — never cloud-synced)
  const { logo, theme, ...rest } = settings;
  const { error } = await _sb.from('profiles').upsert({ id: userId, settings: rest });
  if (error) throw error;
}

// ── Logo storage ──────────────────────────────────────────

async function sbUploadLogo(userId, base64DataUrl) {
  // base64DataUrl = 'data:image/png;base64,xxxx'
  const [header, b64] = base64DataUrl.split(',');
  const mimeMatch = header.match(/data:([^;]+)/);
  const mime = mimeMatch ? mimeMatch[1] : 'image/png';
  const ext  = mime === 'image/jpeg' ? 'jpg' : 'png';

  const byteChars = atob(b64);
  const bytes = new Uint8Array(byteChars.length);
  for (let i = 0; i < byteChars.length; i++) bytes[i] = byteChars.charCodeAt(i);
  const blob = new Blob([bytes], { type: mime });

  const path = `${userId}/logo.${ext}`;
  const { error } = await _sb.storage.from('logos').upload(path, blob, {
    upsert: true, contentType: mime,
  });
  if (error) throw error;

  const { data } = _sb.storage.from('logos').getPublicUrl(path);
  return data.publicUrl + '?t=' + Date.now(); // bust cache
}

async function sbDeleteLogo(userId) {
  // Try both extensions
  await _sb.storage.from('logos').remove([`${userId}/logo.png`, `${userId}/logo.jpg`]);
}

async function sbGetLogoUrl(userId) {
  // Check png first, then jpg
  for (const ext of ['png', 'jpg']) {
    const path = `${userId}/logo.${ext}`;
    const { data } = _sb.storage.from('logos').getPublicUrl(path);
    // Verify it exists with a HEAD request
    try {
      const res = await fetch(data.publicUrl, { method: 'HEAD' });
      if (res.ok) return data.publicUrl + '?t=' + Date.now();
    } catch { /* skip */ }
  }
  return null;
}

// ── Quotes ────────────────────────────────────────────────

async function sbLoadQuotes(userId) {
  return _dbFetchAll('quotes', userId);
}

async function sbSaveQuote(userId, quote) {
  return _dbUpsert('quotes', { id: quote.id, user_id: userId, data: quote });
}

async function sbDeleteQuote(userId, id) {
  return _dbDelete('quotes', id);
}

async function sbSaveQuoteBatch(userId, quotes) {
  if (!quotes.length) return;
  const rows = quotes.map(q => ({ id: q.id, user_id: userId, data: q }));
  const { error } = await _sb.from('quotes').upsert(rows, { onConflict: 'id' });
  if (error) throw error;
}

// ── Invoices ──────────────────────────────────────────────

async function sbLoadInvoices(userId) {
  return _dbFetchAll('invoices', userId);
}

async function sbSaveInvoice(userId, invoice) {
  return _dbUpsert('invoices', { id: invoice.id, user_id: userId, data: invoice });
}

async function sbDeleteInvoice(userId, id) {
  return _dbDelete('invoices', id);
}

// ── Clients ───────────────────────────────────────────────

async function sbLoadClients(userId) {
  return _dbFetchAll('clients', userId);
}

async function sbSaveClient(userId, client) {
  return _dbUpsert('clients', { id: client.id, user_id: userId, data: client });
}

async function sbDeleteClient(userId, id) {
  return _dbDelete('clients', id);
}

// ── Packages ──────────────────────────────────────────────

async function sbLoadPackages(userId) {
  return _dbFetchAll('packages', userId);
}

async function sbSavePackages(userId, packages) {
  // Upsert surviving packages
  if (packages.length) {
    const rows = packages.map(p => ({ id: p.id, user_id: userId, data: p }));
    const { error } = await _sb.from('packages').upsert(rows, { onConflict: 'id' });
    if (error) throw error;
  }

  // Delete packages no longer in the list.
  // When packages is empty we delete ALL — this is intentional (user removed all).
  // Using a separate query avoids the NOT IN () SQL error on empty arrays.
  let deleteQuery = _sb.from('packages').delete().eq('user_id', userId);
  if (packages.length) {
    const ids = packages.map(p => p.id);
    deleteQuery = deleteQuery.not('id', 'in', `(${ids.join(',')})`);
  }
  const { error: delErr } = await deleteQuery;
  if (delErr) throw delErr;
}

// ── Accept tokens ─────────────────────────────────────────

async function sbCreateAcceptToken(userId, token, quoteId, validUntil) {
  // validUntil is the quote's validUntil date string (YYYY-MM-DD) or null
  const expires_at = validUntil
    ? new Date(validUntil + 'T23:59:59').toISOString()
    : null;
  const { error } = await _sb.from('accept_tokens')
    .upsert({ token, quote_id: quoteId, user_id: userId, expires_at }, { onConflict: 'token' });
  if (error) throw error;
}

async function sbGetAcceptToken(token) {
  const { data, error } = await _sb.from('accept_tokens')
    .select('quote_id, user_id').eq('token', token).single();
  if (error) return null;
  return data; // { quote_id, user_id }
}

// ── Data migration: push all localStorage data to Supabase ─
// Call once after first login to migrate existing data.
async function sbMigrateFromLocalStorage(userId) {
  const raw = {
    quotes:   Store.get(KEYS.quotes)   || [],
    invoices: Store.get(KEYS.invoices) || [],
    clients:  Store.get(KEYS.clients)  || [],
    packages: Store.get(KEYS.packages) || [],
    settings: Store.get(KEYS.settings),
  };

  const tasks = [];

  if (raw.quotes.length)
    tasks.push(sbSaveQuoteBatch(userId, raw.quotes));

  if (raw.invoices.length) {
    const rows = raw.invoices.map(i => ({ id: i.id, user_id: userId, data: i }));
    tasks.push(_sb.from('invoices').upsert(rows, { onConflict: 'id' }));
  }

  if (raw.clients.length) {
    const rows = raw.clients.map(c => ({ id: c.id, user_id: userId, data: c }));
    tasks.push(_sb.from('clients').upsert(rows, { onConflict: 'id' }));
  }

  if (raw.packages.length)
    tasks.push(sbSavePackages(userId, raw.packages));

  if (raw.settings)
    tasks.push(sbSaveSettings(userId, raw.settings));

  // Logo: if stored as base64 in settings, upload to storage
  if (raw.settings?.logo && raw.settings.logo.startsWith('data:')) {
    tasks.push(
      sbUploadLogo(userId, raw.settings.logo).then(url => {
        Store.set('sa_logo_url', url);
      })
    );
  }

  await Promise.all(tasks);

  // Accept tokens
  const tokens = Store.get(ACCEPT_KEY) || {};
  for (const [token, quoteId] of Object.entries(tokens)) {
    await sbCreateAcceptToken(userId, token, quoteId).catch(() => {});
  }

  localStorage.setItem('sa_migrated_v1', '1');
  console.log('[Studio] localStorage → Supabase migration complete');
}
