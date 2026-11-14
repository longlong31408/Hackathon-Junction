/* Mochi — failure-free mini-games. Fishing on the pier: wait, the bobber
   dips, tap. Missing is impossible to "lose": the fish just comes back. */
'use strict';
(function (M) {
  const h = M.h;

  M.games = {
    fishing() {
      const s = M.store.state, name = s.cat.name;
      const canvas = h('canvas', { class: 'fish-canvas', 'aria-label': 'Fishing. Tap when the bobber dips.' });
      const msg = h('p', { class: 'fish-msg', 'aria-live': 'polite' }, 'Waiting for a nibble… (no rush)');
      const tapBtn = h('button', { class: 'btn primary big' }, '🎣 Reel in!');
      const body = h('div', { class: 'fishing' }, canvas, msg, tapBtn,
        h('p', { class: 'muted small' }, 'You can stop any time. Nothing is lost.'));
      let state = 'wait', timer = M.rand(2, 4.5), catchItem = null, catchT = 0, raf, last = performance.now(), t = 0;
      const ctx = canvas.getContext('2d');
      function reel() {
        if (state === 'bite') {
          const pool = M.data.FISH, total = pool.reduce((a, f) => a + f.w, 0);
          let r = Math.random() * total; catchItem = pool.find((f) => (r -= f.w) < 0) || pool[0];
          state = 'catch'; catchT = 0;
          const today = M.dayKey();
          let bonus = '';
          M.store.update((x) => {
            if (x.world.fishToday.day !== today) x.world.fishToday = { day: today, n: 0 };
            x.world.fishToday.n += 1;
            if (x.world.fishToday.n <= 3) { x.yarn += 1; bonus = '  +1 🧶'; }
          }, 'yarn');
          msg.textContent = name + ' caught ' + catchItem.icon + ' ' + catchItem.name + '! ' + catchItem.line.replace('{cat}', name) + bonus;
          M.audio.ui('splash');
        } else if (state === 'wait') {
          msg.textContent = 'Not yet — the fish are still thinking about it. 🐟';
        }
      }
      tapBtn.addEventListener('click', reel);
      canvas.addEventListener('pointerdown', reel);
      function frame(now) {
        if (!canvas.isConnected) return;
        const dt = Math.min(0.05, (now - last) / 1000); last = now; t += dt;
        const W = Math.min(body.clientWidth || 320, 420), H = 210;
        const dpr = M.fitCanvas(canvas, W, H);
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        const sky = M.sky(); const [top, bot] = M.skyColors(sky);
        let g = ctx.createLinearGradient(0, 0, 0, 80); g.addColorStop(0, top); g.addColorStop(1, bot);
        ctx.fillStyle = g; ctx.fillRect(0, 0, W, 80);
        g = ctx.createLinearGradient(0, 80, 0, H); g.addColorStop(0, '#A9D6F5'); g.addColorStop(1, '#7FBCE8');
        ctx.fillStyle = g; ctx.fillRect(0, 80, W, H - 80);
        const reduce = M.reducedMotion();
        ctx.strokeStyle = 'rgba(255,255,255,0.6)'; ctx.lineWidth = 2;
        for (let i = 0; i < 6; i++) { const y = 96 + i * 18, x = ((i * 70 + (reduce ? 0 : t * 12)) % (W + 40)) - 20; ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x + 8, y - 4, x + 16, y); ctx.stroke(); }
        // pier
        ctx.fillStyle = '#D9B48F'; ctx.strokeStyle = '#5B4636'; ctx.lineWidth = 2.4;
        M.rr(ctx, -10, H - 46, 130, 16, 3); ctx.fill(); ctx.stroke();
        ctx.fillRect(20, H - 30, 8, 30); ctx.strokeRect(20, H - 30, 8, 30); ctx.fillRect(90, H - 30, 8, 30); ctx.strokeRect(90, H - 30, 8, 30);
        // state machine
        if (state === 'wait') { timer -= dt; if (timer <= 0) { state = 'bite'; timer = 1.8; msg.textContent = '❗ Something is nibbling — tap!'; M.audio.ui('pop'); } }
        else if (state === 'bite') { timer -= dt; if (timer <= 0) { state = 'wait'; timer = M.rand(1.5, 3.5); msg.textContent = 'It swam off to tell its friends about you. Another one will come. 🐟'; } }
        else if (state === 'catch') { catchT += dt; if (catchT > 2.6) { state = 'wait'; timer = M.rand(2, 4.5); } }
        // line + bobber
        const bx = W * 0.68, by = 120 + (state === 'bite' ? (reduce ? 6 : 5 + Math.sin(t * 18) * 4) : (reduce ? 0 : Math.sin(t * 2) * 2));
        const rodTipX = 104, rodTipY = H - 104;
        ctx.strokeStyle = '#5B4636'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(rodTipX, rodTipY); ctx.quadraticCurveTo((rodTipX + bx) / 2, by - 30, bx, by - 6); ctx.stroke();
        if (state !== 'catch') {
          ctx.fillStyle = '#FFFDF8'; ctx.beginPath(); ctx.arc(bx, by, 6, 0, Math.PI); ctx.fill(); ctx.stroke();
          ctx.fillStyle = '#FF6F96'; ctx.beginPath(); ctx.arc(bx, by, 6, Math.PI, 0); ctx.fill(); ctx.stroke();
          if (state === 'bite') { ctx.fillStyle = '#5B4636'; ctx.font = '900 18px ' + M.FONT; ctx.fillText('!', bx - 3, by - 16); }
        }
        // cat with rod
        ctx.strokeStyle = '#B98A66'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(74, H - 70); ctx.lineTo(rodTipX, rodTipY); ctx.stroke();
        M.cat.draw(ctx, { x: 60, y: H - 44, s: 1, pose: state === 'catch' ? 'play' : 'sit', t, coat: s.cat.coat, acc: s.cat.acc, expr: state === 'catch' ? 'happy' : state === 'bite' ? 'surprised' : 'neutral' });
        if (state === 'catch' && catchItem) {
          const k = Math.min(1, catchT / 0.6);
          const ix = M.lerp(bx, W * 0.5, k), iy = M.lerp(by, 60, k) - Math.sin(Math.PI * k) * 30;
          ctx.font = '34px ' + M.FONT; ctx.textAlign = 'center'; ctx.fillText(catchItem.icon, ix, iy); ctx.textAlign = 'start';
        }
        raf = requestAnimationFrame(frame);
      }
      raf = requestAnimationFrame(frame);
      M.ui.sheet({ title: 'Fishing pier', icon: '🎣', body, onClose: () => cancelAnimationFrame(raf) });
    },
  };
})(window.M);
