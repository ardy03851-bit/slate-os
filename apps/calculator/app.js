/* Calculator — WebPad external app */
(function () {
  const style = document.createElement('style');
  style.textContent = `
    .calc-root { height: 100%; display: flex; flex-direction: column; background: #000; color: #fff; padding: 30px 18px 18px; }
    .calc-display { flex: 1; display: flex; flex-direction: column; justify-content: flex-end; align-items: flex-end; padding: 0 12px 16px; min-height: 90px; }
    .calc-history { font-size: 15px; color: #8e8e93; min-height: 20px; }
    .calc-value { font-size: clamp(48px, 9vw, 76px); font-weight: 300; letter-spacing: -2px; line-height: 1.1; word-break: break-all; text-align: right; }
    .calc-pad { display: grid; grid-template-columns: repeat(4, minmax(52px, 88px)); gap: 12px; justify-content: center; }
    .calc-btn { border: none; border-radius: 50%; font-family: inherit; font-size: 26px; font-weight: 500; color: #fff; background: #333333; cursor: pointer; transition: filter .1s, transform .08s; width: 100%; aspect-ratio: 1; align-self: center; }
    .calc-btn:active { transform: scale(.94); }
    .calc-btn.fn { background: #a5a5a5; color: #000; }
    .calc-btn.op { background: #ff9f0a; }
    .calc-btn.op.active { background: #fff; color: #ff9f0a; }
    .calc-btn.zero { grid-column: span 2; aspect-ratio: 2.08; border-radius: 100px; text-align: left; padding-left: 30px; }
  `;
  document.head.append(style);

  window.WebPadApps.calculator = {
    mount(el) {
      let current = '0';
      let previous = null;
      let op = null;
      let justEvaluated = false;

      el.classList.add('calc-root');
      const history = document.createElement('div');
      history.className = 'calc-history';
      const value = document.createElement('div');
      value.className = 'calc-value';
      const display = document.createElement('div');
      display.className = 'calc-display';
      display.append(history, value);
      el.append(display);

      const pad = document.createElement('div');
      pad.className = 'calc-pad';
      el.append(pad);

      const fmt = (n) => {
        if (typeof n !== 'number' || !isFinite(n)) return String(n);
        const s = String(Math.round(n * 1e10) / 1e10);
        const [i, d] = s.split('.');
        return (+i).toLocaleString('en-US') + (d ? '.' + d : '');
      };

      function render() {
        value.textContent = fmt(current);
        history.textContent = previous != null ? `${fmt(previous)} ${op || ''}` : '';
        pad.querySelectorAll('.op').forEach(b => b.classList.toggle('active', b.dataset.k === op));
      }

      function input(k) {
        if (/[0-9]/.test(k)) {
          if (justEvaluated) { current = '0'; justEvaluated = false; }
          current = current === '0' ? k : (current.replace(/\./g, '').length < 12 ? current + k : current);
        } else if (k === '.') {
          if (justEvaluated) { current = '0'; justEvaluated = false; }
          if (!current.includes('.')) current += '.';
        } else if (k === 'AC') {
          current = '0'; previous = null; op = null;
        } else if (k === '±') {
          current = current.startsWith('-') ? current.slice(1) : '-' + current;
        } else if (k === '%') {
          current = String(parseFloat(current) / 100);
        } else if (k === '√') {
          current = String(Math.sqrt(parseFloat(current)));
          justEvaluated = true;
        } else if (['+', '−', '×', '÷'].includes(k)) {
          if (op && previous != null && !justEvaluated) { current = String(compute()); }
          previous = parseFloat(current);
          op = k;
          justEvaluated = true;
        } else if (k === '=') {
          if (op && previous != null) {
            current = String(compute());
            previous = null; op = null;
            justEvaluated = true;
          }
        }
        render();
      }

      function compute() {
        const a = previous, b = parseFloat(current);
        let r = b;
        if (op === '+') r = a + b;
        if (op === '−') r = a - b;
        if (op === '×') r = a * b;
        if (op === '÷') r = b === 0 ? NaN : a / b;
        return r;
      }

      const keys = [
        ['AC', 'fn'], ['±', 'fn'], ['%', 'fn'], ['÷', 'op'],
        ['7'], ['8'], ['9'], ['×', 'op'],
        ['4'], ['5'], ['6'], ['−', 'op'],
        ['1'], ['2'], ['3'], ['+', 'op'],
        ['0', 'zero'], ['.'], ['=', 'op'],
      ];
      for (const [k, cls = ''] of keys) {
        const b = document.createElement('button');
        b.className = 'calc-btn ' + cls;
        b.textContent = k;
        b.dataset.k = k;
        b.addEventListener('click', () => input(k));
        pad.append(b);
      }

      const onKey = (e) => {
        const map = { '/': '÷', '*': '×', '-': '−', '+': '+', 'Enter': '=', '=': '=', 'Escape': 'AC', 'Backspace': 'AC', '.': '.', ',': '.' };
        if (/^[0-9]$/.test(e.key)) input(e.key);
        else if (map[e.key]) input(map[e.key]);
      };
      document.addEventListener('keydown', onKey);

      render();
      return () => document.removeEventListener('keydown', onKey);
    },
  };
})();
