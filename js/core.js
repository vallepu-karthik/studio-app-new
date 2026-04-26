/* ═══════════════════════════════════════════════════════
   studio-app / js / core.js
   Storage · Utilities · Trial limits · Toast
═══════════════════════════════════════════════════════ */

'use strict';

// ── Storage keys ─────────────────────────────────────────
const KEYS = {
  trial:     'sa_trial_v1',
  quotes:    'sa_quotes_v1',
  invoices:  'sa_invoices_v1',
  clients:   'sa_clients_v1',
  settings:  'sa_settings_v1',
  packages:  'sa_packages_v1',
};

// ── Generic storage helpers ───────────────────────────────
const Store = {
  get(key)       { try { return JSON.parse(localStorage.getItem(key)); } catch { return null; } },
  set(key, val)  { localStorage.setItem(key, JSON.stringify(val)); },
  remove(key)    { localStorage.removeItem(key); },
};

// ── ID generator ──────────────────────────────────────────
function genId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

// ── Date helpers ──────────────────────────────────────────
function today() {
  return new Date().toISOString().split('T')[0];
}
function addDays(dateStr, n) {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + n);
  return d.toISOString().split('T')[0];
}
function formatDate(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}
function isOverdue(dateStr) {
  if (!dateStr) return false;
  return new Date(dateStr + 'T00:00:00') < new Date(today() + 'T00:00:00');
}

// ── Multi-currency config ─────────────────────────────────
const CURRENCIES = {
  INR: { symbol: '\u20b9', locale: 'en-IN', pdfSymbol: 'Rs.', label: 'INR (\u20b9)' },
  USD: { symbol: '$',   locale: 'en-US', pdfSymbol: '$',   label: 'USD ($)' },
  AED: { symbol: 'AED ', locale: 'en-AE', pdfSymbol: 'AED ', label: 'AED (\u062f.\u0625)' },
  GBP: { symbol: '\u00a3', locale: 'en-GB', pdfSymbol: '\u00a3', label: 'GBP (\u00a3)' },
  EUR: { symbol: '\u20ac', locale: 'en-DE', pdfSymbol: '\u20ac', label: 'EUR (\u20ac)' },
  SGD: { symbol: 'S$',  locale: 'en-SG', pdfSymbol: 'S$',  label: 'SGD (S$)' },
  AUD: { symbol: 'A$',  locale: 'en-AU', pdfSymbol: 'A$',  label: 'AUD (A$)' },
};

function getCurrencyConfig(code) {
  return CURRENCIES[code] || CURRENCIES['INR'];
}

function getActiveCurrency() {
  return getSettings().currency || 'INR';
}

// ── Currency formatter ────────────────────────────────────
function fmtINR(n) {
  const num = Math.round(Number(n) || 0);
  const cur = getCurrencyConfig(getActiveCurrency());
  return cur.symbol + num.toLocaleString(cur.locale);
}

// ── Quote auto-expiry ─────────────────────────────────────
// Flips status: 'sent' -> 'expired' when validUntil < today.
function autoExpireQuotes() {
  const t = today();
  let changed = false;
  const quotes = getQuotes().map(q => {
    if (q.status === 'sent' && q.validUntil && q.validUntil < t) {
      changed = true;
      return { ...q, status: 'expired', updatedAt: Date.now() };
    }
    return q;
  });
  if (changed) saveQuotes(quotes);
}

// ── Settings ──────────────────────────────────────────────
function getSettings() {
  return Store.get(KEYS.settings) || {
    studioName:   'Studio App',
    tagline:      '',
    phone:        '',
    email:        '',
    address:      '',
    gstin:        '',
    quotePrefix:  'QT-',
    invoicePrefix:'INV-',
    startNumber:  1,
    paymentDays:  14,
    defaultNotes: 'Thank you for choosing us!',
    invoiceDefaultNotes: '',
    currency:     'INR',
    logo:         '',
    theme:        'light',
    termsAndConditions: '',
    // Bank / payment details
    bankName:     '',
    accountName:  '',
    accountNumber:'',
    ifscCode:     '',
    upiId:        '',
    phonePay:     '',
    googlePay:    '',
    // Social media
    instagram:    '',
    website:      '',
    youtube:      '',
    facebook:     '',
    // Google review
    googleReviewLink: '',
    // Signature
    signature:    '',
    // WhatsApp template
    whatsappTemplate: 'Hi {client}, here\'s your quotation {ref} from {studio} for {amount}{event}.\n\nValid until {valid}.\n\nPlease let me know if you have any questions!',
  };
}
function saveSettings(data) { Store.set(KEYS.settings, data); }

// ── Packages ──────────────────────────────────────────────
const DEFAULT_PACKAGES = [
  {
    id: 'pkg-1', name: 'Wedding Standard',
    gstRate: 18,
    items: [
      { desc: 'Full day photography coverage', qty: 1, rate: 25000 },
      { desc: 'Candid photography (full day)',  qty: 1, rate: 8000  },
      { desc: 'Edited album (200 photos)',      qty: 1, rate: 7000  },
      { desc: 'Wedding album print',            qty: 1, rate: 5000  },
    ]
  },
  {
    id: 'pkg-2', name: 'Wedding Premium',
    gstRate: 18,
    items: [
      { desc: 'Full day photography coverage (2 days)', qty: 1, rate: 45000 },
      { desc: 'Drone photography',                      qty: 1, rate: 8000  },
      { desc: 'Edited album (400 photos)',              qty: 1, rate: 12000 },
      { desc: 'Wedding album print (premium)',          qty: 1, rate: 8000  },
      { desc: 'Edited video highlights reel',           qty: 1, rate: 10000 },
      { desc: 'Pen drive with all footage',             qty: 1, rate: 1500  },
    ]
  },
  {
    id: 'pkg-3', name: 'Engagement Shoot',
    gstRate: 18,
    items: [
      { desc: 'Engagement shoot (4 hours)',    qty: 1, rate: 12000 },
      { desc: 'Multiple locations',            qty: 1, rate: 2000  },
      { desc: 'Edited photos (100 selects)',   qty: 1, rate: 4000  },
    ]
  },
  {
    id: 'pkg-4', name: 'Portrait Session',
    gstRate: 18,
    items: [
      { desc: 'Portrait session (1 hour)',   qty: 1, rate: 5000 },
      { desc: 'Edited photos (30 selects)', qty: 1, rate: 2000 },
    ]
  },
  {
    id: 'pkg-5', name: 'Corporate / Headshots',
    gstRate: 18,
    items: [
      { desc: 'Corporate photography (half day)', qty: 1, rate: 8000 },
      { desc: 'Edited headshots (50 photos)',     qty: 1, rate: 3000 },
    ]
  },
];

function getPackages() {
  const stored = Store.get(KEYS.packages);
  return stored && stored.length > 0 ? stored : DEFAULT_PACKAGES;
}
function savePackages(arr) { Store.set(KEYS.packages, arr); }
function getPackageById(id) { return getPackages().find(p => p.id === id) || null; }

// ── Quotes ────────────────────────────────────────────────
function getQuotes()       { return Store.get(KEYS.quotes)   || []; }
function saveQuotes(arr)   { Store.set(KEYS.quotes, arr); }
function getQuoteById(id)  { return getQuotes().find(q => q.id === id) || null; }

function nextQuoteNumber() {
  const s = getSettings();
  const quotes = getQuotes();
  const num = quotes.length > 0
    ? Math.max(...quotes.map(q => q.number || 0)) + 1
    : (s.startNumber || 1);
  return { number: num, ref: s.quotePrefix + String(num).padStart(3, '0') };
}

function saveQuote(quote) {
  const quotes = getQuotes();
  const idx = quotes.findIndex(q => q.id === quote.id);
  if (idx >= 0) quotes[idx] = quote; else quotes.unshift(quote);
  saveQuotes(quotes);
}
function deleteQuote(id) {
  saveQuotes(getQuotes().filter(q => q.id !== id));
}

// ── Invoices ──────────────────────────────────────────────
function getInvoices()       { return Store.get(KEYS.invoices) || []; }
function saveInvoices(arr)   { Store.set(KEYS.invoices, arr); }
function getInvoiceById(id)  { return getInvoices().find(i => i.id === id) || null; }

function nextInvoiceNumber() {
  const s = getSettings();
  const invoices = getInvoices();
  const num = invoices.length > 0
    ? Math.max(...invoices.map(i => i.number || 0)) + 1
    : (s.startNumber || 1);
  return { number: num, ref: s.invoicePrefix + String(num).padStart(3, '0') };
}

function saveInvoice(invoice) {
  const invoices = getInvoices();
  const idx = invoices.findIndex(i => i.id === invoice.id);
  if (idx >= 0) invoices[idx] = invoice; else invoices.unshift(invoice);
  saveInvoices(invoices);
}
function deleteInvoice(id) {
  saveInvoices(getInvoices().filter(i => i.id !== id));
}

// ── Clients ───────────────────────────────────────────────
function getClients()     { return Store.get(KEYS.clients) || []; }
function saveClients(arr) { Store.set(KEYS.clients, arr); }

function upsertClient(clientData) {
  const clients = getClients();
  const existing = clients.find(c =>
    c.name.toLowerCase() === clientData.name.toLowerCase());
  if (existing) {
    Object.assign(existing, clientData);
  } else {
    clients.unshift({ id: genId(), ...clientData });
  }
  saveClients(clients);
}

// ── Trial limit system ────────────────────────────────────
const TRIAL = { quotes: 100, invoices: 100, days: 180 };

function getTrialData() {
  let d = Store.get(KEYS.trial);
  if (!d) {
    d = { startDate: Date.now(), quotes: 0, invoices: 0 };
    Store.set(KEYS.trial, d);
  }
  return d;
}

function trialDaysLeft() {
  const d = getTrialData();
  const elapsed = (Date.now() - d.startDate) / 86400000;
  return Math.max(0, Math.floor(TRIAL.days - elapsed));
}

// Returns 'ok' | 'warn' | 'over'
function trialStatus() {
  const d = getTrialData();
  const dl = trialDaysLeft();
  if (dl === 0 || d.quotes >= TRIAL.quotes || d.invoices >= TRIAL.invoices) return 'over';
  const maxPct = Math.max(
    d.quotes   / TRIAL.quotes,
    d.invoices / TRIAL.invoices,
    1 - dl     / TRIAL.days
  );
  return maxPct >= 0.8 ? 'warn' : 'ok';
}

// Call before creating a quote — returns true if allowed
function trackQuote() {
  const status = trialStatus();
  if (status === 'over') { showLimitBanner('over'); return false; }
  const d = getTrialData();
  d.quotes++;
  Store.set(KEYS.trial, d);
  if (trialStatus() === 'warn') showLimitBanner('warn');
  return true;
}

// Call before creating an invoice — returns true if allowed
function trackInvoice() {
  const status = trialStatus();
  if (status === 'over') { showLimitBanner('over'); return false; }
  const d = getTrialData();
  d.invoices++;
  Store.set(KEYS.trial, d);
  if (trialStatus() === 'warn') showLimitBanner('warn');
  return true;
}

function showLimitBanner(type) {
  const banner = document.getElementById('limit-banner');
  if (!banner) return;
  const d = getTrialData();
  const dl = trialDaysLeft();
  if (type === 'over') {
    banner.className = 'limit-banner over';
    banner.innerHTML = '<span>Free trial limit reached — upgrade to continue creating documents.</span>';
  } else {
    banner.className = 'limit-banner warn';
    banner.innerHTML = `<span>Heads up — ${d.quotes}/${TRIAL.quotes} quotes · ${d.invoices}/${TRIAL.invoices} invoices · ${dl} days left in trial.</span>
      <button onclick="this.parentElement.style.display='none'" class="btn btn-sm">Dismiss</button>`;
  }
}

function initLimitBanner() {
  const status = trialStatus();
  if (status !== 'ok') showLimitBanner(status);
}

// ── Toast ─────────────────────────────────────────────────
let _toastTimer = null;
function showToast(msg, duration = 2800) {
  const el = document.getElementById('toast');
  if (!el) return;
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => el.classList.remove('show'), duration);
}

// ── Active nav ────────────────────────────────────────────
function setActiveNav() {
  const path = window.location.pathname;
  document.querySelectorAll('.nav-item a').forEach(a => {
    a.classList.toggle('active', path.endsWith(a.getAttribute('href')?.split('/').pop()));
  });
}

// ── Totals calculator ─────────────────────────────────────
function calcTotals(items, gstRate, discount) {
  const subtotal  = items.reduce((s, item) => s + (Number(item.qty) * Number(item.rate)), 0);
  const disc      = Math.round(Number(discount) || 0);
  const afterDisc = Math.max(0, subtotal - disc);
  const gst       = Math.round(afterDisc * (gstRate / 100));
  const total     = afterDisc + gst;
  return { subtotal, discount: disc, afterDiscount: afterDisc, gst, total };
}

// ── Reminders ─────────────────────────────────────────────
// A reminder is stored directly on the quote/invoice object:
//   { reminderDate: 'YYYY-MM-DD', reminderNote: 'string', reminderDone: bool }

function getDueReminders() {
  const t = today();
  const results = [];
  getQuotes().forEach(q => {
    if (q.reminderDate && !q.reminderDone && q.reminderDate <= t) {
      results.push({ type: 'quote', id: q.id, ref: q.ref,
        clientName: q.clientName, reminderDate: q.reminderDate,
        reminderNote: q.reminderNote || 'Follow up on quote' });
    }
  });
  getInvoices().forEach(inv => {
    if (inv.reminderDate && !inv.reminderDone && inv.reminderDate <= t) {
      results.push({ type: 'invoice', id: inv.id, ref: inv.ref,
        clientName: inv.clientName, reminderDate: inv.reminderDate,
        reminderNote: inv.reminderNote || 'Follow up on invoice' });
    }
  });
  return results.sort((a, b) => a.reminderDate.localeCompare(b.reminderDate));
}

function markReminderDone(type, id) {
  if (type === 'quote') {
    const q = getQuoteById(id);
    if (q) { q.reminderDone = true; saveQuote(q); }
  } else {
    const inv = getInvoiceById(id);
    if (inv) { inv.reminderDone = true; saveInvoice(inv); }
  }
}

function getAllUpcomingReminders() {
  const t = today();
  const results = [];
  getQuotes().forEach(q => {
    if (q.reminderDate && !q.reminderDone) {
      results.push({ type:'quote', id:q.id, ref:q.ref,
        clientName:q.clientName, reminderDate:q.reminderDate,
        reminderNote:q.reminderNote||'Follow up on quote',
        overdue: q.reminderDate <= t });
    }
  });
  getInvoices().forEach(inv => {
    if (inv.reminderDate && !inv.reminderDone) {
      results.push({ type:'invoice', id:inv.id, ref:inv.ref,
        clientName:inv.clientName, reminderDate:inv.reminderDate,
        reminderNote:inv.reminderNote||'Follow up on invoice',
        overdue: inv.reminderDate <= t });
    }
  });
  return results.sort((a, b) => a.reminderDate.localeCompare(b.reminderDate));
}

// ── Client birthday / anniversary reminders ───────────────
// Returns clients whose birthday or weddingDate falls within `days` days from today.
// Each result: { clientId, clientName, contact, type ('birthday'|'anniversary'),
//               date (MM-DD), nextDate (YYYY-MM-DD), daysAway }
function getClientDateReminders(days) {
  days = days || 7;
  var t       = today();
  var tDate   = new Date(t + 'T00:00:00');
  var results = [];

  getClients().forEach(function(c) {
    var checks = [
      { field: c.birthday,    type: 'birthday'     },
      { field: c.weddingDate, type: 'anniversary'  },
    ];
    checks.forEach(function(chk) {
      if (!chk.field) return;
      var parts = chk.field.split('-'); // YYYY-MM-DD or MM-DD
      var month, day;
      if (parts.length === 3) { month = parseInt(parts[1],10); day = parseInt(parts[2],10); }
      else if (parts.length === 2) { month = parseInt(parts[0],10); day = parseInt(parts[1],10); }
      else return;

      // Build this year's occurrence
      var yr = tDate.getFullYear();
      var candidate = new Date(yr, month - 1, day);
      // If already passed this year, check next year
      if (candidate < tDate) candidate = new Date(yr + 1, month - 1, day);

      var msAway   = candidate.getTime() - tDate.getTime();
      var daysAway = Math.round(msAway / 86400000);
      if (daysAway <= days) {
        var mm = String(month).padStart(2,'0');
        var dd = String(day).padStart(2,'0');
        results.push({
          clientId:   c.id,
          clientName: c.name,
          contact:    c.contact || '',
          instagram:  c.instagram || '',
          type:       chk.type,
          date:       mm + '-' + dd,
          nextDate:   candidate.toISOString().split('T')[0],
          daysAway:   daysAway,
        });
      }
    });
  });

  return results.sort(function(a,b){ return a.daysAway - b.daysAway; });
}

// ── Calendar clash detection ───────────────────────────────
// Returns all quotes that share the same event date,
// excluding the current quote being edited (by id).
function getClashingQuotes(eventDate, excludeId) {
  if (!eventDate) return [];
  return getQuotes().filter(function(q) {
    return q.eventDate === eventDate
      && q.id !== excludeId
      && q.status !== 'draft'   // drafts don't block dates
      && q.status !== 'accepted'; // already converted — not a clash
  });
}

// Returns all clash pairs across all quotes (for dashboard).
function getAllClashes() {
  var quotes = getQuotes().filter(function(q) {
    return q.eventDate && q.status !== 'draft' && q.status !== 'accepted';
  });
  var seen = {};
  var clashes = [];
  quotes.forEach(function(q) {
    if (!seen[q.eventDate]) {
      seen[q.eventDate] = [];
    }
    seen[q.eventDate].push(q);
  });
  Object.keys(seen).forEach(function(date) {
    if (seen[date].length > 1) {
      clashes.push({ date: date, quotes: seen[date] });
    }
  });
  return clashes.sort(function(a, b) { return a.date.localeCompare(b.date); });
}

// ── Quote acceptance ──────────────────────────────────────
// Stores acceptance tokens: key = 'sa_accept_v1', value = { [token]: quoteId }
const ACCEPT_KEY = 'sa_accept_v1';

function getAcceptTokens() {
  return Store.get(ACCEPT_KEY) || {};
}

function createAcceptToken(quoteId) {
  var tokens = getAcceptTokens();
  // reuse existing token for same quote
  var existing = Object.keys(tokens).find(function(t){ return tokens[t] === quoteId; });
  if (existing) return existing;
  var token = genId() + genId();
  tokens[token] = quoteId;
  Store.set(ACCEPT_KEY, tokens);
  return token;
}

function getQuoteByToken(token) {
  var tokens = getAcceptTokens();
  var quoteId = tokens[token];
  if (!quoteId) return null;
  return getQuoteById(quoteId) || null;
}

function markQuoteAccepted(token) {
  var tokens = getAcceptTokens();
  var quoteId = tokens[token];
  if (!quoteId) return false;
  var q = getQuoteById(quoteId);
  if (!q) return false;
  q.status = 'accepted';
  q.acceptedAt = Date.now();
  q.acceptToken = token;
  saveQuote(q);
  return true;
}

// ── Theme ──────────────────────────────────────────────────
function applyTheme() {
  var s = getSettings();
  var theme = s.theme || 'light';
  document.documentElement.setAttribute('data-theme', theme);
}

function toggleTheme() {
  var s = getSettings();
  s.theme = (s.theme === 'dark') ? 'light' : 'dark';
  saveSettings(s);
  applyTheme();
  // Update toggle button label on all pages
  var btn = document.getElementById('theme-toggle-btn');
  if (btn) btn.textContent = s.theme === 'dark' ? '☀' : '☾';
}

// ── Logo ───────────────────────────────────────────────────
function getLogo() { return getSettings().logo || ''; }

function saveLogo(base64) {
  var s = getSettings();
  s.logo = base64;
  saveSettings(s);
}

function removeLogo() {
  var s = getSettings();
  s.logo = '';
  saveSettings(s);
}
