/* ═══════════════════════════════════════════════════════════
   js/sync.js  —  Multi-tab sync via BroadcastChannel
   ─────────────────────────────────────────────────────────
   How it works:
   • Every save/delete already writes to localStorage first.
   • After each write, we broadcast a message on the
     'studio-sync' channel describing what changed.
   • Every other open tab receives it, updates its own
     localStorage from the message, then calls its
     page-specific refresh function to re-render the UI.
   • No server round-trip needed — instant, free.

   Load order: after core.js, before auth.js, on every page.
═══════════════════════════════════════════════════════════ */

'use strict';

// ── Channel setup ─────────────────────────────────────────
var _syncChannel = null;

// Page-specific render function — set by each page after boot
// e.g.  window.__syncRefresh = renderList;
// If not set, we fall back to a full page reload (safe but slow).
window.__syncRefresh = null;

function _getChannel() {
  if (!_syncChannel) {
    try {
      _syncChannel = new BroadcastChannel('studio-sync');
    } catch(e) {
      // BroadcastChannel not supported (very old browsers) — silent no-op
      console.warn('[Sync] BroadcastChannel not supported');
    }
  }
  return _syncChannel;
}

// ── Broadcast a change to other tabs ─────────────────────
// type:    'quote' | 'invoice' | 'client' | 'packages' | 'settings'
// action:  'save' | 'delete' | 'batch'
// payload: the record or id that changed
function broadcastChange(type, action, payload) {
  var ch = _getChannel();
  if (!ch) return;
  try {
    ch.postMessage({ type: type, action: action, payload: payload, ts: Date.now() });
  } catch(e) {
    console.warn('[Sync] Broadcast failed:', e.message);
  }
}

// ── Receive changes from other tabs ──────────────────────
function initTabSync() {
  var ch = _getChannel();
  if (!ch) return;

  ch.onmessage = function(event) {
    var msg = event.data;
    if (!msg || !msg.type) return;

    console.log('[Sync] Received:', msg.type, msg.action);

    // ── Update localStorage from the broadcast ────────────
    try {
      switch(msg.type) {

        case 'quote':
          if (msg.action === 'save') {
            var quotes = Store.get(KEYS.quotes) || [];
            var idx = quotes.findIndex(function(q){ return q.id === msg.payload.id; });
            if (idx >= 0) quotes[idx] = msg.payload;
            else quotes.push(msg.payload);
            Store.set(KEYS.quotes, quotes);
          } else if (msg.action === 'delete') {
            var quotes = Store.get(KEYS.quotes) || [];
            Store.set(KEYS.quotes, quotes.filter(function(q){ return q.id !== msg.payload; }));
          } else if (msg.action === 'batch') {
            Store.set(KEYS.quotes, msg.payload);
          }
          break;

        case 'invoice':
          if (msg.action === 'save') {
            var invs = Store.get(KEYS.invoices) || [];
            var idx = invs.findIndex(function(i){ return i.id === msg.payload.id; });
            if (idx >= 0) invs[idx] = msg.payload;
            else invs.push(msg.payload);
            Store.set(KEYS.invoices, invs);
          } else if (msg.action === 'delete') {
            var invs = Store.get(KEYS.invoices) || [];
            Store.set(KEYS.invoices, invs.filter(function(i){ return i.id !== msg.payload; }));
          }
          break;

        case 'client':
          if (msg.action === 'save') {
            var clients = Store.get(KEYS.clients) || [];
            var idx = clients.findIndex(function(c){ return c.id === msg.payload.id; });
            if (idx >= 0) clients[idx] = msg.payload;
            else clients.push(msg.payload);
            Store.set(KEYS.clients, clients);
          } else if (msg.action === 'delete') {
            var clients = Store.get(KEYS.clients) || [];
            Store.set(KEYS.clients, clients.filter(function(c){ return c.id !== msg.payload; }));
          }
          break;

        case 'packages':
          Store.set(KEYS.packages, msg.payload);
          break;

        case 'settings':
          var local = Store.get(KEYS.settings) || {};
          // Preserve local-only prefs (theme) when receiving settings from another tab
          Store.set(KEYS.settings, Object.assign({}, msg.payload, { theme: local.theme }));
          break;
      }
    } catch(e) {
      console.warn('[Sync] localStorage update failed:', e.message);
    }

    // ── Refresh the current page UI ───────────────────────
    try {
      if (typeof window.__syncRefresh === 'function') {
        window.__syncRefresh(msg.type);

        // Show a brief, unobtrusive toast so the user knows the UI updated
        var LABELS = {
          quote: 'Quotation', invoice: 'Invoice',
          client: 'Client', packages: 'Packages', settings: 'Settings'
        };
        var label = LABELS[msg.type] || 'Data';
        var action = msg.action === 'delete' ? 'deleted' : 'updated';
        if (typeof showToast === 'function') {
          showToast(label + ' ' + action + ' in another tab', 'info');
        }
      }
    } catch(e) {
      console.warn('[Sync] UI refresh failed:', e.message);
    }
  };

  console.log('[Sync] Multi-tab sync active');
}

// ── Patch core.js save/delete to broadcast after each write ──
// Called from auth.js applySupabasePatches() — after the
// Supabase patches are already in place, we wrap again to add
// the broadcast. Order: orig → supabase → broadcast.
function applyBroadcastPatches() {

  // saveQuote
  var _sq = window.saveQuote;
  window.saveQuote = function(quote) {
    _sq(quote);
    broadcastChange('quote', 'save', quote);
  };

  // saveQuotes (batch — e.g. autoExpire)
  var _sqs = window.saveQuotes;
  window.saveQuotes = function(arr) {
    _sqs(arr);
    broadcastChange('quote', 'batch', arr);
  };

  // deleteQuote
  var _dq = window.deleteQuote;
  window.deleteQuote = function(id) {
    _dq(id);
    broadcastChange('quote', 'delete', id);
  };

  // saveInvoice
  var _si = window.saveInvoice;
  window.saveInvoice = function(invoice) {
    _si(invoice);
    broadcastChange('invoice', 'save', invoice);
  };

  // deleteInvoice
  var _di = window.deleteInvoice;
  window.deleteInvoice = function(id) {
    _di(id);
    broadcastChange('invoice', 'delete', id);
  };

  // saveClient
  var _sc = window.saveClient;
  window.saveClient = function(client) {
    _sc(client);
    broadcastChange('client', 'save', client);
  };

  // deleteClient
  var _dc = window.deleteClient;
  window.deleteClient = function(id) {
    _dc(id);
    broadcastChange('client', 'delete', id);
  };

  // savePackages
  var _sp = window.savePackages;
  window.savePackages = function(arr) {
    _sp(arr);
    broadcastChange('packages', 'batch', arr);
  };

  // saveSettings — broadcast but receiver preserves their own theme
  var _ss = window.saveSettings;
  window.saveSettings = function(data) {
    _ss(data);
    broadcastChange('settings', 'save', data);
  };

  console.log('[Sync] Broadcast patches applied');
}
