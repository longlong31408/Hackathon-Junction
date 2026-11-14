/* Mochi — messages in a bottle. Anonymous notes matched by energy and need,
   one kind reply each, report & block on everything. Talks to the bottle
   server (server/server.py); works offline with an outbox + crew bottles. */
'use strict';
(function (M) {
  const h = M.h;
  const D = () => M.data;

  /* ---------- tiny API client ---------- */
  const api = {
    online: null,
    async check(force) {
      if (location.protocol === 'file:') return (this.online = false);
      if (this.online !== null && !force) return this.online;
      try { const r = await this.req('GET', '/api/health'); this.online = !!(r && r.ok); } catch (e) { this.online = false; }
      return this.online;
    },
    async req(method, path, body) {
      const ctl = new AbortController();
      const timer = setTimeout(() => ctl.abort(), 6000);
      try {
        const res = await fetch(path, {
          method, signal: ctl.signal, headers: body ? { 'Content-Type': 'application/json' } : undefined,
          body: body ? JSON.stringify(body) : undefined, cache: 'no-store',
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) { const err = new Error(data.reason || data.error || 'error'); err.data = data; err.status = res.status; throw err; }
        return data;
      } finally { clearTimeout(timer); }
    },
  };
  M.api = api;

  const st = () => M.store.state;
  const cid = () => st().profile.clientId;
  const tz = () => -new Date().getTimezoneOffset();

  const bottles = {
    /* Send queued bottles and pull replies. Quiet; safe to call any time. */
    async sync() {
      if (!st().profile.adult || !(await api.check())) return false;
      for (const b of st().bottles.outbox.slice()) {
        try {
          const r = await api.req('POST', '/api/bottles', { clientId: cid(), text: b.text, energy: b.energy, need: b.need, topic: b.topic, tz: tz() });
          M.store.update((s) => {
            s.bottles.outbox = s.bottles.outbox.filter((x) => x.localId !== b.localId);
            s.bottles.sent.unshift({ id: r.id, text: b.text, at: b.at, status: r.status, need: b.need, topic: b.topic, deliveries: 0, replyCount: 0 });
          });
        } catch (e) {
          if (e.status === 400) M.store.update((s) => { s.bottles.outbox = s.bottles.outbox.filter((x) => x.localId !== b.localId); });
          break;
        }
      }
      try {
        const r = await api.req('GET', '/api/mine?clientId=' + encodeURIComponent(cid()));
        M.store.update((s) => {
          const byId = Object.fromEntries((r.bottles || []).map((b) => [b.id, b]));
          s.bottles.sent.forEach((b) => { const x = byId[b.id]; if (x) { b.status = x.status; b.deliveries = x.deliveries; b.replyCount = x.replyCount; } });
          const known = new Set(s.bottles.replies.map((x) => x.id));
          (r.replies || []).forEach((rp) => {
            if (!known.has(rp.id) && !s.bottles.blocked.includes(rp.authorRef)) s.bottles.replies.unshift(Object.assign({ read: false }, rp));
          });
        }, 'bottles');
      } catch (e) { /* offline is fine */ }
      return true;
    },

    async fetchInbox() {
      const s = st();
      const online = await api.check(true);
      let arrived = [];
      if (online) {
        await this.sync();
        const q = new URLSearchParams({ clientId: cid(), energy: s.today.energy || 3, listener: s.settings.listener ? 1 : 0, need: s.bottles.need || '', topic: s.bottles.topic || '', tz: tz() });
        const r = await api.req('GET', '/api/inbox?' + q.toString());
        arrived = (r.bottles || []).filter((b) => !s.bottles.blocked.includes(b.authorRef));
      } else {
        // Offline: only the clearly-labelled crew bottles can wash up.
        arrived = D().CREW_BOTTLES.filter((b) => !s.bottles.crewDelivered.includes(b.id)).slice(0, 2)
          .map((b) => Object.assign({ crew: true, energy: null, authorRef: 'crew', at: Date.now() }, b));
      }
      M.store.update((st2) => {
        const have = new Set(st2.bottles.inbox.map((b) => b.id));
        arrived.forEach((b) => {
          if (have.has(b.id)) return;
          st2.bottles.inbox.unshift(Object.assign({ replied: false, dismissed: false, seen: false }, b));
          if (b.crew) st2.bottles.crewDelivered.push(b.id);
        });
        st2.bottles.inbox = st2.bottles.inbox.slice(0, 60);
        st2.bottles.lastFetch = Date.now();
      }, 'bottles');
      return { online, n: arrived.length };
    },

    hasNew() {
      const b = st().bottles;
      return b.inbox.some((x) => !x.seen && !x.dismissed) || b.replies.some((x) => !x.read);
    },

    open(tab, prefill) {
      const s = st();
      if (!s.profile.adult) {
        M.ui.sheet({
          title: 'Bottles', icon: '🍾',
          body: h('div', null,
            h('p', null, 'Messages in a bottle connect strangers, so for safety they are only for adults (18+) for now.'),
            h('p', null, 'Everything else in Mochi is yours: your cat, the worry room, tiny tasks, the isles.'),
            h('p', null, 'If things feel heavy, the 🛟 Help button has people you can talk to right now.'),
            h('button', { class: 'btn', onclick: () => M.safety.openHelp() }, '🛟 Help')),
        });
        return;
      }
      tab = tab || 'inbox';
      const content = h('div', { class: 'bottles' });
      const tabs = h('div', { class: 'tabs', role: 'tablist' });
      const status = h('p', { class: 'muted small', 'aria-live': 'polite' });
      const self = this;
      const TABS = [['inbox', '📥 Arrived'], ['write', '✉️ Write'], ['replies', '💌 Replies']];
      function renderTabs() {
        tabs.innerHTML = '';
        TABS.forEach(([id, label]) => tabs.append(h('button', {
          class: 'tab' + (id === tab ? ' on' : ''), role: 'tab', 'aria-selected': String(id === tab),
          onclick: () => { tab = id; renderTabs(); render(); },
        }, label)));
      }
      function render() {
        content.innerHTML = '';
        if (tab === 'inbox') renderInbox(); else if (tab === 'write') renderWrite(); else renderReplies();
      }
      function needRow() {
        const s2 = st();
        const row = h('div', { class: 'need-row' },
          h('span', { class: 'label' }, 'Right now I need:'),
          M.ui.chips(Object.entries(D().NEEDS).map(([id, n]) => ({ id, icon: n.icon, label: n.label })), s2.bottles.need,
            (v) => M.store.update((x) => { x.bottles.need = v || 'company'; }), { label: 'What I need right now' }));
        if ((s2.today.energy || 0) >= 3) {
          row.append(h('button', {
            class: 'toggle-row compact' + (s2.settings.listener ? ' on' : ''), 'aria-pressed': String(!!s2.settings.listener),
            onclick: (e) => { M.store.update((x) => { x.settings.listener = !x.settings.listener; }); e.currentTarget.classList.toggle('on'); e.currentTarget.setAttribute('aria-pressed', String(st().settings.listener)); },
          }, h('span', { 'aria-hidden': 'true' }, '🎧'), h('span', { class: 'grow' }, 'Be a listener cat today (receive heavier bottles)'), h('span', { class: 'switch' })));
        }
        return row;
      }

      // ----- Arrived -----
      function renderInbox() {
        const s2 = st();
        const list = s2.bottles.inbox.filter((b) => !b.dismissed);
        const checkBtn = h('button', { class: 'btn primary' }, '🌊 Check the sea');
        checkBtn.addEventListener('click', async () => {
          checkBtn.disabled = true; status.textContent = 'A cat is looking along the shore…';
          try {
            const r = await self.fetchInbox();
            status.textContent = r.n ? r.n + ' bottle' + (r.n > 1 ? 's' : '') + ' washed up. 🍾' : 'The sea is calm right now. Nothing new — and that is okay.';
            if (!r.online) status.textContent += ' (Offline: only starter bottles from the Mochi crew can arrive.)';
          } catch (e) { status.textContent = 'The sea could not be reached. Try again later.'; }
          checkBtn.disabled = false; render();
        });
        content.append(needRow(), h('div', { class: 'row between' }, checkBtn), status);
        if (!list.length) content.append(h('p', { class: 'empty' }, 'No bottles here yet. When one washes up, you can send its writer one kind reply.'));
        list.forEach((b) => content.append(card(b)));
        M.store.update((x) => x.bottles.inbox.forEach((b) => { b.seen = true; }), 'bottles');
      }

      function card(b) {
        const el = h('article', { class: 'bottle-card' });
        const need = D().NEEDS[b.need] || D().NEEDS.company;
        el.append(
          h('div', { class: 'meta' },
            h('span', { class: 'pill' }, need.icon + ' ' + need.label),
            b.topic ? h('span', { class: 'pill soft' }, b.topic) : null,
            b.crew ? h('span', { class: 'pill crew' }, '🐾 Starter bottle from the Mochi crew') : M.ui.energyDots(b.energy)),
          h('p', { class: 'prewrap' }, b.text));
        if (b.replied) {
          el.append(h('p', { class: 'muted' }, '💛 You sent a kind reply' + (b.myReply ? ': “' + b.myReply + '”' : '.')));
        } else {
          const actions = h('div', { class: 'row wrap' },
            h('button', { class: 'btn primary', onclick: () => { actions.replaceWith(composer(b, el)); } }, '💛 Send a kind reply'),
            h('button', { class: 'btn ghost', onclick: () => { M.store.update((x) => { const t = x.bottles.inbox.find((y) => y.id === b.id); if (t) t.dismissed = true; }); el.remove(); M.ui.toast('The bottle drifts gently back out to sea. 🌊'); } }, '🌊 Let it drift'));
          el.append(actions);
        }
        if (!b.crew) el.append(safetyMenu('bottle', b.id, b.authorRef, () => el.remove()));
        return el;
      }

      function composer(b, cardEl) {
        const ta = h('textarea', { rows: 2, maxlength: 280, placeholder: 'One kind reply (no names, numbers or links)…', 'aria-label': 'Your kind reply' });
        const msg = h('p', { class: 'muted small', 'aria-live': 'polite' });
        const sendBtn = h('button', { class: 'btn primary' }, 'Send 💛');
        sendBtn.addEventListener('click', async () => {
          const text = ta.value.trim();
          const chk = M.safety.check(text, 'reply');
          if (!chk.ok) {
            if (chk.crisis) { M.safety.crisisNotice('reply'); return; }
            msg.textContent = chk.reason === 'empty' ? 'Pick a kind line above or write your own.' : chk.reason; return;
          }
          sendBtn.disabled = true;
          try {
            if (!b.crew || (await api.check())) {
              if (!(await api.check())) throw new Error('offline');
              const r = await api.req('POST', '/api/reply', { clientId: cid(), bottleId: b.id, text });
              if (r.status === 'held') M.ui.toast('Your reply is waiting for a quick check by our team.');
            }
            M.store.update((x) => { const t = x.bottles.inbox.find((y) => y.id === b.id); if (t) { t.replied = true; t.myReply = text; } });
            M.ui.toast(b.crew ? 'The Mochi crew says thank you 💛' : 'A cat is carrying your kind words across the sea. 🐈💨');
            M.audio.ui('sparkle');
            cardEl.replaceWith(card(st().bottles.inbox.find((y) => y.id === b.id)));
          } catch (e) {
            sendBtn.disabled = false;
            msg.textContent = e.data && e.data.reason ? e.data.reason : 'Could not reach the sea right now. Your words are still here — try again later.';
            if (e.data && e.data.crisis) M.safety.crisisNotice('reply');
          }
        });
        return h('div', { class: 'composer' },
          h('div', { class: 'chips wrap' }, D().REPLY_PRESETS.map((p) => h('button', { class: 'chip', onclick: () => { ta.value = p; ta.focus(); } }, p))),
          ta, msg, h('div', { class: 'row end' }, sendBtn));
      }

      function safetyMenu(kind, id, authorRef, onGone) {
        const d = h('details', { class: 'safety-menu' }, h('summary', { 'aria-label': 'Report or block' }, '⋯ Report or block'));
        d.append(h('div', { class: 'row wrap' },
          h('button', { class: 'btn ghost small', onclick: async () => {
            if (!(await M.ui.confirm('Report this message? Our team will look at it, and you will not see it again.', 'Report', 'Cancel', { title: 'Report' }))) return;
            try { if (await api.check()) await api.req('POST', '/api/report', { clientId: cid(), kind, id, reason: 'user report' }); } catch (e) { /* still hide locally */ }
            M.store.update((x) => {
              if (kind === 'bottle') { const t = x.bottles.inbox.find((y) => y.id === id); if (t) { t.dismissed = true; t.reported = true; } }
              else x.bottles.replies = x.bottles.replies.filter((y) => y.id !== id);
            });
            onGone(); M.ui.toast('Thank you for keeping the sea kind. 🛟');
          } }, '🚩 Report'),
          h('button', { class: 'btn ghost small', onclick: async () => {
            if (!(await M.ui.confirm('Block this sender? Their bottles and replies will never reach you again.', 'Block', 'Cancel', { title: 'Block' }))) return;
            try { if (await api.check()) await api.req('POST', '/api/block', { clientId: cid(), authorRef }); } catch (e) { /* local block still applies */ }
            M.store.update((x) => {
              if (!x.bottles.blocked.includes(authorRef)) x.bottles.blocked.push(authorRef);
              x.bottles.inbox.forEach((y) => { if (y.authorRef === authorRef) y.dismissed = true; });
              x.bottles.replies = x.bottles.replies.filter((y) => y.authorRef !== authorRef);
            });
            onGone(); M.ui.toast('Blocked. They will not reach you again.');
          } }, '🚫 Block sender')));
        return d;
      }

      // ----- Write -----
      function renderWrite() {
        const s2 = st();
        let need = s2.bottles.need || 'company', topic = s2.bottles.topic || null, energy = s2.today.energy || null;
        const ta = h('textarea', { rows: 5, maxlength: 500, placeholder: 'Write what is on your mind. No names, numbers or links — just you, anonymously.', 'aria-label': 'Your bottle message', value: prefill || '' });
        prefill = null;
        const counter = h('span', { class: 'muted small' }, ta.value.length + '/500');
        ta.addEventListener('input', () => { counter.textContent = ta.value.length + '/500'; });
        const msg = h('p', { class: 'muted', 'aria-live': 'polite' });
        const sendBtn = h('button', { class: 'btn primary big' }, '🍾 Toss it into the sea');
        sendBtn.addEventListener('click', async () => {
          const text = ta.value.trim();
          const chk = M.safety.check(text, 'bottle');
          if (!chk.ok && chk.crisis) {
            // held for a human: still record that it was written, show support.
            ta.value = '';
            sendHeld(text, need, topic, energy);
            M.safety.crisisNotice('bottle'); return;
          }
          if (!chk.ok) { msg.textContent = chk.reason === 'empty' ? 'Write a few words first.' : chk.reason; return; }
          sendBtn.disabled = true;
          const item = { localId: M.uid(), text, need, topic: topic || '', energy: energy || 3, at: Date.now() };
          M.store.update((x) => { x.bottles.outbox.push(item); x.bottles.need = need; x.bottles.topic = topic || ''; });
          const ok = await self.sync();
          ta.value = ''; counter.textContent = '0/500'; sendBtn.disabled = false;
          const sent = st().bottles.sent.find((b) => b.text === text && b.at === item.at);
          if (ok && sent && sent.status === 'held') { M.safety.crisisNotice('bottle'); }
          else if (ok && sent) { M.ui.toast('A cat is carrying your bottle out to sea. 🐈💨'); M.audio.ui('splash'); }
          else M.ui.toast('Saved in your outbox. It will sail when Mochi can reach the bottle server.');
          render();
        });
        content.append(
          h('label', { class: 'field' }, h('span', null, 'Your bottle'), ta, counter),
          h('div', { class: 'field' }, h('span', null, 'What would help?'),
            M.ui.chips(Object.entries(D().NEEDS).map(([id, n]) => ({ id, icon: n.icon, label: n.label })), need, (v) => { need = v || 'company'; }, { label: 'What would help' })),
          h('div', { class: 'field' }, h('span', null, 'Topic (optional)'),
            M.ui.chips(D().TOPICS.map((t) => ({ id: t, label: t })), topic, (v) => { topic = v; }, { toggle: true, label: 'Topic' })),
          h('div', { class: 'field' }, h('span', null, 'Your energy today'),
            M.ui.chips([1, 2, 3, 4, 5].map((e) => ({ id: e, icon: D().ENERGY[e].icon, label: String(e) })), energy, (v) => { energy = v; }, { label: 'Energy' }),
            h('p', { class: 'muted small' }, 'Bottles go to someone with compatible energy — never to someone at their very lowest when you are too.')),
          msg, sendBtn);
        const mine = st().bottles.sent.concat(st().bottles.outbox.map((o) => Object.assign({ status: 'waiting' }, o)));
        if (mine.length) {
          content.append(h('h3', null, 'Your bottles'));
          mine.slice(0, 20).forEach((b) => content.append(h('div', { class: 'sent-row' },
            h('p', { class: 'prewrap clamp' }, b.text),
            h('p', { class: 'muted small' }, statusLabel(b)))));
        }
      }
      function statusLabel(b) {
        if (b.status === 'waiting') return '⏳ In your outbox — waiting for a connection';
        if (b.status === 'held') return '🛟 Resting safely with our team';
        if (b.status === 'removed') return '🧹 Removed by moderation';
        if (b.status === 'review') return '🔎 Being checked by our team';
        const parts = ['⛵ At sea'];
        if (b.deliveries) parts.push('found by ' + b.deliveries + ' cat' + (b.deliveries > 1 ? 's' : ''));
        if (b.replyCount) parts.push('💌 ' + b.replyCount + ' kind repl' + (b.replyCount > 1 ? 'ies' : 'y'));
        return parts.join(' · ');
      }
      async function sendHeld(text, need, topic, energy) {
        // The server holds crisis bottles for human review; offline we keep nothing.
        if (!(await api.check())) return;
        try {
          const r = await api.req('POST', '/api/bottles', { clientId: cid(), text, energy: energy || 3, need, topic: topic || '', tz: tz() });
          M.store.update((x) => { x.bottles.sent.unshift({ id: r.id, text, at: Date.now(), status: r.status, need, topic: topic || '' }); });
        } catch (e) { /* ignore */ }
      }

      // ----- Replies -----
      function renderReplies() {
        const reps = st().bottles.replies;
        content.append(h('p', { class: 'muted' }, 'Kind replies other cats sent to your bottles.'));
        const refresh = h('button', { class: 'btn' }, '🔄 Check for replies');
        refresh.addEventListener('click', async () => { refresh.disabled = true; const ok = await self.sync(); status.textContent = ok ? '' : 'Offline — replies need the bottle server.'; render(); });
        content.append(h('div', { class: 'row' }, refresh), status);
        if (!reps.length) content.append(h('p', { class: 'empty' }, 'No replies yet. Bottles take their time — there is no rush.'));
        reps.forEach((r) => {
          const mine = st().bottles.sent.find((b) => b.id === r.bottleId);
          const el = h('article', { class: 'bottle-card reply' },
            mine ? h('p', { class: 'muted small clamp' }, 'To your bottle: “' + mine.text + '”') : null,
            h('p', { class: 'prewrap big-text' }, r.text));
          el.append(safetyMenu('reply', r.id, r.authorRef, () => el.remove()));
          content.append(el);
        });
        M.store.update((x) => x.bottles.replies.forEach((r) => { r.read = true; }), 'bottles');
      }

      renderTabs(); render();
      M.ui.sheet({ title: 'Messages in a bottle', icon: '🍾', body: h('div', null, tabs, content), id: 'bottles' });
      if (tab === 'inbox' && Date.now() - st().bottles.lastFetch > 10 * 60 * 1000) {
        status.textContent = 'A cat is looking along the shore…';
        this.fetchInbox().then((r) => { status.textContent = r.n ? r.n + ' bottle' + (r.n > 1 ? 's' : '') + ' washed up. 🍾' : ''; if (tab === 'inbox') render(); }).catch(() => { status.textContent = ''; });
      }
    },
  };

  M.bottles = bottles;
})(window.M);
