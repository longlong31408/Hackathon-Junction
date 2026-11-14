/* Mochi — Calm Room: breathing (room or cloud theme), soundscape mixer,
   entry to the safety plan. */
'use strict';
(function (M) {
  const h = M.h;
  const PATTERNS = {
    gentle: { label: 'Gentle 4 · 4', steps: [['in', 4], ['out', 4]] },
    long: { label: 'Long out 4 · 6', steps: [['in', 4], ['out', 6]] },
    box: { label: 'Box 4 · 4 · 4 · 4', steps: [['in', 4], ['hold', 4], ['out', 4], ['hold', 4]] },
  };
  const CUE = { in: 'Breathe in…', hold: 'Hold gently…', out: 'And out…' };

  const calm = {
    openRoom() {
      const body = h('div', { class: 'stack' },
        h('p', { class: 'muted' }, 'A quiet room. Nothing here needs doing.'),
        h('button', { class: 'btn big', onclick: () => this.breathe({}) }, '🫁 Breathe with ' + M.store.state.cat.name),
        h('button', { class: 'btn big', onclick: () => this.sounds() }, '🎧 Soft sounds'),
        h('button', { class: 'btn big', onclick: () => M.safety.openPlan() }, '📝 My safety plan'),
        h('button', { class: 'btn big ghost', onclick: () => M.safety.openHelp() }, '🛟 Crisis lines'));
      M.ui.sheet({ title: 'Calm Room', icon: '🛋️', body, id: 'calm' });
    },

    sounds() {
      const s = M.store.state.settings.sound;
      const list = h('div', { class: 'stack' });
      const render = () => {
        list.innerHTML = '';
        M.audio.channels.forEach((c) => {
          list.append(h('button', {
            class: 'toggle-row' + (s[c.id] ? ' on' : ''), 'aria-pressed': String(!!s[c.id]),
            onclick: () => { M.store.update((st) => { st.settings.sound[c.id] = !st.settings.sound[c.id]; }); M.audio.sync(); render(); },
          }, h('span', { 'aria-hidden': 'true' }, c.icon), h('span', { class: 'grow' }, c.label), h('span', { class: 'switch' })));
        });
        list.append(h('label', { class: 'field' }, h('span', null, 'Volume'),
          h('input', {
            type: 'range', min: 0, max: 1, step: 0.05, value: s.volume,
            oninput: (e) => { M.store.update((st) => { st.settings.sound.volume = +e.target.value; }); M.audio.sync(); },
          })));
        list.append(h('p', { class: 'muted small' }, 'Every sound is generated on your device and can be switched off on its own.'));
      };
      render();
      M.ui.sheet({ title: 'Soft sounds', icon: '🎧', body: list });
    },

    /* opts.theme: 'room' | 'clouds'; opts.calm: plain style (from the help screen) */
    breathe(opts) {
      opts = opts || {};
      const theme = opts.theme || 'room';
      let pattern = 'gentle', duration = 60, running = false, elapsed = 0, raf = 0, last = 0;
      const canvas = h('canvas', { class: 'breath-canvas', 'aria-hidden': 'true' });
      const cue = h('p', { class: 'breath-cue', 'aria-live': 'polite' }, 'Ready when you are.');
      const count = h('p', { class: 'breath-count muted' }, '');
      const startBtn = h('button', { class: 'btn primary big' }, 'Start');
      const body = h('div', { class: 'breath' },
        canvas, cue, count,
        M.ui.chips(Object.keys(PATTERNS).map((k) => ({ id: k, label: PATTERNS[k].label })), pattern, (v) => { pattern = v || 'gentle'; reset(); }, { label: 'Breathing pattern' }),
        M.ui.chips([{ id: 60, label: '1 min' }, { id: 180, label: '3 min' }, { id: 0, label: 'No timer' }], duration, (v) => { duration = v == null ? 60 : v; reset(); }, { label: 'Length' }),
        startBtn);
      const ctx = canvas.getContext('2d');
      const name = M.store.state.cat.name;
      const total = () => PATTERNS[pattern].steps.reduce((a, s) => a + s[1], 0);
      function phaseAt(t) {
        let x = t % total();
        for (const [kind, len] of PATTERNS[pattern].steps) { if (x < len) return { kind, k: x / len, left: Math.ceil(len - x) }; x -= len; }
        return { kind: 'in', k: 0, left: 4 };
      }
      function reset() { running = false; elapsed = 0; startBtn.textContent = 'Start'; cue.textContent = 'Ready when you are.'; count.textContent = ''; }
      startBtn.addEventListener('click', () => {
        if (running) { running = false; startBtn.textContent = 'Continue'; cue.textContent = 'Paused. Take your time.'; return; }
        running = true; startBtn.textContent = 'Pause'; last = performance.now();
      });
      let lastKind = '';
      function frame(now) {
        if (!canvas.isConnected) return;
        const dt = Math.min(0.1, (now - last) / 1000); last = now;
        if (running) elapsed += dt;
        if (running && duration && elapsed >= duration) {
          running = false; startBtn.textContent = 'Again';
          cue.textContent = 'All done. ' + name + ' is very relaxed now. 💛'; count.textContent = '';
        }
        const ph = running ? phaseAt(elapsed) : { kind: 'rest', k: 0, left: 0 };
        if (running) {
          if (ph.kind !== lastKind) { cue.textContent = CUE[ph.kind]; lastKind = ph.kind; }
          count.textContent = ph.left + (duration ? ' · ' + Math.max(0, Math.ceil(duration - elapsed)) + 's left' : '');
        }
        // size 0..1 of the "breath"
        let size = 0.35;
        if (running) size = ph.kind === 'in' ? M.ease(ph.k) : ph.kind === 'out' ? 1 - M.ease(ph.k) : (lastHoldFull(elapsed) ? 1 : 0);
        draw(size, now / 1000);
        raf = requestAnimationFrame(frame);
      }
      function lastHoldFull(t) {
        // a hold after "in" is full, a hold after "out" is empty
        const steps = PATTERNS[pattern].steps; let x = t % total();
        for (let i = 0; i < steps.length; i++) { if (x < steps[i][1]) return i > 0 && steps[i - 1][0] === 'in'; x -= steps[i][1]; }
        return false;
      }
      function draw(size, t) {
        const W = Math.min(canvas.parentElement ? canvas.parentElement.clientWidth : 320, 420), H = 220;
        const dpr = M.fitCanvas(canvas, W, H);
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        const reduce = M.reducedMotion();
        if (theme === 'clouds') {
          const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#A9D6F5'); g.addColorStop(1, '#E7F5EC');
          ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
          // drifting clouds
          for (let i = 0; i < 4; i++) {
            const x = ((i * 137 + (reduce ? 0 : t * (6 + i * 2))) % (W + 120)) - 60, y = 30 + i * 22;
            cloud(ctx, x, y, 0.6 + (i % 2) * 0.25, 'rgba(255,255,255,0.75)');
          }
          ctx.fillStyle = '#B9E3A8'; ctx.fillRect(0, H - 34, W, 34);
          const sc = reduce ? 1 : 0.8 + size * 0.55;
          cloud(ctx, W / 2, H / 2 - 6, sc * 1.5, '#FFFFFF', reduce ? 0.55 + size * 0.45 : 1);
          M.cat.draw(ctx, { x: W / 2 + 70, y: H - 10, s: 0.7, pose: 'loaf', t, coat: M.store.state.cat.coat, acc: M.store.state.cat.acc, expr: 'happy' });
        } else {
          ctx.fillStyle = opts.calm ? '#F7F5F2' : '#EFEAFB'; ctx.fillRect(0, 0, W, H);
          const r = reduce ? 70 : 42 + size * 46;
          ctx.globalAlpha = reduce ? 0.35 + size * 0.5 : 0.85;
          const g = ctx.createRadialGradient(W / 2, H / 2, 4, W / 2, H / 2, r);
          g.addColorStop(0, '#FFF6E9'); g.addColorStop(1, '#CFC4F2');
          ctx.fillStyle = g; ctx.beginPath(); ctx.arc(W / 2, H / 2, r, 0, 7); ctx.fill();
          ctx.globalAlpha = 1;
          ctx.strokeStyle = 'rgba(91,70,54,0.35)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(W / 2, H / 2, 88, 0, 7); ctx.stroke();
          if (!opts.calm) {
            const sc = 0.85 + (reduce ? 0 : size * 0.08);
            M.cat.draw(ctx, { x: W / 2, y: H / 2 + 22, s: sc, pose: 'sleep', t: 0, still: true, coat: M.store.state.cat.coat, acc: M.store.state.cat.acc });
          }
        }
      }
      raf = requestAnimationFrame(frame);
      M.ui.sheet({
        title: theme === 'clouds' ? 'Cloud breathing' : 'Breathe with ' + name, icon: theme === 'clouds' ? '☁️' : '🫁',
        body, calm: !!opts.calm, onClose: () => cancelAnimationFrame(raf),
      });
    },
  };

  function cloud(ctx, x, y, s, col, alpha) {
    ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
    if (alpha != null) ctx.globalAlpha = alpha;
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.arc(-22, 6, 16, 0, 7); ctx.arc(0, -4, 22, 0, 7); ctx.arc(24, 4, 17, 0, 7); ctx.arc(4, 12, 18, 0, 7);
    ctx.fill(); ctx.restore();
  }
  calm.cloud = cloud;
  M.calm = calm;
})(window.M);
