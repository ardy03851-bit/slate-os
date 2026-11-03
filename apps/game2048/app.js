/* 2048 — WebPad external app */
(function () {
  const style = document.createElement('style');
  style.textContent = `
    .g2048-root { min-height: 100%; background: #faf8ef; display: flex; flex-direction: column; align-items: center; padding: 26px 20px 20px; user-select: none; }
    .g2048-head { width: 100%; max-width: 460px; display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px; }
    .g2048-title { font-size: 42px; font-weight: 800; color: #776e65; letter-spacing: -1px; }
    .g2048-scores { display: flex; gap: 8px; }
    .g2048-scorebox { background: #bbada0; color: #fff; border-radius: 10px; padding: 6px 16px; text-align: center; min-width: 74px; }
    .g2048-scorebox .k { font-size: 10.5px; text-transform: uppercase; letter-spacing: .8px; color: #eee4da; }
    .g2048-scorebox .v { font-size: 20px; font-weight: 700; font-variant-numeric: tabular-nums; }
    .g2048-new { border: none; cursor: pointer; font-family: inherit; background: #8f7a66; color: #fff; font-size: 15px; font-weight: 700; border-radius: 10px; padding: 11px 18px; margin-bottom: 16px; }
    .g2048-board { position: relative; width: min(88%, 420px); aspect-ratio: 1; background: #bbada0; border-radius: 12px; touch-action: none; }
    .g2048-cell, .g2048-tile { position: absolute; width: calc((100% - 5 * 10px) / 4); height: calc((100% - 5 * 10px) / 4); border-radius: 8px; }
    .g2048-cell { background: rgba(238,228,218,.35); }
    .g2048-tile { display: flex; align-items: center; justify-content: center; font-size: clamp(20px, 5.5vw, 34px); font-weight: 800; color: #776e65; transition: transform .12s ease; }
    .g2048-over { position: absolute; inset: 0; border-radius: 12px; background: rgba(238,228,218,.78); display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 12px; color: #776e65; z-index: 5; }
    .g2048-over .big { font-size: 34px; font-weight: 800; }
    .g2048-hint { margin-top: 14px; color: #a09585; font-size: 13px; }
  `;
  document.head.append(style);

  const COLORS = {
    2: '#eee4da', 4: '#ede0c8', 8: '#f2b179', 16: '#f59563', 32: '#f67c5f', 64: '#f65e3b',
    128: '#edcf72', 256: '#edcc61', 512: '#edc850', 1024: '#edc53f', 2048: '#edc22e',
  };
  const textDark = new Set([2, 4]);

  window.WebPadApps.game2048 = {
    mount(el, win, api) {
      el.classList.add('g2048-root');
      let grid, score, best = api.storage.get('g2048.best', 0), over = false, won = false;
      let tiles = new Map(); // id -> {r,c,v,el}

      el.innerHTML = `
        <div class="g2048-head">
          <div class="g2048-title">2048</div>
          <div class="g2048-scores">
            <div class="g2048-scorebox"><div class="k">Score</div><div class="v g-score">0</div></div>
            <div class="g2048-scorebox"><div class="k">Best</div><div class="v g-best">0</div></div>
          </div>
        </div>
        <button class="g2048-new">New Game</button>
        <div class="g2048-board"></div>
        <div class="g2048-hint">Swipe or use arrow keys to move tiles. Merge to reach 2048.</div>`;

      const board = el.querySelector('.g2048-board');
      const scoreEl = el.querySelector('.g-score');
      const bestEl = el.querySelector('.g-best');

      // static cells
      for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) {
        const cell = document.createElement('div');
        cell.className = 'g2048-cell';
        positionCell(cell, r, c);
        board.append(cell);
      }

      function positionCell(elm, r, c) {
        elm.style.top = `calc(10px + ${r} * ((100% - 5 * 10px) / 4 + 10px))`;
        elm.style.left = `calc(10px + ${c} * ((100% - 5 * 10px) / 4 + 10px))`;
      }

      function reset() {
        for (const t of tiles.values()) t.el.remove();
        tiles.clear();
        grid = Array.from({ length: 4 }, () => [null, null, null, null]); // tile ids
        score = 0; over = false; won = false;
        addRandom(); addRandom();
        renderScore();
        clearOverlay();
      }

      let uid = 0;
      function addTile(r, c, v) {
        const id = ++uid;
        const tileEl = document.createElement('div');
        tileEl.className = 'g2048-tile';
        positionCell(tileEl, r, c);
        board.append(tileEl);
        tiles.set(id, { r, c, v, el: tileEl });
        grid[r][c] = id;
        paintTile(id);
        // pop-in animation
        tileEl.style.transform = 'scale(0)';
        requestAnimationFrame(() => requestAnimationFrame(() => { tileEl.style.transform = 'scale(1)'; }));
      }

      function paintTile(id) {
        const t = tiles.get(id);
        t.el.textContent = t.v;
        t.el.style.background = COLORS[t.v] || '#3c3a32';
        t.el.style.color = textDark.has(t.v) ? '#776e65' : '#f9f6f2';
        if (t.v >= 1024) t.el.style.fontSize = 'clamp(16px, 4.2vw, 26px)';
      }

      function addRandom() {
        const empty = [];
        for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) if (!grid[r][c]) empty.push([r, c]);
        if (!empty.length) return;
        const [r, c] = empty[Math.floor(Math.random() * empty.length)];
        addTile(r, c, Math.random() < 0.9 ? 2 : 4);
      }

      function renderScore() {
        scoreEl.textContent = score;
        if (score > best) { best = score; api.storage.set('g2048.best', best); }
        bestEl.textContent = best;
      }

      function clearOverlay() { board.querySelector('.g2048-over')?.remove(); }
      function overlay(title, subtitle) {
        const o = document.createElement('div');
        o.className = 'g2048-over';
        o.innerHTML = `<div class="big"></div><div class="sub" style="font-size:15px"></div>`;
        o.querySelector('.big').textContent = title;
        o.querySelector('.sub').textContent = subtitle;
        board.append(o);
      }

      function move(dir) {
        if (over) return;
        const vec = { up: [-1, 0], down: [1, 0], left: [0, -1], right: [0, 1] }[dir];
        let moved = false;
        let gained = 0;

        const rows = dir === 'up' || dir === 'left' ? [0, 1, 2, 3] : [3, 2, 1, 0];

        for (const r0 of rows) {
          for (let c0 = 0; c0 < 4; c0++) {
            const r = dir === 'up' || dir === 'down' ? r0 : c0;
            const c = dir === 'up' || dir === 'down' ? c0 : r0;
            const id = grid[r][c];
            if (!id) continue;
            let nr = r, nc = c, didMerge = false;
            // slide
            while (true) {
              const tr = nr + vec[0], tc = nc + vec[1];
              if (tr < 0 || tr > 3 || tc < 0 || tc > 3) break;
              const target = grid[tr][tc];
              if (!target) { nr = tr; nc = tc; continue; }
              const tt = tiles.get(target);
              const me = tiles.get(id);
              if (tt.v === me.v && !tt.merged) {
                // merge into the target tile
                grid[r][c] = null;
                tt.v *= 2; tt.merged = true;
                gained += tt.v;
                me.el.remove(); tiles.delete(id);
                paintTile(target);
                if (tt.v === 2048 && !won) { won = true; }
                moved = true;
                didMerge = true;
              }
              break;
            }
            if (!didMerge && (nr !== r || nc !== c)) {
              // slid to an empty cell
              grid[r][c] = null;
              grid[nr][nc] = id;
              const me = tiles.get(id);
              me.r = nr; me.c = nc;
              positionCell(me.el, nr, nc);
              moved = true;
            }
          }
        }

        // clear merged flags
        for (const t of tiles.values()) t.merged = false;

        if (moved) {
          addRandom();
          score += gained;
          renderScore();
          if (won) { overlay('You win!', 'Keep going for a higher score'); won = 'shown'; }
          if (isStuck()) { over = true; overlay('Game over', 'Score: ' + score); }
        }
      }

      function isStuck() {
        for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) {
          if (!grid[r][c]) return false;
          const v = tiles.get(grid[r][c]).v;
          for (const [dr, dc] of [[1, 0], [0, 1]]) {
            const rr = r + dr, cc = c + dc;
            if (rr < 4 && cc < 4) {
              const other = grid[rr][cc];
              if (!other || tiles.get(other).v === v) return false;
            }
          }
        }
        return true;
      }

      // input: keyboard
      const onKey = (e) => {
        const map = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right' };
        if (map[e.key]) { e.preventDefault(); move(map[e.key]); }
      };
      document.addEventListener('keydown', onKey);

      // input: swipe
      let sx = null, sy = null;
      const onStart = (e) => { sx = e.clientX; sy = e.clientY; };
      const onEnd = (e) => {
        if (sx == null) return;
        const dx = e.clientX - sx, dy = e.clientY - sy;
        sx = null;
        if (Math.max(Math.abs(dx), Math.abs(dy)) < 24) return;
        move(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up'));
      };
      board.addEventListener('pointerdown', onStart);
      board.addEventListener('pointerup', onEnd);

      el.querySelector('.g2048-new').addEventListener('click', reset);

      reset();
      return () => {
        document.removeEventListener('keydown', onKey);
        board.removeEventListener('pointerdown', onStart);
        board.removeEventListener('pointerup', onEnd);
      };
    },
  };
})();
