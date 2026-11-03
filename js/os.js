/* ============================================================
   Slate OS — kernel
   A full-screen web OS for tablets. No frames, no toys.
   ============================================================ */
'use strict';

/* ---------------- Config ---------------- */
const CONFIG = {
  repo: { owner: 'ardy03851-bit', name: 'slate-os' }, // live catalog discovery via GitHub API
  storageKey: 'slate.state.v1',
  legacyKey: 'webpad.state.v2',
  version: '2.0.0',
  recentsLimit: 8,
};

/* ---------------- Wallpapers ---------------- */
const WALLPAPERS = [
  { id: 'aurora',  name: 'Aurora',  css: 'url(assets/wallpapers/aurora.jpg) center/cover' },
  { id: 'sunset',  name: 'Sunset',  css: 'url(assets/wallpapers/sunset.jpg) center/cover' },
  { id: 'forest',  name: 'Forest',  css: 'url(assets/wallpapers/forest.jpg) center/cover' },
  { id: 'candy',   name: 'Candy',   css: 'url(assets/wallpapers/candy.jpg) center/cover' },
  { id: 'ocean',   name: 'Ocean',   css: 'url(assets/wallpapers/ocean.jpg) center/cover' },
  { id: 'midnight',name: 'Midnight',css: 'url(assets/wallpapers/midnight.jpg) center/cover' },
  { id: 'mesh',    name: 'Vapor',  css: 'linear-gradient(135deg,#667eea 0%,#764ba2 100%)' },
  { id: 'peach',   name: 'Peach',  css: 'linear-gradient(135deg,#ffecd2 0%,#fcb69f 100%)' },
  { id: 'mint',    name: 'Mint',   css: 'linear-gradient(135deg,#43e97b 0%,#38f9d7 100%)' },
  { id: 'grape',   name: 'Grape',  css: 'linear-gradient(135deg,#a18cd1 0%,#fbc2eb 100%)' },
];

/* ---------------- State ---------------- */
const State = {
  wallpaper: 'aurora',
  dark: false,
  brightness: 100,
  volume: 70,
  focus: false,        // do-not-disturb
  lowPower: false,
  installed: ['calculator', 'clock', 'notes', 'weather', 'game2048'],
  recents: [],
  customWallpaper: null,
};

function saveState() {
  localStorage.setItem(CONFIG.storageKey, JSON.stringify(State));
}
function loadState() {
  try {
    const raw = localStorage.getItem(CONFIG.storageKey);
    if (raw) { Object.assign(State, JSON.parse(raw)); return; }
    // migrate from the old WebPad build
    const legacy = localStorage.getItem(CONFIG.legacyKey);
    if (legacy) {
      const l = JSON.parse(legacy);
      State.wallpaper = l.wallpaper || State.wallpaper;
      State.installed = Array.isArray(l.installed) ? l.installed : State.installed;
      State.dark = !!l.dark;
      State.customWallpaper = l.customWallpaper || null;
    }
  } catch (e) { /* fresh start */ }
  // migrate app data from the old WebPad build
  try {
    if (!localStorage.getItem('slate.app.notes') && localStorage.getItem('webpad.app.notes')) {
      localStorage.setItem('slate.app.notes', localStorage.getItem('webpad.app.notes'));
    }
    if (!localStorage.getItem('slate.app.g2048.best') && localStorage.getItem('webpad.app.g2048.best')) {
      localStorage.setItem('slate.app.g2048.best', localStorage.getItem('webpad.app.g2048.best'));
    }
  } catch (e) { /* ignore */ }
}

/* ---------------- Utilities ---------------- */
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

function toast(msg, ms = 2200) {
  if (State.focus) return; // focus mode silences notifications
  const t = $('#toast');
  t.textContent = msg;
  t.classList.remove('hidden');
  t.classList.add('show');
  clearTimeout(toast._t);
  toast._t = setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.classList.add('hidden'), 300); }, ms);
}

function loadScript(src) {
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = src;
    s.onload = resolve;
    s.onerror = () => reject(new Error('Failed to load ' + src));
    document.head.appendChild(s);
  });
}

function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (k === 'style') el.style.cssText = v;
    else if (k === 'html') el.innerHTML = v;
    else el.setAttribute(k, v);
  }
  for (const c of children.flat()) {
    if (c == null) continue;
    el.append(c.nodeType ? c : document.createTextNode(c));
  }
  return el;
}

const pad = n => String(n).padStart(2, '0');

/* ---------------- OS core ---------------- */
const OS = {
  currentApp: null,      // {id, kind, cleanup}
  loadedScripts: new Set(),
  catalog: [],
  editMode: false,
  pageIndex: 0,
};

/* --- Built-in apps registry --- */
const Builtins = {}; // id -> {name, icon, mount(el)}

/* ---------------- Clock & battery ---------------- */
function tickClock() {
  const now = new Date();
  $('#sb-time').textContent = now.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  const lt = $('#lock-time');
  if (lt) lt.textContent = now.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  const ld = $('#lock-date');
  if (ld) ld.textContent = now.toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'long' });
  const wc = $('#widget-clock-time');
  if (wc) wc.textContent = now.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  const wd = $('#widget-clock-date');
  if (wd) wd.textContent = now.toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'long' });
}
setInterval(tickClock, 1000);
tickClock();

async function initBattery() {
  let b = null;
  try { b = await (navigator.getBattery?.() ?? navigator.battery); } catch (e) { /* fall through */ }
  if (b && typeof b.level === 'number') {
    const upd = () => {
      $('#sb-batt').textContent = Math.round(b.level * 100) + '%';
      if (b.charging) $('#sb-batt').textContent += '⚡';
    };
    upd();
    b.addEventListener?.('levelchange', upd);
    b.addEventListener?.('chargingchange', upd);
    return;
  }
  let level = 87;
  setInterval(() => { level = Math.max(12, level - 1); $('#sb-batt').textContent = level + '%'; }, 90000);
}

/* --- Lock screen weather line --- */
async function loadLockWeather() {
  try {
    const r = await fetch('https://api.open-meteo.com/v1/forecast?latitude=53.35&longitude=-6.26&current=temperature_2m,weather_code&timezone=auto');
    if (!r.ok) return;
    const d = await r.json();
    const codes = { 0: 'Clear', 1: 'Mainly clear', 2: 'Partly cloudy', 3: 'Overcast', 45: 'Fog', 48: 'Fog',
      51: 'Drizzle', 61: 'Rain', 63: 'Rain', 65: 'Heavy rain', 71: 'Snow', 73: 'Snow', 80: 'Showers', 95: 'Storm' };
    $('#lock-weather').textContent = `Dublin · ${Math.round(d.current.temperature_2m)}° · ${codes[d.current.weather_code] || ''}`;
  } catch (e) { /* offline: line stays empty */ }
}

/* ---------------- Wallpaper ---------------- */
function applyWallpaper() {
  const wp = State.customWallpaper
    ? { css: `url("${State.customWallpaper.url}") center/cover` }
    : (WALLPAPERS.find(w => w.id === State.wallpaper) || WALLPAPERS[0]);
  for (const el of [$('#home'), $('#lock-screen')]) {
    el.style.setProperty('--wp', wp.css);
    el.style.background = wp.css;
  }
}

/* ---------------- Appearance / focus ---------------- */
function applyAppearance() {
  document.documentElement.classList.toggle('dark', State.dark);
  $('#cc-dark')?.classList.toggle('on', State.dark);
  $('#cc-dnd')?.classList.toggle('on', State.focus);
  $('#cc-dnd')?.classList.toggle('amber', State.focus);
  $('#statusbar').classList.toggle('focus', State.focus);
  updateStatusCenter();
  $('#cc-battery-saver')?.classList.toggle('on', State.lowPower);
  $('#cc-battery-saver')?.classList.toggle('amber', State.lowPower);
  $('#sb-batt').style.color = State.lowPower ? '#ffd60a' : '';
}
function updateStatusCenter() {
  const c = $('#sb-center');
  if (!c) return;
  if (State.focus) c.textContent = 'Focus';
  else if (OS.currentApp) c.textContent = OS.currentApp.name;
  else c.textContent = '';
}

/* ---------------- Boot / lock / unlock ---------------- */
function boot() {
  loadState();
  applyWallpaper();
  applyAppearance();
  initBattery();
  loadLockWeather();
  $('#dim-layer').style.opacity = String((100 - State.brightness) / 145);
  $('#cc-brightness').value = State.brightness;
  $('#cc-volume').value = State.volume;

  setTimeout(() => {
    $('#boot-screen').classList.add('hidden');
    $('#lock-screen').classList.remove('hidden');
  }, 2000);

  const ls = $('#lock-screen');
  let startY = null;
  ls.addEventListener('pointerdown', e => { startY = e.clientY; });
  ls.addEventListener('pointerup', e => {
    if (startY == null) return;
    const dy = startY - e.clientY;
    if (dy > 40 || dy === 0) unlock();
    startY = null;
  });
}

function unlock() {
  const ls = $('#lock-screen');
  if (ls.classList.contains('unlocking')) return;
  ls.classList.add('unlocking');
  setTimeout(() => {
    ls.classList.add('hidden');
    ls.classList.remove('unlocking');
    $('#home').classList.remove('hidden');
    renderHome();
  }, 480);
}

function lockScreen() {
  closeCurrentApp();
  closeSpotlight();
  closeSwitcher();
  closeControlCenter();
  $('#home').classList.add('hidden');
  const ls = $('#lock-screen');
  ls.classList.remove('hidden');
  loadLockWeather();
}

/* ---------------- Home screen ---------------- */
const DOCK_EXTERNALS = ['clock', 'calculator', 'notes'];

function installedExternals() {
  return OS.catalog.filter(a => State.installed.includes(a.id));
}

function appById(id) {
  return OS.catalog.find(a => a.id === id);
}

function makeIcon({ id, name, iconSrc, onOpen, removable }) {
  const el = h('div', { class: 'app-icon', role: 'button', tabindex: 0,
    onclick: (e) => {
      if (OS.editMode) {
        if (removable) uninstallApp(id);
        return;
      }
      onOpen();
    } });
  el.append(h('div', { class: 'glyph' }, h('img', { src: iconSrc, alt: name, draggable: 'false' })));
  el.append(h('div', { class: 'label' }, name));
  let pressTimer = null;
  el.addEventListener('pointerdown', () => {
    pressTimer = setTimeout(() => { setEditMode(true); clearTimeout(pressTimer); }, 550);
  });
  const cancel = () => pressTimer && clearTimeout(pressTimer);
  el.addEventListener('pointerup', cancel);
  el.addEventListener('pointerleave', cancel);
  el.addEventListener('pointermove', cancel);
  return el;
}

function iconsPerPage() {
  const cols = Math.max(4, Math.floor(window.innerWidth / 118));
  const rows = Math.max(3, Math.floor((window.innerHeight - 220) / 122));
  return cols * rows;
}

function buildWidgetsPage() {
  const page = h('section', { class: 'page', 'data-page': 'widgets' });
  const grid = h('div', { id: 'widgets-page' });

  // Clock widget
  grid.append(h('div', { class: 'widget w-clock', onclick: () => openApp('clock') },
    h('div', { class: 'w-title' }, 'Clock'),
    h('div', { class: 'w-big', id: 'widget-clock-time' }, '—'),
    h('div', { class: 'w-sub', id: 'widget-clock-date' }, '')
  ));

  // Weather widget
  const wx = h('div', { class: 'widget', onclick: () => openApp('weather') },
    h('div', { class: 'w-title' }, 'Weather · Dublin'),
    h('div', { class: 'w-big', id: 'widget-wx-temp' }, '…'),
    h('div', { class: 'w-sub', id: 'widget-wx-desc' }, 'Loading')
  );
  grid.append(wx);
  fetch('https://api.open-meteo.com/v1/forecast?latitude=53.35&longitude=-6.26&current=temperature_2m,weather_code&timezone=auto')
    .then(r => r.json())
    .then(d => {
      const codes = { 0: 'Clear', 1: 'Mainly clear', 2: 'Partly cloudy', 3: 'Overcast', 45: 'Fog', 48: 'Fog',
        51: 'Drizzle', 61: 'Rain', 63: 'Rain', 65: 'Heavy rain', 71: 'Snow', 73: 'Snow', 80: 'Showers', 95: 'Storm' };
      $('#widget-wx-temp').textContent = Math.round(d.current.temperature_2m) + '°';
      $('#widget-wx-desc').textContent = codes[d.current.weather_code] || '';
    })
    .catch(() => { $('#widget-wx-desc').textContent = 'Unavailable offline'; });

  // Notes widget
  const latest = WebPadAPI.storage.get('notes', [])[0];
  grid.append(h('div', { class: 'widget', onclick: () => openApp('notes') },
    h('div', { class: 'w-title' }, 'Notes'),
    h('div', { class: 'w-body', id: 'widget-notes' }, latest ? ((latest.title || 'Untitled') + '\n' + (latest.body || '').slice(0, 90)) : 'No notes yet — tap to write one.')
  ));

  // System widget
  grid.append(h('div', { class: 'widget', onclick: () => openApp('settings') },
    h('div', { class: 'w-title' }, 'System'),
    h('div', { class: 'w-big', style: 'font-size:26px;font-weight:600;margin-top:10px' }, 'Slate OS ' + CONFIG.version),
    h('div', { class: 'w-sub', id: 'widget-sys' }, `${State.installed.length} apps installed · ${State.recents.length} in switcher`)
  ));

  page.append(grid);
  return page;
}

function buildIconPages() {
  const pages = [];
  const apps = [
    ...['photos', 'settings'].map(id => ({ id, name: Builtins[id].name, icon: Builtins[id].icon, builtin: true })),
    ...installedExternals()
      .filter(a => !DOCK_EXTERNALS.includes(a.id))
      .map(a => ({ id: a.id, name: a.name, icon: `apps/${a.id}/icon.png`, builtin: false })),
  ];
  const perPage = iconsPerPage();
  for (let i = 0; i < apps.length; i += perPage) {
    const page = h('section', { class: 'page', 'data-page': 'icons' });
    const grid = h('div', { class: 'icon-grid', id: 'icon-grid' });
    for (const app of apps.slice(i, i + perPage)) {
      grid.append(makeIcon({
        id: app.id, name: app.name, iconSrc: app.icon,
        onOpen: () => app.builtin ? openApp(app.id) : openApp(app.id),
        removable: !app.builtin,
      }));
    }
    page.append(grid);
    pages.push(page);
  }
  return pages.length ? pages : [(() => {
    const page = h('section', { class: 'page' });
    page.append(h('div', { class: 'icon-grid' }));
    return page;
  })()];
}

function renderHome() {
  const pagesEl = $('#pages');
  pagesEl.innerHTML = '';
  pagesEl.append(buildWidgetsPage(), ...buildIconPages());

  // dots
  const dots = $('#page-dots');
  dots.innerHTML = '';
  $$('.page', pagesEl).forEach((_, i) => {
    dots.append(h('span', { class: 'dot' + (i === 0 ? ' active' : ''), onclick: () => {
      pagesEl.children[i].scrollIntoView({ behavior: 'smooth' });
    } }));
  });

  // restore page position
  pagesEl.scrollLeft = 0;
  const idx = Math.min(OS.pageIndex, pagesEl.children.length - 1);
  requestAnimationFrame(() => { pagesEl.children[idx]?.scrollIntoView(); OS.pageIndex = idx; });

  // dock
  const dock = $('#dock');
  dock.innerHTML = '';
  // search "app"
  dock.append(h('div', {
    class: 'app-icon', role: 'button', onclick: () => openSpotlight()
  },
    h('div', { class: 'glyph', style: 'background:rgba(255,255,255,.22);backdrop-filter:blur(10px);display:flex;align-items:center;justify-content:center' },
      h('div', { html: '<svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.5-4.5"/></svg>' })),
    h('div', { class: 'label' }, 'Search')
  ));
  dock.append(makeIcon({ id: 'appstore', name: 'App Store', iconSrc: Builtins.appstore.icon, onOpen: () => openApp('appstore'), removable: false }));
  for (const id of DOCK_EXTERNALS) {
    const app = appById(id);
    if (app && State.installed.includes(id)) {
      dock.append(makeIcon({ id, name: app.name, iconSrc: `apps/${app.id}/icon.png`, onOpen: () => openApp(id), removable: false }));
    }
  }
}

function setEditMode(on) {
  OS.editMode = on;
  $$('.page').forEach(p => p.classList.toggle('editing', on));
  if (on) {
    toast('Tap an app to remove it. Tap the background to finish.');
    const handler = (e) => {
      if (e.target.classList.contains('page') || e.target.id === 'icon-grid' || e.target.id === 'widgets-page') {
        document.removeEventListener('click', handler);
        setEditMode(false);
      }
    };
    setTimeout(() => document.addEventListener('click', handler), 50);
  }
}

/* ---------------- App lifecycle ---------------- */
function closeCurrentApp() {
  if (!OS.currentApp) return;
  try { OS.currentApp.cleanup?.(); } catch (e) { /* ignore */ }
  OS.currentApp = null;
  $('#os').classList.remove('in-app', 'app-dark');
  updateStatusCenter();
  const layer = $('#app-layer');
  for (const w of [...layer.children]) {
    w.classList.add('closing');
    setTimeout(() => w.remove(), 260);
  }
}

function mountWindow(dark = false) {
  const win = h('div', { class: 'app-window' + (dark ? ' dark' : '') });
  const content = h('div', { class: 'app-content' });
  win.append(content);
  $('#app-layer').append(win);
  $('#os').classList.add('in-app');
  $('#os').classList.toggle('app-dark', dark);
  return { win, content };
}

function pushRecent(id, name) {
  State.recents = [{ id, name }, ...State.recents.filter(r => r.id !== id)].slice(0, CONFIG.recentsLimit);
  saveState();
  updateStatusCenter();
}

async function openApp(id) {
  const builtin = Builtins[id];
  if (builtin) {
    closeCurrentApp();
    const { win, content } = mountWindow(false);
    let cleanup = null;
    try { cleanup = builtin.mount(content, win) || null; } catch (e) {
      content.append(h('div', { style: 'padding:40px;color:#888' }, 'This app crashed: ' + e.message));
    }
    OS.currentApp = { id, name: builtin.name, kind: 'builtin', cleanup };
    pushRecent(id, builtin.name);
    updateStatusCenter();
    return;
  }
  const app = appById(id);
  if (!app) { toast('App not found'); return; }
  closeCurrentApp();
  if (!OS.loadedScripts.has(id)) {
    try {
      await loadScript(`apps/${id}/app.js`);
      OS.loadedScripts.add(id);
    } catch (e) {
      toast('Could not launch ' + app.name);
      return;
    }
  }
  const def = window.WebPadApps?.[id];
  if (!def) { toast('App entry point missing'); return; }
  const { win, content } = mountWindow(!!def.dark);
  let cleanup = null;
  try { cleanup = def.mount(content, win, WebPadAPI) || null; } catch (e) {
    content.append(h('div', { style: 'padding:40px;color:#888' }, 'This app crashed: ' + e.message));
  }
  OS.currentApp = { id, name: app.name, kind: 'external', cleanup };
  pushRecent(id, app.name);
  updateStatusCenter();
}

/* API handed to external apps */
const WebPadAPI = {
  close: () => closeCurrentApp(),
  toast,
  storage: {
    get(key, fallback = null) {
      try { const v = localStorage.getItem('slate.app.' + key); return v == null ? fallback : JSON.parse(v); } catch { return fallback; }
    },
    set(key, value) { localStorage.setItem('slate.app.' + key, JSON.stringify(value)); },
  },
  get state() { return State; },
  wallpapers: WALLPAPERS,
  applyWallpaper,
  refreshHome: () => renderHome(),
};

/* ---------------- Install / uninstall ---------------- */
function installApp(id) {
  if (!State.installed.includes(id)) State.installed.push(id);
  saveState();
  renderHome();
  toast(appById(id)?.name + ' installed');
}
function uninstallApp(id) {
  State.installed = State.installed.filter(x => x !== id);
  State.recents = State.recents.filter(r => r.id !== id);
  saveState();
  setEditMode(false);
  renderHome();
  toast('App removed');
}

/* ---------------- Spotlight ---------------- */
function openSpotlight() {
  $('#spotlight').classList.remove('hidden');
  renderSpotlight('');
  setTimeout(() => $('#spot-input').focus(), 60);
}
function closeSpotlight() {
  $('#spotlight').classList.add('hidden');
  $('#spot-input').value = '';
}
function renderSpotlight(q) {
  const results = $('#spot-results');
  results.innerHTML = '';
  const query = q.trim().toLowerCase();
  const apps = [
    ...Object.entries(Builtins).map(([id, b]) => ({ id, name: b.name, icon: b.icon, sub: 'Built-in app', external: false })),
    ...installedExternals().map(a => ({ id: a.id, name: a.name, icon: `apps/${a.id}/icon.png`, sub: a.category || 'App', external: true })),
  ];
  const matches = query ? apps.filter(a => a.name.toLowerCase().includes(query)) : apps.slice(0, 6);

  if (query && matches.length === 0) {
    results.append(h('div', { class: 'spot-empty' }, 'No apps match “' + q.trim() + '”.'));
  }
  for (const m of matches) {
    results.append(h('div', { class: 'spot-row', onclick: () => { closeSpotlight(); openApp(m.id); } },
      h('img', { src: m.icon, alt: '' }),
      h('div', {}, h('div', { class: 'sr-name' }, m.name), h('div', { class: 'sr-sub' }, m.sub))
    ));
  }
  if (query) {
    results.append(h('div', { class: 'spot-row', onclick: () => {
      window.open('https://www.google.com/search?q=' + encodeURIComponent(q.trim()), '_blank');
    } },
      h('div', { style: 'width:42px;height:42px;border-radius:23%;background:rgba(255,255,255,.14);display:flex;align-items:center;justify-content:center' },
        h('div', { html: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M3.5 12h17M12 3a15 15 0 0 1 0 18M12 3a15 15 0 0 0 0 18"/></svg>' })),
      h('div', {}, h('div', { class: 'sr-name' }, 'Search the web'), h('div', { class: 'sr-sub' }, '“' + q.trim() + '” on Google'))
    ));
  }
}

/* ---------------- App switcher ---------------- */
function openSwitcher() {
  const sw = $('#switcher');
  const cards = $('#switcher-cards');
  cards.innerHTML = '';
  if (!State.recents.length) {
    cards.append(h('div', { style: 'color:rgba(255,255,255,.6);font-size:16px;align-self:center;padding:20px' }, 'No recent apps'));
  }
  const iconFor = r => Builtins[r.id]?.icon || (appById(r.id) ? `apps/${r.id}/icon.png` : null);
  for (const r of State.recents) {
    const icon = iconFor(r);
    if (!icon) continue;
    const card = h('div', { class: 'sw-card', onclick: (e) => {
      if (e.target.classList.contains('sw-x')) return;
      closeSwitcher(); openApp(r.id);
    } },
      h('img', { src: icon, alt: '' }),
      h('div', { class: 'sw-name' }, r.name),
      h('button', { class: 'sw-x', onclick: () => {
        State.recents = State.recents.filter(x => x.id !== r.id);
        saveState(); openSwitcher();
      } }, '×')
    );
    cards.append(card);
  }
  sw.classList.remove('hidden');
}
function closeSwitcher() { $('#switcher').classList.add('hidden'); }

/* ---------------- Control center ---------------- */
function openControlCenter() {
  $('#cc-scrim').classList.add('show');
  $('#control-center').classList.add('open');
}
function closeControlCenter() {
  $('#control-center').classList.remove('open');
  $('#cc-scrim').classList.remove('show');
}

function initControlCenter() {
  const cc = $('#control-center'), scrim = $('#cc-scrim');

  // top-right corner of the screen opens it (tap or swipe down)
  let corner = document.createElement('div');
  corner.style.cssText = 'position:absolute;top:0;right:0;width:26%;height:34px;z-index:169;cursor:pointer;touch-action:none;';
  $('#os').append(corner);
  let cStartY = null;
  corner.addEventListener('pointerdown', e => { cStartY = e.clientY; });
  corner.addEventListener('pointerup', e => {
    if (cStartY != null && e.clientY - cStartY > 12) openControlCenter();
    cStartY = null;
  });
  corner.addEventListener('click', () => openControlCenter());
  scrim.addEventListener('click', closeControlCenter);

  $('#cc-dark').addEventListener('click', () => {
    State.dark = !State.dark; saveState(); applyAppearance();
  });
  $('#cc-dnd').addEventListener('click', () => {
    State.focus = !State.focus; saveState(); applyAppearance();
    if (State.focus) toast('Focus on — notifications silenced');
  });
  $('#cc-battery-saver').addEventListener('click', () => {
    State.lowPower = !State.lowPower; saveState(); applyAppearance();
    if (State.lowPower) toast('Low Power Mode on');
  });
  $('#cc-wallpaper').addEventListener('click', () => {
    if (State.customWallpaper) State.customWallpaper = null;
    const idx = WALLPAPERS.findIndex(w => w.id === State.wallpaper);
    State.wallpaper = WALLPAPERS[(idx + 1) % WALLPAPERS.length].id;
    saveState(); applyWallpaper();
    toast('Wallpaper: ' + WALLPAPERS.find(w => w.id === State.wallpaper).name);
  });
  $('#cc-lock-screen').addEventListener('click', () => lockScreen());
  $('#cc-settings').addEventListener('click', () => { closeControlCenter(); openApp('settings'); });

  $('#cc-brightness').addEventListener('input', e => {
    State.brightness = +e.target.value;
    saveState();
    $('#dim-layer').style.opacity = String((100 - State.brightness) / 145);
  });
  $('#cc-volume').addEventListener('input', e => {
    State.volume = +e.target.value;
    saveState();
  });
}

/* ---------------- Home bar & gestures ---------------- */
function initGestures() {
  const bar = $('#home-bar');
  let lastTap = 0;
  let swipeStartY = null;

  bar.addEventListener('pointerdown', e => { swipeStartY = e.clientY; });
  bar.addEventListener('pointerup', e => {
    const dy = (swipeStartY ?? e.clientY) - e.clientY;
    swipeStartY = null;
    if (dy > 30) { // swipe up → home
      goHome();
      return;
    }
    const now = Date.now();
    if (now - lastTap < 320) { // double tap → switcher
      lastTap = 0;
      $('#switcher').classList.contains('hidden') ? openSwitcher() : closeSwitcher();
      return;
    }
    lastTap = now;
    goHome(); // single tap → home
  });

  function goHome() {
    if (!$('#spotlight').classList.contains('hidden')) { closeSpotlight(); return; }
    if (!$('#switcher').classList.contains('hidden')) { closeSwitcher(); return; }
    if (!$('#control-center').classList.contains('open')) {
      closeCurrentApp();
    } else {
      closeControlCenter();
    }
  }

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if ($('#control-center').classList.contains('open')) { closeControlCenter(); return; }
      if (!$('#spotlight').classList.contains('hidden')) { closeSpotlight(); return; }
      if (!$('#switcher').classList.contains('hidden')) { closeSwitcher(); return; }
      if (!$('#lock-screen').classList.contains('hidden')) { unlock(); return; }
      closeCurrentApp();
    }
  });

  // spotlight typing
  const input = $('#spot-input');
  input.addEventListener('input', () => renderSpotlight(input.value));
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      const first = $('#spot-results .spot-row');
      if (first) first.click();
    }
  });
  $('#spotlight').addEventListener('click', (e) => {
    if (e.target.id === 'spotlight') closeSpotlight();
  });
  $('#switcher').addEventListener('click', (e) => {
    if (e.target.id === 'switcher') closeSwitcher();
  });
}

/* ---------------- Built-in apps ---------------- */

/* ---- App Store ---- */
Builtins.appstore = {
  name: 'App Store',
  icon: 'assets/icons/appstore.png',
  mount(el) {
    let filter = 'all';
    el.append(
      h('div', { class: 'app-header' },
        h('h1', {}, 'App Store'),
        h('div', { class: 'spacer' }),
        h('input', { type: 'text', placeholder: 'Search', style: 'width:190px',
          oninput: (e) => { render(e.target.value); } })
      ),
      h('div', { class: 'seg', style: 'margin:14px 20px' })
    );
    const seg = $('.seg', el);
    for (const [k, label] of [['all', 'All'], ['installed', 'Installed'], ['not-installed', 'Available']]) {
      seg.append(h('button', { class: k === 'all' ? 'active' : '', onclick: () => {
        filter = k;
        $$('button', seg).forEach(b => b.classList.remove('active'));
        seg.children[['all', 'installed', 'not-installed'].indexOf(k)].classList.add('active');
        render();
      } }, label));
    }
    const list = h('div', {});
    el.append(list);

    function matchesSearch(a, q) { return !q || (a.name + ' ' + (a.description || '')).toLowerCase().includes(q.toLowerCase()); }

    function render(query = '') {
      list.innerHTML = '';
      const apps = OS.catalog.filter(a => {
        if (!matchesSearch(a, query)) return false;
        const inst = State.installed.includes(a.id);
        return filter === 'all' || (filter === 'installed' ? inst : !inst);
      });
      if (!apps.length) {
        list.append(h('div', { style: 'padding:50px 20px;text-align:center;color:#8e8e93' },
          OS.catalog.length ? 'No apps match.' : 'Could not reach the catalog. Check your connection.'));
        return;
      }
      for (const app of apps) {
        const inst = State.installed.includes(app.id);
        const btn = inst
          ? h('button', { class: 'btn', onclick: () => { closeCurrentApp(); setTimeout(() => openApp(app.id), 120); } }, 'OPEN')
          : h('button', { class: 'btn', onclick: () => { installApp(app.id); render(); } }, 'GET');
        list.append(
          h('div', { class: 'list-row' },
            h('img', { src: `apps/${app.id}/icon.png`, style: 'width:58px;height:58px;border-radius:23%;box-shadow:0 3px 8px rgba(0,0,0,.18)' }),
            h('div', { style: 'flex:1;min-width:0' },
              h('div', { style: 'font-weight:700;font-size:16px' }, app.name),
              h('div', { style: 'font-size:12.5px;color:#8e8e93;margin-top:2px' }, (app.description || '').slice(0, 90)),
              h('div', { style: 'font-size:11.5px;color:#b0b0b5;margin-top:3px' },
                `${app.category || 'App'} · v${app.version || '1.0'} · by ${app.author || 'unknown'}`)
            ),
            btn
          )
        );
      }
    }
    render();
  },
};

/* ---- Settings ---- */
Builtins.settings = {
  name: 'Settings',
  icon: 'assets/icons/settings.png',
  mount(el) {
    el.append(h('div', { class: 'app-header' }, h('h1', {}, 'Settings')));

    const wpSection = h('div', { class: 'card', style: 'margin:16px max(20px, env(safe-area-inset-left))' });
    wpSection.append(h('div', { style: 'font-weight:800;font-size:13px;color:#8e8e93;text-transform:uppercase;letter-spacing:.6px' }, 'Wallpaper'));
    const grid = h('div', { style: 'display:grid;grid-template-columns:repeat(5,1fr);gap:10px;margin-top:12px' });
    for (const wp of WALLPAPERS) {
      grid.append(h('button', {
        style: `aspect-ratio:3/4;border-radius:10px;border:2.5px solid ${(!State.customWallpaper && State.wallpaper === wp.id) ? 'var(--accent)' : 'transparent'};background:${wp.css};cursor:pointer;padding:0`,
        title: wp.name,
        onclick: () => { State.wallpaper = wp.id; State.customWallpaper = null; saveState(); applyWallpaper(); rerender(); }
      }));
    }
    wpSection.append(grid);
    const urlRow = h('div', { style: 'display:flex;gap:8px;margin-top:12px' });
    const urlInput = h('input', { type: 'url', placeholder: 'Custom image URL…', value: State.customWallpaper?.url || '' });
    urlRow.append(urlInput);
    urlRow.append(h('button', { class: 'btn', onclick: () => {
      const url = urlInput.value.trim();
      if (!url) { toast('Enter a URL'); return; }
      State.customWallpaper = { url };
      saveState(); applyWallpaper(); rerender();
      toast('Wallpaper applied');
    } }, 'Apply'));
    wpSection.append(urlRow);
    el.append(wpSection);

    const apSection = h('div', { class: 'card', style: 'margin:0 20px 16px' });
    apSection.append(h('div', { style: 'font-weight:800;font-size:13px;color:#8e8e93;text-transform:uppercase;letter-spacing:.6px' }, 'Appearance & system'));
    const toggleRow = (label, key, after) => h('div', { style: 'display:flex;align-items:center;justify-content:space-between;margin-top:12px' },
      h('span', { style: 'font-size:15px;font-weight:600' }, label),
      h('button', { class: 'btn', onclick: () => { State[key] = !State[key]; saveState(); after?.(); rerender(); } },
        State[key] ? 'On' : 'Off')
    );
    apSection.append(toggleRow('Dark appearance', 'dark', applyAppearance));
    apSection.append(toggleRow('Focus (silence notifications)', 'focus', applyAppearance));
    apSection.append(toggleRow('Low Power Mode', 'lowPower', applyAppearance));
    apSection.append(h('button', { class: 'btn', style: 'margin-top:14px', onclick: () => lockScreen() }, 'Lock Now'));
    el.append(apSection);

    const stSection = h('div', { class: 'card', style: 'margin:0 20px 16px' });
    stSection.append(h('div', { style: 'font-weight:800;font-size:13px;color:#8e8e93;text-transform:uppercase;letter-spacing:.6px' }, 'About'));
    stSection.append(h('div', { style: 'margin-top:10px;font-size:13.5px;color:#666;line-height:1.6' },
      `Slate OS ${CONFIG.version} — a full-screen web OS for tablets.`,
      h('br'), `Installed apps: ${State.installed.length} · Recent apps tracked: ${State.recents.length}`, h('br'),
      `Press and hold any home screen icon to remove it. Swipe between pages; the first page holds widgets.`));
    stSection.append(h('button', { class: 'btn danger', style: 'margin-top:12px', onclick: () => {
      localStorage.removeItem(CONFIG.storageKey);
      localStorage.removeItem(CONFIG.legacyKey);
      location.reload();
    } }, 'Erase All Content & Settings'));
    el.append(stSection);

    function rerender() { el.innerHTML = ''; Builtins.settings.mount(el); }
  },
};

/* ---- Photos (wallpaper gallery) ---- */
Builtins.photos = {
  name: 'Photos',
  icon: 'assets/icons/photos.png',
  mount(el) {
    el.append(h('div', { class: 'app-header' }, h('h1', {}, 'Photos')));
    const grid = h('div', { style: 'display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:10px;padding:6px 20px 20px' });
    for (const wp of WALLPAPERS.filter(w => w.css.includes('url('))) {
      grid.append(h('div', {
        role: 'button', tabindex: 0,
        style: `aspect-ratio:3/4;border-radius:12px;background:${wp.css};cursor:pointer;border:2.5px solid ${(!State.customWallpaper && State.wallpaper === wp.id) ? 'var(--accent)' : 'transparent'}`,
        onclick: () => {
          State.wallpaper = wp.id; State.customWallpaper = null;
          saveState(); applyWallpaper();
          toast('Wallpaper set to ' + wp.name);
        }
      }));
    }
    el.append(h('div', { style: 'padding:12px 20px;font-size:13px;color:#8e8e93' }, 'Your wallpaper collection. Tap to set.'));
    el.append(grid);
  },
};

/* ---------------- Catalog discovery ---------------- */
async function fetchJSON(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(url + ' -> ' + r.status);
  return r.json();
}

/* Discover apps/ folders. Primary: GitHub contents API (auto — any new folder
   pushed to the repo appears). Fallback: apps/manifest.json (for local files). */
async function loadCatalog() {
  const apps = [];
  try {
    const { owner, name } = CONFIG.repo;
    const dirs = await fetchJSON(`https://api.github.com/repos/${owner}/${name}/contents/apps?ref=main`);
    const folders = dirs.filter(d => d.type === 'dir').map(d => d.name);
    const metas = await Promise.all(folders.map(f =>
      fetchJSON(`https://raw.githubusercontent.com/${owner}/${name}/main/apps/${f}/app.json`)
        .catch(() => null)
    ));
    for (const m of metas) if (m && m.id) apps.push(m);
  } catch (e) { /* offline / rate-limited — fall through */ }

  if (!apps.length) {
    try {
      const m = await fetchJSON('apps/manifest.json');
      apps.push(...(m.apps || []));
    } catch (e) { /* no catalog at all */ }
  }

  OS.catalog = apps;
  renderHome();
}

/* ---------------- Resize handling ---------------- */
let resizeTimer = null;
window.addEventListener('resize', () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => { if (!$('#home').classList.contains('hidden')) renderHome(); }, 250);
});

/* ---------------- Go ---------------- */
window.WebPadApps = {};
boot();
initControlCenter();
initGestures();
loadCatalog();
