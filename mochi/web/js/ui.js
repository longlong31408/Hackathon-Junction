/* Mochi — bubbly UI primitives: bottom sheets, toasts, confirm dialogs.
   Calm sheets (help / safety) drop all bounce and decoration. */
'use strict';
(function (M) {
  const h = M.h;
  const stack = [];

  function focusables(el) {
    return Array.from(el.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'))
      .filter((x) => !x.disabled && !x.hidden && x.offsetParent !== null);
  }

  const ui = {
    /* opts: {title, icon, body, calm, onClose, className, label} -> {el, body, close} */
    sheet(opts) {
      const prevFocus = document.activeElement;
      const body = h('div', { class: 'sheet-body' }, opts.body || null);
      const closeBtn = h('button', { class: 'icon-btn sheet-close', 'aria-label': 'Close' }, '✕');
      const titleId = 'sheet-title-' + Math.random().toString(36).slice(2, 8);
      const panel = h('div', {
        class: 'sheet' + (opts.calm ? ' calm' : '') + (opts.className ? ' ' + opts.className : ''),
        role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': titleId,
      },
      h('div', { class: 'sheet-head' },
        h('h2', { id: titleId }, opts.icon ? h('span', { class: 'sheet-icon', 'aria-hidden': 'true' }, opts.icon) : null, opts.title || ''),
        closeBtn),
      body);
      const backdrop = h('div', { class: 'sheet-backdrop' + (opts.calm ? ' calm' : '') }, panel);
      let closed = false;
      const api = {
        el: panel, body,
        close() {
          if (closed) return; closed = true;
          const i = stack.indexOf(api); if (i >= 0) stack.splice(i, 1);
          backdrop.classList.add('closing');
          setTimeout(() => backdrop.remove(), M.reducedMotion() || opts.calm ? 0 : 160);
          if (opts.onClose) opts.onClose();
          if (prevFocus && prevFocus.focus && document.contains(prevFocus)) prevFocus.focus();
          M.emit('sheet-closed', opts.id);
        },
        setTitle(t) { M.$('#' + titleId).lastChild.textContent = t; },
      };
      closeBtn.addEventListener('click', () => api.close());
      backdrop.addEventListener('pointerdown', (e) => { if (e.target === backdrop) backdrop._down = true; });
      backdrop.addEventListener('click', (e) => { if (e.target === backdrop && backdrop._down) api.close(); backdrop._down = false; });
      panel.addEventListener('keydown', (e) => {
        if (e.key === 'Tab') {
          const f = focusables(panel); if (!f.length) return;
          if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f[f.length - 1].focus(); }
          else if (!e.shiftKey && document.activeElement === f[f.length - 1]) { e.preventDefault(); f[0].focus(); }
        }
      });
      M.$('#sheetRoot').append(backdrop);
      stack.push(api);
      setTimeout(() => { const f = focusables(panel); (f[1] || f[0] || panel).focus({ preventScroll: true }); }, 30);
      return api;
    },
    closeAll() { stack.slice().reverse().forEach((s) => s.close()); },
    top() { return stack[stack.length - 1]; },
    isOpen() { return stack.length > 0; },

    toast(msg, ms) {
      const root = M.$('#toasts');
      const t = h('div', { class: 'toast' }, msg);
      root.append(t);
      while (root.children.length > 3) root.firstChild.remove();
      setTimeout(() => { t.classList.add('out'); setTimeout(() => t.remove(), 400); }, ms || 2800);
    },

    confirm(text, yes, no, opts) {
      return new Promise((resolve) => {
        let answered = false;
        const s = ui.sheet({
          title: (opts && opts.title) || 'Are you sure?', calm: opts && opts.calm, className: 'small',
          body: h('div', null,
            h('p', null, text),
            h('div', { class: 'row end' },
              h('button', { class: 'btn ghost', onclick: () => { answered = true; s.close(); resolve(false); } }, no || 'Keep it'),
              h('button', { class: 'btn ' + ((opts && opts.danger) ? 'danger' : 'primary'), onclick: () => { answered = true; s.close(); resolve(true); } }, yes || 'Yes'))),
          onClose: () => { if (!answered) resolve(false); },
        });
      });
    },

    /* segmented chip choice: options [{id, icon, label}] */
    chips(options, value, onChange, opts) {
      const wrap = h('div', { class: 'chips' + (opts && opts.big ? ' big' : ''), role: 'radiogroup', 'aria-label': (opts && opts.label) || '' });
      const render = () => {
        wrap.innerHTML = '';
        options.forEach((o) => {
          wrap.append(h('button', {
            class: 'chip' + (o.id === value ? ' on' : ''), role: 'radio', 'aria-checked': String(o.id === value),
            onclick: () => { value = (opts && opts.toggle && value === o.id) ? null : o.id; render(); onChange(value); },
          }, o.icon ? h('span', { 'aria-hidden': 'true' }, o.icon + ' ') : null, o.label));
        });
      };
      render();
      return wrap;
    },

    energyDots(e) {
      const n = e || 0;
      return h('span', { class: 'energy-dots', 'aria-label': n ? 'energy ' + n + ' of 5' : 'energy unknown', title: n ? 'energy ' + n + '/5' : '' },
        [1, 2, 3, 4, 5].map((i) => h('i', { class: i <= n ? 'on' : '' })));
    },
  };

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && stack.length) { e.preventDefault(); stack[stack.length - 1].close(); }
  });

  M.ui = ui;
})(window.M);
