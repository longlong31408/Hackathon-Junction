/* Mochi — safety: the always-visible help screen, the personal safety plan,
   and the message filter (mirrored on the server in server/server.py).
   Serious moments use the calm layout: no bounce, no jokes. */
'use strict';
(function (M) {
  const h = M.h;

  /* ---------- message filter ---------- */
  const CRISIS = [
    /\bkill(ing)?\s+my\s*self\b/i, /\bsuicid(e|al)\b/i, /\bend(ing)?\s+(my|it)\s+(life|all)\b/i, /\bwant(ing)?\s+to\s+die\b/i,
    /\bwanna\s+die\b/i, /\b(don'?t|do not)\s+want\s+to\s+(live|be alive|be here)\b/i, /\bno\s+reason\s+to\s+live\b/i,
    /\bself[\s-]?harm/i, /\bcut(ting)?\s+my\s*self\b/i, /\bhurt(ing)?\s+my\s*self\b/i, /\boverdos(e|ing)\b/i,
    /\bbetter\s+off\s+dead\b/i, /\btake\s+my\s+(own\s+)?life\b/i, /\bnot\s+be\s+(here|around)\s+anymore\b/i,
    /\bcan'?t\s+go\s+on\s+(like\s+this|anymore|any\s+more)\b/i, /\bkms\b/i,
  ];
  const ABUSE = [
    /\bkill\s+your\s*self\b/i, /\bkys\b/i, /\bgo\s+die\b/i, /\bnobody\s+(cares|likes\s+you)\b/i, /\byou'?re\s+(worthless|pathetic|a\s+loser|stupid|ugly)\b/i,
    /\bshut\s+up\b/i, /\bidiot\b/i, /\bloser\b/i,
  ];
  const CONTACT = [
    [/(https?:\/\/|www\.)\S+/i, 'links'],
    [/\b[\w-]+\.(com|net|org|io|me|gg|ly|co|app|xyz|info|vn|fi|uk|de|ru|tv|link)\b/i, 'links'],
    [/[\w.+-]+@[\w-]+\.[\w.]+/, 'email addresses'],
    [/(^|\s)@[\w.]{2,}/, 'social handles'],
    [/\b(snap(chat)?|insta(gram)?|discord|telegram|whatsapp|kik|tiktok|zalo|facebook|messenger|wechat|line\s?id)\b/i, 'social handles'],
  ];
  function digits(text) {
    const m = text.match(/\+?\d[\d\s().-]{5,}\d/g) || [];
    return m.some((s) => s.replace(/\D/g, '').length >= 7);
  }

  M.safety = {
    /* kind: 'bottle' | 'reply' -> {ok, crisis, reason} */
    check(text, kind) {
      const t = (text || '').trim();
      if (!t) return { ok: false, reason: 'empty' };
      if (CRISIS.some((r) => r.test(t))) return { ok: false, crisis: true, reason: 'crisis' };
      for (const [re, what] of CONTACT) if (re.test(t)) return { ok: false, reason: 'To keep everyone safe, bottles can\'t carry ' + what + '.' };
      if (digits(t)) return { ok: false, reason: 'To keep everyone safe, bottles can\'t carry phone numbers.' };
      if (kind === 'reply' && ABUSE.some((r) => r.test(t))) return { ok: false, reason: 'Replies here are kind-only. Could you say it more gently?' };
      return { ok: true };
    },

    country() {
      const set = M.store.state.settings.country;
      if (set && set !== 'auto') return set;
      let tz = '';
      try { tz = Intl.DateTimeFormat().resolvedOptions().timeZone || ''; } catch (e) { /* ignore */ }
      if (M.data.TZ_COUNTRY[tz]) return M.data.TZ_COUNTRY[tz];
      const langs = navigator.languages || [navigator.language || ''];
      for (const l of langs) {
        const region = (l.split('-')[1] || '').toUpperCase();
        if (M.data.HELPLINES[region]) return region;
        if (/^vi/i.test(l)) return 'VN';
        if (/^fi/i.test(l)) return 'FI';
      }
      if (/^America\//.test(tz)) return 'US';
      return 'OTHER';
    },

    /* The 🛟 screen. Plain, calm, always reachable in one tap. */
    openHelp() {
      const existing = document.querySelector('.sheet.help-sheet');
      if (existing) { existing.querySelector('button').focus(); return; }
      const body = h('div', { class: 'help' });
      const render = () => {
        body.innerHTML = '';
        const code = this.country();
        const info = M.data.HELPLINES[code];
        const emergency = info ? info.emergency : '112';
        M.add(body,
          h('p', { class: 'lead' }, 'You matter. If you are thinking about ending your life, or you are in danger right now, please contact emergency services or a crisis line.'),
          h('a', { class: 'btn danger block', href: 'tel:' + emergency.replace(/\s/g, '') },
            '📞 Call emergency services: ' + emergency),
          info && info.emergencyNote ? h('p', { class: 'muted small' }, info.emergencyNote) : null,
          h('label', { class: 'field' }, h('span', null, 'Country'),
            h('select', {
              onchange: (e) => { M.store.update((s) => { s.settings.country = e.target.value; }); render(); },
            },
            h('option', { value: 'auto' }, 'Detect automatically'),
            Object.keys(M.data.HELPLINES).map((k) => h('option', { value: k, selected: M.store.state.settings.country === k }, M.data.HELPLINES[k].name)),
            h('option', { value: 'OTHER', selected: M.store.state.settings.country === 'OTHER' }, 'Somewhere else'))),
          info ? h('div', { class: 'lines' },
            h('h3', null, 'Crisis lines in ' + info.name),
            info.lines.map((l) => h('div', { class: 'line' },
              h('strong', null, l.name),
              h('div', { class: 'row wrap' },
                h('a', { class: 'btn primary', href: 'tel:' + l.tel.replace(/\s/g, '') }, '📞 Call ' + l.tel),
                l.alt ? h('a', { class: 'btn ghost', href: 'tel:' + l.alt.replace(/\s/g, '') }, 'or ' + l.alt) : null,
                l.sms ? h('a', { class: 'btn ghost', href: 'sms:' + l.sms.replace(/\s/g, '') }, '💬 Text ' + l.sms) : null),
              h('p', { class: 'muted small' }, l.note, ' ', h('a', { href: l.web, target: '_blank', rel: 'noopener' }, 'Website')))))
            : h('div', { class: 'lines' },
              h('p', null, 'Find a free, confidential helpline near you:'),
              h('a', { class: 'btn primary', href: 'https://findahelpline.com', target: '_blank', rel: 'noopener' }, '🌍 findahelpline.com')),
          this.trustedPeople(),
          h('h3', null, 'Other things that can help'),
          h('div', { class: 'stack' },
            h('button', { class: 'btn', onclick: () => this.openPlan() }, '📝 My safety plan'),
            h('button', { class: 'btn', onclick: () => M.calm.breathe({ calm: true }) }, '🫁 Breathe slowly for a minute'),
            h('a', { class: 'btn ghost', href: 'https://findahelpline.com', target: '_blank', rel: 'noopener' }, '🌍 Helplines in other countries')),
          h('p', { class: 'muted small' },
            'Mochi is a self-care companion, not a crisis service or a medical device. Numbers last checked ' + M.data.HELP_CHECKED + '.'),
        );
      };
      render();
      M.ui.sheet({ title: 'Help is here', icon: '🛟', body, calm: true, className: 'help-sheet', id: 'help' });
    },

    trustedPeople() {
      const p = (M.store.state.safetyPlan.people || '').trim();
      if (!p) return null;
      return h('div', { class: 'lines' }, h('h3', null, 'People you said you could reach out to'), h('p', { class: 'prewrap' }, p));
    },

    /* Personal safety plan, based on the widely used Stanley–Brown structure. */
    openPlan() {
      const sections = [
        ['warning', 'My warning signs', 'Thoughts, feelings or situations that tell me a hard time may be starting.'],
        ['coping', 'Things I can do on my own', 'Small things that help me cope: a shower, music, a walk, holding something soft…'],
        ['distract', 'People and places that take my mind off things', 'A café, a friend\'s place, a park, a group chat…'],
        ['people', 'People I can ask for help', 'Names and how to reach them. This stays on this device only.'],
        ['pros', 'Professionals and services I can contact', 'My doctor, a therapist, a local crisis line…'],
        ['safe', 'Making my space safer', 'Things I can put away or ask someone to keep for me.'],
        ['reasons', 'Reasons to keep going', 'People, pets, plans, little things I would miss.'],
      ];
      const plan = M.store.state.safetyPlan;
      const body = h('div', { class: 'plan' },
        h('p', { class: 'muted' }, 'Fill in what you can, whenever you can. Even one line helps. Saved only on this device.'),
        sections.map(([key, title, hint]) => h('label', { class: 'field' },
          h('span', null, title),
          h('textarea', {
            rows: 3, placeholder: hint, value: plan[key] || '',
            oninput: (e) => { M.store.update((s) => { s.safetyPlan[key] = e.target.value; }); },
          }))),
        h('div', { class: 'row wrap' },
          h('button', { class: 'btn', onclick: () => { document.body.classList.add('print-plan'); window.print(); setTimeout(() => document.body.classList.remove('print-plan'), 500); } }, '🖨️ Print or save as PDF'),
          h('button', { class: 'btn ghost', onclick: () => this.openHelp() }, '🛟 Crisis lines')));
      M.ui.sheet({ title: 'My safety plan', icon: '📝', body, calm: true, className: 'plan-sheet' });
    },

    /* Shown when someone writes crisis language into a bottle or reply. */
    crisisNotice(where) {
      const code = this.country();
      const info = M.data.HELPLINES[code];
      const body = h('div', { class: 'help' },
        h('p', { class: 'lead' }, 'It sounds like things are really heavy right now. Thank you for putting it into words.'),
        h('p', null, where === 'bottle'
          ? 'Your bottle is resting safely with our team instead of going out to sea. Messages like this deserve a real person, not a stranger\'s bottle.'
          : 'We held this message so a real person on our team can look at it first.'),
        h('p', null, 'If you might act on these thoughts, please reach out now:'),
        info ? info.lines.map((l) => h('a', { class: 'btn primary block', href: 'tel:' + l.tel.replace(/\s/g, '') }, '📞 ' + l.name + ' · ' + l.tel)) : null,
        h('a', { class: 'btn danger block', href: 'tel:' + (info ? info.emergency : '112') }, '📞 Emergency services · ' + (info ? info.emergency : '112')),
        h('div', { class: 'stack' },
          h('button', { class: 'btn', onclick: () => this.openHelp() }, 'More help options'),
          h('button', { class: 'btn', onclick: () => this.openPlan() }, 'My safety plan')));
      M.ui.sheet({ title: 'You are not alone', icon: '🛟', body, calm: true });
    },
  };
})(window.M);
