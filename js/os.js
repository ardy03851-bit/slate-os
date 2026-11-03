/* ============================================================
   WebPad OS — kernel
   A tiny "iPad" that runs in a browser tab.
   ============================================================ */
'use strict';

/* ---------------- Config ---------------- */
const CONFIG = {
  repo: { owner: 'ardy03851-bit', name: 'webpad' }, // live catalog discovery via GitHub API
  storageKey: 'webpad.state.v2',
  version: '1.0.0',
};

/* ---------------- Wallpapers ---------------- */
const WALLPAPERS = [
  { id: 'aurora',  name: 'Aurora',  css: 'url(assets/wallpapers/aurora.jpg) center/cover' },
  { id: 'sunset',  name: 'Sunset',  css: 'url(assets/wallpapers/sunset.jpg) center/cover' },
  { id: 'forest',  name: 'Forest',  css: 'url(assets/wallpapers/forest.jpg) center/cover' },
  { id: 'candy',   name: 'Candy',  css: 'url(assets/wallpapers/candy.jpg) center/cover' },
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
  installed: ['calculator', 'clock', 'notes', 'weather', 'game2048'],
  customWallpaper: null, // {url}
};

function saveState() {
  localStorage.setItem(CONFIG.storageKey, JSON.stringify(State));
}
function loadState() {
  try {
    const raw = localStorage.getItem(CONFIG.storageKey);
    if (raw) Object.assign(State, JSON.parse(raw));
  } catch (e) { /* fresh start */ }
}

/* ---------------- Utilities ---------------- */
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

function toast(msg, ms = 2200) {
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

/* ---------------- OS core ---------------- */
const OS = {
  currentApp: null,      // {id, kind: 'builtin'|'external', cleanup}
  loadedScripts: new Set(),
  catalog: [],           // external apps from apps/ folders
  editMode: false,
};

/* --- Built-in apps registry --- */
const Builtins = {}; // id -> {name, icon, mount(el), dark?}

/* --- Clock --- */
function tickClock() {
  const now = new Date();
  const time = now.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  $('#sb-time').textContent = time;
  const lt = $('#lock-time');
  if (lt) lt.textContent = time;
  const ld = $('#lock-date');
  if (ld) ld.textContent = now.toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'long' });
}
setInterval(tickClock, 1000);
tickClock();

/* --- Battery (simulated, real if supported) --- */
async function initBattery() {
  try {
    const b = await navigator.getBattery?.() || await navigator.battery;
    if (b) {
      const upd = () => { $('#sb-batt').textContent = Math.round(b.level * 100) + '%'; };
      upd();
      b.addEventListener('levelchange', upd);
      return;
    }
  } catch (e) { /* fall through */ }
  // graceful simulation
  let level = 87;
  setInterval(() => {
    level = Math.max(12, level - 1);
    $('#sb-batt').textContent = level + '%';
  }, 90000);
}

/* --- Wallpaper --- */
function applyWallpaper() {
  const wp = State.customWallpaper
    ? { css: `url("${State.customWallpaper.url}") center/cover` }
    : (WALLPAPERS.find(w => w.id === State.wallpaper) || WALLPAPERS[0]);
  for (const el of [$('#home-screen'), $('#lock-screen')]) {
    el.style.setProperty('--wp', wp.css);
    el.style.background = wp.css;
  }
}

/* --- Boot / lock / unlock --- */
function boot() {
  loadState();
  applyWallpaper();
  initBattery();
  $('#dim-layer').style.opacity = String((100 - State.brightness) / 145);
  document.body.classList.toggle('dark', State.dark);

  setTimeout(() => {
    $('#boot-screen').classList.add('hidden');
    $('#lock-screen').classList.remove('hidden');
  }, 2400);

  // unlock: drag up or click
  const ls = $('#lock-screen');
  let startY = null;
  ls.addEventListener('pointerdown', e => { startY = e.clientY; });
  ls.addEventListener('pointerup', e => {
    if (startY == null) return;
    const dy = startY - e.clientY;
    if (dy > 40 || dy === 0) unlock(); // drag up OR simple tap
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
    $('#home-screen').classList.remove('hidden');
    renderHome();
  }, 480);
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
  // long-press for edit mode
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

function renderHome() {
  const grid = $('#icon-grid');
  grid.innerHTML = '';

  // built-ins live on the home screen
  for (const id of ['photos', 'settings']) {
    const app = Builtins[id];
    grid.append(makeIcon({ id, name: app.name, iconSrc: app.icon, onOpen: () => openBuiltin(id), removable: false }));
  }

  // installed external apps (dock apps are excluded from the main grid)
  for (const app of installedExternals()) {
    if (DOCK_EXTERNALS.includes(app.id)) continue;
    grid.append(makeIcon({
      id: app.id, name: app.name,
      iconSrc: `apps/${app.id}/icon.png`,
      onOpen: () => openExternal(app),
      removable: true,
    }));
  }

  // dock: app store + clock + calculator + notes (as available)
  const dock = $('#dock');
  dock.innerHTML = '';
  const dockApps = ['appstore', ...['clock', 'calculator', 'notes'].filter(id => State.installed.includes(id))];
  for (const id of dockApps) {
    if (id === 'appstore') {
      const app = Builtins.appstore;
      dock.append(makeIcon({ id, name: app.name, iconSrc: app.icon, onOpen: () => openBuiltin('appstore'), removable: false }));
    } else {
      const app = appById(id);
      if (app) dock.append(makeIcon({ id, name: app.name, iconSrc: `apps/${app.id}/icon.png`, onOpen: () => openExternal(app), removable: false }));
    }
  }
}

function setEditMode(on) {
  OS.editMode = on;
  $('#home-screen').classList.toggle('editing', on);
  if (on) {
    toast('Tap an app to remove it. Tap the background to finish.');
    const done = () => { setEditMode(false); };
    setTimeout(() => {
      $('#home-screen').addEventListener('click', function bg(e) {
        if (e.target.id === 'home-screen' || e.target.id === 'icon-grid') {
          $('#home-screen').removeEventListener('click', bg);
          done();
        }
      });
    }, 50);
  }
}

/* ---------------- App lifecycle ---------------- */
function closeCurrentApp() {
  if (!OS.currentApp) return;
  try { OS.currentApp.cleanup?.(); } catch (e) { /* ignore */ }
  OS.currentApp = null;
  $('#screen').classList.remove('in-app', 'app-dark');
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
  $('#screen').classList.add('in-app');
  $('#screen').classList.toggle('app-dark', dark);
  return { win, content };
}

function openBuiltin(id) {
  const app = Builtins[id];
  if (!app) return;
  closeCurrentApp();
  const { win, content } = mountWindow(app.dark);
  let cleanup = null;
  try {
    cleanup = app.mount(content, win) || null;
  } catch (e) {
    content.append(h('div', { style: 'padding:40px;color:#888' }, 'This app crashed: ' + e.message));
  }
  OS.currentApp = { id, kind: 'builtin', cleanup };
}

async function openExternal(app) {
  closeCurrentApp();
  if (!OS.loadedScripts.has(app.id)) {
    try {
      await loadScript(`apps/${app.id}/app.js`);
      OS.loadedScripts.add(app.id);
    } catch (e) {
      toast('Could not launch ' + app.name);
      return;
    }
  }
  const def = window.WebPadApps?.[app.id];
  if (!def) { toast('App entry point missing'); return; }
  const { win, content } = mountWindow(!!def.dark);
  let cleanup = null;
  try {
    cleanup = def.mount(content, win, WebPadAPI) || null;
  } catch (e) {
    content.append(h('div', { style: 'padding:40px;color:#888' }, 'This app crashed: ' + e.message));
  }
  OS.currentApp = { id: app.id, kind: 'external', cleanup };
}

/* API handed to external apps */
const WebPadAPI = {
  close: () => closeCurrentApp(),
  toast,
  storage: {
    get(key, fallback = null) {
      try { const v = localStorage.getItem('webpad.app.' + key); return v == null ? fallback : JSON.parse(v); } catch { return fallback; }
    },
    set(key, value) { localStorage.setItem('webpad.app.' + key, JSON.stringify(value)); },
  },
  get state() { return State; },
  wallpapers: WALLPAPERS,
  applyWallpaper,
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
  saveState();
  setEditMode(false);
  renderHome();
  toast('App removed');
}

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
  // 1) GitHub API
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

  // 2) manifest fallback
  if (!apps.length) {
    try {
      const m = await fetchJSON('apps/manifest.json');
      apps.push(...(m.apps || []));
    } catch (e) { /* no catalog at all */ }
  }

  OS.catalog = apps;
  renderHome();
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
        h('input', { type: 'text', placeholder: 'Search', style: 'width:180px',
          oninput: (e) => { render(e.target.value); } })
      ),
      h('div', { class: 'seg', style: 'margin:14px 20px; display:inline-flex' })
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
          ? h('button', { class: 'btn', onclick: () => { WebPadAPI.close(); setTimeout(() => openExternal(app), 100); } }, 'OPEN')
          : h('button', { class: 'btn', onclick: () => { installApp(app.id); render(); } }, 'GET');
        list.append(
          h('div', { class: 'list-row' },
            h('img', { src: `apps/${app.id}/icon.png`, style: 'width:56px;height:56px;border-radius:13px;box-shadow:0 3px 8px rgba(0,0,0,.18)' }),
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

    // Wallpaper
    const wpSection = h('div', { class: 'card', style: 'margin:16px 20px' });
    wpSection.append(h('div', { style: 'font-weight:800;font-size:13px;color:#8e8e93;text-transform:uppercase;letter-spacing:.6px' }, 'Wallpaper'));
    const grid = h('div', { style: 'display:grid;grid-template-columns:repeat(5,1fr);gap:10px;margin-top:12px' });
    for (const wp of WALLPAPERS) {
      const thumb = h('button', {
        style: `aspect-ratio:3/4;border-radius:10px;border:2.5px solid ${(!State.customWallpaper && State.wallpaper === wp.id) ? '#007aff' : 'transparent'};background:${wp.css};cursor:pointer;padding:0`,
        title: wp.name,
        onclick: () => {
          State.wallpaper = wp.id; State.customWallpaper = null;
          saveState(); applyWallpaper(); renderSettings();
        }
      });
      grid.append(thumb);
    }
    wpSection.append(grid);

    // custom URL
    const urlRow = h('div', { style: 'display:flex;gap:8px;margin-top:12px' });
    const urlInput = h('input', { type: 'url', placeholder: 'Custom image URL…', value: State.customWallpaper?.url || '' });
    urlRow.append(urlInput);
    urlRow.append(h('button', { class: 'btn', onclick: () => {
      const url = urlInput.value.trim();
      if (!url) { toast('Enter a URL'); return; }
      State.customWallpaper = { url };
      saveState(); applyWallpaper(); renderSettings();
      toast('Wallpaper applied');
    } }, 'Apply'));
    wpSection.append(urlRow);
    el.append(wpSection);

    // Appearance
    const apSection = h('div', { class: 'card', style: 'margin:0 20px 16px' });
    apSection.append(h('div', { style: 'font-weight:800;font-size:13px;color:#8e8e93;text-transform:uppercase;letter-spacing:.6px' }, 'Appearance'));
    const row1 = h('div', { style: 'display:flex;align-items:center;justify-content:space-between;margin-top:12px' },
      h('span', { style: 'font-size:15px;font-weight:600' }, 'Dark home screen tint'),
      h('button', { class: 'btn', onclick: () => {
        State.dark = !State.dark; saveState();
        document.body.classList.toggle('dark', State.dark);
        toast(State.dark ? 'Dark mode on' : 'Dark mode off');
      } }, State.dark ? 'On' : 'Off')
    );
    apSection.append(row1);
    el.append(apSection);

    // Storage / reset
    const stSection = h('div', { class: 'card', style: 'margin:0 20px 16px' });
    stSection.append(h('div', { style: 'font-weight:800;font-size:13px;color:#8e8e93;text-transform:uppercase;letter-spacing:.6px' }, 'About'));
    stSection.append(h('div', { style: 'margin-top:10px;font-size:13.5px;color:#666;line-height:1.6' },
      `WebPad OS ${CONFIG.version} — a tiny iPad that lives in your browser.`,
      h('br'), `Installed apps: ${State.installed.length}`, h('br'),
      `Tap and hold a home screen icon to rearrange/remove.`));
    stSection.append(h('button', { class: 'btn danger', style: 'margin-top:12px', onclick: () => {
      localStorage.removeItem(CONFIG.storageKey);
      location.reload();
    } }, 'Reset WebPad'));
    el.append(stSection);

    function renderSettings() {
      el.innerHTML = '';
      Builtins.settings.mount(el);
    }
  },
};

/* ---- Photos (wallpaper gallery) ---- */
Builtins.photos = {
  name: 'Photos',
  icon: 'assets/icons/photos.png',
  mount(el) {
    el.append(h('div', { class: 'app-header' }, h('h1', {}, 'Photos')));
    const grid = h('div', { style: 'display:grid;grid-template-columns:repeat(3,1fr);gap:6px;padding:6px' });
    for (const wp of WALLPAPERS.filter(w => w.css.includes('url('))) {
      grid.append(h('div', {
        role: 'button', tabindex: 0,
        style: `aspect-ratio:3/4;border-radius:8px;background:${wp.css};cursor:pointer`,
        onclick: () => {
          State.wallpaper = wp.id; State.customWallpaper = null;
          saveState(); applyWallpaper();
          toast('Wallpaper set to ' + wp.name);
        }
      }));
    }
    el.append(h('div', { style: 'padding:12px 20px;font-size:13px;color:#8e8e93' }, 'Tap a wallpaper to set it.'));
    el.append(grid);
  },
};

/* ---------------- Control center ---------------- */
function initControlCenter() {
  const cc = $('#control-center'), scrim = $('#cc-scrim');
  const open = () => { scrim.classList.add('show'); cc.classList.add('open'); };
  const close = () => { cc.classList.remove('open'); scrim.classList.remove('show'); };

  // top-right corner of the screen toggles it (like swiping from the corner)
  let corner = document.createElement('div');
  corner.style.cssText = 'position:absolute;top:0;right:0;width:22%;height:30px;z-index:149;cursor:pointer;';
  $('#screen').append(corner);
  corner.addEventListener('click', () => cc.classList.contains('open') ? close() : open());
  scrim.addEventListener('click', close);

  $('#cc-dark').addEventListener('click', (e) => {
    State.dark = !State.dark; saveState();
    document.body.classList.toggle('dark', State.dark);
    e.currentTarget.classList.toggle('on', State.dark);
  });
  if (State.dark) $('#cc-dark').classList.add('on');

  $('#cc-wallpaper').addEventListener('click', () => {
    if (State.customWallpaper) State.customWallpaper = null;
    const idx = WALLPAPERS.findIndex(w => w.id === State.wallpaper);
    State.wallpaper = WALLPAPERS[(idx + 1) % WALLPAPERS.length].id;
    saveState(); applyWallpaper();
    toast('Wallpaper: ' + (WALLPAPERS.find(w => w.id === State.wallpaper)).name);
  });

  $('#cc-brightness').addEventListener('input', (e) => {
    State.brightness = +e.target.value;
    saveState();
    $('#dim-layer').style.opacity = String((100 - State.brightness) / 145);
  });
  $('#cc-brightness').value = State.brightness;
}

/* ---------------- Home button & keyboard ---------------- */
function initButtons() {
  $('#home-btn').addEventListener('click', () => {
    if (!$('#control-center').classList.contains('open')) {
      if (OS.editMode) { setEditMode(false); return; }
      closeCurrentApp();
    }
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if ($('#control-center').classList.contains('open')) { $('#cc-scrim').click(); return; }
      if (!$('#lock-screen').classList.contains('hidden')) { unlock(); return; }
      closeCurrentApp();
    }
  });
}

/* ---------------- Go ---------------- */
window.WebPadApps = {};
boot();
initControlCenter();
initButtons();
loadCatalog();
