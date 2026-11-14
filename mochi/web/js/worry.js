/* Mochi — Worry Room: type (or say) a worry, then the cat eats it, shreds it
   or buries it in the litter box. Worries are never stored — only a count. */
'use strict';
(function (M) {
  const h = M.h;

  const worry = {
    open(prefill) {
      const st = M.store.state, name = st.cat.name;
      const canvas = h('canvas', { class: 'worry-canvas', 'aria-hidden': 'true' });
      const ta = h('textarea', { rows: 3, maxlength: 600, placeholder: 'What is weighing on you? ' + name + ' is hungry for it.', 'aria-label': 'Your worry', value: prefill || '' });
      const status = h('p', { class: 'muted', 'aria-live': 'polite' }, 'Private. Nothing you write here is saved or sent anywhere.');
      let anim = null; // {kind, t}
      const methods = [
        ['eat', '😋', 'Eat it'],
        ['shred', '✂️', 'Shred it'],
        ['bury', '🪣', 'Bury it'],
      ];
      const btns = h('div', { class: 'row wrap center' }, methods.map(([id, icon, label]) =>
        h('button', { class: 'btn primary', onclick: () => go(id) }, icon + ' ' + label)));
      const mic = voiceButton(ta);
      const share = st.profile.adult ? h('button', {
        class: 'btn ghost small',
        onclick: () => {
          const text = ta.value.trim();
          if (!text) { status.textContent = 'Write something first — then it can sail.'; return; }
          sheet.close(); M.bottles.open('write', text);
        },
      }, '🍾 Share it as an anonymous bottle instead') : null;
      const body = h('div', { class: 'worry' }, canvas, h('div', { class: 'with-mic' }, ta, mic), btns, status, share);

      function go(kind) {
        const text = ta.value.trim();
        if (!text) { status.textContent = 'Write a worry first — even one word is enough.'; ta.focus(); return; }
        if (anim) return;
        anim = { kind, t: 0, words: text.slice(0, 40) };
        ta.value = ''; ta.disabled = true;
        M.audio.ui(kind === 'eat' ? 'chomp' : kind === 'shred' ? 'shred' : 'dig');
        status.textContent = kind === 'eat' ? name + ' is munching…' : kind === 'shred' ? 'Shred shred shred…' : name + ' is digging…';
      }
      function done() {
        const kind = anim.kind; anim = null; ta.disabled = false;
        M.store.update((s) => { s.worriesReleased += 1; });
        const n = M.store.state.worriesReleased;
        status.textContent = (kind === 'eat' ? 'Gone. ' + name + ' licks their whiskers.' : kind === 'shred' ? 'Confetti now. Not your problem for the moment.' : 'Buried deep. ' + name + ' pats the sand flat.')
          + ' (' + name + ' has taken care of ' + n + ' worr' + (n === 1 ? 'y' : 'ies') + ' so far.)';
        M.audio.ui('purr');
      }

      const ctx = canvas.getContext('2d');
      const parts = new M.Particles();
      let last = performance.now(), raf;
      function frame(now) {
        if (!canvas.isConnected) return;
        const dt = Math.min(0.05, (now - last) / 1000); last = now;
        const W = Math.min(body.clientWidth || 320, 420), H = 170;
        const dpr = M.fitCanvas(canvas, W, H);
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.fillStyle = '#FFF0D6'; ctx.fillRect(0, 0, W, H);
        ctx.fillStyle = '#F3DDB8'; ctx.fillRect(0, H - 26, W, 26);
        const cx = W / 2 + 30, fy = H - 18;
        // litter box
        ctx.strokeStyle = M.cat.OUT; ctx.lineWidth = 2.2;
        ctx.fillStyle = '#A9D6F5'; M.rr(ctx, 26, fy - 22, 84, 24, 6); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#EED9B0'; M.rr(ctx, 32, fy - 26, 72, 9, 4); ctx.fill();
        let pose = 'sit', expr = 'neutral', catX = cx;
        const t = now / 1000;
        if (anim) {
          anim.t += dt;
          const k = anim.t;
          const paperX = M.lerp(W / 2 - 60, anim.kind === 'bury' ? 66 : cx - 26, Math.min(1, k / 0.6));
          const paperY = anim.kind === 'bury' ? M.lerp(fy - 60, fy - 26, Math.min(1, k / 0.6)) : fy - 40;
          if (anim.kind === 'eat') {
            pose = k > 0.5 && k < 2 ? 'eat' : 'sit'; expr = k >= 2 ? 'happy' : 'neutral';
            if (k < 0.7) paper(ctx, paperX, paperY, 1 - Math.max(0, k - 0.5) * 3, anim.words);
            if (k > 0.6 && k < 1.9 && Math.random() < 0.5) parts.add('crumb', cx - 22, fy - 36, { vx: M.rand(-30, 30), vy: M.rand(-40, -10), gravity: 120, life: 0.8 });
            if (k > 2 && k < 2.1) parts.burst('heart', cx - 4, fy - 70, 3);
          } else if (anim.kind === 'shred') {
            pose = k < 1.8 ? 'play' : 'sit'; expr = k >= 1.8 ? 'happy' : 'squint';
            if (k < 0.6) paper(ctx, paperX, paperY, 1, anim.words);
            if (k > 0.6 && k < 1.8 && Math.random() < 0.7) parts.add('paper', cx - 24, fy - 40, { vx: M.rand(-60, 60), vy: M.rand(-60, -10), gravity: 90, vr: M.rand(-6, 6), life: 1.5 });
          } else {
            catX = M.lerp(cx, 120, Math.min(1, k / 0.5));
            pose = k < 0.5 ? 'walk' : k < 2 ? 'play' : 'sit'; expr = k >= 2 ? 'happy' : 'neutral';
            if (k < 0.8) paper(ctx, paperX, paperY, 1, anim.words);
            if (k > 0.6 && k < 2 && Math.random() < 0.6) parts.add('sand', 70, fy - 26, { vx: M.rand(-50, 50), vy: M.rand(-60, -20), gravity: 160, life: 0.7 });
          }
          if (k > 2.6) done();
        }
        M.cat.draw(ctx, { x: catX, y: fy, s: 1.15, pose, t, phase: t * 10, dir: -1, expr, coat: M.store.state.cat.coat, acc: M.store.state.cat.acc });
        parts.update(dt); parts.draw(ctx);
        raf = requestAnimationFrame(frame);
      }
      raf = requestAnimationFrame(frame);
      const sheet = M.ui.sheet({ title: 'Worry Room', icon: '🗑️', body, id: 'worry', onClose: () => cancelAnimationFrame(raf) });
    },
  };

  function paper(ctx, x, y, s, words) {
    if (s <= 0) return;
    ctx.save(); ctx.translate(x, y); ctx.scale(s, s); ctx.rotate(-0.1);
    ctx.fillStyle = '#FFFDF8'; ctx.strokeStyle = '#5B4636'; ctx.lineWidth = 1.6;
    M.rr(ctx, -20, -14, 40, 28, 5); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = '#C9B8A6'; ctx.lineWidth = 1.2;
    for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.moveTo(-14, -6 + i * 7); ctx.lineTo(14 - i * 5, -6 + i * 7); ctx.stroke(); }
    ctx.restore();
  }

  /* Voice input via the browser's speech recognition, when available. */
  function voiceButton(ta) {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return null;
    let rec = null;
    const btn = h('button', { class: 'icon-btn mic', 'aria-label': 'Speak instead of typing', title: 'Voice typing uses your browser\'s speech service' }, '🎤');
    btn.addEventListener('click', () => {
      if (rec) { rec.stop(); return; }
      rec = new SR(); rec.interimResults = false; rec.lang = navigator.language || 'en-US';
      rec.onresult = (e) => { ta.value = (ta.value + ' ' + Array.from(e.results).map((r) => r[0].transcript).join(' ')).trim(); };
      rec.onend = () => { rec = null; btn.classList.remove('on'); };
      rec.onerror = () => { rec = null; btn.classList.remove('on'); };
      btn.classList.add('on'); rec.start();
    });
    return btn;
  }
  worry.voiceButton = voiceButton;
  M.worry = worry;
})(window.M);
