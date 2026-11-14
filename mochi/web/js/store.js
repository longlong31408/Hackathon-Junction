/* Mochi — on-device state. Private data (check-ins, worries count, safety
   plan, tasks, world progress) never leaves the device. Check-in history is
   only persisted with explicit consent (mood data = health data, GDPR art. 9). */
'use strict';
(function (M) {
  const KEY = 'mochi.save.v1';

  function defaults() {
    return {
      version: 1,
      createdAt: Date.now(),
      lastVisitDay: null,
      onboarded: false,
      profile: { adult: null, consentCheckins: false, clientId: M.uid() },
      cat: { name: 'Mochi', coat: 'cream', acc: 'bow' },
      owned: { acc: ['none', 'bow', 'scarf', 'glasses'], decor: [] },
      decorOff: [], // owned decor the user has hidden
      yarn: 3,
      today: { date: M.dayKey(), mood: null, energy: null, social: null, tasks: [], giftPending: false },
      checkins: [], // [{t, mood, energy, social}] — only kept with consent
      lastCheckinAt: 0,
      worriesReleased: 0,
      settings: {
        checkinFreq: 'daily', // off | daily | twice | open
        reducedMotion: null, // null = follow the operating system
        textSize: 'm',
        leftHanded: false,
        joystick: false,
        dayNight: 'clock', // clock | day | night
        country: 'auto',
        listener: false,
        sound: { volume: 0.6, music: false, purr: false, rain: false, fire: false, waves: false, ui: true },
      },
      safetyPlan: { warning: '', coping: '', distract: '', people: '', pros: '', safe: '', reasons: '' },
      world: {
        x: null, y: null, fog: '', discovered: [], found: [], quests: { scarf: 'none' },
        garden: [], // [{day, color, hope}]
        leavesHung: 0, fishToday: { day: null, n: 0 },
      },
      bottles: {
        need: 'company', topic: '',
        outbox: [], // bottles waiting for a connection
        sent: [], // [{id, text, at, status, need, topic}]
        inbox: [], // bottles that arrived [{id, text, need, topic, energy, crew, at, replied, dismissed}]
        replies: [], // replies to my bottles [{id, bottleId, text, at, read}]
        blocked: [], // authorRefs
        crewDelivered: [],
        lastFetch: 0,
      },
    };
  }

  function merge(def, saved) {
    if (saved == null) return def;
    if (Array.isArray(def)) return Array.isArray(saved) ? saved : def;
    if (typeof def !== 'object' || def === null) return typeof saved === typeof def || def === null ? saved : def;
    const out = {};
    for (const k in def) out[k] = merge(def[k], saved[k]);
    for (const k in saved) if (!(k in out)) out[k] = saved[k];
    return out;
  }

  const store = {
    state: null,
    session: { checkedInThisSession: false, startedAt: Date.now() },
    load() {
      let saved = null;
      try { saved = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) { saved = null; }
      this.state = merge(defaults(), saved);
      this.rollDay();
      return this.state;
    },
    /* New calendar day: fresh tasks and blanket, plus a welcome-back gift that
       is identical whether you were away 1 day or 3 months. */
    rollDay() {
      const s = this.state, key = M.dayKey();
      if (s.today.date !== key) {
        s.today = { date: key, mood: null, energy: null, social: null, tasks: [], giftPending: false };
      }
      if (s.onboarded && s.lastVisitDay && s.lastVisitDay !== key) s.today.giftPending = true;
      s.lastVisitDay = key;
      this.save();
    },
    persistable() {
      const s = JSON.parse(JSON.stringify(this.state));
      if (!s.profile.consentCheckins) {
        s.checkins = [];
        s.today.mood = null; s.today.energy = null; s.today.social = null;
      }
      return s;
    },
    save() {
      clearTimeout(this._t);
      this._t = setTimeout(() => this.flush(), 250);
    },
    flush() {
      clearTimeout(this._t);
      try { localStorage.setItem(KEY, JSON.stringify(this.persistable())); } catch (e) { /* storage full / private mode */ }
    },
    update(fn, evt) {
      fn(this.state);
      this.save();
      M.emit('change', evt);
      if (evt) M.emit(evt);
    },
    energy() { return this.state.today.energy || null; },
    addYarn(n) {
      this.update((s) => { s.yarn = Math.max(0, s.yarn + n); }, 'yarn');
    },
    exportJSON() {
      const data = JSON.parse(JSON.stringify(this.state));
      data.exportedAt = new Date().toISOString();
      data.note = 'Everything Mochi stores on this device. Bottles you sent are also kept anonymously on the bottle server until you delete them.';
      return JSON.stringify(data, null, 2);
    },
    deleteCheckins() {
      this.update((s) => { s.checkins = []; s.today.mood = null; s.today.energy = null; s.today.social = null; }, 'energy');
    },
    wipe() {
      try { localStorage.removeItem(KEY); } catch (e) { /* ignore */ }
      this.state = defaults();
    },
  };

  M.store = store;
  window.addEventListener('pagehide', () => store.flush());
  document.addEventListener('visibilitychange', () => { if (document.hidden) store.flush(); });
})(window.M);
