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

// ── Currency formatter ────────────────────────────────────
function fmtINR(n) {
  const num = Math.round(Number(n) || 0);
  return '₹' + num.toLocaleString('en-IN');
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
    currency:     'INR',
  };
}
function saveSettings(data) { Store.set(KEYS.settings, data); }

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
function calcTotals(items, gstRate) {
  const subtotal = items.reduce((s, item) => s + (Number(item.qty) * Number(item.rate)), 0);
  const gst      = Math.round(subtotal * (gstRate / 100));
  const total    = subtotal + gst;
  return { subtotal, gst, total };
}
