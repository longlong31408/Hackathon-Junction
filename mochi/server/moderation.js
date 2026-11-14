'use strict';
const $ = (s) => document.querySelector(s);
const tokenIn = $('#token');
tokenIn.value = sessionStorage.getItem('mochiModToken') || '';

async function load() {
  const token = tokenIn.value.trim();
  sessionStorage.setItem('mochiModToken', token);
  const res = await fetch('/api/mod/queue?token=' + encodeURIComponent(token), { cache: 'no-store' });
  const list = $('#list');
  list.textContent = '';
  if (!res.ok) { list.textContent = res.status === 403 ? 'Wrong token.' : 'Could not load the queue.'; return; }
  const data = await res.json();
  $('#stats').textContent = data.stats.bottlesAtSea + ' bottles at sea · ' + data.stats.replies + ' kind replies';
  if (!data.items.length) list.textContent = 'Nothing waiting. The sea is calm. 🌊';
  for (const it of data.items) {
    const el = document.createElement('div');
    el.className = 'item ' + it.status;
    const meta = document.createElement('div');
    meta.className = 'meta';
    meta.textContent = (it.status === 'held' ? 'HELD (crisis language)' : 'REPORTED') + ' · ' + it.kind + ' · ' + new Date(it.at).toLocaleString()
      + (it.energy ? ' · energy ' + it.energy : '') + (it.reports.length ? ' · reports: ' + it.reports.join(', ') : '');
    const text = document.createElement('div');
    text.className = 'text';
    text.textContent = it.text;
    const ok = document.createElement('button'); ok.className = 'ok'; ok.textContent = 'Approve';
    const rm = document.createElement('button'); rm.className = 'rm'; rm.textContent = 'Remove';
    ok.onclick = () => decide(it, 'approve');
    rm.onclick = () => decide(it, 'remove');
    el.append(meta, text, ok, ' ', rm);
    list.append(el);
  }
  const crew = $('#crew');
  crew.textContent = data.crewNotes.length ? '' : '—';
  data.crewNotes.forEach((n) => { const p = document.createElement('p'); p.textContent = '💛 ' + n.text; crew.append(p); });
}

async function decide(it, action) {
  await fetch('/api/mod/decide', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token: tokenIn.value.trim(), kind: it.kind, id: it.id, action }),
  });
  load();
}

$('#load').onclick = load;
tokenIn.addEventListener('keydown', (e) => { if (e.key === 'Enter') load(); });
if (tokenIn.value) load();
