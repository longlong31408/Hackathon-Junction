/* Mochi — cozy soundscape synthesised with Web Audio (no audio files).
   Every channel is individually mutable; nothing plays until the user turns
   it on (autoplay policies + no sudden sounds for distressed users). */
'use strict';
(function (M) {
  let ctx = null, master = null;
  const live = {}; // channel name -> {out, stop}
  const buffers = {};

  function ensure() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = M.store.state.settings.sound.volume;
      master.connect(ctx.destination);
    }
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    return ctx;
  }

  function noise(kind) {
    if (buffers[kind]) return buffers[kind];
    const len = ctx.sampleRate * 4, buf = ctx.createBuffer(1, len, ctx.sampleRate), d = buf.getChannelData(0);
    let last = 0, b0 = 0, b1 = 0, b2 = 0;
    for (let i = 0; i < len; i++) {
      const w = Math.random() * 2 - 1;
      if (kind === 'brown') { last = (last + 0.02 * w) / 1.02; d[i] = last * 3.5; }
      else if (kind === 'pink') { b0 = 0.997 * b0 + w * 0.029591; b1 = 0.985 * b1 + w * 0.032534; b2 = 0.95 * b2 + w * 0.048056; d[i] = (b0 + b1 + b2 + w * 0.05) * 0.9; }
      else d[i] = w;
    }
    return (buffers[kind] = buf);
  }
  function loopNoise(kind) {
    const src = ctx.createBufferSource(); src.buffer = noise(kind); src.loop = true; src.start(); return src;
  }
  function filter(type, freq, q) { const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; if (q) f.Q.value = q; return f; }
  function gain(v) { const g = ctx.createGain(); g.gain.value = v; return g; }
  function burst(dest, freq, type, dur, vol, q) {
    const src = ctx.createBufferSource(); src.buffer = noise('white');
    const f = filter(type || 'bandpass', freq, q || 1); const g = gain(0);
    const t = ctx.currentTime;
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + 0.005); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f); f.connect(g); g.connect(dest);
    src.start(t, Math.random() * 3); src.stop(t + dur + 0.05);
  }

  const builders = {
    rain() {
      const out = gain(0);
      const src = loopNoise('pink'); const hp = filter('highpass', 500); const lp = filter('lowpass', 5200);
      src.connect(hp); hp.connect(lp); lp.connect(gain(0.5)).connect(out);
      const iv = setInterval(() => { if (Math.random() < 0.7) burst(out, 2500 + Math.random() * 3000, 'bandpass', 0.04, 0.12, 6); }, 90);
      return { out, stop() { clearInterval(iv); src.stop(); } };
    },
    fire() {
      const out = gain(0);
      const src = loopNoise('brown'); const lp = filter('lowpass', 700);
      src.connect(lp); lp.connect(gain(0.55)).connect(out);
      let alive = true;
      (function crackle() {
        if (!alive) return;
        burst(out, 1800 + Math.random() * 3000, 'highpass', 0.02 + Math.random() * 0.05, 0.15 + Math.random() * 0.35);
        setTimeout(crackle, 60 + Math.random() * 420);
      })();
      return { out, stop() { alive = false; src.stop(); } };
    },
    waves() {
      const out = gain(0);
      const src = loopNoise('brown'); const lp = filter('lowpass', 600);
      const amp = gain(0.25); const lfo = ctx.createOscillator(); const depth = gain(0.22);
      lfo.frequency.value = 0.11; lfo.connect(depth); depth.connect(amp.gain); lfo.start();
      src.connect(lp); lp.connect(amp); amp.connect(out);
      return { out, stop() { src.stop(); lfo.stop(); } };
    },
    purr() {
      // brown-noise rumble, amplitude-modulated at ~24 Hz, breathing slowly
      const out = gain(0);
      const src = loopNoise('brown'); const lp = filter('lowpass', 220);
      const am = gain(0.5); const lfo = ctx.createOscillator(); lfo.frequency.value = 24; const d = gain(0.5);
      lfo.connect(d); d.connect(am.gain); lfo.start();
      const breath = gain(0.6); const lfo2 = ctx.createOscillator(); lfo2.frequency.value = 0.32; const d2 = gain(0.35);
      lfo2.connect(d2); d2.connect(breath.gain); lfo2.start();
      src.connect(lp); lp.connect(am); am.connect(breath); breath.connect(gain(1.6)).connect(out);
      return { out, stop() { src.stop(); lfo.stop(); lfo2.stop(); } };
    },
    music() {
      // slow lo-fi pad: Cmaj7 – Am7 – Fmaj7 – G6, soft plucks, vinyl crackle
      const out = gain(0);
      const lp = filter('lowpass', 1500); lp.connect(out);
      const chords = [[48, 55, 59, 64], [45, 52, 55, 60], [41, 48, 52, 57], [43, 50, 52, 59]];
      const penta = [72, 74, 76, 79, 81, 84];
      const midi = (n) => 440 * Math.pow(2, (n - 69) / 12);
      let bar = 0, alive = true; const barLen = 4.2;
      function voice(freq, t0, dur, vol, type) {
        const o = ctx.createOscillator(); o.type = type; o.frequency.value = freq; o.detune.value = Math.random() * 8 - 4;
        const g = gain(0); o.connect(g); g.connect(lp);
        g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(vol, t0 + (type === 'sine' ? 0.02 : 0.9));
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur); o.start(t0); o.stop(t0 + dur + 0.1);
      }
      function schedule() {
        if (!alive) return;
        const t0 = ctx.currentTime + 0.1, ch = chords[bar % 4];
        ch.forEach((n) => voice(midi(n), t0, barLen + 0.6, 0.045, 'triangle'));
        for (let b = 0; b < 4; b++) if (Math.random() < 0.45) voice(midi(M.pick(penta)), t0 + b * (barLen / 4) + 0.05, 1.4, 0.06, 'sine');
        bar++;
      }
      schedule();
      const iv = setInterval(schedule, barLen * 1000);
      const crackle = setInterval(() => { if (Math.random() < 0.5) burst(out, 3000, 'highpass', 0.01, 0.05); }, 140);
      return { out, stop() { alive = false; clearInterval(iv); clearInterval(crackle); } };
    },
  };

  const LEVEL = { rain: 0.5, fire: 0.6, waves: 0.55, purr: 0.7, music: 0.9 };

  function setChannel(name, on) {
    if (on) {
      if (live[name] || !ensure()) return;
      const ch = builders[name]();
      ch.out.connect(master);
      ch.out.gain.setTargetAtTime(LEVEL[name], ctx.currentTime, 0.8);
      live[name] = ch;
    } else if (live[name]) {
      const ch = live[name]; delete live[name];
      ch.out.gain.setTargetAtTime(0, ctx.currentTime, 0.4);
      setTimeout(() => { try { ch.stop(); ch.out.disconnect(); } catch (e) { /* already stopped */ } }, 1800);
    }
  }

  const audio = {
    channels: [
      { id: 'music', label: 'Lo-fi music', icon: '🎵' },
      { id: 'purr', label: 'Purring', icon: '🐈' },
      { id: 'rain', label: 'Rain on the window', icon: '🌧️' },
      { id: 'fire', label: 'Crackling fireplace', icon: '🔥' },
      { id: 'waves', label: 'Soft waves', icon: '🌊' },
    ],
    /* Apply settings. Only call from a user gesture the first time. */
    sync() {
      const s = M.store.state.settings.sound;
      const any = this.channels.some((c) => s[c.id]);
      if (!ctx && !any) return;
      if (!ensure()) return;
      master.gain.setTargetAtTime(s.volume, ctx.currentTime, 0.2);
      this.channels.forEach((c) => setChannel(c.id, !!s[c.id]));
    },
    anyOn() { const s = M.store.state.settings.sound; return this.channels.some((c) => s[c.id]); },
    /* Short UI sounds (respect the "UI sounds" toggle). */
    ui(kind) {
      if (!M.store.state.settings.sound.ui || !ensure()) return;
      const t = ctx.currentTime, out = gain(0.5); out.connect(master);
      const tone = (f0, f1, dur, type, vol, delay) => {
        const o = ctx.createOscillator(); o.type = type || 'sine';
        const g = gain(0); o.connect(g); g.connect(out);
        const s = t + (delay || 0);
        o.frequency.setValueAtTime(f0, s); o.frequency.exponentialRampToValueAtTime(f1, s + dur);
        g.gain.setValueAtTime(0, s); g.gain.linearRampToValueAtTime(vol || 0.2, s + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, s + dur);
        o.start(s); o.stop(s + dur + 0.05);
      };
      switch (kind) {
        case 'pop': tone(520, 860, 0.09, 'sine', 0.18); break;
        case 'meow': {
          const o = ctx.createOscillator(); o.type = 'sawtooth';
          const f = filter('bandpass', 1100, 3); const g = gain(0); o.connect(f); f.connect(g); g.connect(out);
          o.frequency.setValueAtTime(480, t); o.frequency.linearRampToValueAtTime(760, t + 0.12); o.frequency.linearRampToValueAtTime(430, t + 0.42);
          f.frequency.setValueAtTime(900, t); f.frequency.linearRampToValueAtTime(1500, t + 0.15); f.frequency.linearRampToValueAtTime(800, t + 0.42);
          g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.16, t + 0.05); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.45);
          o.start(t); o.stop(t + 0.5); break;
        }
        case 'chomp': burst(out, 500, 'lowpass', 0.07, 0.5); setTimeout(() => burst(out, 450, 'lowpass', 0.07, 0.5), 140); break;
        case 'shred': for (let i = 0; i < 8; i++) setTimeout(() => burst(out, 3000, 'highpass', 0.03, 0.25), i * 55); break;
        case 'dig': for (let i = 0; i < 4; i++) setTimeout(() => burst(out, 900, 'lowpass', 0.08, 0.35), i * 160); break;
        case 'sparkle': tone(1320, 1320, 0.25, 'sine', 0.08); tone(1760, 1760, 0.3, 'sine', 0.07, 0.08); tone(2093, 2093, 0.4, 'sine', 0.06, 0.16); break;
        case 'splash': burst(out, 1200, 'lowpass', 0.35, 0.4); break;
        case 'whoosh': burst(out, 700, 'bandpass', 0.5, 0.25, 0.7); break;
        case 'purr': {
          const ch = builders.purr(); ch.out.connect(out); ch.out.gain.setTargetAtTime(0.8, t, 0.1);
          ch.out.gain.setTargetAtTime(0, t + 1.2, 0.3); setTimeout(() => ch.stop(), 2600); break;
        }
        default: break;
      }
    },
  };

  document.addEventListener('visibilitychange', () => {
    if (!ctx) return;
    if (document.hidden) ctx.suspend().catch(() => {});
    else if (Object.keys(live).length) ctx.resume().catch(() => {});
  });

  M.audio = audio;
})(window.M);
