/* ═══════════════════════════════════════════════════════
   studio-app / js / pdf.js  — v4 clean layout
═══════════════════════════════════════════════════════ */
'use strict';

var PW  = 210;
var PH  = 297;
var ML  = 14;
var MR  = 14;
var CW  = PW - ML - MR;

/* ── Brand colours ───────────────────────────────────── */
var TEAL      = [45,  70,  80];
var TEAL_TEXT = [210, 180, 100];
var WHITE     = [255, 255, 255];
var BLACK     = [20,  20,  20];
var MID       = [90,  90,  90];
var MUTED     = [160, 160, 160];
var LIGHT     = [225, 225, 225];
var ROW_ALT   = [248, 248, 246];
var ROW_HEAD  = [232, 232, 228];
var GREEN     = [29,  111,  66];
var INSTA_C   = [193,  53, 132];
var YT_C      = [255,   0,   0];
var FB_C      = [ 24, 119, 242];
var WEB_C     = [ 24,  95, 165];

/* ── Helpers ─────────────────────────────────────────── */
function sf(doc,r){ doc.setFillColor(r[0],r[1],r[2]); }
function sd(doc,r){ doc.setDrawColor(r[0],r[1],r[2]); }
function st(doc,r){ doc.setTextColor(r[0],r[1],r[2]); }
function bold(doc)  { doc.setFont('helvetica','bold'); }
function normal(doc){ doc.setFont('helvetica','normal'); }
function right(doc,txt,x,y){ doc.text(String(txt),x,y,{align:'right'}); }
var _pdfCurrencySymbol = '₹';
var _pdfCurrencyLocale = 'en-IN';
function inr(n){
  var num = Math.round(Number(n)||0);
  return _pdfCurrencySymbol + num.toLocaleString(_pdfCurrencyLocale);
}
function setPdfCurrency(code){
  var map = {
    INR: ['₹','en-IN'], USD: ['$','en-US'], AED: ['AED ','en-US'],
    GBP: ['£','en-GB'], EUR: ['€','en-DE'],
    SGD: ['S$','en-SG'], AUD: ['A$','en-AU']
  };
  var c = map[code] || map['INR'];
  _pdfCurrencySymbol = c[0]; _pdfCurrencyLocale = c[1];
}
function hline(doc,y,col,lw){
  sd(doc,col||LIGHT); doc.setLineWidth(lw||0.3);
  doc.line(ML,y,PW-MR,y);
}

/* ══════════════════════════════════════════════════════
   IMAGE COMPRESSION
══════════════════════════════════════════════════════ */
// ── Compress an image to a base64 JPEG ───────────────────
// Handles both base64 data URIs and https:// URLs safely.
// If canvas is tainted (CORS), falls back to using the image directly.
function compressImage(src, maxW, maxH, quality, callback) {
  // If it's a remote URL, fetch it as a blob first to avoid canvas taint
  if (src && src.startsWith('http')) {
    fetch(src)
      .then(function(r) { return r.blob(); })
      .then(function(blob) {
        var reader = new FileReader();
        reader.onload = function(e) { _doCompress(e.target.result, maxW, maxH, quality, callback); };
        reader.onerror = function() { callback(src); };
        reader.readAsDataURL(blob);
      })
      .catch(function() {
        // Fetch failed (CORS/network) — use image directly without compression
        console.warn('[PDF] Logo fetch failed — using URL directly');
        callback(src);
      });
    return;
  }
  _doCompress(src, maxW, maxH, quality, callback);
}

function _doCompress(base64, maxW, maxH, quality, callback) {
  try {
    var img = new Image();
    img.crossOrigin = 'anonymous'; // prevent canvas taint for CDN images
    img.onload = function() {
      try {
        var scale = Math.min(1, maxW / img.width, maxH / img.height);
        var cw = Math.round(img.width * scale), ch = Math.round(img.height * scale);
        var canvas = document.createElement('canvas');
        canvas.width = cw; canvas.height = ch;
        canvas.getContext('2d').drawImage(img, 0, 0, cw, ch);
        var result = canvas.toDataURL('image/jpeg', quality || 0.6);
        callback(result);
      } catch(e) {
        // toDataURL threw SecurityError — return original without compression
        console.warn('[PDF] Canvas tainted — using image without compression:', e.message);
        callback(base64);
      }
    };
    img.onerror = function() { callback(base64); };
    img.src = base64;
  } catch(e) {
    console.warn('[PDF] compressImage error:', e.message);
    callback(base64);
  }
}

function prepareImages(settings, callback) {
  var logo = settings.logo, sig = settings.signature;
  var done = 0, total = (logo ? 1 : 0) + (sig ? 1 : 0);
  if (!total) { callback(settings); return; }
  function check() { if (++done === total) callback(settings); }
  if (logo) compressImage(logo, 200, 120, 0.6, function(o) { settings._logo = o; check(); });
  if (sig)  compressImage(sig,  200,  80, 0.7, function(o) { settings._sig  = o; check(); });
}

/* ══════════════════════════════════════════════════════
   HEADER
══════════════════════════════════════════════════════ */
function drawHeader(doc, s, ref, dateStr, docType) {
  var hh = 44;
  sf(doc,TEAL); sd(doc,TEAL); doc.rect(0,0,PW,hh,'F');

  bold(doc); doc.setFontSize(24); st(doc,TEAL_TEXT);
  doc.text(docType==='invoice'?'INVOICE':'QUOTATION', ML, 15);

  normal(doc); doc.setFontSize(7.5); st(doc,TEAL_TEXT);
  doc.text(docType==='invoice'?'Invoice Number':'Quote Number', ML, 23);
  doc.text('Date', ML, 33);
  bold(doc); doc.setFontSize(9); st(doc,WHITE);
  doc.text(ref, ML, 27);
  doc.text(dateStr, ML, 37);

  /* Logo box */
  var bx=PW-MR-32, by=4, bw=32, bh=36;
  var logoData = s._logo || s.logo;
  if(logoData){
    try{ doc.addImage(logoData,'JPEG',bx,by,bw,bh); }
    catch(e){
      sf(doc,WHITE); sd(doc,WHITE); doc.roundedRect(bx,by,bw,bh,2,2,'FD');
      normal(doc); doc.setFontSize(7); st(doc,MUTED);
      doc.text((s.studioName||'LOGO').slice(0,10).toUpperCase(), bx+bw/2, by+bh/2,{align:'center',baseline:'middle'});
    }
  } else {
    sf(doc,WHITE); sd(doc,WHITE); doc.roundedRect(bx,by,bw,bh,2,2,'FD');
    normal(doc); doc.setFontSize(7); st(doc,MUTED);
    doc.text((s.studioName||'LOGO').slice(0,10).toUpperCase(), bx+bw/2, by+bh/2,{align:'center',baseline:'middle'});
  }
  return hh+4;
}

/* ══════════════════════════════════════════════════════
   BILL TO / FROM
══════════════════════════════════════════════════════ */
function drawBillBlock(doc, clientName, studioName, y, docType) {
  var lx=ML, rx=ML+95;
  normal(doc); doc.setFontSize(8); st(doc,MUTED);
  doc.text(docType==='invoice'?'BILL TO':'QUOTATION TO',   lx, y);
  doc.text(docType==='invoice'?'BILL FROM':'QUOTATION FROM', rx, y);
  y+=6;
  bold(doc); doc.setFontSize(15); st(doc,BLACK);
  doc.text(clientName||'—', lx, y);
  doc.text(studioName||'—', rx, y);
  y+=9;
  return y;
}

/* ══════════════════════════════════════════════════════
   LINE ITEMS TABLE
══════════════════════════════════════════════════════ */
function drawItemsTable(doc, items, y) {
  /* Column X positions */
  var xDesc=ML, xQty=ML+108, xPrice=ML+128, xTotal=PW-MR;

  /* Header */
  sf(doc,ROW_HEAD); sd(doc,ROW_HEAD); doc.rect(ML,y,CW,8,'F');
  bold(doc); doc.setFontSize(8.5); st(doc,BLACK);
  doc.text('ITEM DESCRIPTION', xDesc+2, y+5.5);
  doc.text('QTY',   xQty+2,  y+5.5);
  doc.text('PRICE', xPrice+2, y+5.5);
  right(doc,'TOTAL', xTotal,  y+5.5);
  y+=10;

  items.forEach(function(item,idx){
    var amt=Math.round((Number(item.qty)||1)*(Number(item.rate)||0));
    if(idx%2===1){ sf(doc,ROW_ALT); sd(doc,ROW_ALT); doc.rect(ML,y-1,CW,8,'F'); }
    var lines=doc.splitTextToSize(item.desc||'—',100);
    var rowH=Math.max(8,lines.length*5);
    normal(doc); doc.setFontSize(9); st(doc,BLACK);
    doc.text(lines, xDesc+2, y+4.5);
    /* Expense tag */
    if(item.itemType==='expense'){
      var tagW=18; var tagX=xDesc+2+doc.getTextWidth(lines[0])+3;
      if(lines.length>1) tagX=xDesc+2;
      var tagY=lines.length>1?y+4.5+5:y+2;
      sf(doc,[254,243,199]); sd(doc,[253,211,77]);
      doc.setLineWidth(0.2);
      doc.roundedRect(tagX,tagY-2.8,tagW,4,1,1,'FD');
      doc.setTextColor(146,64,14); doc.setFontSize(6); bold(doc);
      doc.text('EXPENSE',tagX+tagW/2,tagY-0.3,{align:'center'});
    }
    st(doc,MID);
    normal(doc); doc.setFontSize(9);
    doc.text(String(item.qty||1), xQty+2, y+4.5);
    if(item.rate) doc.text(inr(item.rate), xPrice+2, y+4.5);
    st(doc,BLACK);
    if(amt) right(doc,inr(amt), xTotal, y+4.5);
    y+=rowH;
  });
  hline(doc,y+1,LIGHT,0.4);
  return y+4;
}

/* ══════════════════════════════════════════════════════
   TOTALS BLOCK  (right-aligned)
══════════════════════════════════════════════════════ */
function drawTotalsBlock(doc, subtotal, discount, gst, grandTotal, y) {
  var lx=ML+95, rx=PW-MR;
  normal(doc); doc.setFontSize(10); st(doc,MID);
  doc.text('Sub Total', lx, y); right(doc,inr(subtotal), rx, y); y+=7;
  if(discount>0){
    st(doc,GREEN);
    doc.text('Discount', lx, y); right(doc,'- '+inr(discount), rx, y); y+=7;
    st(doc,MID);
  }
  if(gst>0){
    doc.text('GST', lx, y); right(doc,inr(gst), rx, y); y+=7;
  }
  hline(doc,y,LIGHT,0.3); y+=4;
  bold(doc); doc.setFontSize(11); st(doc,BLACK);
  doc.text('Grand Total', lx, y); right(doc,inr(grandTotal), rx, y); y+=5;
  hline(doc,y,LIGHT,0.3);
  return y+4;
}

/* ══════════════════════════════════════════════════════
   PAYMENT SCHEDULE  (invoice milestones)
   Fixed alignment: status pill left, amount right
══════════════════════════════════════════════════════ */
function drawMilestones(doc, milestones, y) {
  if(!milestones||milestones.length===0) return y;

  bold(doc); doc.setFontSize(9.5); st(doc,BLACK);
  doc.text('Payment Schedule', ML, y); y+=6;

  /* Column positions */
  var xLabel  = ML;
  var xStatus = ML+90;   /* status pill start */
  var xAmt    = PW-MR;   /* amount right-aligned */

  milestones.forEach(function(m){
    normal(doc); doc.setFontSize(9); st(doc,MID);

    /* Label + date */
    var label = (m.label||'') + (m.dueDate ? '  ('+formatDate(m.dueDate)+')' : '');
    doc.text(label, xLabel, y);

    /* Status pill background */
    var sc = m.status==='collected' ? GREEN : m.status==='pending' ? [146,64,14] : [120,120,120];
    var pillW = doc.getTextWidth(m.status||'upcoming') + 6;
    sf(doc, sc); sd(doc, sc);
    doc.roundedRect(xStatus, y-3.5, pillW, 5, 1, 1, 'F');
    doc.setTextColor(255,255,255); doc.setFontSize(7.5); bold(doc);
    doc.text((m.status||'upcoming'), xStatus+3, y+0.2);

    /* Amount */
    normal(doc); doc.setFontSize(9); st(doc,BLACK);
    right(doc, inr(m.amount||0), xAmt, y);

    y+=7;
  });
  return y+2;
}

/* ══════════════════════════════════════════════════════
   BOTTOM SECTION — two columns:
   LEFT:  Payment Details
   RIGHT: Total box + Signature
   Drawn as a teal-tinted card row
══════════════════════════════════════════════════════ */
function drawBottomSection(doc, s, invoice, grandTotal, isInvoice, y) {
  var leftW  = 80;            /* left column width */
  var divX   = ML + leftW + 4;/* divider x */
  var rightX = divX + 4;      /* right column start */
  var rx     = PW - MR;

  /* ── LEFT: Payment Details ── */
  bold(doc); doc.setFontSize(9); st(doc,BLACK);
  doc.text('PAYMENT DETAILS', ML, y); y+=6;

  normal(doc); doc.setFontSize(8.5); st(doc,MID);
  var bankLines = [];
  if(s.bankName)      bankLines.push('Bank: '     + s.bankName);
  if(s.accountName)   bankLines.push('A/C Name: ' + s.accountName);
  if(s.accountNumber) bankLines.push('A/C No: '   + s.accountNumber);
  if(s.ifscCode)      bankLines.push('IFSC: '     + s.ifscCode);
  if(s.upiId)         bankLines.push('UPI: '      + s.upiId);
  if(s.phonePay)      bankLines.push('PhonePe: '  + s.phonePay);
  if(s.googlePay)     bankLines.push('GPay: '     + s.googlePay);
  if(!s.bankName&&!s.upiId&&!s.phonePay){
    if(s.phone)   bankLines.push(s.phone);
    if(s.email)   bankLines.push(s.email);
    if(s.address) bankLines.push(s.address);
  }

  var bankStartY = y;
  bankLines.forEach(function(line){
    doc.text(line, ML, y); y+=5;
  });
  var bankEndY = y;

  /* ── RIGHT: Total box ── */
  var rightStartY = bankStartY - 6; /* align with PAYMENT DETAILS heading */
  var ry = rightStartY;

  if(isInvoice){
    /* Grand Total / Collected / Pending Due */
    var ms = invoice.milestones||[];
    var collected = ms.reduce(function(s,m){ return s+(m.status==='collected'?(m.amount||0):0); },0);
    var pending   = Math.max(0, grandTotal-collected);

    normal(doc); doc.setFontSize(9); st(doc,MID);
    doc.text('Grand Total', rightX, ry); right(doc,inr(grandTotal), rx, ry); ry+=6;

    if(collected>0){
      st(doc,GREEN);
      doc.text('Total Collected', rightX, ry); right(doc,inr(collected), rx, ry); ry+=6;
    }
    hline(doc, ry, LIGHT, 0.3); ry+=5;
    bold(doc); doc.setFontSize(10); st(doc,BLACK);
    doc.text('Total Pending Due (INR)', rightX, ry); right(doc,inr(pending), rx, ry); ry+=7;

  } else {
    /* Quote: Total (INR) */
    normal(doc); doc.setFontSize(9.5); st(doc,MID);
    doc.text('Total (INR)', rightX, ry);
    bold(doc); doc.setFontSize(13); st(doc,BLACK);
    right(doc, inr(grandTotal), rx, ry); ry+=7;
  }

  hline(doc, ry, LIGHT, 0.3); ry+=6;

  /* Signature image */
  var sigData = s._sig||s.signature;
  if(sigData){
    try{ doc.addImage(sigData,'JPEG', rx-42, ry, 42, 20); ry+=22; }
    catch(e){ ry+=4; }
  } else { ry+=4; }

  normal(doc); doc.setFontSize(8); st(doc,MUTED);
  right(doc,'Authorized Signatory', rx, ry);

  return Math.max(bankEndY, ry+6) + 4;
}

/* ══════════════════════════════════════════════════════
   SOCIAL MEDIA BAR  — brand colour pills
══════════════════════════════════════════════════════ */
function drawSocialBar(doc, s, y) {
  var items=[];
  if(s.instagram) items.push({lbl:'I', val:s.instagram, col:INSTA_C, url:'https://instagram.com/'+s.instagram.replace('@','')});
  if(s.website)   items.push({lbl:'W', val:s.website,   col:WEB_C,   url:s.website.startsWith('http')?s.website:'https://'+s.website});
  if(s.youtube)   items.push({lbl:'Y', val:s.youtube,   col:YT_C,    url:s.youtube.startsWith('http')?s.youtube:'https://'+s.youtube});
  if(s.facebook)  items.push({lbl:'F', val:s.facebook,  col:FB_C,    url:s.facebook.startsWith('http')?s.facebook:'https://'+s.facebook});
  if(!items.length) return y;

  hline(doc,y,LIGHT,0.2); y+=5;
  var x=ML;
  items.forEach(function(item){
    /* Pill bg */
    sf(doc,item.col); sd(doc,item.col);
    doc.roundedRect(x, y-3.5, 6, 5.5, 1, 1, 'F');
    /* Letter */
    doc.setTextColor(255,255,255); bold(doc); doc.setFontSize(6.5);
    doc.text(item.lbl, x+3, y+0.3, {align:'center'});
    /* Clickable handle */
    normal(doc); doc.setFontSize(8);
    doc.setTextColor(item.col[0],item.col[1],item.col[2]);
    doc.textWithLink(item.val, x+8, y, {url:item.url});
    x += 8 + doc.getTextWidth(item.val) + 10;
  });
  st(doc,MID);
  return y+8;
}

/* ══════════════════════════════════════════════════════
   CONTACT BAR
══════════════════════════════════════════════════════ */
function drawContactBar(doc, s, y) {
  normal(doc); doc.setFontSize(8.5); st(doc,MID);
  var parts=[];
  if(s.phone)   parts.push(s.phone);
  if(s.email)   parts.push(s.email);
  if(s.address) parts.push(s.address);
  if(parts.length) doc.text(parts.join('   '), ML, y);
  return y+6;
}

/* ══════════════════════════════════════════════════════
   GOOGLE REVIEW LINK
══════════════════════════════════════════════════════ */
function drawReviewLink(doc, s, y) {
  if(!s.googleReviewLink) return y;
  hline(doc,y,LIGHT,0.2); y+=5;
  bold(doc); doc.setFontSize(8.5); st(doc,BLACK);
  doc.text('Enjoyed our work? Leave us a review  ', ML, y);
  normal(doc); doc.setFontSize(8);
  doc.setTextColor(WEB_C[0],WEB_C[1],WEB_C[2]);
  doc.textWithLink(s.googleReviewLink, ML, y+5, {url:s.googleReviewLink});
  st(doc,MID);
  return y+12;
}

/* ══════════════════════════════════════════════════════
   PAGE FOOTER
══════════════════════════════════════════════════════ */
function drawPageFooter(doc, ref, dateStr, clientName, pageNum, docType) {
  var y=PH-8, label=docType==='invoice'?'Invoice':'Quotation';
  hline(doc,y-3,LIGHT,0.2);
  normal(doc); doc.setFontSize(7.5); st(doc,MUTED);
  doc.text(label+' No '+ref,         ML,       y);
  doc.text(label+' Date '+dateStr,   ML+40,    y);
  doc.text(label+' For '+clientName, ML+100,   y);
  right(doc,'Page '+pageNum, PW-MR,  y);
}

/* ══════════════════════════════════════════════════════
   TERMS PAGE  (page 2, quotes only)
══════════════════════════════════════════════════════ */
var DEFAULT_TERMS=[
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

function drawTermsPage(doc, s, ref, dateStr, clientName) {
  doc.addPage();
  drawHeader(doc, s, ref, dateStr, 'quote');
  var y=54;
  bold(doc); doc.setFontSize(11); st(doc,BLACK);
  doc.text('Terms and Conditions', PW/2, y, {align:'center'}); y+=10;
  normal(doc); doc.setFontSize(9); st(doc,MID);
  var terms=s.termsAndConditions ? doc.splitTextToSize(s.termsAndConditions,CW) : DEFAULT_TERMS;
  terms.forEach(function(line){ doc.text(line,ML,y); y+=6.5; });
  drawPageFooter(doc,ref,dateStr,clientName,2,'quote');
}

/* ══════════════════════════════════════════════════════
   GENERATE QUOTE PDF
══════════════════════════════════════════════════════ */
function generateQuotePDF(quote) {
  try {
    console.log('[PDF] generateQuotePDF called', quote);
    if (typeof jspdf === 'undefined') {
      console.error('[PDF] jsPDF library not loaded — check CDN script tag');
      if (typeof showToast === 'function') showToast('PDF library not loaded. Check internet connection.');
      return;
    }
    if (typeof getSettings !== 'function') {
      console.error('[PDF] getSettings() not found — core.js may not have loaded');
      if (typeof showToast === 'function') showToast('App error: core.js not loaded.');
      return;
    }
    var s = getSettings();
    console.log('[PDF] settings loaded', s);
    prepareImages(s, function(s) {
      try {
        _genQuote(quote, s);
        console.log('[PDF] Quote PDF generated successfully');
      } catch(e) {
        console.error('[PDF] _genQuote failed:', e);
        if (typeof showToast === 'function') showToast('PDF generation failed: ' + e.message);
      }
    });
  } catch(e) {
    console.error('[PDF] generateQuotePDF outer error:', e);
    if (typeof showToast === 'function') showToast('PDF error: ' + e.message);
  }
}

function _genQuote(quote, s) {
  setPdfCurrency(s.currency || 'INR');
  var doc=new jspdf.jsPDF({unit:'mm',format:'a4',compress:true});
  var ref=quote.ref||'QT-001';
  var dateStr=formatDate(quote.quoteDate);
  var client=quote.clientName||'—';

  var y=drawHeader(doc,s,ref,dateStr,'quote');
  y=drawBillBlock(doc,client,s.studioName||'Studio',y,'quote');
  hline(doc,y,LIGHT,0.3); y+=6;
  y=drawItemsTable(doc,quote.lineItems||[],y); y+=4;
  y=drawTotalsBlock(doc,quote.subtotal||0,quote.discount||0,quote.gst||0,quote.total||0,y); y+=6;

  /* Event note */
  if(quote.eventDate||quote.venue){
    normal(doc); doc.setFontSize(8); st(doc,MUTED);
    doc.text('Event: '+[quote.eventDate?formatDate(quote.eventDate):'',quote.venue||''].filter(Boolean).join(' · '), ML, y);
    y+=6;
  }

  hline(doc,y,LIGHT,0.2); y+=4;
  y=drawBottomSection(doc,s,null,quote.total||0,false,y);
  y=drawSocialBar(doc,s,y);
  y=drawContactBar(doc,s,y+2);
  drawPageFooter(doc,ref,dateStr,client,1,'quote');
  drawTermsPage(doc,s,ref,dateStr,client);
  doc.save(ref+'.pdf');
}

/* ══════════════════════════════════════════════════════
   GENERATE INVOICE PDF
══════════════════════════════════════════════════════ */
function generateInvoicePDF(invoice) {
  try {
    console.log('[PDF] generateInvoicePDF called', invoice);
    if (typeof jspdf === 'undefined') {
      console.error('[PDF] jsPDF library not loaded — check CDN script tag');
      if (typeof showToast === 'function') showToast('PDF library not loaded. Check internet connection.');
      return;
    }
    if (typeof getSettings !== 'function') {
      console.error('[PDF] getSettings() not found — core.js may not have loaded');
      if (typeof showToast === 'function') showToast('App error: core.js not loaded.');
      return;
    }
    var s = getSettings();
    console.log('[PDF] settings loaded', s);
    prepareImages(s, function(s) {
      try {
        _genInvoice(invoice, s);
        console.log('[PDF] Invoice PDF generated successfully');
      } catch(e) {
        console.error('[PDF] _genInvoice failed:', e);
        if (typeof showToast === 'function') showToast('PDF generation failed: ' + e.message);
      }
    });
  } catch(e) {
    console.error('[PDF] generateInvoicePDF outer error:', e);
    if (typeof showToast === 'function') showToast('PDF error: ' + e.message);
  }
}

function _genInvoice(invoice, s) {
  setPdfCurrency(s.currency || 'INR');
  var doc=new jspdf.jsPDF({unit:'mm',format:'a4',compress:true});
  var ref=invoice.ref||'INV-001';
  var dateStr=formatDate(invoice.invoiceDate);
  var client=invoice.clientName||'—';

  var y=drawHeader(doc,s,ref,dateStr,'invoice');
  y=drawBillBlock(doc,client,s.studioName||'Studio',y,'invoice');
  hline(doc,y,LIGHT,0.3); y+=6;
  y=drawItemsTable(doc,invoice.lineItems||[],y); y+=4;

  var subtotal=invoice.subtotal||0, gst=invoice.gst||0, grandTotal=invoice.total||0;
  y=drawTotalsBlock(doc,subtotal,invoice.discount||0,gst,grandTotal,y); y+=4;

  /* Payment schedule */
  y=drawMilestones(doc,invoice.milestones||[],y); y+=2;

  /* Event date & venue */
  if(invoice.eventDate || invoice.venue){
    sf(doc,[245,248,252]); sd(doc,[220,228,240]);
    doc.setLineWidth(0.3);
    doc.roundedRect(ML, y, CW, 9, 2, 2, 'FD');
    bold(doc); doc.setFontSize(8); st(doc,[60,90,140]);
    doc.text('EVENT DATE', ML+3, y+3.5);
    normal(doc); doc.setFontSize(9); st(doc,BLACK);
    var evStr = invoice.eventDate ? formatDate(invoice.eventDate) : '';
    var venStr = invoice.venue ? '  |  Venue: '+invoice.venue : '';
    doc.text(evStr + venStr, ML+28, y+3.5);
    y+=13;
  }

  /* Professional payment note */
  sf(doc,[255,251,235]); sd(doc,[253,211,77]);
  doc.setLineWidth(0.4);
  doc.roundedRect(ML, y, CW, 10, 2, 2, 'FD');
  bold(doc); doc.setFontSize(8); st(doc,[120,80,0]);
  doc.text('PAYMENT NOTE', ML+3, y+4);
  normal(doc); doc.setFontSize(8.5); st(doc,[80,50,0]);
  doc.text('Kindly clear the due amount upon receipt of this invoice. We appreciate your prompt payment.', ML+32, y+4);
  normal(doc); doc.setFontSize(7.5); st(doc,MUTED);
  doc.text('For queries, contact us at '+(s.phone||s.email||''), ML+32, y+8);
  y+=14;

  /* Custom notes if any */
  if(invoice.notes){
    normal(doc); doc.setFontSize(8.5); st(doc,MID);
    var noteLines = doc.splitTextToSize(invoice.notes, CW-4);
    noteLines.forEach(function(line){ doc.text(line, ML+2, y); y+=5; });
    y+=2;
  }

  hline(doc,y,LIGHT,0.2); y+=4;
  y=drawBottomSection(doc,s,invoice,grandTotal,true,y);
  y=drawSocialBar(doc,s,y);
  y=drawContactBar(doc,s,y+2);
  y=drawReviewLink(doc,s,y+2);
  drawPageFooter(doc,ref,dateStr,client,1,'invoice');
  doc.save(ref+'.pdf');
}
