/* Mochi — subtle check-ins (blanket = mood, laser = energy, seat = social)
   asked inside the cat's world, plus the generic speech bubble. */
'use strict';
(function (M) {
  const h = M.h;
  const D = () => M.data;

  /* ---------- speech bubble (dismissable, ignorable) ---------- */
  M.speech = {
    show(o) {
      const el = M.$('#speech');
      el.innerHTML = '';
      M.add(el,
        h('button', { class: 'icon-btn speech-x', 'aria-label': o.dismissLabel || 'Not now', onclick: () => { this.hide(); if (o.onDismiss) o.onDismiss(); } }, '✕'),
        h('p', { class: 'speech-text' }, o.text),
        o.options && o.options.length ? h('div', { class: 'speech-options' + (o.options.length > 3 ? ' many' : '') },
          o.options.map((op) => h('button', { class: 'speech-opt', onclick: op.onClick },
            op.icon ? h('span', { class: 'emo', 'aria-hidden': 'true' }, op.icon) : null, h('span', null, op.label)))) : null,
        o.footer || null);
      el.hidden = false;
      el.classList.remove('pop'); void el.offsetWidth; el.classList.add('pop');
      this.current = o.id || 'bubble';
    },
    hide() { const el = M.$('#speech'); const was = this.current; el.hidden = true; el.innerHTML = ''; this.current = null; if (was) M.emit('speech-hidden', was); },
    current: null,
  };

  const checkin = {
    due() {
      const s = M.store.state, f = s.settings.checkinFreq;
      if (f === 'off' || M.store.session.checkinAsked) return false;
      if (f === 'open') return true;
      const last = s.lastCheckinAt ? new Date(s.lastCheckinAt) : null;
      if (!last || M.dayKey(last) !== M.dayKey()) return true;
      if (f === 'twice') { const half = (d) => (d.getHours() < 14 ? 0 : 1); return half(last) !== half(new Date()); }
      return false;
    },
    maybeStart() {
      if (this.due() && !M.ui.isOpen() && !M.speech.current) this.start();
    },
    markAsked() {
      M.store.session.checkinAsked = true;
      M.store.update((s) => { s.lastCheckinAt = Date.now(); });
    },
    start() {
      const name = M.store.state.cat.name;
      const dismiss = () => this.markAsked();
      M.speech.show({
        id: 'checkin', text: name + ' is picking a blanket for today — which one?', onDismiss: dismiss,
        options: Object.entries(D().MOODS).map(([id, m]) => ({ icon: m.icon, label: m.label, onClick: () => { this.set('mood', id); this.step2(); } })),
      });
    },
    step2() {
      const name = M.store.state.cat.name;
      M.speech.show({
        id: 'checkin', text: 'How fast should ' + name + ' chase the laser today?', onDismiss: () => this.finish(),
        options: [1, 2, 3, 4, 5].map((e) => ({ icon: D().ENERGY[e].icon, label: D().ENERGY[e].label, onClick: () => { this.set('energy', e); this.step3(); } })),
      });
    },
    step3() {
      const name = M.store.state.cat.name;
      M.speech.show({
        id: 'checkin', text: name + ' wants to sit somewhere — where?', onDismiss: () => this.finish(),
        options: Object.entries(D().SOCIAL).map(([id, m]) => ({ icon: m.icon, label: m.label, onClick: () => { this.set('social', id); this.finish(true); } })),
      });
    },
    set(field, value) {
      M.store.update((s) => { s.today[field] = value; }, field === 'energy' ? 'energy' : 'mood');
    },
    finish(showSummary) {
      const s = M.store.state;
      this.markAsked();
      if (s.profile.consentCheckins && (s.today.mood || s.today.energy || s.today.social)) {
        M.store.update((st) => {
          st.checkins.push({ t: Date.now(), mood: st.today.mood, energy: st.today.energy, social: st.today.social });
          if (st.checkins.length > 400) st.checkins.splice(0, st.checkins.length - 400);
        });
      }
      M.tasks.ensure();
      if (!showSummary) { M.speech.hide(); return; }
      const e = s.today.energy, name = s.cat.name;
      const opts = [{ icon: '🧶', label: 'See tiny tasks', onClick: () => { M.speech.hide(); M.tasks.open(); } }];
      if (s.today.social === 'friends' && s.profile.adult) opts.push({ icon: '🍾', label: 'Any bottles?', onClick: () => { M.speech.hide(); M.bottles.open('inbox'); } });
      if (e === 1) opts.push({ icon: '🛋️', label: 'Just watch ' + name, onClick: () => { M.speech.hide(); M.app.show('map'); M.world.setCouch(true); } });
      M.speech.show({
        id: 'checkin-done',
        text: name + ' ' + (e ? D().ENERGY[e].state : 'is happy you stopped by.') + ' Tasks are in the kitchen whenever (or if ever) you want them.',
        options: opts,
      });
    },
  };

  /* ---------- daily tasks ---------- */
  const tasks = {
    resolve(id) {
      const t = D().TASKS.find((x) => x.id === id);
      return t ? t.text.replace('{cat}', M.store.state.cat.name) : id;
    },
    ensure() {
      const s = M.store.state, e = s.today.energy || 2;
      if (s.today.taskEnergy === e && s.today.tasks.length) return;
      const n = D().TASK_COUNT[e];
      const kept = s.today.tasks.filter((t) => t.done || t.skipped);
      const fresh = this.pickTasks(e, n - kept.length, kept.map((t) => t.id));
      M.store.update((st) => { st.today.tasks = kept.concat(fresh.map((id) => ({ id, done: false, skipped: false }))); st.today.taskEnergy = e; }, 'tasks');
    },
    pickTasks(e, n, exclude) {
      if (n <= 0) return [];
      const evening = new Date().getHours() >= 18;
      const rnd = M.rng(M.hashStr(M.dayKey() + ':' + e + ':' + exclude.join(',')));
      const pool = D().TASKS.filter((t) => e >= t.e[0] && e <= t.e[1] && (!t.evening || evening) && !exclude.includes(t.id));
      for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]]; }
      const out = [], cats = new Set();
      for (const t of pool) { if (out.length >= n) break; if (!cats.has(t.cat)) { out.push(t.id); cats.add(t.cat); } }
      for (const t of pool) { if (out.length >= n) break; if (!out.includes(t.id)) out.push(t.id); }
      return out;
    },
    open() {
      this.ensure();
      const list = h('div', { class: 'tasks' });
      const name = M.store.state.cat.name;
      const render = () => {
        const s = M.store.state;
        list.innerHTML = '';
        list.append(h('p', { class: 'muted' },
          s.today.energy ? ['Sized for today\'s energy ', M.ui.energyDots(s.today.energy), '. Doing none of them is also completely fine.']
            : 'No check-in today, so these are extra gentle. Doing none of them is also completely fine.'));
        s.today.tasks.forEach((t, i) => {
          const text = this.resolve(t.id);
          const row = h('div', { class: 'task' + (t.done ? ' done' : '') + (t.skipped ? ' skipped' : '') },
            h('p', { class: 'task-text' }, text));
          if (t.done || t.skipped) {
            row.append(h('div', { class: 'row between' },
              h('span', { class: 'muted' }, t.done ? '✓ Done. ' + name + ' noticed. 💛' : '💤 Rested instead. That counts.'),
              h('button', { class: 'btn ghost small', onclick: () => { M.store.update((st) => { if (st.today.tasks[i].done) st.yarn = Math.max(0, st.yarn - 2); st.today.tasks[i].done = false; st.today.tasks[i].skipped = false; }, 'yarn'); render(); } }, 'Undo')));
          } else {
            row.append(h('div', { class: 'row wrap' },
              h('button', { class: 'btn primary', onclick: () => {
                M.store.update((st) => { st.today.tasks[i].done = true; st.yarn += 2; }, 'yarn');
                M.ui.toast(M.pick(D().DONE_LINES).replace('{cat}', name) + '  +2 🧶');
                M.audio.ui('sparkle'); M.emit('task-done'); render();
              } }, '✓ Did it'),
              h('button', { class: 'btn', onclick: () => {
                M.store.update((st) => { st.today.tasks[i].skipped = true; });
                M.ui.toast(M.pick(D().SKIP_LINES).replace('{cat}', name)); render();
              } }, '💤 Rest instead'),
              h('button', { class: 'icon-btn', 'aria-label': 'Swap for a different task', title: 'Swap', onclick: () => {
                const st = M.store.state;
                const [next] = this.pickTasks(st.today.energy || 2, 1, st.today.tasks.map((x) => x.id).concat([String(Date.now())]));
                if (next) { M.store.update((s2) => { s2.today.tasks[i] = { id: next, done: false, skipped: false }; }); render(); }
              } }, '🔄')));
          }
          list.append(row);
        });
        if (!s.today.energy) list.append(h('button', { class: 'btn ghost', onclick: () => { M.ui.closeAll(); M.app.show('home'); M.checkin.start(); } }, '🧺 Check in with ' + name));
        list.append(h('p', { class: 'muted small' }, 'No streaks, no scores. Nothing spoils or expires while you are away.'));
      };
      render();
      M.ui.sheet({ title: 'Tiny tasks', icon: '🍳', body: list, id: 'tasks' });
    },
  };

  M.checkin = checkin;
  M.tasks = tasks;
})(window.M);
