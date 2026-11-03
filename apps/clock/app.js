/* Clock — WebPad external app */
(function () {
  const style = document.createElement('style');
  style.textContent = `
    .clock-root { background: #000; color: #fff; min-height: 100%; }
    .clock-wrap { display: flex; flex-direction: column; align-items: center; padding: 18px 0 30px; }
    .clock-canvas-wrap { position: relative; width: min(46%, 240px); aspect-ratio: 1; margin: 6px 0 14px; }
    .clock-digital { font-size: clamp(40px, 7vw, 58px); font-weight: 200; letter-spacing: -1px; }
    .clock-seconds { color: #ff9f0a; font-size: .5em; vertical-align: super; margin-left: 6px; font-weight: 400; }
    .clock-sub { color: #8e8e93; font-size: 14px; margin-top: 2px; }
    .clock-section { margin: 8px 20px 16px; }
    .clock-section h2 { font-size: 13px; text-transform: uppercase; letter-spacing: .6px; color: #8e8e93; margin: 0 0 8px 4px; }
    .wc-row { display: flex; justify-content: space-between; align-items: center; padding: 13px 18px; background: #1c1c1e; border-radius: 14px; margin-bottom: 8px; }
    .wc-row .wc-city { font-size: 17px; font-weight: 600; }
    .wc-row .wc-meta { color: #8e8e93; font-size: 12.5px; margin-top: 1px; }
    .wc-row .wc-time { font-size: 30px; font-weight: 300; font-variant-numeric: tabular-nums; }
    .wc-row .wc-time.night { color: #ffd60a; }
  `;
  document.head.append(style);

  window.WebPadApps.clock = {
    mount(el) {
      el.classList.add('clock-root');
      el.append(
        Object.assign(document.createElement('div'), { className: 'clock-wrap' }),
      );
      const wrap = el.querySelector('.clock-wrap');
      const canvas = document.createElement('canvas');
      const cwrap = document.createElement('div');
      cwrap.className = 'clock-canvas-wrap';
      cwrap.append(canvas);
      const digital = document.createElement('div');
      digital.style.cssText = 'font-size:clamp(40px,7vw,58px);font-weight:200';
      const sub = document.createElement('div');
      sub.className = 'clock-sub';
      wrap.append(cwrap, digital, sub);

      // world clocks
      const cities = [
        { name: 'Dublin', tz: 'Europe/Dublin' },
        { name: 'London', tz: 'Europe/London' },
        { name: 'New York', tz: 'America/New_York' },
        { name: 'San Francisco', tz: 'America/Los_Angeles' },
        { name: 'Tokyo', tz: 'Asia/Tokyo' },
        { name: 'Sydney', tz: 'Australia/Sydney' },
      ];
      const section = document.createElement('div');
      section.className = 'clock-section';
      section.append(Object.assign(document.createElement('h2'), { textContent: 'World Clock' }));
      const rows = cities.map(c => {
        const row = document.createElement('div');
        row.className = 'wc-row';
        row.innerHTML = `<div><div class="wc-city"></div><div class="wc-meta"></div></div><div class="wc-time"></div>`;
        section.append(row);
        return row;
      });
      el.append(section);

      function draw() {
        const now = new Date();
        const dpr = window.devicePixelRatio || 1;
        const size = cwrap.clientWidth;
        if (canvas.width !== size * dpr) { canvas.width = size * dpr; canvas.height = size * dpr; canvas.style.width = size + 'px'; canvas.style.height = size + 'px'; }
        const ctx = canvas.getContext('2d');
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.clearRect(0, 0, size, size);
        const cx = size / 2, cy = size / 2, r = size / 2 - 4;

        // face
        ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.fillStyle = '#1c1c1e'; ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,.15)'; ctx.lineWidth = 2; ctx.stroke();

        // ticks
        for (let i = 0; i < 60; i++) {
          const a = (i / 60) * Math.PI * 2;
          const len = i % 5 === 0 ? 10 : 5;
          ctx.beginPath();
          ctx.moveTo(cx + Math.sin(a) * (r - 6), cy - Math.cos(a) * (r - 6));
          ctx.lineTo(cx + Math.sin(a) * (r - 6 - len), cy - Math.cos(a) * (r - 6 - len));
          ctx.strokeStyle = i % 5 === 0 ? 'rgba(255,255,255,.8)' : 'rgba(255,255,255,.3)';
          ctx.lineWidth = i % 5 === 0 ? 2.5 : 1.2;
          ctx.stroke();
        }

        const ms = now.getMilliseconds() / 1000;
        const s = now.getSeconds() + ms;
        const m = now.getMinutes() + s / 60;
        const hr = (now.getHours() % 12) + m / 60;

        const hand = (angle, length, width, color, cap = 'round') => {
          ctx.beginPath();
          ctx.moveTo(cx - Math.sin(angle) * length * 0.18, cy + Math.cos(angle) * length * 0.18);
          ctx.lineTo(cx + Math.sin(angle) * length, cy - Math.cos(angle) * length);
          ctx.strokeStyle = color; ctx.lineWidth = width; ctx.lineCap = cap;
          ctx.stroke();
        };

        hand((hr / 12) * Math.PI * 2, r * 0.5, 6, '#fff');
        hand((m / 60) * Math.PI * 2, r * 0.72, 4, '#fff');
        hand((s / 60) * Math.PI * 2, r * 0.82, 1.6, '#ff9f0a');

        ctx.beginPath(); ctx.arc(cx, cy, 5, 0, Math.PI * 2); ctx.fillStyle = '#ff9f0a'; ctx.fill();

        digital.innerHTML = `${now.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}<span class="clock-seconds">${String(now.getSeconds()).padStart(2, '0')}</span>`;
        sub.textContent = now.toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'long' });

        for (let i = 0; i < cities.length; i++) {
          const c = cities[i], row = rows[i];
          const time = new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit', timeZone: c.tz }).format(now);
          const hour24 = +new Intl.DateTimeFormat('en-US', { hour: 'numeric', hour12: false, timeZone: c.tz }).format(now).replace(/\D/g, '');
          const day = new Intl.DateTimeFormat('en-US', { weekday: 'short', timeZone: c.tz }).format(now);
          const isNight = hour24 >= 20 || hour24 < 6;
          row.querySelector('.wc-city').textContent = c.name;
          row.querySelector('.wc-meta').textContent = (isNight ? 'Night' : 'Day') + ' · ' + day;
          row.querySelector('.wc-time').textContent = time;
          row.querySelector('.wc-time').classList.toggle('night', isNight);
        }
      }

      draw();
      const iv = setInterval(draw, 50);
      const onResize = () => draw();
      window.addEventListener('resize', onResize);
      return () => { clearInterval(iv); window.removeEventListener('resize', onResize); };
    },
  };
})();
