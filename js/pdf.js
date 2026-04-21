/* ═══════════════════════════════════════════════════════
   studio-app / js / pdf.js
   Generates Quote + Invoice PDFs matching Airavata Photography layout.
   Requires jsPDF loaded before this file.
═══════════════════════════════════════════════════════ */
'use strict';

var PW   = 210;   // A4 width mm
var PH   = 297;   // A4 height mm
var ML   = 14;    // margin left
var MR   = 14;    // margin right
var CW   = PW - ML - MR;  // content width

/* ── Colours ──────────────────────────────────────────── */
var TEAL      = [45,  70,  80];   // dark teal header bg
var TEAL_TEXT = [210, 180, 100];  // gold/amber text on teal
var WHITE     = [255, 255, 255];
var BLACK     = [20,  20,  20];
var MID       = [80,  80,  80];
var MUTED     = [150, 150, 150];
var LIGHT     = [230, 230, 230];
var ROW_ALT   = [248, 248, 246];
var ROW_HEAD  = [235, 235, 230];

/* ── Helpers ──────────────────────────────────────────── */
function sf(doc, r) { doc.setFillColor(r[0],r[1],r[2]); }
function sd(doc, r) { doc.setDrawColor(r[0],r[1],r[2]); }
function st(doc, r) { doc.setTextColor(r[0],r[1],r[2]); }
function bold(doc)  { doc.setFont('helvetica','bold'); }
function normal(doc){ doc.setFont('helvetica','normal'); }
function right(doc, txt, x, y){ doc.text(String(txt), x, y, {align:'right'}); }

function hline(doc, y, col, lw) {
  sd(doc, col || LIGHT);
  doc.setLineWidth(lw || 0.3);
  doc.line(ML, y, PW - MR, y);
}

/* ══════════════════════════════════════════════════════
   PAGE FOOTER  (quotation no · date · client · page N)
══════════════════════════════════════════════════════ */
function drawPageFooter(doc, ref, dateStr, clientName, pageNum) {
  var y = PH - 8;
  hline(doc, y - 3, LIGHT, 0.2);
  normal(doc); doc.setFontSize(7.5); st(doc, MUTED);
  doc.text('Quotation No ' + ref,          ML,        y);
  doc.text('Quotation Date ' + dateStr,    ML + 40,   y);
  doc.text('Quotation For ' + clientName,  ML + 100,  y);
  right(doc, 'Page ' + pageNum, PW - MR,  y);
}

/* ══════════════════════════════════════════════════════
   DARK TEAL HEADER  (same on every page)
══════════════════════════════════════════════════════ */
function drawTealHeader(doc, settings) {
  var hh = 42; // header height mm
  sf(doc, TEAL); sd(doc, TEAL);
  doc.rect(0, 0, PW, hh, 'F');

  /* "QUOTATION" title */
  bold(doc); doc.setFontSize(22);
  st(doc, TEAL_TEXT);
  doc.text('QUOTATION', ML, 14);

  /* Invoice number + date labels */
  normal(doc); doc.setFontSize(8); st(doc, TEAL_TEXT);
  doc.text('Invoice Number', ML, 22);
  doc.text('Date',           ML, 32);

  bold(doc); doc.setFontSize(9); st(doc, WHITE);
  doc.text(settings.invoicePrefix ? settings.invoicePrefix + '001' : 'AIR001', ML, 26);
  // date filled per-document — placeholder here

  /* Studio logo placeholder box top-right */
  var bx = PW - MR - 28, by = 4, bw = 28, bh = 34;
  sf(doc, WHITE); sd(doc, WHITE);
  doc.roundedRect(bx, by, bw, bh, 2, 2, 'FD');
  normal(doc); doc.setFontSize(7); st(doc, MUTED);
  doc.text('LOGO', bx + bw/2, by + bh/2, {align:'center', baseline:'middle'});

  return hh;
}

/* re-draw header with real ref+date */
function drawQuoteHeader(doc, settings, ref, dateStr) {
  var hh = 42;
  sf(doc, TEAL); sd(doc, TEAL);
  doc.rect(0, 0, PW, hh, 'F');

  bold(doc); doc.setFontSize(22); st(doc, TEAL_TEXT);
  doc.text('QUOTATION', ML, 14);

  normal(doc); doc.setFontSize(8); st(doc, TEAL_TEXT);
  doc.text('Invoice Number', ML, 22);
  doc.text('Date',           ML, 32);

  bold(doc); doc.setFontSize(9); st(doc, WHITE);
  doc.text(ref,     ML, 26);
  doc.text(dateStr, ML, 36);

  /* Logo — real image if uploaded, fallback to studio name box */
  var bx = PW - MR - 30, by = 4, bw = 30, bh = 34;
  if (settings.logo) {
    try {
      var ext = settings.logo.indexOf('image/png') > -1 ? 'PNG' :
                settings.logo.indexOf('image/gif') > -1 ? 'GIF' : 'JPEG';
      doc.addImage(settings.logo, ext, bx, by, bw, bh);
    } catch(e) {
      sf(doc, WHITE); sd(doc, WHITE); doc.roundedRect(bx, by, bw, bh, 2, 2, 'FD');
    }
  } else {
    sf(doc, WHITE); sd(doc, WHITE); doc.roundedRect(bx, by, bw, bh, 2, 2, 'FD');
    normal(doc); doc.setFontSize(7); st(doc, MUTED);
    doc.text(settings.studioName ? settings.studioName.slice(0,10).toUpperCase() : 'LOGO',
             bx + bw/2, by + bh/2, {align:'center', baseline:'middle'});
  }

  return hh + 2;
}

/* ══════════════════════════════════════════════════════
   QUOTATION TO / QUOTATION FROM block
══════════════════════════════════════════════════════ */
function drawBillBlock(doc, clientName, studioName, y) {
  normal(doc); doc.setFontSize(9); st(doc, MID);
  doc.text('QUATATION TO',   ML,        y);
  doc.text('QUATATION FROM', ML + 95,   y);
  y += 7;

  bold(doc); doc.setFontSize(16); st(doc, BLACK);
  doc.text(clientName || '—',   ML,      y);
  doc.text(studioName || '—',   ML + 95, y);
  y += 10;
  return y;
}

/* ══════════════════════════════════════════════════════
   LINE ITEMS TABLE
══════════════════════════════════════════════════════ */
function drawItemsTable(doc, items, y) {
  var colD  = ML;           // description start
  var colQ  = ML + 112;     // qty
  var colP  = ML + 130;     // price
  var colT  = PW - MR;     // total (right-aligned)

  /* Table header row */
  sf(doc, ROW_HEAD); sd(doc, ROW_HEAD);
  doc.rect(ML, y, CW, 8, 'F');
  bold(doc); doc.setFontSize(9); st(doc, BLACK);
  doc.text('ITEM DESCRIPTION', colD + 2, y + 5.5);
  doc.text('QTY',  colQ + 2, y + 5.5);
  doc.text('PRICE', colP + 2, y + 5.5);
  right(doc, 'TOTAL', colT, y + 5.5);
  y += 10;

  /* Rows */
  items.forEach(function(item, idx) {
    var amt = Math.round((Number(item.qty)||1) * (Number(item.rate)||0));

    if (idx % 2 === 1) {
      sf(doc, ROW_ALT); sd(doc, ROW_ALT);
      doc.rect(ML, y - 1, CW, 8, 'F');
    }

    var lines = doc.splitTextToSize(item.desc || '—', 108);
    var rowH  = Math.max(8, lines.length * 5);

    normal(doc); doc.setFontSize(9); st(doc, BLACK);
    doc.text(lines, colD + 2, y + 4.5);

    st(doc, MID);
    doc.text(String(item.qty || 1), colQ + 2, y + 4.5);
    if (item.rate) doc.text(fmtINR(item.rate), colP + 2, y + 4.5);

    st(doc, BLACK);
    if (amt) right(doc, fmtINR(amt), colT, y + 4.5);

    y += rowH;
  });

  hline(doc, y + 1, LIGHT, 0.4);
  return y + 4;
}

/* ══════════════════════════════════════════════════════
   TOTALS BLOCK  (subtotal / discount / grand total)
══════════════════════════════════════════════════════ */
function drawTotalsBlock(doc, subtotal, discount, grandTotal, y) {
  var lx = ML + 95;
  var rx = PW - MR;

  normal(doc); doc.setFontSize(10); st(doc, MID);
  doc.text('Sub Total',   lx, y); right(doc, fmtINR(subtotal),   rx, y); y += 7;
  doc.text('Discount',    lx, y); right(doc, fmtINR(discount),   rx, y); y += 7;

  bold(doc); doc.setFontSize(11); st(doc, BLACK);
  doc.text('Grand Total', lx, y); right(doc, fmtINR(grandTotal), rx, y); y += 5;

  hline(doc, y, LIGHT, 0.3);
  return y + 4;
}

/* ══════════════════════════════════════════════════════
   BANK DETAILS block (bottom left)
══════════════════════════════════════════════════════ */
function drawBankDetails(doc, settings, y) {
  bold(doc); doc.setFontSize(10); st(doc, BLACK);
  doc.text('BANK DETAILS', ML, y); y += 6;
  normal(doc); doc.setFontSize(9); st(doc, MID);
  doc.text(settings.studioName || '', ML, y); y += 5;
  if (settings.phone)   { doc.text(settings.phone,   ML, y); y += 5; }
  if (settings.email)   { doc.text(settings.email,   ML, y); y += 5; }
  if (settings.address) { doc.text(settings.address, ML, y); y += 5; }
  return y;
}

/* ══════════════════════════════════════════════════════
   TOTAL(INR) box  (bottom right)
══════════════════════════════════════════════════════ */
function drawTotalINRBox(doc, grandTotal, y) {
  var bx = ML + 90, bw = PW - MR - ML - 90;

  normal(doc); doc.setFontSize(10); st(doc, BLACK);
  doc.text('Total(INR)', bx, y);

  bold(doc); doc.setFontSize(14); st(doc, BLACK);
  right(doc, fmtINR(grandTotal), PW - MR, y);
  y += 8;

  /* Authorized signatory line */
  hline(doc, y, LIGHT, 0.3);
  y += 8;
  normal(doc); doc.setFontSize(8); st(doc, MUTED);
  right(doc, 'Authorized Signatory', PW - MR, y);
  return y + 4;
}

/* ══════════════════════════════════════════════════════
   CONTACT FOOTER BAR  (phone · email · address · web)
══════════════════════════════════════════════════════ */
function drawContactBar(doc, settings, y) {
  normal(doc); doc.setFontSize(8.5); st(doc, MID);
  var parts = [];
  if (settings.phone)   parts.push(settings.phone);
  if (settings.email)   parts.push(settings.email);
  if (settings.address) parts.push(settings.address);
  doc.text(parts.join('   '), ML, y);
  return y + 6;
}

/* ══════════════════════════════════════════════════════
   TERMS & CONDITIONS  (page 2)
══════════════════════════════════════════════════════ */
var DEFAULT_TERMS = [
  '1. This proposal is valid for 30 days. The dates are not confirmed and subject to availability.',
  '2. Travel, Food and Accommodation: For events outside the home city, travel and accommodation',
  '   will be arranged by client or charged per actuals.',
  '3. No dates are blocked till the booking amount is received and acknowledgment given.',
  '4. Crew per diem charges apply for outstation events.',
  '5. The studio may use content on social media / website. A non-disclosure agreement can be',
  '   signed for an additional 5% fee.',
  '6. Drones are subject to DCGA & government regulations. Client is responsible for permissions.',
  '7. After completion of the event, 80% of the total amount will be paid.',
];

function drawTermsPage(doc, settings, ref, dateStr, clientName) {
  doc.addPage();
  drawQuoteHeader(doc, settings, ref, dateStr);

  var y = 52;
  bold(doc); doc.setFontSize(11); st(doc, BLACK);
  doc.text('Terms and Conditions', PW / 2, y, {align:'center'});
  y += 10;

  normal(doc); doc.setFontSize(9); st(doc, MID);
  var terms = settings.termsAndConditions
    ? doc.splitTextToSize(settings.termsAndConditions, CW)
    : DEFAULT_TERMS;
  terms.forEach(function(line) {
    doc.text(line, ML, y);
    y += 6.5;
  });

  drawPageFooter(doc, ref, dateStr, clientName, 2);
}

/* ══════════════════════════════════════════════════════
   MAIN — generateQuotePDF
══════════════════════════════════════════════════════ */
function generateQuotePDF(quote) {
  var s   = getSettings();
  var doc = new jspdf.jsPDF({ unit:'mm', format:'a4' });

  var ref      = quote.ref      || 'QT-001';
  var dateStr  = formatDate(quote.quoteDate);
  var client   = quote.clientName  || '—';
  var studio   = s.studioName      || 'Studio App';

  /* ── Page 1 ── */
  var y = drawQuoteHeader(doc, s, ref, dateStr);
  y += 4;

  /* Bill to / From */
  y = drawBillBlock(doc, client, studio, y);
  y += 2;

  hline(doc, y, LIGHT, 0.3); y += 6;

  /* Line items */
  y = drawItemsTable(doc, quote.lineItems || [], y);
  y += 4;

  /* Totals — discount from GST for now, or 0 if no GST */
  var subtotal   = quote.subtotal || 0;
  var gst        = quote.gst      || 0;
  var total      = quote.total    || 0;
  /* Show discount row as GST if present, else 0 */
  var discount   = gst; // repurpose discount row for GST
  var grandTotal = total;

  y = drawTotalsBlock(doc, subtotal + gst, discount, grandTotal, y);
  y += 4;

  /* Bank details + Total INR box side by side */
  var bankY = y;
  drawBankDetails(doc, s, bankY);

  /* Event date note if present */
  if (quote.eventDate || quote.venue) {
    normal(doc); doc.setFontSize(8); st(doc, MUTED);
    var eventNote = [quote.eventDate ? formatDate(quote.eventDate) : '', quote.venue || ''].filter(Boolean).join(' · ');
    doc.text('Event: ' + eventNote, ML, bankY + 35);
  }

  drawTotalINRBox(doc, grandTotal, y);

  y = Math.max(bankY + 40, y + 20);

  /* Contact bar */
  y = drawContactBar(doc, s, y + 4);

  /* Page footer */
  drawPageFooter(doc, ref, dateStr, client, 1);

  /* ── Page 2 — Terms ── */
  drawTermsPage(doc, s, ref, dateStr, client);

  doc.save(ref + '.pdf');
}

/* ══════════════════════════════════════════════════════
   INVOICE PDF  (same layout, title = INVOICE)
══════════════════════════════════════════════════════ */
function generateInvoicePDF(invoice) {
  var s   = getSettings();
  var doc = new jspdf.jsPDF({ unit:'mm', format:'a4' });

  var ref      = invoice.ref        || 'INV-001';
  var dateStr  = formatDate(invoice.invoiceDate);
  var client   = invoice.clientName || '—';
  var studio   = s.studioName       || 'Studio App';

  /* Header — swap title to INVOICE */
  var hh = 42;
  sf(doc, TEAL); sd(doc, TEAL); doc.rect(0, 0, PW, hh, 'F');
  bold(doc); doc.setFontSize(22); st(doc, TEAL_TEXT);
  doc.text('INVOICE', ML, 14);
  normal(doc); doc.setFontSize(8); st(doc, TEAL_TEXT);
  doc.text('Invoice Number', ML, 22); doc.text('Date', ML, 32);
  bold(doc); doc.setFontSize(9); st(doc, WHITE);
  doc.text(ref, ML, 26); doc.text(dateStr, ML, 36);

  var bx = PW - MR - 30, bw = 30, bh = 34;
  if (s.logo) {
    try {
      var ext2 = s.logo.indexOf('image/png') > -1 ? 'PNG' :
                 s.logo.indexOf('image/gif') > -1 ? 'GIF' : 'JPEG';
      doc.addImage(s.logo, ext2, bx, 4, bw, bh);
    } catch(e) {
      sf(doc, WHITE); sd(doc, WHITE); doc.roundedRect(bx, 4, bw, bh, 2, 2, 'FD');
    }
  } else {
    sf(doc, WHITE); sd(doc, WHITE); doc.roundedRect(bx, 4, bw, bh, 2, 2, 'FD');
    normal(doc); doc.setFontSize(7); st(doc, MUTED);
    doc.text(studio.slice(0,10).toUpperCase(), bx + bw/2, 4 + bh/2, {align:'center', baseline:'middle'});
  }

  var y = hh + 6;

  /* Bill to / From */
  y = drawBillBlock(doc, client, studio, y);
  hline(doc, y, LIGHT, 0.3); y += 6;

  /* Line items */
  y = drawItemsTable(doc, invoice.lineItems || [], y);
  y += 4;

  var subtotal   = invoice.subtotal || 0;
  var gst        = invoice.gst      || 0;
  var grandTotal = invoice.total    || 0;

  y = drawTotalsBlock(doc, subtotal + gst, gst, grandTotal, y);
  y += 4;

  /* Milestones if any */
  var ms = invoice.milestones || [];
  if (ms.length > 0) {
    bold(doc); doc.setFontSize(9); st(doc, BLACK);
    doc.text('Payment Schedule', ML, y); y += 5;
    ms.forEach(function(m) {
      normal(doc); doc.setFontSize(9); st(doc, MID);
      doc.text(m.label + (m.dueDate ? '  (' + formatDate(m.dueDate) + ')' : ''), ML, y);
      st(doc, BLACK); right(doc, fmtINR(m.amount||0), PW - MR, y);
      /* status */
      normal(doc); doc.setFontSize(7.5);
      var sc = m.status === 'collected' ? '#1d6f42' : m.status === 'pending' ? '#92400e' : '#888';
      doc.setTextColor(sc); doc.text('[' + (m.status||'upcoming') + ']', PW - MR - 24, y);
      st(doc, MID); y += 6;
    });
    y += 2;
  }

  var bankY = y;
  drawBankDetails(doc, s, bankY);
  drawTotalINRBox(doc, grandTotal, y);
  y = Math.max(bankY + 40, y + 20);
  drawContactBar(doc, s, y + 4);
  drawPageFooter(doc, ref, dateStr, client, 1);

  /* Invoice = single page only. No terms page. */
  doc.save(ref + '.pdf');
}
