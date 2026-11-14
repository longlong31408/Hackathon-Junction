/* Mochi — settings, accessibility, privacy & data, wardrobe and decor. */
'use strict';
(function (M) {
  const h = M.h;
  const D = () => M.data;
  const S = () => M.store.state;

  function toggleRow(icon, label, get, set, hint) {
    const btn = h('button', { class: 'toggle-row' + (get() ? ' on' : ''), 'aria-pressed': String(!!get()) },
      h('span', { 'aria-hidden': 'true' }, icon), h('span', { class: 'grow' }, label, hint ? h('small', { class: 'muted block' }, hint) : null), h('span', { class: 'switch' }));
    btn.addEventListener('click', () => { set(!get()); btn.classList.toggle('on', !!get()); btn.setAttribute('aria-pressed', String(!!get())); });
    return btn;
  }

  const settings = {
    open() {
      const s = S();
      const body = h('div', { class: 'settings' },
        h('h3', null, '🐱 ' + s.cat.name),
        h('div', { class: 'stack' },
          h('button', { class: 'btn', onclick: () => this.wardrobe() }, '🎀 Look & wardrobe'),
          h('button', { class: 'btn', onclick: () => this.decor() }, '🪴 Decorate the mansion')),

        h('h3', null, '🧺 Check-ins'),
        h('p', { class: 'muted small' }, 'How often ' + s.cat.name + ' asks its little questions. Skipping is always fine.'),
        M.ui.chips([
          { id: 'off', label: 'Off' }, { id: 'daily', label: 'Once a day' }, { id: 'twice', label: 'Twice a day' }, { id: 'open', label: 'Every visit' },
        ], s.settings.checkinFreq, (v) => M.store.update((x) => { x.settings.checkinFreq = v || 'daily'; }), { label: 'Check-in frequency' }),

        h('h3', null, '♿ Comfort & accessibility'),
        h('div', { class: 'stack' },
          toggleRow('🐢', 'Reduced motion', () => M.reducedMotion(), (v) => { M.store.update((x) => { x.settings.reducedMotion = v; }); M.app.applySettings(); }, 'No bouncing, camera sweeps or particles'),
          toggleRow('🫲', 'Left-handed layout', () => S().settings.leftHanded, (v) => { M.store.update((x) => { x.settings.leftHanded = v; }); M.app.applySettings(); }),
          toggleRow('🕹️', 'Joystick on the map', () => S().settings.joystick, (v) => { M.store.update((x) => { x.settings.joystick = v; }); M.app.applySettings(); }, 'Tap-to-walk always works too')),
        h('div', { class: 'field' }, h('span', null, 'Text size'),
          M.ui.chips([{ id: 's', label: 'A' }, { id: 'm', label: 'A+' }, { id: 'l', label: 'A++' }, { id: 'xl', label: 'A+++' }], s.settings.textSize,
            (v) => { M.store.update((x) => { x.settings.textSize = v || 'm'; }); M.app.applySettings(); }, { label: 'Text size' })),
        h('div', { class: 'field' }, h('span', null, 'World time'),
          M.ui.chips([{ id: 'clock', label: '🕰️ Follow my clock' }, { id: 'day', label: '☀️ Always day' }, { id: 'night', label: '🌙 Always night' }], s.settings.dayNight,
            (v) => { M.store.update((x) => { x.settings.dayNight = v || 'clock'; }); M.emit('sky'); }, { label: 'World time' })),

        h('h3', null, '🎧 Sound'),
        h('div', { class: 'stack' },
          toggleRow('🔔', 'Little UI sounds (pops, meows)', () => S().settings.sound.ui, (v) => M.store.update((x) => { x.settings.sound.ui = v; })),
          h('button', { class: 'btn', onclick: () => M.calm.sounds() }, '🎵 Soundscape mixer')),

        h('h3', null, '🔒 Privacy & data'),
        this.privacy(),

        h('h3', null, 'ℹ️ About'),
        h('p', { class: 'muted small' }, 'Mochi is a support and self-care tool, not a medical device or a replacement for professional treatment. If you are in crisis, contact your local emergency number or a crisis helpline (🛟 Help, top right).'),
      );
      M.ui.sheet({ title: 'Settings', icon: '⚙️', body, id: 'settings' });
    },

    privacy() {
      const s = S();
      const wrap = h('div', { class: 'stack' },
        h('div', { class: 'card soft' },
          h('p', null, h('strong', null, 'What Mochi keeps, and where')),
          h('ul', { class: 'small' },
            h('li', null, 'On this device only: your cat, tasks, yarn, world progress, safety plan' + (s.profile.consentCheckins ? ', and your check-in history.' : '.')),
            h('li', null, 'Never stored anywhere: what you type in the Worry Room (only a count of released worries).'),
            h('li', null, 'On the bottle server, without your name: bottles and replies you send, linked to a random ID — not to you.'),
            h('li', null, 'No ads, no trackers, no selling or sharing data.'))),
        toggleRow('🧺', 'Remember my check-ins on this device', () => S().profile.consentCheckins, (v) => {
          M.store.update((x) => { x.profile.consentCheckins = v; if (!v) x.checkins = []; });
          M.ui.toast(v ? 'Check-ins will be remembered on this device.' : 'Check-in history deleted and no longer kept.');
        }, 'Mood data is health data. Off = nothing is kept after you close Mochi.'),
        h('div', { class: 'row wrap' },
          h('button', { class: 'btn', onclick: () => this.viewData() }, '👀 View my data'),
          h('button', { class: 'btn', onclick: () => this.exportData() }, '⬇️ Export (JSON)')),
        h('div', { class: 'row wrap' },
          h('button', { class: 'btn ghost', onclick: async () => {
            if (await M.ui.confirm('Delete your check-in history? Your cat will simply start fresh.', 'Delete', 'Keep', { danger: true })) { M.store.deleteCheckins(); M.ui.toast('Check-in history deleted.'); }
          } }, '🗑️ Delete check-ins'),
          h('button', { class: 'btn danger', onclick: () => this.deleteEverything() }, '🧨 Delete everything')));
      return wrap;
    },

    viewData() {
      const s = S();
      const rows = s.checkins.slice().reverse().slice(0, 60);
      const body = h('div', null,
        h('p', { class: 'muted' }, s.profile.consentCheckins ? 'Your remembered check-ins (newest first).' : 'Check-ins are not being remembered, so there is no history to show.'),
        rows.length ? h('table', { class: 'data-table' },
          h('thead', null, h('tr', null, h('th', null, 'When'), h('th', null, 'Blanket'), h('th', null, 'Energy'), h('th', null, 'Seat'))),
          h('tbody', null, rows.map((c) => h('tr', null,
            h('td', null, new Date(c.t).toLocaleString()),
            h('td', null, c.mood ? D().MOODS[c.mood].icon + ' ' + D().MOODS[c.mood].label : '—'),
            h('td', null, c.energy ? D().ENERGY[c.energy].icon + ' ' + c.energy + '/5' : '—'),
            h('td', null, c.social ? D().SOCIAL[c.social].icon + ' ' + D().SOCIAL[c.social].label : '—'))))) : null,
        h('p', { class: 'muted small' }, 'Worries released: ' + s.worriesReleased + ' (content never stored) · Bottles sent: ' + s.bottles.sent.length + ' · Found on the isles: ' + s.world.found.length),
        h('details', null, h('summary', null, 'Show the raw data'), h('pre', { class: 'raw' }, M.store.exportJSON())));
      M.ui.sheet({ title: 'My data', icon: '👀', body });
    },

    exportData() {
      const blob = new Blob([M.store.exportJSON()], { type: 'application/json' });
      const a = h('a', { href: URL.createObjectURL(blob), download: 'mochi-data-' + M.dayKey() + '.json' });
      document.body.append(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    },

    async deleteEverything() {
      const ok = await M.ui.confirm('This deletes your cat, your progress, your safety plan and all check-ins from this device, and asks the bottle server to delete every bottle and reply you sent. It cannot be undone.', 'Delete everything', 'Keep my cat', { danger: true, title: 'Delete everything?' });
      if (!ok) return;
      try { if (await M.api.check()) await M.api.req('POST', '/api/forget', { clientId: S().profile.clientId }); } catch (e) { /* local wipe still happens */ }
      M.store.wipe();
      location.reload();
    },

    wardrobe() {
      const canvas = h('canvas', { class: 'preview-canvas', 'aria-hidden': 'true' });
      const nameIn = h('input', { type: 'text', maxlength: 16, value: S().cat.name, 'aria-label': 'Cat name' });
      nameIn.addEventListener('change', () => { const v = nameIn.value.trim() || 'Mochi'; M.store.update((x) => { x.cat.name = v; }, 'cat'); });
      const coats = h('div', { class: 'swatches', role: 'radiogroup', 'aria-label': 'Coat' });
      const accs = h('div', { class: 'acc-grid' });
      const yarnLabel = h('span', null);
      const render = () => {
        const s = S();
        yarnLabel.textContent = 'Accessory  ·  you have ' + s.yarn + ' 🧶';
        coats.innerHTML = '';
        D().COATS.forEach((id) => {
          const c = M.cat.COATS[id];
          coats.append(h('button', {
            class: 'swatch' + (s.cat.coat === id ? ' on' : ''), role: 'radio', 'aria-checked': String(s.cat.coat === id),
            onclick: () => { M.store.update((x) => { x.cat.coat = id; }, 'cat'); render(); },
          }, h('i', { style: { background: c.body, boxShadow: 'inset -6px -6px 0 ' + (c.mark || c.belly) } }), c.label));
        });
        accs.innerHTML = '';
        D().ACCESSORIES.forEach((a) => {
          const owned = s.owned.acc.includes(a.id);
          const on = s.cat.acc === a.id;
          accs.append(h('button', {
            class: 'acc' + (on ? ' on' : '') + (owned ? '' : ' locked'), 'aria-pressed': String(on),
            onclick: () => {
              if (owned) { M.store.update((x) => { x.cat.acc = a.id; }, 'cat'); render(); return; }
              if (a.cost == null) { M.ui.toast(a.note || 'Found somewhere on the isles.'); return; }
              if (S().yarn < a.cost) { M.ui.toast('That needs ' + a.cost + ' 🧶. Yarn comes gently — no rush.'); return; }
              M.store.update((x) => { x.yarn -= a.cost; x.owned.acc.push(a.id); x.cat.acc = a.id; }, 'yarn'); M.emit('cat'); M.audio.ui('sparkle'); render();
            },
          }, h('span', { class: 'emo', 'aria-hidden': 'true' }, a.icon), h('span', null, a.label),
          !owned ? h('small', null, a.cost == null ? '🗺️ ' + (a.note || '') : a.cost + ' 🧶') : null));
        });
      };
      render();
      const body = h('div', { class: 'wardrobe' },
        canvas,
        h('label', { class: 'field' }, h('span', null, 'Name'), nameIn),
        h('div', { class: 'field' }, h('span', null, 'Coat'), coats),
        h('div', { class: 'field' }, yarnLabel, accs),
        h('p', { class: 'muted small' }, 'Yarn is earned gently (tasks, finds, welcome-back gifts) and only buys cosmetics. Never real money.'));
      M.cat.preview(canvas, () => ({ coat: S().cat.coat, acc: S().cat.acc, pose: 'sit' }), 160, 120);
      M.ui.sheet({ title: 'Look & wardrobe', icon: '🎀', body });
    },

    decor() {
      const list = h('div', { class: 'stack' });
      const render = () => {
        const s = S();
        list.innerHTML = '';
        list.append(h('p', { class: 'muted' }, 'You have ' + s.yarn + ' 🧶. Decorations are just for fun — every feature is open from day one.'));
        D().DECOR.forEach((d) => {
          const owned = s.owned.decor.includes(d.id), shown = owned && !s.decorOff.includes(d.id);
          list.append(h('div', { class: 'decor-row' },
            h('span', { class: 'emo', 'aria-hidden': 'true' }, d.icon), h('span', { class: 'grow' }, d.label),
            owned
              ? h('button', { class: 'btn small' + (shown ? '' : ' ghost'), 'aria-pressed': String(shown), onclick: () => {
                M.store.update((x) => { x.decorOff = shown ? x.decorOff.concat(d.id) : x.decorOff.filter((y) => y !== d.id); }, 'decor'); render();
              } }, shown ? 'Placed ✓' : 'Stored')
              : h('button', { class: 'btn small primary', onclick: () => {
                if (S().yarn < d.cost) { M.ui.toast('That needs ' + d.cost + ' 🧶. No rush at all.'); return; }
                M.store.update((x) => { x.yarn -= d.cost; x.owned.decor.push(d.id); }, 'decor'); M.emit('yarn'); M.audio.ui('sparkle'); render();
              } }, d.cost + ' 🧶')));
        });
      };
      render();
      M.ui.sheet({ title: 'Decorate', icon: '🪴', body: list });
    },
  };

  M.settings = settings;
})(window.M);
