'use strict';

function renderNav(activePage, basePath) {
  var b = (basePath === undefined) ? '' : basePath;
  var settings = getSettings();

  // Apply theme immediately
  applyTheme();

  // Use clean Vercel URLs — no .html extensions in nav
  var nav = [
    { id:'dashboard', label:'Dashboard',  href: '/app',       dot:'#639922' },
    { id:'quotes',    label:'Quotations', href: '/quotes',    dot:'#378ADD' },
    { id:'invoices',  label:'Invoices',   href: '/invoices',  dot:'#BA7517' },
    { id:'clients',   label:'Clients',    href: '/clients',   dot:'#1D9E75' },
    { id:'reports',   label:'Reports',    href: '/reports',   dot:'#7C3AED' },
    { id:'settings',  label:'Settings',   href: '/settings',  dot:'#888780' },
  ];

  var dueReminders = getDueReminders();
  var qBadge = dueReminders.filter(function(r){ return r.type==='quote'; }).length;
  var iBadge = dueReminders.filter(function(r){ return r.type==='invoice'; }).length;

  var sidebar = document.getElementById('sidebar');
  if (!sidebar) return;

  var logo = getLogo();
  var isDark = (settings.theme === 'dark');

  var items = nav.map(function(item) {
    var badge = '';
    if (item.id === 'quotes'   && qBadge > 0) badge = '<span class="nav-badge">' + qBadge + '</span>';
    if (item.id === 'invoices' && iBadge > 0) badge = '<span class="nav-badge">' + iBadge + '</span>';
    return '<li class="nav-item"><a href="' + item.href + '" class="' + (activePage === item.id ? 'active' : '') + '">' +
      '<span class="nav-dot" style="background:' + item.dot + '"></span>' +
      item.label + badge + '</a></li>';
  }).join('');

  sidebar.innerHTML =
    '<div class="sidebar-brand">' +
      (logo ? '<img class="sidebar-logo visible" src="' + logo + '" alt="Logo">' : '') +
      '<div class="sidebar-brand-text">' +
        '<div class="app-name">' + (settings.studioName || 'Studio App') + '</div>' +
        (settings.tagline ? '<div class="app-sub">' + settings.tagline + '</div>' : '') +
      '</div>' +
    '</div>' +
    '<ul class="nav-list">' + items + '</ul>' +
    '<div class="sidebar-footer">' +
      '<span id="trial-footer"></span>' +
      '<div style="display:flex;gap:6px;align-items:center">' +
        '<button class="theme-toggle" id="theme-toggle-btn" onclick="toggleTheme()" title="Toggle theme">' +
          (isDark ? '☀' : '☾') +
        '</button>' +
        (typeof signOutAndRedirect === "function" ?
          '<button class="theme-toggle" onclick="signOutAndRedirect(\'' + b + '\')" title="Sign out" style="font-size:14px">⏻</button>' : '') +
      '</div>' +
    '</div>';

  var d      = getTrialData();
  var dl     = trialDaysLeft();
  var status = trialStatus();
  var color  = status === 'over' ? '#e53e3e' : status === 'warn' ? '#d97706' : '';
  var tf = document.getElementById('trial-footer');
  if (tf) {
    tf.textContent = dl + 'd · ' + d.quotes + '/100 · ' + d.invoices + '/100';
    if (color) tf.style.color = color;
  }
}
