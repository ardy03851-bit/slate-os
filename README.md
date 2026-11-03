# Slate OS

A serious, full-screen web operating system for tablets. Open it on an iPad, add it to your home screen, and it runs full-bleed like a native app: swipeable home pages with widgets, Spotlight search, an app switcher, a control center, and a real app framework with an App Store.

Built from scratch — original design, original code. No frameworks, no build step for the OS itself, no dependencies.

## What's inside

**Shell**
- Full-screen layout with safe-area support (notches and home indicators respected)
- Boot splash → lock screen (with live weather line) → home
- Swipeable home pages with snap scrolling: a widgets page plus automatic icon pages
- Widgets: clock, live weather, notes preview, system status — all tappable
- Spotlight search: search icon in the dock, type to filter apps or search the web
- App switcher: double-tap the home bar (or swipe up and tap) — recents as cards
- Control center: pull down from the top-right corner — brightness, volume, dark appearance, Focus, Low Power Mode, wallpaper cycling, lock
- Home bar gestures: tap to go home, double-tap for the switcher, swipe up to close
- 10 wallpapers + custom URL wallpaper, persistent settings, jiggle mode (press and hold an icon to remove it)
- PWA manifest — "Add to Home Screen" on a real iPad runs it standalone, no browser chrome

**Built-in apps**: App Store, Settings, Photos

**App framework — the `apps/` folder**

Every installable app is a folder inside `apps/`:

```
apps/
  myapp/
    app.json    # metadata: id, name, description, category, version, author
    icon.png    # 256×256 icon
    app.js      # the app itself
```

`app.json`:
```json
{ "id": "myapp", "name": "My App", "version": "1.0.0",
  "author": "You", "category": "Utilities",
  "description": "What it does." }
```

`app.js` registers itself when loaded:

```js
window.WebPadApps.myapp = {
  mount(el, win, api) {
    // el: your scrollable root element
    // api.close(), api.toast(msg), api.storage.get/set(key, value),
    // api.refreshHome(), api.wallpapers, api.applyWallpaper()
    el.innerHTML = "<h1>Hello</h1>";
  },
};
```

Drop the folder in, push, and it appears in the App Store — no OS changes needed. Discovery works two ways:

1. **GitHub API** (primary) — the App Store lists the repo's `apps/` directory live, so a new folder shows up with no build step.
2. **`apps/manifest.json`** (fallback) — regenerate after adding an app locally with `node build.js`.

## Included apps

- **Calculator** — full keyboard support, adaptive layout
- **Clock** — live analog clock + world clocks
- **Notes** — autosaving notes (localStorage)
- **Weather** — live conditions + 7-day forecast via [Open-Meteo](https://open-meteo.com)
- **2048** — swipe or arrow keys

## Run it

Any static server works:

```bash
npx serve .          # or: python3 -m http.server
```

Opening `index.html` directly from disk works too (the manifest fallback is used for the catalog).

## Deploy

It's a static site — GitHub Pages, Netlify, Vercel, any host. This repo is deployed on GitHub Pages from the `main` branch root: https://ardy03851-bit.github.io/slate-os/

## Tips

- Everything persists in localStorage (installed apps, wallpaper, recents, notes, high scores)
- Settings → "Erase All Content & Settings" resets everything
- Regenerate the artwork with `python3 tools/gen_assets.py` and `python3 tools/gen_logo.py`
