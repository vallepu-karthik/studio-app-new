/* ═══════════════════════════════════════════════════════════
   js/sanitize.js  —  XSS prevention helpers
   Load this before any page script that uses innerHTML.
═══════════════════════════════════════════════════════════ */

'use strict';

/**
 * Escape user-supplied strings before inserting into innerHTML.
 * Converts the 5 dangerous HTML characters to safe entities.
 * Already defined in some pages as a local — this global version
 * is the single authoritative implementation.
 */
function esc(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Safe text setter — sets element text without HTML parsing.
 * Use instead of el.innerHTML = str whenever the value is plain text.
 */
function setText(id, str) {
  var el = document.getElementById(id);
  if (el) el.textContent = str || '';
}
