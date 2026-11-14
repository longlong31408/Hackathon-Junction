/* Mochi — procedural chibi cat. 100% original shapes drawn in code: big
   round head, small round body, dot eyes, soft cocoa outlines.
   drawCat(ctx, {x, y, s, pose, t, coat, acc, dir, expr, phase, rot, alpha})
   (x, y) is the point between the cat's feet. */
'use strict';
(function (M) {
  const OUT = '#5B4636';
  const COATS = {
    cream: { label: 'Cream puff', body: '#F8E2C2', belly: '#FFF8EC', ear: '#FFC2C2' },
    ginger: { label: 'Ginger', body: '#F6B27A', belly: '#FFEBD6', mark: '#E08A4C', stripes: true, ear: '#FFB9A8' },
    mist: { label: 'Misty grey', body: '#C8C5D3', belly: '#F2F0F7', mark: '#A29DB5', stripes: true, ear: '#F4C4D0' },
    midnight: { label: 'Midnight', body: '#4B4556', belly: '#615A70', ear: '#C99AAE', dark: true },
    calico: { label: 'Calico', body: '#FFFBF4', belly: '#FFFFFF', mark: '#F2A863', mark2: '#6B5E6E', patches: true, ear: '#FFC2C2' },
    tuxedo: { label: 'Tuxedo', body: '#3F3B48', belly: '#FFFBF4', ear: '#C99AAE', dark: true, tux: true },
    stone: { label: 'Stone', body: '#CFCBC6', belly: '#E2DED9', ear: '#BDB8B2' }, // statues on the isles
  };

  function ell(ctx, x, y, rx, ry, rot, fill, stroke) {
    ctx.beginPath();
    ctx.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), rot || 0, 0, Math.PI * 2);
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    if (stroke !== false) ctx.stroke();
  }

  function tail(ctx, c, pts, w) {
    ctx.save();
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(pts[0], pts[1]);
    ctx.bezierCurveTo(pts[2], pts[3], pts[4], pts[5], pts[6], pts[7]);
    ctx.strokeStyle = OUT; ctx.lineWidth = w + 5; ctx.stroke();
    ctx.strokeStyle = c.body; ctx.lineWidth = w; ctx.stroke();
    if (c.stripes) { ctx.strokeStyle = c.mark; ctx.lineWidth = w; ctx.setLineDash([3, 5]); ctx.stroke(); ctx.setLineDash([]); }
    ctx.restore();
  }

  function leg(ctx, c, x, top, len, w, shade) {
    ctx.fillStyle = shade ? M.mixColor(c.body, '#5B4636', 0.18) : (c.tux ? c.belly : c.body);
    M.rr(ctx, x - w / 2, top, w, len, w / 2);
    ctx.fill(); ctx.stroke();
  }

  /* The head is drawn in its own space: centre (0,0), rx 21, ry 17.5. */
  function head(ctx, c, o, hx, hy, hs, hrot) {
    const t = o.t || 0;
    ctx.save();
    ctx.translate(hx, hy); ctx.rotate(hrot || 0); ctx.scale(hs, hs);
    const face = c.dark ? '#F6E8DC' : OUT;
    // ears
    for (const sx of [-1, 1]) {
      const twitch = sx === 1 && o.expr !== 'sleep' && (t % 5.3) < 0.15 ? -0.12 : 0;
      ctx.save(); ctx.rotate(twitch);
      ctx.beginPath();
      ctx.moveTo(sx * 18, -5); ctx.quadraticCurveTo(sx * 17, -20, sx * 13, -25); ctx.quadraticCurveTo(sx * 6, -18, sx * 2, -15);
      ctx.closePath(); ctx.fillStyle = c.body; ctx.fill(); ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(sx * 14.5, -9); ctx.quadraticCurveTo(sx * 14, -18, sx * 12.5, -20.5); ctx.quadraticCurveTo(sx * 8, -16, sx * 6, -14.5);
      ctx.closePath(); ctx.fillStyle = c.ear; ctx.fill();
      ctx.restore();
    }
    // head shape
    ell(ctx, 0, 0, 21, 17.5, 0, c.body, false);
    // markings
    ctx.save();
    ctx.beginPath(); ctx.ellipse(0, 0, 21, 17.5, 0, 0, Math.PI * 2); ctx.clip();
    if (c.patches) { ell(ctx, 13, -11, 11, 9, 0.4, c.mark, false); ell(ctx, -15, -9, 8, 7, 0, c.mark2, false); }
    if (c.tux) { ell(ctx, 1, 9, 11, 7.5, 0, c.belly, false); }
    if (c.stripes) {
      ctx.strokeStyle = c.mark; ctx.lineWidth = 2.6; ctx.lineCap = 'round';
      for (const dx of [-5, 0, 5]) { ctx.beginPath(); ctx.moveTo(dx, -17); ctx.lineTo(dx * 0.8, -11 - Math.abs(dx) * 0.2); ctx.stroke(); }
    }
    ctx.restore();
    ell(ctx, 0, 0, 21, 17.5, 0, null);
    // cheeks
    ctx.globalAlpha = 0.5;
    ell(ctx, -12.5, 6, 3.8, 2.3, 0, '#FF9DA7', false);
    ell(ctx, 14, 6, 3.8, 2.3, 0, '#FF9DA7', false);
    ctx.globalAlpha = 1;
    // eyes
    const expr = o.expr || 'neutral';
    const blink = expr === 'neutral' && !o.still && (t % 4.1) < 0.13;
    ctx.strokeStyle = face; ctx.fillStyle = face; ctx.lineWidth = 2; ctx.lineCap = 'round';
    const eyes = [[-7, 1], [9, 1]];
    for (const [ex, ey] of eyes) {
      ctx.beginPath();
      if (expr === 'happy') { ctx.arc(ex, ey + 1.5, 3, Math.PI * 1.15, Math.PI * 1.85); ctx.stroke(); }
      else if (expr === 'sleep' || expr === 'yawn' || blink) { ctx.arc(ex, ey - 1, 3, Math.PI * 0.15, Math.PI * 0.85); ctx.stroke(); }
      else if (expr === 'squint') { const d = ex < 0 ? 1 : -1; ctx.moveTo(ex - 2.5 * d, ey - 2.5); ctx.lineTo(ex + 2 * d, ey); ctx.lineTo(ex - 2.5 * d, ey + 2.5); ctx.stroke(); }
      else {
        const r = expr === 'surprised' ? 3.6 : 2.7;
        ctx.arc(ex, ey, r, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#FFFFFF'; ctx.beginPath(); ctx.arc(ex - 0.9, ey - 1, r * 0.36, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = face;
      }
    }
    // nose + mouth
    ctx.fillStyle = '#F48FA0';
    ctx.beginPath(); ctx.moveTo(-0.6, 4.2); ctx.lineTo(3.4, 4.2); ctx.lineTo(1.4, 6.2); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = face; ctx.lineWidth = 1.5;
    if (expr === 'yawn' || expr === 'eat' || expr === 'surprised') {
      const open = expr === 'yawn' ? 5 : expr === 'eat' ? 2 + Math.abs(Math.sin(t * 14)) * 2.5 : 2.6;
      ell(ctx, 1.4, 9.5, 3 + open * 0.3, open, 0, '#C8576A', false);
      ctx.strokeStyle = face; ctx.stroke();
    } else {
      ctx.beginPath(); ctx.arc(-0.6, 7, 2, 0.1, Math.PI - 0.1); ctx.stroke();
      ctx.beginPath(); ctx.arc(3.4, 7, 2, 0.1, Math.PI - 0.1); ctx.stroke();
    }
    // whiskers
    ctx.globalAlpha = 0.55; ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(-15, 4); ctx.lineTo(-25, 2); ctx.moveTo(-15, 7.5); ctx.lineTo(-24, 9);
    ctx.moveTo(17, 4); ctx.lineTo(27, 2); ctx.moveTo(17, 7.5); ctx.lineTo(26, 9);
    ctx.stroke();
    ctx.globalAlpha = 1; ctx.lineWidth = 2.4; ctx.strokeStyle = OUT;
    headAcc(ctx, o.acc);
    ctx.restore();
  }

  function flower(ctx, x, y, col) {
    ctx.fillStyle = col;
    for (let i = 0; i < 5; i++) { const a = (i / 5) * Math.PI * 2; ctx.beginPath(); ctx.arc(x + Math.cos(a) * 2.6, y + Math.sin(a) * 2.6, 2.2, 0, 7); ctx.fill(); }
    ctx.fillStyle = '#FFD86B'; ctx.beginPath(); ctx.arc(x, y, 1.6, 0, 7); ctx.fill();
  }

  function headAcc(ctx, acc) {
    ctx.lineWidth = 2; ctx.strokeStyle = OUT;
    switch (acc) {
      case 'bow':
        ctx.save(); ctx.translate(13, -14); ctx.rotate(0.35);
        ctx.fillStyle = '#FF8FAB';
        ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(-8, -6); ctx.lineTo(-8, 6); ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(8, -6); ctx.lineTo(8, 6); ctx.closePath(); ctx.fill(); ctx.stroke();
        ell(ctx, 0, 0, 2.8, 2.8, 0, '#FF6F96');
        ctx.restore(); break;
      case 'glasses':
        ctx.fillStyle = 'rgba(255,255,255,0.28)'; ctx.lineWidth = 1.8;
        ell(ctx, -7, 1, 5.6, 5.2, 0, 'rgba(255,255,255,0.28)'); ell(ctx, 9, 1, 5.6, 5.2, 0, 'rgba(255,255,255,0.28)');
        ctx.beginPath(); ctx.moveTo(-1.4, 0); ctx.quadraticCurveTo(1, -2, 3.4, 0); ctx.stroke(); break;
      case 'beanie':
        ctx.fillStyle = '#A9D6F5';
        ctx.beginPath(); ctx.ellipse(0, -8, 20.5, 13, 0, Math.PI, Math.PI * 2); ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#7FBCE8'; M.rr(ctx, -21, -11, 42, 6, 3); ctx.fill(); ctx.stroke();
        ell(ctx, 0, -22, 4.5, 4.5, 0, '#FFF6E9'); break;
      case 'flowers': {
        const cols = ['#FF9EB5', '#FFE08A', '#CFC4F2', '#BDE6CF', '#FFC8A2'];
        for (let i = 0; i < 5; i++) { const a = Math.PI * (1.12 + i * 0.19); flower(ctx, Math.cos(a) * 18, Math.sin(a) * 14.5 - 1, cols[i]); }
        break;
      }
      case 'sailor':
        ctx.fillStyle = '#FFFDF8'; M.rr(ctx, -12, -24, 24, 10, 4); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#6F8FD8'; M.rr(ctx, -14, -16, 28, 4, 2); ctx.fill(); ctx.stroke(); break;
      case 'straw':
        ctx.fillStyle = '#F3D58A'; ell(ctx, 0, -13, 27, 6, 0, '#F3D58A'); ell(ctx, 0, -18, 13, 8, 0, '#F3D58A');
        ctx.fillStyle = '#FF8FAB'; M.rr(ctx, -13, -16, 26, 3.5, 1.5); ctx.fill(); break;
      case 'leafhat':
        ctx.save(); ctx.translate(2, -18); ctx.rotate(-0.3);
        ell(ctx, 0, 0, 13, 6, 0, '#8FCB9B');
        ctx.beginPath(); ctx.moveTo(-12, 0); ctx.lineTo(12, 0); ctx.stroke(); ctx.restore(); break;
      default: break;
    }
  }

  function neckAcc(ctx, acc, nx, ny, nw, t) {
    if (acc === 'scarf') {
      ctx.fillStyle = '#FF9E7A';
      M.rr(ctx, nx - nw / 2, ny - 3.5, nw, 7, 3.5); ctx.fill(); ctx.stroke();
      ctx.save(); ctx.translate(nx - nw * 0.25, ny + 2); ctx.rotate(0.15 + Math.sin(t * 2) * 0.05);
      M.rr(ctx, -3.5, 0, 7, 12, 3); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#FFF6E9'; ctx.fillRect(-3, 4, 6, 2); ctx.restore();
    } else if (acc === 'bandana') {
      ctx.fillStyle = '#BDE6CF';
      ctx.beginPath(); ctx.moveTo(nx - nw / 2, ny - 2); ctx.lineTo(nx + nw / 2, ny - 2); ctx.lineTo(nx + 2, ny + 10); ctx.closePath();
      ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#FFFDF8';
      for (const [dx, dy] of [[-5, 1], [3, 1], [1, 5]]) { ctx.beginPath(); ctx.arc(nx + dx, ny + dy, 1.2, 0, 7); ctx.fill(); }
    }
  }

  function backpack(ctx, x, y, w, h) {
    ctx.fillStyle = '#FFC8A2'; M.rr(ctx, x, y, w, h, 4); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#FFB07F'; M.rr(ctx, x + 2, y + h * 0.45, w - 4, h * 0.4, 2.5); ctx.fill(); ctx.stroke();
  }

  function drawCat(ctx, o) {
    const c = COATS[o.coat] || COATS.cream;
    const s = o.s || 1, dir = o.dir || 1, t = o.t || 0;
    const still = o.still || M.reducedMotion();
    const pose = o.pose || 'sit';
    const tt = still ? 0 : t;
    const breath = still ? 0 : Math.sin(t * 2.2) * 0.6;
    const sway = still ? 0 : Math.sin(t * 2.4);
    ctx.save();
    ctx.translate(o.x, o.y);
    if (o.alpha != null) ctx.globalAlpha = o.alpha;
    ctx.scale(s * dir, s);
    if (o.rot) { ctx.translate(0, -16); ctx.rotate(o.rot); ctx.translate(0, 16); }
    ctx.lineJoin = 'round'; ctx.lineWidth = 2.4; ctx.strokeStyle = OUT;
    // soft ground shadow
    if (!o.noShadow) {
      ctx.save(); ctx.globalAlpha *= 0.16; ctx.fillStyle = OUT;
      ctx.beginPath(); ctx.ellipse(1, 0.5, pose === 'walk' || pose === 'run' || pose === 'loaf' || pose === 'sleep' ? 22 : 18, 3.4, 0, 0, 7); ctx.fill();
      ctx.restore();
    }
    const oo = Object.assign({}, o, { t: tt, still });

    if (pose === 'sit' || pose === 'play' || pose === 'eat' || pose === 'yawn') {
      tail(ctx, c, [-13, -5, -30, -6, -32, -24, -24 + sway * 3, -34 + sway], 5.5);
      if (o.acc === 'backpack') backpack(ctx, -19, -27, 12, 15);
      ell(ctx, 0, -15 - breath * 0.4, 16, 15 + breath * 0.3, 0, c.body);
      ell(ctx, 4, -12, 9, 9.5, 0, c.belly, false);
      if (pose === 'play') {
        const up = still ? 0 : Math.max(0, Math.sin(t * 9)) * 6;
        ell(ctx, -4, -1.5, 5, 3.2, 0, c.tux ? c.belly : c.body);
        ell(ctx, 13, -10 - up, 4.5, 4, 0, c.tux ? c.belly : c.body);
      } else {
        ell(ctx, -4, -1.5, 5, 3.2, 0, c.tux ? c.belly : c.body);
        ell(ctx, 8, -1.5, 5, 3.2, 0, c.tux ? c.belly : c.body);
      }
      neckAcc(ctx, o.acc, 3, -26, 26, tt);
      const eat = pose === 'eat';
      head(ctx, c, Object.assign(oo, { expr: eat ? 'eat' : pose === 'yawn' ? 'yawn' : o.expr }), eat ? 9 : 3, eat ? -32 : -39 - breath * 0.5, 1, eat ? 0.22 : (pose === 'play' ? 0.08 : 0));
    } else if (pose === 'loaf') {
      tail(ctx, c, [-18, -6, -24, 2, -6, 3, 10, 0], 5);
      if (o.acc === 'backpack') backpack(ctx, -12, -24, 13, 11);
      ell(ctx, 0, -11 - breath * 0.3, 22, 11 + breath * 0.25, 0, c.body);
      ell(ctx, 8, -6, 9, 4.5, 0, c.belly, false);
      neckAcc(ctx, o.acc, 11, -16, 22, tt);
      head(ctx, c, oo, 12, -26, 0.92, 0);
    } else if (pose === 'sleep') {
      if (o.acc === 'backpack') backpack(ctx, -14, -22, 12, 10);
      ell(ctx, -2, -11 - breath * 0.4, 21, 12 + breath * 0.3, 0, c.body);
      tail(ctx, c, [-20, -6, -22, 3, 0, 4, 16, -2], 5);
      head(ctx, c, Object.assign(oo, { expr: 'sleep' }), 11, -14, 0.8, 0.18);
    } else if (pose === 'walk' || pose === 'run' || pose === 'stand') {
      const run = pose === 'run';
      const ph = still || pose === 'stand' ? 0 : (o.phase || 0);
      const amp = run ? 5 : 3.2;
      const bob = pose === 'stand' ? 0 : Math.abs(Math.sin(ph)) * (run ? 2 : 1.2);
      const legs = [[-11, 0, true], [9, Math.PI, true], [-6, Math.PI, false], [14, 0, false]];
      for (const [lx, off, far] of legs) if (far) leg(ctx, c, lx + Math.sin(ph + off) * amp, -10 - bob, 10 - Math.max(0, -Math.cos(ph + off)) * 2, 6, true);
      tail(ctx, c, [-16, -16 - bob, -26, -18, -26, -30, -22 + sway * 3, -36 + sway], 5.5);
      ell(ctx, 0, -15 - bob, run ? 20 : 18, run ? 10 : 11, 0, c.body);
      ell(ctx, 4, -10 - bob, 11, 5, 0, c.belly, false);
      if (o.acc === 'backpack') backpack(ctx, -8, -29 - bob, 14, 10);
      for (const [lx, off, far] of legs) if (!far) leg(ctx, c, lx + Math.sin(ph + off) * amp, -10 - bob, 10 - Math.max(0, -Math.cos(ph + off)) * 2, 6, false);
      neckAcc(ctx, o.acc, 15, -24 - bob, 18, tt);
      head(ctx, c, oo, 17, -31 - bob, 0.92, run ? 0.12 : 0);
    }
    ctx.restore();
  }

  /* Small animated preview used in onboarding and the wardrobe. */
  function preview(canvas, getOpts, cssW, cssH) {
    const ctx = canvas.getContext('2d');
    let start = performance.now();
    function frame(now) {
      if (!canvas.isConnected) return;
      const dpr = M.fitCanvas(canvas, cssW, cssH);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, cssW, cssH);
      const o = getOpts();
      drawCat(ctx, Object.assign({ x: cssW / 2 - 2, y: cssH - 12, s: cssH / 72, t: (now - start) / 1000 }, o));
      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  }

  M.cat = { draw: drawCat, COATS, preview, OUT };
})(window.M);
