'use strict';

function renderNav(activePage, basePath) {
  var b = (basePath === undefined) ? '' : basePath;
  var settings = getSettings();

  applyTheme();

  var nav = [
    { id:'dashboard', label:'Dashboard',  href: b + 'index.html',         dot:'#639922' },
    { id:'quotes',    label:'Quotations', href: b + 'pages/quotes.html',   dot:'#378ADD' },
    { id:'invoices',  label:'Invoices',   href: b + 'pages/invoices.html', dot:'#BA7517' },
    { id:'clients',   label:'Clients',    href: b + 'pages/clients.html',  dot:'#1D9E75' },
    { id:'settings',  label:'Settings',   href: b + 'pages/settings.html', dot:'#888780' },
  ];

  var dueReminders = getDueReminders();
  var qBadge = dueReminders.filter(function(r){ return r.type==='quote'; }).length;
  var iBadge = dueReminders.filter(function(r){ return r.type==='invoice'; }).length;

  var sidebar = document.getElementById('sidebar');
  if (!sidebar) return;

  var logo   = getLogo();
  var isDark = (settings.theme === 'dark');

  var items = nav.map(function(item) {
    var badge = '';
    if (item.id === 'quotes'   && qBadge > 0) badge = '<span class="nav-badge">' + qBadge + '</span>';
    if (item.id === 'invoices' && iBadge > 0) badge = '<span class="nav-badge">' + iBadge + '</span>';
    return '<li class="nav-item"><a href="' + item.href + '" class="' +
      (activePage === item.id ? 'active' : '') + '">' +
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
      '<div style="display:flex;flex-direction:column;gap:4px;flex:1;min-width:0">' +
        '<span id="trial-footer" style="font-size:11px;color:var(--text4)"></span>' +
        '<span id="user-email-footer" style="font-size:10px;color:var(--text4);overflow:hidden;text-overflow:ellipsis;white-space:nowrap"></span>' +
      '</div>' +
      '<div style="display:flex;gap:4px;flex-shrink:0">' +
        '<button class="theme-toggle" id="theme-toggle-btn" onclick="toggleTheme()" title="Toggle theme">' +
          (isDark ? '☀' : '☾') +
        '</button>' +
        '<button class="theme-toggle" id="signout-btn" onclick="handleSignOut()" title="Sign out" style="display:none">⇤</button>' +
      '</div>' +
    '</div>';

  // Trial info
  var d      = getTrialData();
  var dl     = trialDaysLeft();
  var status = trialStatus();
  var color  = status === 'over' ? '#e53e3e' : status === 'warn' ? '#d97706' : '';
  var tf = document.getElementById('trial-footer');
  if (tf) {
    tf.textContent = dl + 'd · ' + d.quotes + '/100 · ' + d.invoices + '/100';
    if (color) tf.style.color = color;
  }

  // Show user email and sign out if logged in
  sbGetSession().then(function(session) {
    if (!session) return;
    var emailEl = document.getElementById('user-email-footer');
    var signout = document.getElementById('signout-btn');
    if (emailEl) emailEl.textContent = session.user.email;
    if (signout) signout.style.display = 'inline-flex';
  }).catch(function() {});
}

async function handleSignOut() {
  try { await sbSignOut(); } catch(e) {}
  const inPages = window.location.pathname.includes('/pages/');
  window.location.href = inPages ? '../login.html' : 'login.html';
}
