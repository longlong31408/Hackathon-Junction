/* Mochi — app shell: boot, views (mansion ↔ map), top & bottom bars, rooms,
   and a gentle queue for the cat's speech bubbles (gift → check-in → bedtime). */
'use strict';
(function (M) {
  const h = M.h;
  const S = () => M.store.state;

  const app = {
    view: 'home',
    queue: [],

    boot() {
      M.store.load();
      this.applySettings();
      if (!S().onboarded) M.onboarding.start(() => this.start());
      else this.start();
    },

    start() {
      M.mansion.init();
      M.world.init();
      this.bindChrome();
      this.renderChrome();
      M.on('change', () => this.renderChrome());
      M.on('speech-hidden', () => setTimeout(() => this.pump(), 450));
      M.on('sheet-closed', () => setTimeout(() => this.pump(), 600));
      M.tasks.ensure();
      this.show('home');

      const s = S();
      if (s.today.giftPending) this.enqueue(() => this.gift());
      this.enqueue(() => { if (M.checkin.due()) M.checkin.start(); else this.pump(); });
      if (M.sky().late) this.enqueue(() => this.bedtime());

      document.addEventListener('pointerdown', () => { if (M.audio.anyOn()) M.audio.sync(); }, { once: true });
      setInterval(() => document.body.classList.toggle('night', M.sky().isNight), 60000);
      document.body.classList.toggle('night', M.sky().isNight);
      document.addEventListener('visibilitychange', () => {
        if (document.hidden) { M.mansion.stop(); M.world.stop(); }
        else { const before = S().today.date; M.store.rollDay(); if (S().today.date !== before) M.tasks.ensure(); this.show(this.view); }
      });
      setTimeout(() => M.bottles.sync().catch(() => {}), 1500);
      if (/^https?:$/.test(location.protocol)) {
        // installable PWA + offline cache (browsers refuse both over file://)
        document.head.append(h('link', { rel: 'manifest', href: 'manifest.webmanifest' }));
        if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
      }
    },

    bindChrome() {
      M.$('#helpBtn').addEventListener('click', () => M.safety.openHelp());
      M.$('#settingsBtn').addEventListener('click', () => M.settings.open());
      M.$('#catNameBtn').addEventListener('click', () => M.settings.wardrobe());
      M.$('#moodBtn').addEventListener('click', () => { M.ui.closeAll(); this.show('home'); M.checkin.start(); });
      M.$('#navHome').addEventListener('click', () => { M.ui.closeAll(); this.show('home'); });
      M.$('#navMap').addEventListener('click', () => { M.ui.closeAll(); this.show('map'); });
      M.$('#navBottles').addEventListener('click', () => { M.ui.closeAll(); M.bottles.open('inbox'); });
      M.$('#navTasks').addEventListener('click', () => { M.ui.closeAll(); M.tasks.open(); });
    },

    renderChrome() {
      const s = S();
      M.$('#catName').textContent = s.cat.name;
      M.$('#yarnCount').textContent = s.yarn;
      const mood = s.today.mood ? M.data.MOODS[s.today.mood] : null;
      const mb = M.$('#moodBtn');
      mb.textContent = mood ? mood.icon : '🐾';
      mb.setAttribute('aria-label', mood ? 'Today\'s blanket: ' + mood.label + '. Tap to check in again' : 'No blanket picked today. Tap to check in');
      mb.title = mood ? 'Today\'s blanket: ' + mood.label : 'Check in';
    },

    applySettings() {
      const s = S().settings, root = document.documentElement;
      root.dataset.text = s.textSize;
      root.classList.toggle('reduce', M.reducedMotion());
      document.body.classList.toggle('lefty', !!s.leftHanded);
      const joy = M.$('#joystick'); if (joy) joy.hidden = !s.joystick;
    },

    show(view) {
      this.view = view;
      const home = view === 'home';
      M.$('#homeView').hidden = !home;
      M.$('#mapView').hidden = home;
      M.$('#navHome').classList.toggle('on', home);
      M.$('#navMap').classList.toggle('on', !home);
      M.$(home ? '#navHome' : '#navMap').setAttribute('aria-current', 'page');
      M.$(home ? '#navMap' : '#navHome').removeAttribute('aria-current');
      if (home) {
        M.world.stop(); M.mansion.start();
        if (!M.speech.current && M.checkin.due() && !this.queue.length) this.enqueue(() => { if (M.checkin.due()) M.checkin.start(); else this.pump(); });
        setTimeout(() => this.pump(), 300);
      } else {
        M.speech.hide();
        M.mansion.stop(); M.world.start();
        this.applySettings();
      }
    },

    enqueue(fn) { this.queue.push(fn); if (!M.speech.current) setTimeout(() => this.pump(), 700); },
    pump() {
      if (this.view !== 'home' || M.speech.current || M.ui.isOpen() || document.getElementById('onboarding').hidden === false) return;
      const fn = this.queue.shift();
      if (fn) fn();
    },

    gift() {
      const name = S().cat.name;
      M.speech.show({
        id: 'gift',
        text: 'Welcome back! ' + name + ' saved you a little gift: 3 🧶. (It is the same gift whether you were gone a day or a season.)',
        options: [{ icon: '💛', label: 'Thank you', onClick: () => { this.claimGift(); M.speech.hide(); } }],
        onDismiss: () => this.claimGift(),
      });
    },
    claimGift() {
      if (!S().today.giftPending) return;
      M.store.update((s) => { s.today.giftPending = false; s.yarn += 3; }, 'yarn');
      M.audio.ui('sparkle');
    },

    bedtime() {
      if (M.store.session.bedtimeShown) return this.pump();
      M.store.session.bedtimeShown = true;
      const name = S().cat.name;
      M.mansion.yawn();
      M.speech.show({
        id: 'bedtime',
        text: name + ' is yawning… it is late. Maybe a good time to rest? 🌙',
        options: [
          { icon: '🫁', label: 'Wind down', onClick: () => { M.speech.hide(); M.calm.breathe({}); } },
          { icon: '🎧', label: 'Soft sounds', onClick: () => { M.speech.hide(); M.calm.sounds(); } },
          { icon: '💤', label: 'Goodnight', onClick: () => { M.speech.hide(); M.ui.toast('Goodnight. ' + name + ' will keep the blanket warm. 🌙'); } },
        ],
      });
    },

    openRoom(id) {
      switch (id) {
        case 'bedroom': return this.bedroom();
        case 'calm': return M.calm.openRoom();
        case 'kitchen': return M.tasks.open();
        case 'mail': return M.bottles.open('inbox');
        case 'worry': return M.worry.open();
        case 'garden': return this.show('map');
        default: return null;
      }
    },

    bedroom() {
      const s = S(), name = s.cat.name, e = s.today.energy;
      const body = h('div', { class: 'stack' },
        h('p', null, name + ' ' + (e ? M.data.ENERGY[e].state : 'is waiting to see how today feels.')),
        h('button', { class: 'btn big primary', onclick: () => { M.ui.closeAll(); M.checkin.start(); } }, '🧺 Check in with ' + name),
        h('button', { class: 'btn big', onclick: () => M.settings.wardrobe() }, '🎀 Look & wardrobe'),
        h('button', { class: 'btn big', onclick: () => M.settings.decor() }, '🪴 Decorate'),
        h('button', { class: 'btn big', onclick: () => { M.ui.closeAll(); this.show('map'); M.world.setCouch(true); } }, '🛋️ Just watch ' + name + ' wander'),
        h('p', { class: 'muted small' }, name + ' never gets sick, sad or hungry while you are away. Promise.'));
      M.ui.sheet({ title: 'Cozy Bedroom', icon: '🛏️', body, id: 'bedroom' });
    },
  };

  M.app = app;
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => app.boot());
  else app.boot();
})(window.M);
