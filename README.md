# WebPad — a tiny iPad that lives in your browser

WebPad is a custom, web-based tablet UI. Launch it and you get a full iPad experience inside a device frame: boot screen, lock screen, home screen with a dock, control center, working apps, an App Store, and persistent settings — all in a single static site.

**Not affiliated with Apple.** It's an original, custom-built tablet OS with its own look and feel.

## Features

- Boot animation → lock screen (swipe or tap to unlock) → home screen
- Live status bar (real clock, real battery level where supported)
- 10 wallpapers (6 generated photographic-style, 4 gradients) + custom image URL wallpaper
- Control Center: brightness, dark mode, wallpaper cycling (click the top-right corner of the screen)
- Jiggle mode: press and hold any home-screen icon to remove apps
- App Store with install / uninstall — installed apps persist across visits (localStorage)
- Home button that closes apps, just like the real thing

## Built-in apps

| App | What it does |
| --- | --- |
| **App Store** | Browses every app in `apps/`, installs and uninstalls them |
| **Settings** | Wallpaper picker, custom wallpaper URL, dark mode, reset |
| **Photos** | Wallpaper gallery — tap to set |

## The `apps/` folder (how to add an app)

Every third-party app is just a folder inside `apps/`:

```
apps/
  myapp/
    app.json    # metadata: id, name, description, category, version, author
    icon.png    # 256×256 icon (rounded corners are applied by the OS)
    app.js      # the app itself
```

`app.json`:
```json
{ "id": "myapp", "name": "My App", "version": "1.0.0",
  "author": "You", "category": "Utilities",
  "description": "What it does." }
```

`app.js` registers itself when loaded — the OS injects your folder automatically:

```js
window.WebPadApps.myapp = {
  mount(el, win, api) {
    // el: your root element (scrollable content area)
    // api.close(), api.toast(msg), api.storage.get/set(key, value),
    // api.wallpapers, api.applyWallpaper()
    el.innerHTML = "<h1>Hello</h1>";
  },
};
```

Drop the folder in, push, and it appears in the App Store. Discovery works two ways:

1. **GitHub API** (primary) — the site lists the repo's `apps/` directory live, so a new folder shows up with no build step.
2. **`apps/manifest.json`** (fallback) — regenerate it after adding an app locally with `node build.js`.

## Included starter apps

- **Calculator** — full keyboard support
- **Clock** — live analog clock + world clocks
- **Notes** — autosaving notes (localStorage)
- **Weather** — live conditions + 7-day forecast via [Open-Meteo](https://open-meteo.com)
- **2048** — swipe or arrow keys

## Run it

Any static server works:

```bash
npx serve .          # or: python3 -m http.server
```

Opening `index.html` directly from disk works too (the manifest fallback is used).

## Deploy

It's a static site — GitHub Pages, Netlify, Vercel, any host. This repo is deployed on GitHub Pages from the `main` branch root.
