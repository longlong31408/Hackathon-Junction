/* Mochi — shared helpers. Everything lives on the global `M` namespace so the
   app runs from a plain file:// double-click as well as from the server. */
'use strict';
window.M = window.M || {};

(function (M) {
  // ---------- DOM ----------
  M.h = function h(tag, attrs, ...kids) {
    const el = document.createElement(tag);
    if (attrs) {
      for (const k in attrs) {
        const v = attrs[k];
        if (v == null || v === false) continue;
        if (k === 'class') el.className = v;
        else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
        else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
        else if (k === 'value') el.value = v;
        else if (k === 'checked') el.checked = !!v;
        else if (v === true) el.setAttribute(k, '');
        else el.setAttribute(k, v);
      }
    }
    for (const kid of kids.flat(Infinity)) {
      if (kid == null || kid === false) continue;
      el.append(kid.nodeType ? kid : document.createTextNode(String(kid)));
    }
    return el;
  };
  M.$ = (sel, root) => (root || document).querySelector(sel);
  // null-safe append (native Element.append would print "null")
  M.add = function (el, ...kids) {
    for (const k of kids.flat(Infinity)) if (k != null && k !== false) el.append(k.nodeType ? k : String(k));
    return el;
  };

  // ---------- tiny event bus ----------
  const handlers = {};
  M.on = (evt, fn) => { (handlers[evt] = handlers[evt] || []).push(fn); return () => M.off(evt, fn); };
  M.off = (evt, fn) => { handlers[evt] = (handlers[evt] || []).filter((f) => f !== fn); };
  M.emit = (evt, data) => { (handlers[evt] || []).slice().forEach((fn) => { try { fn(data); } catch (e) { console.error(e); } }); };

  // ---------- math ----------
  M.clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  M.lerp = (a, b, t) => a + (b - a) * t;
  M.ease = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
  M.rand = (a, b) => a + Math.random() * (b - a);
  M.pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
  M.dist = (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by);

  // Deterministic RNG (mulberry32) for the hand-crafted world and daily tasks.
  M.rng = function (seed) {
    let a = seed >>> 0;
    return function () {
      a |= 0; a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };
  M.hashStr = function (s) {
    let h = 2166136261;
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  };
  M.hash2 = function (x, y) {
    let h = Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263);
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  };

  M.uid = function () {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    const b = new Uint8Array(16);
    (window.crypto || {}).getRandomValues ? crypto.getRandomValues(b) : b.forEach((_, i) => (b[i] = Math.random() * 256));
    return Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
  };

  // ---------- dates (always the user's local time) ----------
  M.dayKey = function (d) {
    d = d || new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  };
  M.daysBetween = function (keyA, keyB) {
    const [ya, ma, da] = keyA.split('-').map(Number);
    const [yb, mb, db] = keyB.split('-').map(Number);
    return Math.round((Date.UTC(yb, mb - 1, db) - Date.UTC(ya, ma - 1, da)) / 86400000);
  };

  /* Day/night: returns how "night" it is (0..1) and how warm (dawn/dusk) the
     light is. Respects the "world time" setting so it can be pinned. */
  M.sky = function (date) {
    const mode = (M.store && M.store.state && M.store.state.settings.dayNight) || 'clock';
    let h;
    if (mode === 'day') h = 12;
    else if (mode === 'night') h = 23;
    else { date = date || new Date(); h = date.getHours() + date.getMinutes() / 60; }
    let night;
    if (h >= 7 && h < 18) night = 0;
    else if (h >= 18 && h < 21) night = (h - 18) / 3;
    else if (h >= 21 || h < 5) night = 1;
    else night = 1 - (h - 5) / 2; // 5..7 dawn
    const warm = Math.max(0, 1 - Math.abs(h - 19) / 1.6) + Math.max(0, 1 - Math.abs(h - 6.2) / 1.2);
    const late = h >= 23 || h < 4;
    return { h, night: M.clamp(night, 0, 1), warm: M.clamp(warm, 0, 1), late, isNight: night > 0.6 };
  };
  M.skyColors = function (sky) {
    const day = ['#A9D6F5', '#DFF1FB'];
    const dusk = ['#F7B8A8', '#FFE2C2'];
    const night = ['#2D2B57', '#4B4680'];
    const mix = (a, b, t) => {
      const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
      const r = Math.round(M.lerp(pa >> 16, pb >> 16, t));
      const g = Math.round(M.lerp((pa >> 8) & 255, (pb >> 8) & 255, t));
      const bl = Math.round(M.lerp(pa & 255, pb & 255, t));
      return '#' + ((1 << 24) | (r << 16) | (g << 8) | bl).toString(16).slice(1);
    };
    let top = mix(day[0], dusk[0], sky.warm * 0.8), bot = mix(day[1], dusk[1], sky.warm * 0.8);
    top = mix(top, night[0], sky.night); bot = mix(bot, night[1], sky.night);
    return [top, bot];
  };
  M.mixColor = function (a, b, t) {
    const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
    const r = Math.round(M.lerp(pa >> 16, pb >> 16, t));
    const g = Math.round(M.lerp((pa >> 8) & 255, (pb >> 8) & 255, t));
    const bl = Math.round(M.lerp(pa & 255, pb & 255, t));
    return '#' + ((1 << 24) | (r << 16) | (g << 8) | bl).toString(16).slice(1);
  };

  // ---------- accessibility ----------
  const mq = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
  M.reducedMotion = function () {
    const s = M.store && M.store.state && M.store.state.settings.reducedMotion;
    if (s === true || s === false) return s;
    return !!(mq && mq.matches);
  };

  // ---------- canvas helpers ----------
  M.fitCanvas = function (canvas, cssW, cssH, maxDpr) {
    const dpr = Math.min(window.devicePixelRatio || 1, maxDpr || 2);
    canvas.style.width = cssW + 'px';
    canvas.style.height = cssH + 'px';
    const w = Math.round(cssW * dpr), hh = Math.round(cssH * dpr);
    if (canvas.width !== w || canvas.height !== hh) { canvas.width = w; canvas.height = hh; }
    return dpr;
  };
  M.rr = function (ctx, x, y, w, h, r) {
    // rounded rect path; r may be a number or [tl, tr, br, bl]
    const [a, b, c, d] = Array.isArray(r) ? r : [r, r, r, r];
    ctx.beginPath();
    ctx.moveTo(x + a, y);
    ctx.lineTo(x + w - b, y); ctx.quadraticCurveTo(x + w, y, x + w, y + b);
    ctx.lineTo(x + w, y + h - c); ctx.quadraticCurveTo(x + w, y + h, x + w - c, y + h);
    ctx.lineTo(x + d, y + h); ctx.quadraticCurveTo(x, y + h, x, y + h - d);
    ctx.lineTo(x, y + a); ctx.quadraticCurveTo(x, y, x + a, y);
    ctx.closePath();
  };
  M.FONT = '"Nunito", ui-rounded, "Segoe UI", system-ui, sans-serif';

  /* Small particle system shared by the mansion, the world and mini-games. */
  M.Particles = class {
    constructor() { this.list = []; }
    add(type, x, y, o) {
      if (M.reducedMotion() && type !== 'z') return; // particles are decorative
      this.list.push(Object.assign({ type, x, y, vx: 0, vy: -20, life: 1.4, age: 0, size: 1, color: '#FF8FAB', rot: 0, vr: 0 }, o || {}));
    }
    burst(type, x, y, n, o) {
      for (let i = 0; i < n; i++) {
        this.add(type, x, y, Object.assign({ vx: M.rand(-40, 40), vy: M.rand(-70, -20), vr: M.rand(-4, 4) }, typeof o === 'function' ? o(i) : o));
      }
    }
    update(dt) {
      for (const p of this.list) {
        p.age += dt; p.x += p.vx * dt; p.y += p.vy * dt; p.rot += p.vr * dt;
        if (p.gravity) p.vy += p.gravity * dt;
        if (p.drag) { p.vx *= 1 - p.drag * dt; p.vy *= 1 - p.drag * dt; }
      }
      this.list = this.list.filter((p) => p.age < p.life);
    }
    draw(ctx) {
      for (const p of this.list) {
        const k = p.age / p.life;
        ctx.save();
        ctx.globalAlpha = (p.alpha == null ? 1 : p.alpha) * (k > 0.7 ? 1 - (k - 0.7) / 0.3 : 1);
        ctx.translate(p.x, p.y); ctx.rotate(p.rot); ctx.scale(p.size, p.size);
        M.drawParticle(ctx, p, k);
        ctx.restore();
      }
    }
  };
  M.drawParticle = function (ctx, p, k) {
    const OUT = '#5B4636';
    switch (p.type) {
      case 'heart':
        ctx.fillStyle = p.color; ctx.strokeStyle = OUT; ctx.lineWidth = 1.3;
        ctx.beginPath(); ctx.moveTo(0, 3);
        ctx.bezierCurveTo(-7, -2, -4, -8, 0, -4); ctx.bezierCurveTo(4, -8, 7, -2, 0, 3);
        ctx.fill(); ctx.stroke(); break;
      case 'sparkle':
        ctx.fillStyle = p.color || '#FFE08A';
        ctx.beginPath();
        for (let i = 0; i < 8; i++) { const r = i % 2 ? 1.6 : 5; const a = (i * Math.PI) / 4; ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r); }
        ctx.closePath(); ctx.fill(); break;
      case 'z':
        ctx.fillStyle = p.color || '#7A6CC4'; ctx.font = 'bold ' + (9 + k * 6) + 'px ' + M.FONT;
        ctx.fillText('z', 0, 0); break;
      case 'note':
        ctx.fillStyle = p.color || '#7A6CC4'; ctx.font = 'bold 12px ' + M.FONT; ctx.fillText('♪', 0, 0); break;
      case 'crumb':
        ctx.fillStyle = p.color || '#F3E3C8'; ctx.beginPath(); ctx.arc(0, 0, 2, 0, 7); ctx.fill(); break;
      case 'paper':
        ctx.fillStyle = '#FFFDF8'; ctx.strokeStyle = '#C9B8A6'; ctx.lineWidth = 0.8;
        ctx.fillRect(-1.5, -5, 3, 10); ctx.strokeRect(-1.5, -5, 3, 10); break;
      case 'sand':
        ctx.fillStyle = p.color || '#E8D4A8'; ctx.beginPath(); ctx.arc(0, 0, 1.8, 0, 7); ctx.fill(); break;
      case 'puff':
        ctx.fillStyle = p.color || 'rgba(255,255,255,0.9)'; ctx.beginPath(); ctx.arc(0, 0, 4 + k * 8, 0, 7); ctx.fill(); break;
      case 'drop':
        ctx.fillStyle = p.color || '#A9D6F5'; ctx.beginPath(); ctx.arc(0, 0, 2.2, 0, 7); ctx.fill(); break;
      case 'leaf':
        ctx.fillStyle = p.color || '#F2B880'; ctx.strokeStyle = OUT; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.ellipse(0, 0, 6, 3.2, 0, 0, 7); ctx.fill(); ctx.stroke(); break;
      default: break;
    }
  };

  /* Speech bubble drawn inside a canvas (used by cats in the mansion & world). */
  M.drawBubble = function (ctx, x, y, text, opts) {
    opts = opts || {};
    const size = opts.size || 11;
    ctx.save();
    ctx.font = '700 ' + size + 'px ' + M.FONT;
    const w = Math.min(ctx.measureText(text).width + 16, 240), hgt = size + 12;
    const bx = M.clamp(x - w / 2, 4, (opts.maxX || 9999) - w - 4), by = y - hgt - 8;
    ctx.fillStyle = 'rgba(255,253,248,0.97)'; ctx.strokeStyle = '#5B4636'; ctx.lineWidth = 1.8;
    M.rr(ctx, bx, by, w, hgt, 9); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x - 5, by + hgt - 1); ctx.lineTo(x, by + hgt + 6); ctx.lineTo(x + 5, by + hgt - 1);
    ctx.fill(); ctx.stroke();
    ctx.fillRect(x - 4, by + hgt - 2.5, 8, 2);
    ctx.fillStyle = '#5B4636'; ctx.textBaseline = 'middle';
    ctx.fillText(text, bx + 8, by + hgt / 2 + 0.5, w - 16);
    ctx.restore();
  };
})(window.M);
