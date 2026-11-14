/* Mochi — the Mansion: a side-view "dollhouse" cutaway with six rooms.
   The cat lives here, mirrors the user's energy, does silly things now and
   then, and follows you into whichever room you open. */
'use strict';
(function (M) {
  const W = 400, H = 620, OUT = '#5B4636';
  const FLOOR_H = 140, SLAB = 14;
  const floorTop = (f) => 110 + f * (FLOOR_H + SLAB);
  const floorY = (f) => floorTop(f) + 134;

  const ROOMS = [
    { id: 'bedroom', label: 'Cozy Bedroom', icon: '🛏️', floor: 0, side: 0, wall: '#FFE3CF', pat: '#FFD2B5', pattern: 'dots' },
    { id: 'calm', label: 'Calm Room', icon: '🛋️', floor: 0, side: 1, wall: '#E6DEF8', pat: '#D7CCF3', pattern: 'stars' },
    { id: 'kitchen', label: 'Kitchen', icon: '🍳', floor: 1, side: 0, wall: '#E2F4EA', pat: '#CBE8D8', pattern: 'tiles' },
    { id: 'mail', label: 'Mailroom', icon: '📬', floor: 1, side: 1, wall: '#DCEEFB', pat: '#CBE3F6', pattern: 'stripes' },
    { id: 'worry', label: 'Worry Room', icon: '🗑️', floor: 2, side: 0, wall: '#FFF0D6', pat: '#FBE3BC', pattern: 'diag' },
    { id: 'garden', label: 'Garden Door', icon: '🚪', floor: 2, side: 1, wall: '#E8F4D9', pat: '#D6EBC2', pattern: 'leaves' },
  ];
  const R = {};
  ROOMS.forEach((r) => { r.x = r.side ? 204 : 34; r.y = floorTop(r.floor); r.w = 162; r.h = FLOOR_H; r.fy = r.y + 134; R[r.id] = r; });

  const SPOTS = {
    box: { floor: 0, x: R.bedroom.x + 38, y: floorY(0) },
    bench: { floor: 0, x: R.bedroom.x + 40, y: R.bedroom.y + 78, up: true },
    rug: { floor: 0, x: R.bedroom.x + 66, y: floorY(0) },
    sofa: { floor: 0, x: R.calm.x + 58, y: R.calm.fy - 22, up: true },
    sofaArm: { floor: 0, x: R.calm.x + 17, y: R.calm.fy - 31, up: true },
    table: { floor: 1, x: R.kitchen.x + 124, y: R.kitchen.fy - 37, up: true },
  };
  const centerSpot = (id) => ({ floor: R[id].floor, x: R[id].x + (id === 'garden' ? 60 : 81), y: floorY(R[id].floor) });

  // ---------------------------------------------------------------- state
  let canvas, ctx, wrap, staticCv, staticKey = '', scale = 1, dpr = 1, running = false, raf = 0, last = 0, acc = 0;
  const parts = new M.Particles();
  const cat = { x: SPOTS.bench.x, y: SPOTS.bench.y, floor: 0, pose: 'sit', dir: 1, expr: 'neutral', phase: 0, alpha: 1, rot: 0, inBox: false, queue: [], bubble: null, bubbleT: 0, happyT: 0, home: true, visiting: false, idleT: 0 };
  const cup = { state: 'table', x: 0, y: 0, vy: 0, t: 0 };
  let gagT = 30, t = 0;

  // ---------------------------------------------------------------- behaviour
  function energy() { return M.store.energy() || 3; }

  function plan(spot) {
    const steps = [];
    steps.push({ type: 'leave' });
    if (spot.floor !== cat.floor) {
      const landX = spot.up ? spot.x + (spot.x > 200 ? -22 : 22) : spot.x;
      steps.push({ type: 'poof', floor: spot.floor, x: landX });
    } else {
      steps.push({ type: 'down' });
      steps.push({ type: 'walk', x: spot.up ? spot.x + (cat.x < spot.x ? -22 : 22) : spot.x });
    }
    if (spot.up) steps.push({ type: 'hop', x: spot.x, y: spot.y, dur: 0.45 });
    return steps;
  }

  function goHome() {
    const e = energy();
    cat.visiting = false; cat.home = true; cat.idleT = 0;
    const reduce = M.reducedMotion();
    if (e === 1) cat.queue = plan(SPOTS.box).concat([{ type: 'pose', pose: 'sleep', dur: Infinity, inBox: true }]);
    else if (e === 2) cat.queue = plan(SPOTS.sofa).concat([{ type: 'pose', pose: 'loaf', dur: Infinity, faceDir: 1 }]);
    else if (e === 4) cat.queue = plan(SPOTS.rug).concat([{ type: 'pose', pose: 'play', dur: Infinity, toy: true, faceDir: 1 }]);
    else if (e === 5 && !reduce) cat.queue = plan({ floor: 0, x: 60, y: floorY(0) }).concat([{ type: 'zoom' }]);
    else if (e === 5) cat.queue = plan(SPOTS.rug).concat([{ type: 'pose', pose: 'sit', dur: Infinity, expr: 'happy', faceDir: 1 }]);
    else cat.queue = plan(SPOTS.bench).concat([{ type: 'pose', pose: 'sit', dur: Infinity, faceDir: -1, birds: true }]);
    cat.cur = null;
  }

  function visit(roomId) {
    const spot = roomId === 'bedroom' ? SPOTS.rug : centerSpot(roomId);
    cat.queue = plan(spot).concat([{ type: 'pose', pose: 'sit', dur: Infinity, expr: 'neutral', faceDir: spot.x > 200 ? -1 : 1 }]);
    cat.cur = null; cat.home = false; cat.visiting = true; cat.idleT = 0;
  }

  function say(text, dur) { cat.bubble = text; cat.bubbleT = dur || 2.2; }

  function gag() {
    const name = M.store.state.cat.name;
    const options = ['sneeze', 'spin', 'cup', 'box', 'fall', 'yawn'];
    const g = M.pick(options);
    let steps;
    if (g === 'sneeze') steps = [{ type: 'pose', pose: 'sit', dur: 0.7, expr: 'squint' }, { type: 'call', fn: () => { parts.burst('puff', cat.x + 18 * cat.dir, cat.y - 34, 4, { vy: -10, life: 0.8 }); say('achoo!', 1.4); } }, { type: 'pose', pose: 'sit', dur: 1.4, expr: 'surprised' }];
    else if (g === 'spin') steps = [{ type: 'call', fn: () => say('?!', 1.6) }, { type: 'spin', dur: 2.2 }, { type: 'pose', pose: 'sit', dur: 1.5, expr: 'happy', say: 'got it!' }];
    else if (g === 'cup' && cup.state === 'table') steps = plan(SPOTS.table).concat([{ type: 'pose', pose: 'play', dur: 1.1, faceDir: 1 }, { type: 'call', fn: () => { cup.state = 'fall'; cup.vy = -40; cup.t = 0; } }, { type: 'pose', pose: 'sit', dur: 1.5, expr: 'neutral', faceDir: 1 }, { type: 'pose', pose: 'sit', dur: 1.8, expr: 'happy', faceDir: -1, say: "wasn't me" }]);
    else if (g === 'box') steps = plan(SPOTS.box).concat([{ type: 'pose', pose: 'sit', dur: 2.6, inBox: 'stuck', say: '…help? (no, it is fine)' }, { type: 'pose', pose: 'sit', dur: 0.8, expr: 'happy' }]);
    else if (g === 'fall') steps = plan(SPOTS.sofaArm).concat([{ type: 'pose', pose: 'stand', dur: 0.9, faceDir: -1 }, { type: 'fall', dur: 0.4 }, { type: 'pose', pose: 'sit', dur: 2, expr: 'surprised', say: 'I meant to do that.' }]);
    else steps = [{ type: 'pose', pose: 'yawn', dur: 1.8, say: '*yaaawn*' }];
    steps.push({ type: 'call', fn: () => goHome() });
    cat.queue = steps; cat.cur = null; cat.home = false;
    if (name) M.emit('mansion-gag', g);
  }

  function pet() {
    const sleeping = cat.cur && cat.cur.pose === 'sleep';
    parts.burst('heart', cat.x, cat.y - 50, 3, () => ({ vx: M.rand(-25, 25), vy: M.rand(-50, -25), life: 1.2 }));
    if (sleeping) { say('purr… zz', 1.6); M.audio.ui('purr'); return; }
    cat.happyT = 1.6; say(M.pick(M.data.PET_LINES), 1.6);
    M.audio.ui(Math.random() < 0.6 ? 'meow' : 'purr');
  }

  function updateCat(dt) {
    if (cat.happyT > 0) cat.happyT -= dt;
    if (cat.bubbleT > 0) { cat.bubbleT -= dt; if (cat.bubbleT <= 0) cat.bubble = null; }
    if (!cat.cur) {
      cat.cur = cat.queue.shift() || null;
      if (cat.cur) cat.cur.k = 0;
      if (!cat.cur) { goHome(); return; }
    }
    const s = cat.cur;
    s.k += dt;
    const speed = 75;
    switch (s.type) {
      case 'leave': cat.inBox = false; cat.rot = 0; cat.cur = null; break;
      case 'down':
        if (cat.y < floorY(cat.floor) - 2) { s.type = 'hop'; s.x = cat.x + (cat.x > 200 ? -22 : 22); s.y = floorY(cat.floor); s.dur = 0.4; s.k = 0; }
        else cat.cur = null;
        break;
      case 'walk': {
        const dx = s.x - cat.x;
        cat.pose = 'walk'; cat.dir = dx >= 0 ? 1 : -1; cat.expr = 'neutral';
        const step = Math.min(Math.abs(dx), speed * dt);
        cat.x += Math.sign(dx) * step; cat.phase += dt * 11;
        if (Math.abs(dx) < 0.5) cat.cur = null;
        break;
      }
      case 'hop': {
        if (s.sx == null) { s.sx = cat.x; s.sy = cat.y; cat.dir = s.x >= cat.x ? 1 : -1; }
        const k = Math.min(1, s.k / s.dur);
        cat.x = M.lerp(s.sx, s.x, k); cat.y = M.lerp(s.sy, s.y, k) - Math.sin(Math.PI * k) * 26;
        cat.pose = 'stand';
        if (k >= 1) { cat.y = s.y; cat.cur = null; }
        break;
      }
      case 'poof': {
        if (!s.fired) {
          s.fired = true; parts.burst('puff', cat.x, cat.y - 20, 6, { vy: -15, life: 0.7 });
          M.audio.ui('pop');
        }
        cat.alpha = Math.max(0, 1 - s.k / 0.25);
        if (s.k > 0.3 && !s.moved) {
          s.moved = true; cat.floor = s.floor; cat.x = s.x; cat.y = floorY(s.floor);
          parts.burst('puff', cat.x, cat.y - 20, 6, { vy: -15, life: 0.7 });
        }
        if (s.moved) cat.alpha = Math.min(1, (s.k - 0.3) / 0.25);
        cat.pose = 'sit';
        if (s.k > 0.6) { cat.alpha = 1; cat.cur = null; }
        break;
      }
      case 'pose':
        if (!s.started) {
          s.started = true;
          if (s.say) say(s.say, Math.min(s.dur, 2.4));
          if (s.faceDir) cat.dir = s.faceDir;
        }
        cat.pose = s.pose; cat.expr = s.expr || (s.pose === 'sleep' ? 'sleep' : 'neutral'); cat.inBox = s.inBox || false;
        if (s.pose === 'sleep' && Math.random() < dt * 0.9) parts.add('z', cat.x + 12, cat.y - 30, { vx: 8, vy: -14, life: 2.2 });
        if (s.k >= s.dur) cat.cur = null;
        break;
      case 'spin':
        cat.pose = 'walk'; cat.phase += dt * 16; cat.rot = s.k * 7;
        if (s.k >= s.dur) { cat.rot = 0; cat.cur = null; }
        break;
      case 'fall': {
        if (s.sy == null) { s.sy = cat.y; s.sx = cat.x; }
        const k = Math.min(1, s.k / s.dur);
        cat.y = M.lerp(s.sy, floorY(cat.floor), k * k); cat.x = s.sx - k * 12; cat.rot = -k * 1.2; cat.pose = 'stand'; cat.expr = 'surprised';
        if (k >= 1) { cat.rot = 0; cat.y = floorY(cat.floor); parts.burst('puff', cat.x, cat.y - 4, 4, { vy: -8, life: 0.5 }); cat.cur = null; }
        break;
      }
      case 'zoom': {
        if (s.tx == null) s.tx = 340;
        const dx = s.tx - cat.x;
        cat.pose = 'run'; cat.dir = dx >= 0 ? 1 : -1; cat.expr = 'happy';
        cat.x += Math.sign(dx) * Math.min(Math.abs(dx), 170 * dt); cat.phase += dt * 20;
        if (Math.abs(dx) < 1) { s.tx = s.tx > 200 ? 60 : 340; if (Math.random() < 0.3) { cat.queue.unshift({ type: 'pose', pose: 'sit', dur: 1.2, expr: 'happy', faceDir: cat.dir }, { type: 'zoom' }); cat.cur = null; } }
        break;
      }
      case 'call': cat.cur = null; s.fn(); break;
      default: cat.cur = null;
    }
    if (cat.happyT > 0 && cat.pose !== 'sleep') cat.expr = 'happy';
  }

  function update(dt) {
    t += dt;
    updateCat(dt);
    // idle gags: only while nobody is looking at a sheet and energy allows
    const settled = cat.cur && cat.cur.type === 'pose' && cat.cur.dur === Infinity;
    if (settled && cat.home && !M.ui.isOpen() && !M.reducedMotion() && energy() >= 2 && energy() <= 4) {
      gagT -= dt;
      if (gagT <= 0) { gagT = M.rand(28, 60); gag(); }
    }
    if (cat.visiting && settled && !M.ui.isOpen()) { cat.idleT += dt; if (cat.idleT > 6) goHome(); }
    // cup physics
    if (cup.state === 'fall') {
      cup.t += dt; cup.vy += 420 * dt; cup.y += cup.vy * dt; cup.x += 30 * dt;
      if (cup.y >= R.kitchen.fy) { cup.y = R.kitchen.fy; if (Math.abs(cup.vy) > 60) { cup.vy *= -0.35; } else { cup.state = 'floor'; cup.t = 0; } }
    } else if (cup.state === 'floor') {
      cup.t += dt;
      if (cup.t > 7) { cup.state = 'table'; parts.burst('sparkle', cupHome().x, cupHome().y - 6, 4); }
    }
    if (cup.state === 'table') { const c = cupHome(); cup.x = c.x; cup.y = c.y; }
    // ambient
    if (!M.reducedMotion() && M.store.state.settings.sound.music && Math.random() < dt * 0.8) parts.add('note', R.calm.x + 150, R.calm.fy - 72, { vx: M.rand(-8, 8), vy: -18, life: 2 });
    parts.update(dt);
  }
  const cupHome = () => ({ x: R.kitchen.x + 140, y: R.kitchen.fy - 36 });

  // ---------------------------------------------------------------- drawing: static layer
  function drawStatic(c) {
    const sky = M.sky();
    const [top, bot] = M.skyColors(sky);
    const g = c.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, top); g.addColorStop(0.85, bot);
    c.fillStyle = g; c.fillRect(0, 0, W, H);
    if (sky.night > 0.4) {
      const rnd = M.rng(7);
      c.fillStyle = 'rgba(255,250,220,' + (sky.night * 0.9).toFixed(2) + ')';
      for (let i = 0; i < 40; i++) { const x = rnd() * W, y = rnd() * 200; c.beginPath(); c.arc(x, y, rnd() * 1.4 + 0.4, 0, 7); c.fill(); }
      c.fillStyle = '#FFF6D8'; c.beginPath(); c.arc(56, 52, 16, 0, 7); c.fill();
      c.fillStyle = top; c.beginPath(); c.arc(63, 47, 14, 0, 7); c.fill();
    } else {
      c.fillStyle = '#FFE7A8'; c.beginPath(); c.arc(352, 40 + sky.warm * 50, 18, 0, 7); c.fill();
      cloud(c, 70, 50, 0.7); cloud(c, 330, 120, 0.5);
    }
    // hills + ground
    c.fillStyle = M.mixColor('#BDE6CF', '#2F3A55', sky.night * 0.6);
    c.beginPath(); c.moveTo(0, 560); c.quadraticCurveTo(80, 500, 170, 548); c.quadraticCurveTo(260, 490, 400, 540); c.lineTo(400, 600); c.lineTo(0, 600); c.fill();
    c.fillStyle = M.mixColor('#A8DBA8', '#2E4A45', sky.night * 0.6);
    c.fillRect(0, 568, W, H - 568);
    const rnd2 = M.rng(3);
    for (let i = 0; i < 26; i++) {
      const x = rnd2() * W, y = 580 + rnd2() * 34;
      c.fillStyle = ['#FF9EB5', '#FFE08A', '#FFFDF8', '#CFC4F2'][i % 4];
      c.globalAlpha = 1 - sky.night * 0.5; c.beginPath(); c.arc(x, y, 2.2, 0, 7); c.fill(); c.globalAlpha = 1;
    }
    // chimney + roof
    c.lineWidth = 3; c.strokeStyle = OUT; c.lineJoin = 'round';
    c.fillStyle = '#E8B79A'; M.rr(c, 296, 34, 28, 56, 3); c.fill(); c.stroke();
    c.fillStyle = '#D99A7E'; M.rr(c, 292, 30, 36, 10, 3); c.fill(); c.stroke();
    c.fillStyle = '#F0A38A';
    c.beginPath(); c.moveTo(6, 114); c.quadraticCurveTo(100, 64, 200, 18); c.quadraticCurveTo(300, 64, 394, 114); c.closePath(); c.fill(); c.stroke();
    c.save(); c.clip();
    c.strokeStyle = 'rgba(91,70,54,0.25)'; c.lineWidth = 2;
    for (let row = 0; row < 6; row++) {
      const y = 40 + row * 15;
      for (let x = -10; x < 410; x += 18) { c.beginPath(); c.arc(x + (row % 2) * 9, y, 9, 0, Math.PI); c.stroke(); }
    }
    c.restore();
    c.strokeStyle = OUT; c.lineWidth = 3;
    c.beginPath(); c.moveTo(6, 114); c.quadraticCurveTo(100, 64, 200, 18); c.quadraticCurveTo(300, 64, 394, 114); c.closePath(); c.stroke();
    // attic window
    c.fillStyle = '#FFFDF8'; c.beginPath(); c.arc(200, 78, 17, 0, 7); c.fill(); c.stroke();
    const ag = c.createLinearGradient(0, 62, 0, 94); ag.addColorStop(0, top); ag.addColorStop(1, bot);
    c.fillStyle = sky.night > 0.5 ? '#FFD98A' : ag; c.beginPath(); c.arc(200, 78, 12, 0, 7); c.fill(); c.stroke();
    c.beginPath(); c.moveTo(188, 78); c.lineTo(212, 78); c.moveTo(200, 66); c.lineTo(200, 90); c.lineWidth = 2; c.stroke();
    // house shell
    c.lineWidth = 3;
    c.fillStyle = '#F7D9BC'; c.fillRect(24, 110, 352, 462); c.strokeRect(24, 110, 352, 462);
    // night tint over the exterior only (interiors stay warm and lit)
    if (sky.night > 0) { c.fillStyle = 'rgba(30,26,70,' + (sky.night * 0.35).toFixed(3) + ')'; c.fillRect(0, 0, W, H); }
    if (sky.warm > 0) { c.fillStyle = 'rgba(255,160,110,' + (sky.warm * 0.08).toFixed(3) + ')'; c.fillRect(0, 0, W, H); }
    // rooms
    ROOMS.forEach((r) => drawRoom(c, r, sky, top, bot));
    // slabs and walls
    for (let f = 0; f < 3; f++) {
      const y = floorTop(f) + FLOOR_H;
      c.fillStyle = '#D9B48F'; c.fillRect(24, y, 352, SLAB); c.strokeRect(24, y, 352, SLAB);
      c.fillStyle = 'rgba(91,70,54,0.18)'; for (let x = 40; x < 376; x += 46) c.fillRect(x, y + 3, 2, SLAB - 6);
      // middle wall with an arched doorway
      const wt = floorTop(f);
      c.fillStyle = '#E9C7A6';
      c.beginPath(); c.moveTo(196, wt); c.lineTo(204, wt); c.lineTo(204, wt + 46); c.quadraticCurveTo(200, wt + 38, 196, wt + 46); c.closePath(); c.fill();
      c.lineWidth = 2; c.beginPath(); c.moveTo(196, wt); c.lineTo(196, wt + 46); c.moveTo(204, wt); c.lineTo(204, wt + 46); c.stroke();
      c.lineWidth = 3;
    }
    c.fillStyle = '#D9B48F'; c.fillRect(24, 106, 352, 6);
    c.strokeRect(24, 110, 352, 462);
    c.fillStyle = '#E9C7A6'; c.fillRect(24, 110, 10, 462); c.fillRect(366, 110, 10, 462);
    c.strokeRect(24, 110, 10, 462); c.strokeRect(366, 110, 10, 462);
    // front steps
    c.fillStyle = '#E5CDB0'; M.rr(c, 300, 572, 70, 8, 3); c.fill(); c.stroke();
  }

  function cloud(c, x, y, s) {
    c.save(); c.translate(x, y); c.scale(s, s); c.fillStyle = 'rgba(255,255,255,0.9)';
    c.beginPath(); c.arc(-22, 6, 16, 0, 7); c.arc(0, -4, 22, 0, 7); c.arc(24, 4, 17, 0, 7); c.arc(4, 12, 18, 0, 7); c.fill(); c.restore();
  }

  function windowRect(c, x, y, w, hh, top, bot, sky, opts) {
    c.fillStyle = '#FFFDF8'; M.rr(c, x - 4, y - 4, w + 8, hh + 8, 6); c.fill(); c.stroke();
    const g = c.createLinearGradient(0, y, 0, y + hh); g.addColorStop(0, top); g.addColorStop(1, bot);
    c.fillStyle = g; M.rr(c, x, y, w, hh, 4); c.fill();
    if (sky.night > 0.5) { c.fillStyle = '#FFF6D8'; for (let i = 0; i < 4; i++) { c.beginPath(); c.arc(x + 6 + ((i * 13) % w), y + 6 + ((i * 7) % (hh - 10)), 1, 0, 7); c.fill(); } }
    else { c.save(); M.rr(c, x, y, w, hh, 4); c.clip(); cloud(c, x + w * 0.6, y + hh * 0.4, 0.3); c.restore(); }
    c.lineWidth = 2; M.rr(c, x, y, w, hh, 4); c.stroke();
    c.beginPath(); c.moveTo(x + w / 2, y); c.lineTo(x + w / 2, y + hh); c.moveTo(x, y + hh / 2); c.lineTo(x + w, y + hh / 2); c.stroke();
    if (opts && opts.curtains) {
      c.fillStyle = opts.curtains;
      c.beginPath(); c.moveTo(x - 6, y - 6); c.quadraticCurveTo(x + 8, y + hh * 0.5, x - 2, y + hh + 4); c.lineTo(x - 8, y + hh + 4); c.closePath(); c.fill(); c.stroke();
      c.beginPath(); c.moveTo(x + w + 6, y - 6); c.quadraticCurveTo(x + w - 8, y + hh * 0.5, x + w + 2, y + hh + 4); c.lineTo(x + w + 8, y + hh + 4); c.closePath(); c.fill(); c.stroke();
    }
    c.lineWidth = 2.6;
  }

  function plant(c, x, y, s) {
    c.save(); c.translate(x, y); c.scale(s, s);
    c.fillStyle = '#8FCB9B';
    for (const [a, l] of [[-0.9, 16], [-0.3, 20], [0.3, 19], [0.9, 15]]) { c.save(); c.rotate(a); c.beginPath(); c.ellipse(0, -l / 2 - 8, 5, l / 2, 0, 0, 7); c.fill(); c.stroke(); c.restore(); }
    c.fillStyle = '#F0A38A'; c.beginPath(); c.moveTo(-9, -10); c.lineTo(9, -10); c.lineTo(6, 2); c.lineTo(-6, 2); c.closePath(); c.fill(); c.stroke();
    c.restore();
  }

  function drawRoom(c, r, sky, top, bot) {
    const { x, y, w, h: hh, fy } = r;
    const st = M.store.state;
    const owned = (id) => st.owned.decor.includes(id) && !st.decorOff.includes(id);
    c.save();
    c.beginPath(); c.rect(x, y, w, hh); c.clip();
    c.fillStyle = r.wall; c.fillRect(x, y, w, hh);
    // wallpaper
    c.fillStyle = r.pat; c.strokeStyle = r.pat; c.lineWidth = 2;
    if (r.pattern === 'dots') for (let i = 0; i < 9; i++) for (let j = 0; j < 7; j++) { c.beginPath(); c.arc(x + 9 + i * 18 + (j % 2) * 9, y + 10 + j * 18, 2.4, 0, 7); c.fill(); }
    if (r.pattern === 'stars') for (let i = 0; i < 7; i++) for (let j = 0; j < 6; j++) star(c, x + 12 + i * 24 + (j % 2) * 12, y + 12 + j * 22, 3);
    if (r.pattern === 'tiles') { for (let yy = y + 70; yy < fy; yy += 12) { c.beginPath(); c.moveTo(x, yy); c.lineTo(x + w, yy); c.stroke(); } for (let xx = x; xx < x + w; xx += 12) { c.beginPath(); c.moveTo(xx, y + 70); c.lineTo(xx, fy); c.stroke(); } }
    if (r.pattern === 'stripes') for (let xx = x + 6; xx < x + w; xx += 16) c.fillRect(xx, y, 6, hh);
    if (r.pattern === 'diag') for (let k = -hh; k < w; k += 18) { c.beginPath(); c.moveTo(x + k, y + hh); c.lineTo(x + k + hh, y); c.lineWidth = 5; c.stroke(); }
    if (r.pattern === 'leaves') for (let i = 0; i < 6; i++) for (let j = 0; j < 5; j++) { c.beginPath(); c.ellipse(x + 14 + i * 27 + (j % 2) * 13, y + 14 + j * 24, 5, 2.6, 0.6, 0, 7); c.fill(); }
    // floor boards
    c.fillStyle = '#E2BE97'; c.fillRect(x, fy - 4, w, hh - (fy - 4 - y));
    c.strokeStyle = 'rgba(91,70,54,0.25)'; c.lineWidth = 1.5;
    for (let xx = x + 10; xx < x + w; xx += 28) { c.beginPath(); c.moveTo(xx, fy - 4); c.lineTo(xx - 4, y + hh); c.stroke(); }
    c.fillStyle = '#F7EBDD'; c.fillRect(x, fy - 8, w, 4);
    c.strokeStyle = OUT; c.lineWidth = 2.6; c.lineJoin = 'round';

    if (r.id === 'bedroom') {
      windowRect(c, x + 16, y + 28, 48, 38, top, bot, sky, { curtains: '#FFC8A2' });
      // bench
      c.fillStyle = '#D9B48F'; c.fillRect(x + 14, y + 80, 5, fy - (y + 80)); c.fillRect(x + 62, y + 80, 5, fy - (y + 80));
      c.strokeRect(x + 14, y + 80, 5, fy - (y + 80)); c.strokeRect(x + 62, y + 80, 5, fy - (y + 80));
      c.fillStyle = '#E8C29C'; M.rr(c, x + 10, y + 78, 62, 8, 3); c.fill(); c.stroke();
      c.fillStyle = '#BDE6CF'; M.rr(c, x + 16, y + 73, 50, 7, 3); c.fill(); c.stroke();
      // bed
      const mood = st.today.mood ? M.data.MOODS[st.today.mood].color : '#FFE3B8';
      c.fillStyle = '#D9B48F'; M.rr(c, x + 148, fy - 60, 12, 60, [5, 0, 0, 5]); c.fill(); c.stroke();
      c.fillStyle = '#FFFDF8'; M.rr(c, x + 92, fy - 32, 58, 16, 5); c.fill(); c.stroke();
      c.fillStyle = '#D9B48F'; c.fillRect(x + 94, fy - 16, 5, 16); c.strokeRect(x + 94, fy - 16, 5, 16);
      c.fillStyle = '#FFFDF8'; M.rr(c, x + 128, fy - 42, 20, 11, 5); c.fill(); c.stroke();
      c.fillStyle = mood; M.rr(c, x + 88, fy - 36, 46, 24, [8, 4, 6, 8]); c.fill(); c.stroke();
      c.strokeStyle = 'rgba(91,70,54,0.25)'; c.lineWidth = 1.5;
      for (let i = 0; i < 3; i++) { c.beginPath(); c.moveTo(x + 96 + i * 12, fy - 34); c.lineTo(x + 96 + i * 12, fy - 14); c.stroke(); }
      c.strokeStyle = OUT; c.lineWidth = 2.6;
      // rug
      c.fillStyle = '#CFC4F2'; c.beginPath(); c.ellipse(x + 64, fy - 1, 28, 5, 0, 0, 7); c.fill(); c.stroke();
      if (owned('plant')) { c.fillStyle = '#D9B48F'; M.rr(c, x + 86, y + 50, 40, 5, 2); c.fill(); c.stroke(); plant(c, x + 100, y + 48, 0.8); c.fillStyle = '#A9D6F5'; M.rr(c, x + 112, y + 36, 7, 14, 1); c.fill(); c.stroke(); }
      if (owned('lights')) {
        c.lineWidth = 1.5; c.beginPath(); c.moveTo(x, y + 20); c.quadraticCurveTo(x + w / 2, y + 34, x + w, y + 20); c.stroke();
        const cols = ['#FFE08A', '#FF9EB5', '#A9D6F5', '#BDE6CF'];
        for (let i = 1; i < 10; i++) {
          const k = i / 10, bx = x + w * k, by = y + 20 + 14 * (1 - Math.pow(2 * k - 1, 2)) * 0.98 + 3;
          if (sky.night > 0.3) { c.fillStyle = 'rgba(255,224,138,0.35)'; c.beginPath(); c.arc(bx, by, 6, 0, 7); c.fill(); }
          c.fillStyle = cols[i % 4]; c.beginPath(); c.arc(bx, by, 2.6, 0, 7); c.fill();
        }
        c.lineWidth = 2.6;
      }
    } else if (r.id === 'calm') {
      // painting
      c.fillStyle = '#FFFDF8'; M.rr(c, x + 28, y + 30, 54, 34, 3); c.fill(); c.stroke();
      c.fillStyle = '#A9D6F5'; c.fillRect(x + 32, y + 34, 46, 26);
      c.fillStyle = '#BDE6CF'; c.beginPath(); c.moveTo(x + 32, y + 60); c.quadraticCurveTo(x + 50, y + 44, x + 78, y + 56); c.lineTo(x + 78, y + 60); c.fill();
      c.fillStyle = '#FFE08A'; c.beginPath(); c.arc(x + 68, y + 42, 4, 0, 7); c.fill();
      // sofa
      c.fillStyle = '#FFC8A2';
      M.rr(c, x + 14, fy - 48, 88, 28, 10); c.fill(); c.stroke();
      M.rr(c, x + 12, fy - 26, 92, 14, 6); c.fill(); c.stroke();
      M.rr(c, x + 6, fy - 36, 14, 26, 6); c.fill(); c.stroke();
      M.rr(c, x + 96, fy - 36, 14, 26, 6); c.fill(); c.stroke();
      c.fillStyle = '#BDE6CF'; M.rr(c, x + 24, fy - 42, 18, 16, 6); c.fill(); c.stroke();
      c.fillStyle = '#CFC4F2'; M.rr(c, x + 76, fy - 42, 18, 16, 6); c.fill(); c.stroke();
      c.fillStyle = '#B98A66'; c.fillRect(x + 16, fy - 12, 5, 10); c.fillRect(x + 96, fy - 12, 5, 10);
      // fireplace
      c.fillStyle = '#E8C9B0'; M.rr(c, x + 114, fy - 58, 44, 58, [6, 6, 0, 0]); c.fill(); c.stroke();
      c.fillStyle = '#5B4636'; M.rr(c, x + 122, fy - 40, 28, 40, [12, 12, 0, 0]); c.fill();
      c.fillStyle = '#D9B48F'; M.rr(c, x + 110, fy - 62, 52, 7, 3); c.fill(); c.stroke();
      // radio on the mantel
      c.fillStyle = '#A9D6F5'; M.rr(c, x + 140, fy - 74, 16, 12, 3); c.fill(); c.stroke();
      c.fillStyle = '#FFFDF8'; c.beginPath(); c.arc(x + 145, fy - 68, 3, 0, 7); c.fill();
    } else if (r.id === 'kitchen') {
      c.fillStyle = '#BDE6CF'; M.rr(c, x + 8, y + 26, 54, 26, 4); c.fill(); c.stroke();
      c.beginPath(); c.moveTo(x + 35, y + 26); c.lineTo(x + 35, y + 52); c.stroke();
      windowRect(c, x + 98, y + 28, 46, 32, top, bot, sky, null);
      plant(c, x + 112, y + 64, 0.55);
      // counter + stove
      c.fillStyle = '#FFFDF8'; M.rr(c, x + 6, fy - 40, 60, 40, 3); c.fill(); c.stroke();
      c.beginPath(); c.moveTo(x + 36, fy - 40); c.lineTo(x + 36, fy); c.stroke();
      c.fillStyle = '#D9B48F'; M.rr(c, x + 4, fy - 46, 64, 7, 3); c.fill(); c.stroke();
      c.fillStyle = '#F0A38A'; M.rr(c, x + 12, fy - 60, 22, 14, [3, 3, 6, 6]); c.fill(); c.stroke();
      c.fillStyle = '#FFE08A'; M.rr(c, x + 44, fy - 58, 12, 12, 3); c.fill(); c.stroke();
      // table
      c.fillStyle = '#D9B48F'; M.rr(c, x + 84, fy - 37, 70, 6, 3); c.fill(); c.stroke();
      c.fillRect(x + 90, fy - 31, 5, 31); c.strokeRect(x + 90, fy - 31, 5, 31);
      c.fillRect(x + 143, fy - 31, 5, 31); c.strokeRect(x + 143, fy - 31, 5, 31);
      // bowls
      c.fillStyle = '#A9D6F5'; M.rr(c, x + 66, fy - 6, 16, 7, [2, 2, 5, 5]); c.fill(); c.stroke();
      c.fillStyle = '#FFC8A2'; M.rr(c, x + 112, fy - 6, 16, 7, [2, 2, 5, 5]); c.fill(); c.stroke();
    } else if (r.id === 'mail') {
      c.fillStyle = '#E8C29C'; M.rr(c, x + 10, y + 28, 68, 44, 4); c.fill(); c.stroke();
      for (let i = 0; i < 3; i++) for (let j = 0; j < 2; j++) {
        c.fillStyle = '#C9A27F'; M.rr(c, x + 14 + i * 21, y + 32 + j * 19, 18, 16, 2); c.fill();
        if ((i + j) % 2 === 0) { c.fillStyle = '#FFFDF8'; c.fillRect(x + 16 + i * 21, y + 38 + j * 19, 14, 9); c.strokeStyle = '#FF9EB5'; c.lineWidth = 1; c.strokeRect(x + 16 + i * 21, y + 38 + j * 19, 14, 9); c.strokeStyle = OUT; c.lineWidth = 2.6; }
      }
      // desk + paper boat
      c.fillStyle = '#D9B48F'; M.rr(c, x + 10, fy - 36, 70, 6, 3); c.fill(); c.stroke();
      c.fillRect(x + 14, fy - 30, 5, 30); c.strokeRect(x + 14, fy - 30, 5, 30); c.fillRect(x + 71, fy - 30, 5, 30); c.strokeRect(x + 71, fy - 30, 5, 30);
      c.fillStyle = '#FFFDF8'; c.beginPath(); c.moveTo(x + 30, fy - 44); c.lineTo(x + 54, fy - 44); c.lineTo(x + 48, fy - 37); c.lineTo(x + 36, fy - 37); c.closePath(); c.fill(); c.stroke();
      c.beginPath(); c.moveTo(x + 42, fy - 56); c.lineTo(x + 42, fy - 44); c.lineTo(x + 50, fy - 46); c.closePath(); c.fill(); c.stroke();
      // corkboard + shelf
      c.fillStyle = '#E8C29C'; M.rr(c, x + 94, y + 28, 58, 30, 3); c.fill(); c.stroke();
      [['#FFC8A2', 98, 32], ['#BDE6CF', 118, 36], ['#CFC4F2', 134, 31]].forEach(([col, px, py]) => { c.fillStyle = col; c.fillRect(x + px, y + py, 14, 10); c.fillStyle = '#FF6F96'; c.beginPath(); c.arc(x + px + 7, y + py + 1, 1.5, 0, 7); c.fill(); });
      c.fillStyle = '#D9B48F'; M.rr(c, x + 92, y + 74, 62, 5, 2); c.fill(); c.stroke();
      if (owned('cattree')) {
        c.fillStyle = '#E8C29C'; c.fillRect(x + 134, fy - 48, 8, 48); c.strokeRect(x + 134, fy - 48, 8, 48);
        c.fillStyle = '#CFC4F2'; M.rr(c, x + 120, fy - 52, 36, 7, 3); c.fill(); c.stroke(); M.rr(c, x + 126, fy - 26, 30, 7, 3); c.fill(); c.stroke();
        c.fillStyle = '#BDE6CF'; M.rr(c, x + 122, fy - 6, 36, 6, 3); c.fill(); c.stroke();
      }
    } else if (r.id === 'worry') {
      c.fillStyle = '#FFFDF8'; M.rr(c, x + 14, y + 28, 86, 28, 5); c.fill(); c.stroke();
      c.fillStyle = OUT; c.font = '700 8.5px ' + M.FONT; c.fillText('worries go here', x + 21, y + 40, 74); c.fillText('↓ the cat eats them', x + 21, y + 51, 74);
      c.fillStyle = '#A9D6F5'; M.rr(c, x + 10, fy - 16, 56, 16, 5); c.fill(); c.stroke();
      c.fillStyle = '#EED9B0'; M.rr(c, x + 15, fy - 20, 46, 7, 3); c.fill();
      // cute shredder
      c.fillStyle = '#CFC4F2'; M.rr(c, x + 82, fy - 36, 30, 36, 6); c.fill(); c.stroke();
      c.fillStyle = OUT; c.fillRect(x + 86, fy - 33, 22, 3);
      c.beginPath(); c.arc(x + 91, fy - 20, 1.8, 0, 7); c.arc(x + 103, fy - 20, 1.8, 0, 7); c.fill();
      c.beginPath(); c.lineWidth = 1.5; c.arc(x + 97, fy - 16, 3, 0.2, Math.PI - 0.2); c.stroke(); c.lineWidth = 2.6;
      // basket
      c.fillStyle = '#E8C29C'; c.beginPath(); c.moveTo(x + 120, fy - 22); c.lineTo(x + 146, fy - 22); c.lineTo(x + 142, fy); c.lineTo(x + 124, fy); c.closePath(); c.fill(); c.stroke();
      c.fillStyle = '#FFFDF8'; c.beginPath(); c.arc(x + 128, fy - 24, 5, 0, 7); c.arc(x + 138, fy - 25, 4.5, 0, 7); c.fill(); c.stroke();
    } else if (r.id === 'garden') {
      // sign
      c.fillStyle = '#FFFDF8'; M.rr(c, x + 40, y + 26, 82, 14, 4); c.fill(); c.stroke();
      c.fillStyle = OUT; c.font = '800 9px ' + M.FONT; c.fillText('Whisker Isles  →', x + 48, y + 36);
      // door
      c.fillStyle = '#8FCB9B'; c.beginPath(); c.moveTo(x + 58, fy); c.lineTo(x + 58, fy - 64); c.quadraticCurveTo(x + 58, fy - 90, x + 82, fy - 90); c.quadraticCurveTo(x + 106, fy - 90, x + 106, fy - 64); c.lineTo(x + 106, fy); c.closePath(); c.fill(); c.stroke();
      c.fillStyle = sky.night > 0.5 ? '#4B4680' : '#A9D6F5'; c.beginPath(); c.arc(x + 82, fy - 66, 10, 0, 7); c.fill(); c.stroke();
      c.fillStyle = '#FFE08A'; c.beginPath(); c.arc(x + 98, fy - 38, 3, 0, 7); c.fill(); c.stroke();
      c.fillStyle = '#FFC8A2'; M.rr(c, x + 52, fy - 4, 60, 5, 2); c.fill(); c.stroke();
      // hooks + umbrella stand + big plant
      c.fillStyle = '#D9B48F'; M.rr(c, x + 10, y + 52, 34, 5, 2); c.fill(); c.stroke();
      c.fillStyle = '#FF9E7A'; M.rr(c, x + 14, y + 56, 8, 22, 3); c.fill(); c.stroke();
      c.fillStyle = '#A9D6F5'; M.rr(c, x + 14, fy - 24, 18, 24, 3); c.fill(); c.stroke();
      c.strokeStyle = '#F0A38A'; c.lineWidth = 3; c.beginPath(); c.moveTo(x + 20, fy - 24); c.lineTo(x + 18, fy - 46); c.stroke(); c.strokeStyle = OUT; c.lineWidth = 2.6;
      plant(c, x + 134, fy, 1.3);
      if (owned('bunting')) {
        c.lineWidth = 1.5; c.beginPath(); c.moveTo(x, y + 12); c.quadraticCurveTo(x + w / 2, y + 22, x + w, y + 12); c.stroke();
        const cols = ['#FF9EB5', '#FFE08A', '#A9D6F5', '#BDE6CF', '#CFC4F2'];
        for (let i = 0; i < 9; i++) { const bx = x + 10 + i * 17, by = y + 13 + 8 * (1 - Math.pow((i - 4) / 4.5, 2)); c.fillStyle = cols[i % 5]; c.beginPath(); c.moveTo(bx - 5, by); c.lineTo(bx + 5, by); c.lineTo(bx, by + 9); c.closePath(); c.fill(); c.stroke(); }
        c.lineWidth = 2.6;
      }
    }
    c.restore();
    // hanging room sign (outside clip so it reads clearly)
    c.save();
    c.font = '800 9.5px ' + M.FONT;
    const label = r.label;
    const tw = c.measureText(label).width + 12;
    const sx = r.id === 'garden' ? x + w - tw - 6 : x + w / 2 - tw / 2;
    const sy = r.id === 'garden' ? y + 6 : y + 4;
    if (r.id !== 'garden') {
      c.fillStyle = 'rgba(255,253,248,0.92)'; c.strokeStyle = OUT; c.lineWidth = 1.6;
      M.rr(c, sx, sy, tw, 14, 6); c.fill(); c.stroke();
      c.fillStyle = OUT; c.fillText(label, sx + 6, sy + 10.5);
    }
    c.restore();
  }

  function star(c, x, y, r) {
    c.beginPath();
    for (let i = 0; i < 10; i++) { const rr = i % 2 ? r * 0.45 : r; const a = (i * Math.PI) / 5 - Math.PI / 2; c.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); }
    c.closePath(); c.fill();
  }

  // ---------------------------------------------------------------- drawing: dynamic layer
  function draw() {
    const cssW = canvas.clientWidth || 360;
    scale = cssW / W;
    const key = [Math.round(cssW), dpr, M.store.state.today.mood, M.store.state.owned.decor.join(), M.store.state.decorOff.join(), skyKey()].join('|');
    if (key !== staticKey) {
      staticKey = key;
      staticCv = staticCv || document.createElement('canvas');
      staticCv.width = Math.round(W * scale * dpr); staticCv.height = Math.round(H * scale * dpr);
      const sc = staticCv.getContext('2d');
      sc.setTransform(scale * dpr, 0, 0, scale * dpr, 0, 0);
      drawStatic(sc);
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(staticCv, 0, 0);
    ctx.setTransform(scale * dpr, 0, 0, scale * dpr, 0, 0);
    const reduce = M.reducedMotion();
    const st = M.store.state;
    ctx.lineJoin = 'round';
    // chimney smoke
    if (!reduce) for (let i = 0; i < 3; i++) {
      const k = ((t * 0.25 + i / 3) % 1);
      ctx.fillStyle = 'rgba(255,255,255,' + (0.6 * (1 - k)).toFixed(2) + ')';
      ctx.beginPath(); ctx.arc(310 + Math.sin(t + i) * 6 + k * 14, 26 - k * 30, 5 + k * 8, 0, 7); ctx.fill();
    }
    // rain on windows
    if (st.settings.sound.rain && !reduce) {
      ctx.strokeStyle = 'rgba(120,160,210,0.7)'; ctx.lineWidth = 1;
      for (const [wx, wy, ww, wh] of [[R.bedroom.x + 16, R.bedroom.y + 28, 48, 38], [R.kitchen.x + 98, R.kitchen.y + 28, 46, 32]]) {
        ctx.save(); ctx.beginPath(); ctx.rect(wx, wy, ww, wh); ctx.clip();
        for (let i = 0; i < 8; i++) { const rx = wx + ((i * 13 + t * 20) % ww), ry = wy + ((i * 17 + t * 90) % wh); ctx.beginPath(); ctx.moveTo(rx, ry); ctx.lineTo(rx - 2, ry + 6); ctx.stroke(); }
        ctx.restore();
      }
    }
    // birds outside the bedroom window when the cat is watching
    if (cat.cur && cat.cur.birds) {
      const wx = R.bedroom.x + 16, wy = R.bedroom.y + 28;
      ctx.save(); ctx.beginPath(); ctx.rect(wx, wy, 48, 38); ctx.clip();
      ctx.strokeStyle = OUT; ctx.lineWidth = 1.4;
      for (let i = 0; i < 2; i++) {
        const bx = wx + ((t * (10 + i * 4) + i * 30) % 70) - 10, by = wy + 10 + i * 9 + Math.sin(t * 3 + i) * 2, f = Math.sin(t * 10 + i) * 2;
        ctx.beginPath(); ctx.moveTo(bx - 4, by - f); ctx.quadraticCurveTo(bx - 2, by - 2, bx, by); ctx.quadraticCurveTo(bx + 2, by - 2, bx + 4, by - f); ctx.stroke();
      }
      ctx.restore();
    }
    // fire
    const fx = R.calm.x + 136, fyy = R.calm.fy - 2;
    for (let i = 0; i < 3; i++) {
      const hh = 16 + (reduce ? 0 : Math.sin(t * 9 + i * 2) * 3) - i * 3;
      ctx.fillStyle = ['#FFB070', '#FFD27A', '#FFF1B8'][i];
      ctx.beginPath(); ctx.moveTo(fx - 9 + i * 3, fyy); ctx.quadraticCurveTo(fx - 8 + i * 3, fyy - hh * 0.6, fx + (reduce ? 0 : Math.sin(t * 6 + i)), fyy - hh);
      ctx.quadraticCurveTo(fx + 8 - i * 3, fyy - hh * 0.6, fx + 9 - i * 3, fyy); ctx.closePath(); ctx.fill();
    }
    ctx.fillStyle = 'rgba(255,190,110,0.18)'; ctx.beginPath(); ctx.arc(fx, fyy - 10, 30, 0, 7); ctx.fill();
    // fish bowl
    if (st.owned.decor.includes('fishbowl') && !st.decorOff.includes('fishbowl')) {
      const bx = R.calm.x + 122, by = R.calm.fy - 72;
      ctx.strokeStyle = OUT; ctx.lineWidth = 1.8; ctx.fillStyle = 'rgba(169,214,245,0.75)';
      ctx.beginPath(); ctx.arc(bx, by, 9, 0, 7); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#FFB070'; const fxx = bx + Math.sin(t * 1.3) * 4;
      ctx.beginPath(); ctx.ellipse(fxx, by + 1, 3, 2, 0, 0, 7); ctx.fill();
    }
    // bottles on the mailroom shelf (glow softly when something new arrived — no red badges)
    const glow = M.bottles && M.bottles.hasNew();
    for (let i = 0; i < 3; i++) {
      const bx = R.mail.x + 104 + i * 18, by = R.mail.y + 74;
      if (glow) { ctx.fillStyle = 'rgba(255,224,138,' + (0.35 + 0.2 * Math.sin(t * 2 + i)).toFixed(2) + ')'; ctx.beginPath(); ctx.arc(bx, by - 9, 11, 0, 7); ctx.fill(); }
      ctx.fillStyle = ['rgba(189,230,207,0.9)', 'rgba(169,214,245,0.9)', 'rgba(207,196,242,0.9)'][i];
      ctx.strokeStyle = OUT; ctx.lineWidth = 1.8;
      M.rr(ctx, bx - 5, by - 16, 10, 16, 3); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#C9A27F'; ctx.fillRect(bx - 2.5, by - 21, 5, 5); ctx.strokeRect(bx - 2.5, by - 21, 5, 5);
      ctx.fillStyle = '#FFFDF8'; ctx.fillRect(bx - 2, by - 11, 4, 6);
    }
    // cup
    ctx.save(); ctx.translate(cup.x, cup.y); if (cup.state !== 'table') ctx.rotate(cup.state === 'floor' ? 1.4 : cup.t * 8);
    ctx.fillStyle = '#FF9EB5'; ctx.strokeStyle = OUT; ctx.lineWidth = 1.8;
    M.rr(ctx, -5, -10, 10, 10, 2); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.arc(6, -5, 3, -1.4, 1.4); ctx.stroke(); ctx.restore();
    // yarn ball
    if (cat.cur && cat.cur.toy) {
      const yx = cat.x + 22 * cat.dir + (reduce ? 0 : Math.sin(t * 3) * 4), yy = cat.y - 6;
      ctx.fillStyle = '#FF9EB5'; ctx.strokeStyle = OUT; ctx.lineWidth = 1.8;
      ctx.beginPath(); ctx.arc(yx, yy, 6, 0, 7); ctx.fill(); ctx.stroke();
      ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(yx, yy, 3.5, 0.5, 2.6); ctx.stroke();
    }
    // box + cat
    const bx = SPOTS.box.x, by = SPOTS.box.y;
    const boxBack = () => { ctx.fillStyle = '#C99A6E'; ctx.strokeStyle = OUT; ctx.lineWidth = 2.2; ctx.beginPath(); ctx.moveTo(bx - 22, by - 26); ctx.lineTo(bx + 22, by - 26); ctx.lineTo(bx + 20, by - 18); ctx.lineTo(bx - 20, by - 18); ctx.closePath(); ctx.fill(); ctx.stroke(); };
    const boxFront = () => {
      ctx.fillStyle = '#E3B98C'; ctx.strokeStyle = OUT; ctx.lineWidth = 2.2;
      M.rr(ctx, bx - 21, by - 19, 42, 19, 2); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(bx - 21, by - 19); ctx.lineTo(bx - 30, by - 30); ctx.lineTo(bx - 22, by - 27); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle = 'rgba(91,70,54,0.3)'; ctx.fillRect(bx - 4, by - 19, 8, 6);
    };
    const catOpts = { x: cat.x, y: cat.y, s: 0.85, pose: cat.pose, t, dir: cat.dir, expr: cat.expr, phase: cat.phase, alpha: cat.alpha, rot: cat.rot, coat: st.cat.coat, acc: st.cat.acc };
    if (cat.inBox) {
      boxBack();
      const sink = cat.inBox === 'stuck' ? 20 : -6;
      M.cat.draw(ctx, Object.assign(catOpts, { y: cat.y + sink, noShadow: true }));
      if (cat.inBox === true) {
        const mood = st.today.mood ? M.data.MOODS[st.today.mood].color : '#FFE3B8';
        ctx.fillStyle = mood; ctx.strokeStyle = OUT; ctx.lineWidth = 2;
        // blanket tucked over the body, head peeking out on the right
        ctx.beginPath(); ctx.moveTo(bx - 24, by - 19); ctx.quadraticCurveTo(bx - 14, by - 34, bx - 2, by - 27); ctx.quadraticCurveTo(bx + 3, by - 24, bx + 4, by - 17); ctx.lineTo(bx - 22, by - 14); ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.strokeStyle = 'rgba(91,70,54,0.3)'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(bx - 16, by - 28); ctx.lineTo(bx - 14, by - 17); ctx.moveTo(bx - 8, by - 29); ctx.lineTo(bx - 6, by - 17); ctx.stroke();
      }
      boxFront();
    } else {
      boxBack(); boxFront();
      if (cat.pose === 'run' && !reduce) {
        ctx.strokeStyle = 'rgba(91,70,54,0.4)'; ctx.lineWidth = 2;
        for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.moveTo(cat.x - cat.dir * (24 + i * 4), cat.y - 10 - i * 8); ctx.lineTo(cat.x - cat.dir * (38 + i * 6), cat.y - 10 - i * 8); ctx.stroke(); }
      }
      M.cat.draw(ctx, catOpts);
    }
    parts.draw(ctx);
    if (cat.bubble) M.drawBubble(ctx, cat.x, cat.y - (cat.pose === 'sleep' ? 34 : 58), cat.bubble, { maxX: W });
  }
  let skyMemo = { at: 0, key: '' };
  function skyKey() {
    const now = Date.now();
    if (now - skyMemo.at > 20000 || skyMemo.mode !== M.store.state.settings.dayNight) {
      const s = M.sky();
      skyMemo = { at: now, key: Math.round(s.night * 10) + ':' + Math.round(s.warm * 10), mode: M.store.state.settings.dayNight };
    }
    return skyMemo.key;
  }

  // ---------------------------------------------------------------- loop & input
  function resize() {
    const cssW = Math.min(wrap.clientWidth || 360, 560);
    dpr = M.fitCanvas(canvas, cssW, cssW * (H / W), 2);
    staticKey = '';
  }
  function loop(now) {
    if (!running) return;
    raf = requestAnimationFrame(loop);
    const dt = Math.min(0.1, (now - last) / 1000);
    acc += dt; last = now;
    if (acc < 1 / 31) return; // ~30 fps is plenty for a cozy scene and saves battery
    const step = acc; acc = 0;
    update(step); draw();
  }

  function hitRoom(lx, ly) { return ROOMS.find((r) => lx >= r.x && lx <= r.x + r.w && ly >= r.y && ly <= r.y + r.h); }

  const mansion = {
    ROOMS,
    init() {
      canvas = M.$('#mansionCanvas'); ctx = canvas.getContext('2d'); wrap = M.$('#mansionWrap');
      const btns = M.$('#roomButtons');
      ROOMS.forEach((r) => {
        btns.append(M.h('button', {
          class: 'room-btn', 'aria-label': r.icon + ' ' + r.label,
          style: { left: (r.x / W) * 100 + '%', top: (r.y / H) * 100 + '%', width: (r.w / W) * 100 + '%', height: (r.h / H) * 100 + '%' },
          onclick: () => mansion.openRoom(r.id),
        }));
      });
      btns.append(M.h('button', { class: 'room-btn sr-pet', 'aria-label': 'Pet your cat', onclick: () => pet() }));
      let down = null;
      wrap.addEventListener('pointerdown', (e) => { down = { x: e.clientX, y: e.clientY }; });
      wrap.addEventListener('pointerup', (e) => {
        if (!down || Math.hypot(e.clientX - down.x, e.clientY - down.y) > 10) { down = null; return; }
        down = null;
        const rect = canvas.getBoundingClientRect();
        const lx = (e.clientX - rect.left) / scale, ly = (e.clientY - rect.top) / scale;
        if (Math.abs(lx - cat.x) < 26 && ly < cat.y + 4 && ly > cat.y - 60) { pet(); return; }
        const r = hitRoom(lx, ly);
        if (r) mansion.openRoom(r.id);
      });
      window.addEventListener('resize', () => { if (running) resize(); });
      M.on('energy', () => goHome());
      M.on('task-done', () => { cat.happyT = 2; parts.burst('heart', cat.x, cat.y - 50, 4); });
      M.on('sky', () => { staticKey = ''; skyMemo.at = 0; });
      M.on('decor', () => { staticKey = ''; });
      goHome();
      // start already settled at home so the first frame isn't a walk across the house
      while (cat.queue.length && cat.queue[0].type !== 'pose' && cat.queue[0].type !== 'zoom') {
        const s = cat.queue.shift();
        if (s.type === 'poof') { cat.floor = s.floor; cat.x = s.x; cat.y = floorY(s.floor); }
        if (s.type === 'walk') cat.x = s.x;
        if (s.type === 'hop') { cat.x = s.x; cat.y = s.y; }
      }
    },
    openRoom(id) {
      M.audio.ui('pop');
      if (id !== 'garden') visit(id);
      M.app.openRoom(id);
    },
    start() {
      if (running) return;
      running = true; resize(); last = performance.now(); acc = 1;
      raf = requestAnimationFrame(loop);
    },
    stop() { running = false; cancelAnimationFrame(raf); },
    yawn() { cat.queue = [{ type: 'pose', pose: 'yawn', dur: 1.8, say: '*yaaawn*' }, { type: 'call', fn: () => goHome() }]; cat.cur = null; },
    pet,
  };
  M.mansion = mansion;
})(window.M);
