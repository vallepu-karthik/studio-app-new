/* ═══════════════════════════════════════════════════════
   studio-app / js / nav.js
   Each page passes basePath explicitly — no URL sniffing.
   index.html  → basePath = ''
   pages/*.html → basePath = '../'
═══════════════════════════════════════════════════════ */
'use strict';

function renderNav(activePage, basePath) {
  var b = (basePath === undefined) ? '' : basePath;
  var settings = getSettings();

  var nav = [
    { id:'dashboard', label:'Dashboard',  href: b + 'index.html',         dot:'#639922' },
    { id:'quotes',    label:'Quotations', href: b + 'pages/quotes.html',   dot:'#378ADD' },
    { id:'invoices',  label:'Invoices',   href: b + 'pages/invoices.html', dot:'#BA7517' },
    { id:'clients',   label:'Clients',    href: b + 'pages/clients.html',  dot:'#1D9E75' },
    { id:'settings',  label:'Settings',   href: b + 'pages/settings.html', dot:'#888780' },
  ];

  var sidebar = document.getElementById('sidebar');
  if (!sidebar) return;

  var items = nav.map(function(item) {
    return '<li class="nav-item"><a href="' + item.href + '" class="' + (activePage === item.id ? 'active' : '') + '">' +
      '<span class="nav-dot" style="background:' + item.dot + '"></span>' +
      item.label + '</a></li>';
  }).join('');

  sidebar.innerHTML =
    '<div class="sidebar-brand">' +
      '<div class="app-name">' + (settings.studioName || 'Studio App') + '</div>' +
      (settings.tagline ? '<div class="app-sub">' + settings.tagline + '</div>' : '') +
    '</div>' +
    '<ul class="nav-list">' + items + '</ul>' +
    '<div class="sidebar-footer"></div>';

  var d      = getTrialData();
  var dl     = trialDaysLeft();
  var status = trialStatus();
  var color  = status === 'over' ? '#9b1c1c' : status === 'warn' ? '#92400e' : '#888';
  sidebar.querySelector('.sidebar-footer').innerHTML =
    '<span style="color:' + color + ';font-size:11px">' +
    dl + ' days left · ' + d.quotes + '/100 quotes · ' + d.invoices + '/100 invoices</span>';
}
