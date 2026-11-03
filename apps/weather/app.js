/* Weather — WebPad external app. Live data via Open-Meteo (no key required). */
(function () {
  const style = document.createElement('style');
  style.textContent = `
    .wx-root { min-height: 100%; background: linear-gradient(180deg,#215e93,#3b7ea1 45%,#57a0b8); color:#fff; }
    .wx-hero { text-align: center; padding: 34px 20px 22px; }
    .wx-city { font-size: 22px; font-weight: 600; }
    .wx-temp { font-size: 84px; font-weight: 200; letter-spacing: -3px; margin: 2px 0; }
    .wx-cond { font-size: 17px; opacity: .95; }
    .wx-hilo { font-size: 15px; opacity: .85; margin-top: 4px; }
    .wx-grid { display: grid; grid-template-columns: repeat(3,1fr); gap: 10px; padding: 0 18px; margin-top: 8px; }
    .wx-cell { background: rgba(255,255,255,.14); border-radius: 14px; padding: 12px 8px; text-align: center; backdrop-filter: blur(4px); }
    .wx-cell .k { font-size: 11px; text-transform: uppercase; letter-spacing: .5px; opacity: .75; }
    .wx-cell .v { font-size: 18px; font-weight: 600; margin-top: 3px; }
    .wx-section { padding: 22px 20px 10px; }
    .wx-section h2 { font-size: 13px; text-transform: uppercase; letter-spacing: .6px; opacity: .8; margin-bottom: 10px; }
    .wx-day { display: flex; align-items: center; gap: 14px; padding: 10px 14px; background: rgba(255,255,255,.12); border-radius: 12px; margin-bottom: 7px; }
    .wx-day .d { width: 44px; font-weight: 600; }
    .wx-day .i { font-size: 22px; width: 34px; text-align: center; }
    .wx-day .bar { flex: 1; height: 5px; border-radius: 3px; background: rgba(255,255,255,.25); position: relative; }
    .wx-day .bar i { position: absolute; top: 0; bottom: 0; border-radius: 3px; background: linear-gradient(90deg,#ffd60a,#ff9f0a); }
    .wx-day .t { font-variant-numeric: tabular-nums; font-size: 15px; }
    .wx-day .lo { color: rgba(255,255,255,.6); }
    .wx-err { text-align:center; padding: 60px 24px; opacity:.9; }
    .wx-picker { display: flex; gap: 8px; flex-wrap: wrap; justify-content: center; padding: 4px 16px 0; }
    .wx-chip { border: 1px solid rgba(255,255,255,.5); background: rgba(255,255,255,.12); color: #fff; border-radius: 100px; padding: 6px 14px; font-size: 13.5px; font-weight: 600; cursor: pointer; }
    .wx-chip.on { background: #fff; color: #1c5d8c; border-color: #fff; }
  `;
  document.head.append(style);

  const CITIES = [
    { name: 'Dublin', lat: 53.35, lon: -6.26 },
    { name: 'London', lat: 51.51, lon: -0.13 },
    { name: 'New York', lat: 40.71, lon: -74.01 },
    { name: 'Tokyo', lat: 35.68, lon: 139.69 },
    { name: 'Sydney', lat: -33.87, lon: 151.21 },
    { name: 'San Francisco', lat: 37.77, lon: -122.42 },
  ];

  const WMO = {
    0: ['Clear sky', '☀️'], 1: ['Mainly clear', '🌤️'], 2: ['Partly cloudy', '⛅️'], 3: ['Overcast', '☁️'],
    45: ['Fog', '🌫️'], 48: ['Icy fog', '🌫️'],
    51: ['Light drizzle', '🌦️'], 53: ['Drizzle', '🌦️'], 55: ['Heavy drizzle', '🌧️'],
    61: ['Light rain', '🌦️'], 63: ['Rain', '🌧️'], 65: ['Heavy rain', '🌧️'],
    71: ['Light snow', '🌨️'], 73: ['Snow', '🌨️'], 75: ['Heavy snow', '❄️'], 77: ['Snow grains', '🌨️'],
    80: ['Showers', '🌦️'], 81: ['Showers', '🌧️'], 82: ['Violent showers', '⛈️'],
    85: ['Snow showers', '🌨️'], 86: ['Snow showers', '❄️'],
    95: ['Thunderstorm', '⛈️'], 96: ['Storm + hail', '⛈️'], 99: ['Storm + hail', '⛈️'],
  };
  const wmo = c => WMO[c] || ['—', '🌡️'];

  window.WebPadApps.weather = {
    mount(el, win, api) {
      el.classList.add('wx-root');
      const saved = api.storage.get('weather.city', 0);
      let cityIdx = CITIES.findIndex(c => c.name === saved?.name) >= 0 ? CITIES.findIndex(c => c.name === saved.name) : 0;

      const picker = document.createElement('div');
      picker.className = 'wx-picker';
      const hero = document.createElement('div');
      hero.className = 'wx-hero';
      const grid = document.createElement('div');
      grid.className = 'wx-grid';
      const section = document.createElement('div');
      section.className = 'wx-section';
      el.append(picker, hero, grid, section);

      function renderPicker() {
        picker.innerHTML = '';
        for (let i = 0; i < CITIES.length; i++) {
          const chip = document.createElement('button');
          chip.className = 'wx-chip' + (i === cityIdx ? ' on' : '');
          chip.textContent = CITIES[i].name;
          chip.addEventListener('click', () => { cityIdx = i; api.storage.set('weather.city', CITIES[i]); load(); });
          picker.append(chip);
        }
      }

      function bar(min, max, lo, hi) {
        const p = v => Math.max(0, Math.min(100, ((v - min) / Math.max(1, max - min)) * 100));
        return `<div class="bar"><i style="left:${p(lo)}%;width:${Math.max(4, p(hi) - p(lo))}%"></i></div>`;
      }

      async function load() {
        renderPicker();
        hero.innerHTML = `<div style="padding:40px;opacity:.7">Loading…</div>`;
        grid.innerHTML = ''; section.innerHTML = '';
        const c = CITIES[cityIdx];
        try {
          const url = `https://api.open-meteo.com/v1/forecast?latitude=${c.lat}&longitude=${c.lon}` +
            `&current=temperature_2m,weather_code,wind_speed_10m,relative_humidity_2m,apparent_temperature` +
            `&daily=weather_code,temperature_2m_max,temperature_2m_min&forecast_days=7&timezone=auto`;
          const r = await fetch(url);
          if (!r.ok) throw new Error('http ' + r.status);
          const d = await r.json();
          const [desc, icon] = wmo(d.current.weather_code);
          hero.innerHTML = `
            <div class="wx-city">${c.name}</div>
            <div class="wx-temp">${Math.round(d.current.temperature_2m)}°</div>
            <div class="wx-cond">${icon} ${desc}</div>
            <div class="wx-hilo">H:${Math.round(d.daily.temperature_2m_max[0])}° L:${Math.round(d.daily.temperature_2m_min[0])}° · feels ${Math.round(d.current.apparent_temperature)}°</div>`;
          grid.innerHTML = `
            <div class="wx-cell"><div class="k">Wind</div><div class="v">${Math.round(d.current.wind_speed_10m)} km/h</div></div>
            <div class="wx-cell"><div class="k">Humidity</div><div class="v">${d.current.relative_humidity_2m}%</div></div>
            <div class="wx-cell"><div class="k">Condition</div><div class="v">${icon}</div></div>`;
          section.innerHTML = '<h2>7-Day Forecast</h2>';
          const weekMin = Math.min(...d.daily.temperature_2m_min);
          const weekMax = Math.max(...d.daily.temperature_2m_max);
          const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
          for (let i = 0; i < 7; i++) {
            const [, di] = wmo(d.daily.weather_code[i]);
            const dt = new Date(d.daily.time[i]);
            section.innerHTML += `
              <div class="wx-day">
                <span class="d">${i === 0 ? 'Today' : days[dt.getDay()]}</span>
                <span class="i">${di}</span>
                <span class="t lo">${Math.round(d.daily.temperature_2m_min[i])}°</span>
                ${bar(weekMin, weekMax, d.daily.temperature_2m_min[i], d.daily.temperature_2m_max[i])}
                <span class="t">${Math.round(d.daily.temperature_2m_max[i])}°</span>
              </div>`;
          }
        } catch (e) {
          hero.innerHTML = `<div class="wx-err">Couldn’t reach the weather service.<br>Check your connection and try again.</div>`;
        }
      }

      load();
    },
  };
})();
