/* ═══════════════════════════════════════════════════════════
   js/auth.js
   Session guard + data sync layer.

   Load order in every page (after core.js, supabase.js):
     <script src="../js/supabase.js"></script>
     <script src="../js/auth.js"></script>
     <script src="../js/nav.js"></script>
   ─────────────────────────────────────────────────────────
   How the sync layer works:
   • All reads still come from localStorage (instant, no flicker)
   • Every write goes to localStorage first, then async to Supabase
   • On app load, we pull latest data from Supabase and refresh localStorage
   • Result: app works offline, data is safe in the cloud
═══════════════════════════════════════════════════════════ */

'use strict';

// ── Session state ─────────────────────────────────────────
let _session   = null;
let _userId    = null;
let _syncReady = false;

function getSession()    { return _session; }
function getAuthUserId() { return _userId; }
function isSyncReady()   { return _syncReady; }

// ── Route guard: redirect to auth if not signed in ────────
// Call at the top of every protected page's <script>
async function requireAuth(basePath) {
  const b = basePath || '';
  _session = await sbGetSession();
  if (!_session) {
    window.location.href = '/pages/auth.html';
    return false;
  }
  _userId = _session.user.id;
  return true;
}

// ── Pull latest from Supabase into localStorage ───────────
async function syncFromCloud() {
  if (!_userId) return;

  try {
    const [quotes, invoices, clients, packages, settings] = await Promise.all([
      sbLoadQuotes(_userId),
      sbLoadInvoices(_userId),
      sbLoadClients(_userId),
      sbLoadPackages(_userId),
      sbLoadSettings(_userId),
    ]);

    // Always write — even empty arrays — so deletions on one device
    // propagate correctly to all other devices. The old if (arr.length)
    // guard was silently swallowing cross-device deletions.
    if (quotes   !== null) Store.set(KEYS.quotes,   quotes);
    if (invoices !== null) Store.set(KEYS.invoices, invoices);
    if (clients  !== null) Store.set(KEYS.clients,  clients);
    if (packages !== null) Store.set(KEYS.packages, packages);

    if (settings) {
      // Merge cloud settings with local, preserving logo URL and theme
      const local      = Store.get(KEYS.settings) || {};
      const logoUrl    = Store.get('sa_logo_url') || local.logo || '';
      const localTheme = local.theme || 'light'; // never let cloud overwrite theme (FIX-15)
      Store.set(KEYS.settings, { ...local, ...settings, logo: logoUrl, theme: localTheme });
    }

    // FIX-12: Cache logo URL with 1-hour TTL to avoid 2 HEAD requests on every page load
    const LOGO_TTL    = 60 * 60 * 1000; // 1 hour in ms
    const cachedLogoTs = localStorage.getItem('sa_logo_ts');
    const logoExpired  = !cachedLogoTs || (Date.now() - parseInt(cachedLogoTs, 10)) > LOGO_TTL;

    if (logoExpired) {
      const logoUrl = await sbGetLogoUrl(_userId);
      localStorage.setItem('sa_logo_ts', String(Date.now())); // cache hit or miss timestamp
      if (logoUrl) {
        Store.set('sa_logo_url', logoUrl);
        const s = Store.get(KEYS.settings) || {};
        s.logo = logoUrl;
        Store.set(KEYS.settings, s);
      }
    }

    _syncReady = true;
    console.log('[Studio] Sync from cloud complete');
  } catch (err) {
    console.warn('[Studio] Cloud sync failed (offline?):', err.message);
    _syncReady = true; // still let the app work offline
  }
}

// ── Patch core.js data functions to also write to Supabase ─
// We wrap saveQuote, saveInvoice etc. in-place after they are defined.
// These patches fire async — they never block the UI.

function _patchSaveQuote() {
  const _orig = window.saveQuote;
  window.saveQuote = function(quote) {
    _orig(quote); // localStorage first
    if (_userId) sbSaveQuote(_userId, quote).catch(e => console.warn('[Studio] saveQuote sync:', e.message));
  };
}

function _patchSaveQuotes() {
  const _orig = window.saveQuotes;
  window.saveQuotes = function(arr) {
    _orig(arr);
    if (_userId) sbSaveQuoteBatch(_userId, arr).catch(e => console.warn('[Studio] saveQuotes sync:', e.message));
  };
}

function _patchDeleteQuote() {
  const _orig = window.deleteQuote;
  window.deleteQuote = function(id) {
    _orig(id);
    if (_userId) sbDeleteQuote(_userId, id).catch(e => console.warn('[Studio] deleteQuote sync:', e.message));
  };
}

function _patchSaveInvoice() {
  const _orig = window.saveInvoice;
  window.saveInvoice = function(invoice) {
    _orig(invoice);
    if (_userId) sbSaveInvoice(_userId, invoice).catch(e => console.warn('[Studio] saveInvoice sync:', e.message));
  };
}

function _patchDeleteInvoice() {
  const _orig = window.deleteInvoice;
  window.deleteInvoice = function(id) {
    _orig(id);
    if (_userId) sbDeleteInvoice(_userId, id).catch(e => console.warn('[Studio] deleteInvoice sync:', e.message));
  };
}

function _patchSaveClient() {
  // core.js exposes upsertClient(data), not saveClient — patch the real function.
  const _orig = window.upsertClient;
  window.upsertClient = function(clientData) {
    _orig(clientData);
    // Re-fetch the stored client (with its id) and sync to Supabase.
    if (_userId) {
      const clients = typeof getClients === 'function' ? getClients() : [];
      const stored = clients.find(c => c.name && clientData.name &&
        c.name.toLowerCase() === clientData.name.toLowerCase());
      if (stored) sbSaveClient(_userId, stored).catch(e => console.warn('[Studio] upsertClient sync:', e.message));
    }
  };
}

function _patchDeleteClient() {
  // core.js has no standalone deleteClient — deletions go through saveClients(arr).
  // We reconstruct the deleted id by comparing before/after the array write.
  const _origSaveClients = window.saveClients;
  window.saveClients = function(arr) {
    const before = typeof getClients === 'function' ? getClients().map(c => c.id) : [];
    _origSaveClients(arr);
    if (_userId) {
      const afterIds = arr.map(c => c.id);
      const deletedIds = before.filter(id => !afterIds.includes(id));
      deletedIds.forEach(id =>
        sbDeleteClient(_userId, id).catch(e => console.warn('[Studio] deleteClient sync:', e.message))
      );
    }
  };
}

function _patchSavePackages() {
  const _orig = window.savePackages;
  window.savePackages = function(arr) {
    _orig(arr);
    if (_userId) sbSavePackages(_userId, arr).catch(e => console.warn('[Studio] savePackages sync:', e.message));
  };
}

function _patchSaveSettings() {
  const _orig = window.saveSettings;
  window.saveSettings = function(data) {
    _orig(data);
    if (_userId) sbSaveSettings(_userId, data).catch(e => console.warn('[Studio] saveSettings sync:', e.message));
  };
}

// Logo patches — upload to Supabase Storage instead of base64 in settings
function _patchSaveLogo() {
  const _orig = window.saveLogo;
  window.saveLogo = function(base64) {
    _orig(base64); // keep local copy while uploading
    if (!_userId) return;
    sbUploadLogo(_userId, base64)
      .then(url => {
        Store.set('sa_logo_url', url);
        const s = Store.get(KEYS.settings) || {};
        s.logo = url; // swap base64 for CDN URL
        Store.set(KEYS.settings, s);
        console.log('[Studio] Logo uploaded:', url);
      })
      .catch(e => console.warn('[Studio] logo upload:', e.message));
  };
}

function _patchRemoveLogo() {
  const _orig = window.removeLogo;
  window.removeLogo = function() {
    _orig();
    Store.remove('sa_logo_url');
    if (_userId) sbDeleteLogo(_userId).catch(e => console.warn('[Studio] deleteLogo:', e.message));
  };
}

// Accept token patches — mirror to Supabase
function _patchCreateAcceptToken() {
  const _orig = window.createAcceptToken;
  window.createAcceptToken = function(quoteId, validUntil) {
    const token = _orig(quoteId);
    if (_userId) sbCreateAcceptToken(_userId, token, quoteId, validUntil).catch(e => console.warn('[Studio] acceptToken sync:', e.message));
    return token;
  };
}

// ── Apply all patches ─────────────────────────────────────
function applySupabasePatches() {
  _patchSaveQuote();
  _patchSaveQuotes();
  _patchDeleteQuote();
  _patchSaveInvoice();
  _patchDeleteInvoice();
  _patchSaveClient();
  _patchDeleteClient();
  _patchSavePackages();
  _patchSaveSettings();
  _patchSaveLogo();
  _patchRemoveLogo();
  _patchCreateAcceptToken();
}

// ── initAuth — call at the top of every protected page ────
// Usage:
//   initAuth('../').then(() => { renderNav(...); boot(); });
async function initAuth(basePath) {
  const ok = await requireAuth(basePath || '');
  if (!ok) return false; // already redirecting

  applySupabasePatches();

  // First time login — migrate localStorage data to Supabase
  const migrated = localStorage.getItem('sa_migrated_v1');
  if (!migrated) {
    try {
      await sbMigrateFromLocalStorage(_userId);
    } catch (e) {
      console.warn('[Studio] Migration error:', e.message);
    }
  }

  // Pull latest cloud data into localStorage
  await syncFromCloud();

  return true;
}

// ── Sign-out helper ───────────────────────────────────────
async function signOutAndRedirect(basePath) {
  try {
    await sbSignOut();
  } catch (e) { /* ignore */ }
  _session = null;
  _userId  = null;
  window.location.href = (basePath || '') + 'pages/auth.html';
}
