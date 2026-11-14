/* Mochi — gentle onboarding: welcome, 18+ for the community, adopt a cat,
   transparent explanation of check-ins + explicit consent. */
'use strict';
(function (M) {
  const h = M.h;

  M.onboarding = {
    start(done) {
      const root = M.$('#onboarding');
      root.hidden = false;
      const draft = { name: 'Mochi', coat: 'cream', acc: 'bow', adult: null, consent: false, freq: 'daily' };
      let step = 0;
      const card = h('div', { class: 'ob-card', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Welcome to Mochi' });
      root.innerHTML = ''; root.append(card);

      const steps = [
        () => [
          h('div', { class: 'ob-hero', 'aria-hidden': 'true' }, '🐱'),
          h('h1', null, 'Hi. This is a cozy place for low-energy days.'),
          h('p', null, 'A little cat, a little mansion, a big quiet world. Nothing here expires, nothing here punishes you, and everything works with one tap.'),
          h('p', { class: 'muted small' }, 'Mochi is a self-care companion, not a medical service. The 🛟 Help button is on every screen.'),
          nav(null, 'Let\'s go'),
        ],
        () => [
          h('h1', null, 'One quick question'),
          h('p', null, 'Mochi\'s community features connect strangers, so for now they are for adults only. Are you 18 or older?'),
          h('div', { class: 'stack' },
            h('button', { class: 'btn primary big', onclick: () => { draft.adult = true; next(); } }, 'Yes, I\'m 18 or older'),
            h('button', { class: 'btn big', onclick: () => { draft.adult = false; next(); } }, 'No, I\'m under 18')),
          h('p', { class: 'muted small' }, 'Under 18? You can still keep a private cat — only the bottle messages are switched off.'),
          nav(true, null),
        ],
        () => {
          const canvas = h('canvas', { class: 'preview-canvas', 'aria-hidden': 'true' });
          M.cat.preview(canvas, () => ({ coat: draft.coat, acc: draft.acc, pose: 'sit' }), 170, 128);
          const nameIn = h('input', { type: 'text', maxlength: 16, value: draft.name, 'aria-label': 'Cat name' });
          nameIn.addEventListener('input', () => { draft.name = nameIn.value; });
          const coats = h('div', { class: 'swatches', role: 'radiogroup', 'aria-label': 'Coat' });
          const accs = h('div', { class: 'chips wrap' });
          const render = () => {
            coats.innerHTML = '';
            M.data.COATS.forEach((id) => {
              const c = M.cat.COATS[id];
              coats.append(h('button', { class: 'swatch' + (draft.coat === id ? ' on' : ''), role: 'radio', 'aria-checked': String(draft.coat === id), onclick: () => { draft.coat = id; render(); } },
                h('i', { style: { background: c.body, boxShadow: 'inset -6px -6px 0 ' + (c.mark || c.belly) } }), c.label));
            });
            accs.innerHTML = '';
            M.data.ACCESSORIES.filter((a) => a.cost === 0).forEach((a) => accs.append(
              h('button', { class: 'chip' + (draft.acc === a.id ? ' on' : ''), onclick: () => { draft.acc = a.id; render(); } }, a.icon + ' ' + a.label)));
          };
          render();
          return [
            h('h1', null, 'Adopt your cat'),
            canvas,
            h('label', { class: 'field' }, h('span', null, 'Name'), nameIn),
            h('div', { class: 'field' }, h('span', null, 'Coat'), coats),
            h('div', { class: 'field' }, h('span', null, 'Accessory'), accs),
            nav(true, 'This is my cat'),
          ];
        },
        () => {
          const name = (draft.name || 'Mochi').trim() || 'Mochi';
          const consent = h('input', { type: 'checkbox', id: 'ob-consent' });
          consent.addEventListener('change', () => { draft.consent = consent.checked; });
          return [
            h('h1', null, 'How ' + name + ' cares for you'),
            h('p', null, 'Sometimes ' + name + ' asks little questions — like which blanket to pick, or how fast to chase the laser. They help ' + name + ' match your energy and size your daily tasks.'),
            h('ul', { class: 'small' },
              h('li', null, 'Skipping a question never changes anything.'),
              h('li', null, name + ' never gets sick or sad if you are away.'),
              h('li', null, 'You can view, export or delete your data any time in ⚙️ Settings.')),
            h('label', { class: 'consent', for: 'ob-consent' }, consent,
              h('span', null, 'Remember my check-ins on this device. ', h('small', { class: 'muted' }, 'Optional. Mood is health data, so we only keep it if you say yes. Without this, ' + name + ' forgets your answers when you close the app.'))),
            h('div', { class: 'field' }, h('span', null, 'How often may ' + name + ' ask?'),
              M.ui.chips([{ id: 'off', label: 'Never' }, { id: 'daily', label: 'Once a day' }, { id: 'twice', label: 'Twice a day' }], draft.freq, (v) => { draft.freq = v || 'daily'; })),
            nav(true, 'Enter the mansion 🏰'),
          ];
        },
      ];

      function nav(back, nextLabel) {
        return h('div', { class: 'row between ob-nav' },
          back ? h('button', { class: 'btn ghost', onclick: () => { step--; render(); } }, '← Back') : h('span'),
          nextLabel ? h('button', { class: 'btn primary big', onclick: next }, nextLabel) : h('span'));
      }
      function next() {
        if (step === steps.length - 1) return finish();
        step++; render();
      }
      function render() {
        card.innerHTML = '';
        card.append(h('div', { class: 'ob-dots', 'aria-hidden': 'true' }, steps.map((_, i) => h('i', { class: i === step ? 'on' : '' }))));
        card.append(...steps[step]());
        const f = card.querySelector('h1'); if (f) { f.tabIndex = -1; f.focus(); }
      }
      function finish() {
        M.store.update((s) => {
          s.onboarded = true;
          s.profile.adult = !!draft.adult;
          s.profile.consentCheckins = !!draft.consent;
          s.settings.checkinFreq = draft.freq;
          s.cat = { name: (draft.name || 'Mochi').trim() || 'Mochi', coat: draft.coat, acc: draft.acc };
        }, 'cat');
        M.store.flush();
        root.hidden = true; root.innerHTML = '';
        done();
      }
      render();
    },
  };
})(window.M);
