/* Workplace Services portal — user greeting, uni feeds, office helpers.
   Pure client-side; feeds are fetched via the same-origin nginx proxy.
   User identity comes from oauth2-proxy's own /oauth2/userinfo endpoint. */

'use strict';

/* ── 1. Greet the authenticated user (via oauth2-proxy userinfo) ─ */
function loadUser() {
  fetch('/oauth2/userinfo', { headers: { 'Accept': 'application/json' } })
    .then(r => (r.ok ? r.json() : Promise.reject()))
    .then(info => {
      const el = document.getElementById('user-name');
      const name = info.preferredUsername || (info.email || '').split('@')[0] || '';
      el.textContent = name ? name : 'Gast';
      document.title = name ? 'Workplace Services – ' + name : 'Workplace Services';
    })
    .catch(() => { document.getElementById('user-name').textContent = 'Gast'; });
}

/* ── 2. Atom feed loading (uni-marburg.de / Plone) ───────────────── */
const FEEDS = {
  news:   { path: '/news',   max: 8, dateAttr: 'published' },
  events: { path: '/events', max: 6, dateAttr: 'published' },
  hrz:    { path: '/hrz',    max: 6, dateAttr: 'published' },
  ub:     { path: '/ub',     max: 6, dateAttr: 'published' },
};

function fmtDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function loadFeed(key) {
  const cfg = FEEDS[key];
  const list = document.getElementById('feed-' + key);
  fetch(cfg.path)
    .then(r => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.text(); })
    .then(text => {
      const xml = new DOMParser().parseFromString(text, 'text/xml');
      const entries = Array.from(xml.querySelectorAll('entry')).slice(0, cfg.max);
      if (!entries.length) throw new Error('no entries');
      list.innerHTML = '';
      entries.forEach(entry => {
        const title = (entry.querySelector('title')?.textContent || '').trim();
        const linkEl = entry.querySelector('link[rel="alternate"]') || entry.querySelector('link');
        const link = linkEl?.getAttribute('href') || '#';
        const date = fmtDate(entry.querySelector(cfg.dateAttr)?.textContent || '');
        const li = document.createElement('li');
        const a = document.createElement('a');
        a.href = link; a.target = '_blank'; a.rel = 'noopener';
        a.textContent = title;
        li.appendChild(a);
        if (date) {
          const s = document.createElement('span');
          s.className = 'date'; s.textContent = date;
          li.appendChild(s);
        }
        list.appendChild(li);
      });
    })
    .catch(() => {
      list.innerHTML = '<li class="error">Feed derzeit nicht verfügbar</li>';
    });
}

/* ── 3. Office helpers ───────────────────────────────────────────── */

/* 3.1 Notenschnitt (grade point average, weighted by credits) */
function gradeState() { return window.__gradeRows || (window.__gradeRows = [{}]); }

function renderGradeRows() {
  const wrap = document.getElementById('grade-rows');
  const rows = gradeState();
  wrap.innerHTML = '';
  rows.forEach((row, i) => {
    const div = document.createElement('div');
    div.className = 'grade-row';
    const g = document.createElement('input');
    g.type = 'number'; g.min = '1'; g.max = '6'; g.step = '0.1'; g.placeholder = 'Note';
    g.value = row.grade || '';
    g.addEventListener('input', () => { rows[i].grade = g.value; calcGrade(); });
    const c = document.createElement('input');
    c.type = 'number'; c.min = '0'; c.step = '0.5'; c.placeholder = 'Credits';
    c.value = row.credits || '';
    c.addEventListener('input', () => { rows[i].credits = c.value; calcGrade(); });
    const del = document.createElement('button');
    del.type = 'button'; del.className = 'btn-ghost-dark';
    del.textContent = '✕';
    del.addEventListener('click', () => { rows.splice(i, 1); renderGradeRows(); calcGrade(); });
    div.appendChild(g); div.appendChild(c); div.appendChild(del);
    wrap.appendChild(div);
  });
}

function calcGrade() {
  const rows = gradeState();
  let sum = 0, credits = 0;
  rows.forEach(r => {
    const g = parseFloat(r.grade), c = parseFloat(r.credits);
    if (!isNaN(g) && !isNaN(c) && c > 0) { sum += g * c; credits += c; }
  });
  const out = document.getElementById('grade-result');
  if (!credits) { out.textContent = ''; return; }
  out.textContent = `Ø ${(sum / credits).toFixed(2)} bei ${credits} Credits`;
}

/* 3.2 Kalenderwoche */
function isoWeek(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - dayNum + 3);
  const firstThursday = new Date(Date.UTC(d.getUTCFullYear(), 0, 4));
  const firstDayNum = (firstThursday.getUTCDay() + 6) % 7;
  firstThursday.setUTCDate(firstThursday.getUTCDate() - firstDayNum + 3);
  return 1 + Math.round((d - firstThursday) / (7 * 24 * 3600 * 1000));
}

function mondayOfWeek(year, week) {
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const dayNum = (jan4.getUTCDay() + 6) % 7;
  jan4.setUTCDate(jan4.getUTCDate() - dayNum + 3);   // first Thursday
  const firstMonday = new Date(Date.UTC(jan4.getUTCFullYear(), 0, 1));
  firstMonday.setUTCDate(jan4.getUTCDate() - 3 + (week - 1) * 7);
  return firstMonday;
}

function initKW() {
  const dateIn = document.getElementById('kw-date');
  dateIn.value = new Date().toISOString().slice(0, 10);
  document.getElementById('kw-from-date').addEventListener('click', () => {
    const d = new Date(dateIn.value + 'T00:00:00');
    if (isNaN(d)) { document.getElementById('kw-result').textContent = 'Ungültiges Datum'; return; }
    document.getElementById('kw-result').textContent =
      `KW ${isoWeek(d)} in ${d.getFullYear()}`;
  });
  const numIn = document.getElementById('kw-num');
  const yearIn = document.getElementById('kw-year');
  yearIn.value = new Date().getFullYear();
  document.getElementById('kw-from-number').addEventListener('click', () => {
    const w = parseInt(numIn.value, 10), y = parseInt(yearIn.value, 10);
    if (isNaN(w) || isNaN(y) || w < 1 || w > 53) {
      document.getElementById('kw2-result').textContent = 'Bitte gültige KW (1–53) und Jahr angeben';
      return;
    }
    const m = mondayOfWeek(y, w);
    document.getElementById('kw2-result').textContent =
      `Montag: ${m.toISOString().slice(0, 10)} (KW ${w}/${y})`;
  });
}

/* 3.3 Passwort-Generator */
function genPassword(len, symbols) {
  const lower = 'abcdefghijkmnopqrstuvwxyz';
  const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const digits = '23456789';
  const syms = '!@#$%^&*()-_=+[]{}|;:,.<>?';
  const pool = lower + upper + digits + (symbols ? syms : '');
  const arr = new Uint32Array(len);
  crypto.getRandomValues(arr);
  let out = '';
  for (let i = 0; i < len; i++) out += pool[arr[i] % pool.length];
  return out;
}

function initPassword() {
  const lenIn = document.getElementById('pw-len');
  const symsIn = document.getElementById('pw-syms');
  const out = document.getElementById('pw-out');
  const gen = () => { out.value = genPassword(parseInt(lenIn.value, 10) || 16, symsIn.checked); };
  document.getElementById('pw-gen').addEventListener('click', gen);
  document.getElementById('pw-copy').addEventListener('click', async () => {
    if (!out.value) return;
    try { await navigator.clipboard.writeText(out.value); } catch (e) { out.select(); document.execCommand('copy'); }
  });
  gen();
}

/* 3.4 Kosten-Teiler */
function initSplit() {
  document.getElementById('split-calc').addEventListener('click', () => {
    const amount = parseFloat(document.getElementById('split-amount').value);
    const people = parseInt(document.getElementById('split-people').value, 10);
    const tip = parseFloat(document.getElementById('split-tip').value) || 0;
    if (isNaN(amount) || isNaN(people) || people < 1) {
      document.getElementById('split-result').textContent = 'Bitte Betrag und Personen angeben';
      return;
    }
    const total = amount * (1 + tip / 100);
    document.getElementById('split-result').textContent =
      `Gesamt ${total.toFixed(2)} € — pro Person ${(total / people).toFixed(2)} €`;
  });
}

/* 3.5 To-Do-Liste (localStorage) */
const TODO_KEY = 'portal-todos';
function loadTodos() {
  try { return JSON.parse(localStorage.getItem(TODO_KEY)) || []; } catch (e) { return []; }
}
function saveTodos(t) { localStorage.setItem(TODO_KEY, JSON.stringify(t)); }

function renderTodos() {
  const list = document.getElementById('todo-list');
  const todos = loadTodos();
  list.innerHTML = '';
  todos.forEach((t, i) => {
    const li = document.createElement('li');
    if (t.done) li.classList.add('done');
    const cb = document.createElement('input');
    cb.type = 'checkbox'; cb.checked = !!t.done;
    cb.addEventListener('change', () => { const a = loadTodos(); a[i].done = cb.checked; saveTodos(a); renderTodos(); });
    const span = document.createElement('span'); span.textContent = t.text;
    const del = document.createElement('button'); del.type = 'button'; del.textContent = '✕';
    del.addEventListener('click', () => { const a = loadTodos(); a.splice(i, 1); saveTodos(a); renderTodos(); });
    li.appendChild(cb); li.appendChild(span); li.appendChild(del);
    list.appendChild(li);
  });
}

function initTodo() {
  renderTodos();
  const input = document.getElementById('todo-input');
  const add = () => {
    const text = input.value.trim();
    if (!text) return;
    const a = loadTodos(); a.push({ text, done: false }); saveTodos(a);
    input.value = ''; renderTodos();
  };
  document.getElementById('todo-add').addEventListener('click', add);
  input.addEventListener('keydown', e => { if (e.key === 'Enter') add(); });
}

/* 3.6 Rechner */
function initCalc() {
  const display = document.getElementById('calc-display');
  const keys = [
    '7','8','9','/',
    '4','5','6','*',
    '1','2','3','-',
    '0','.','C','+',
    '=', '←',
  ];
  const grid = document.getElementById('calc-keys');
  keys.forEach(k => {
    const b = document.createElement('button');
    b.textContent = k;
    if ('+-*/'.includes(k)) b.classList.add('op');
    if (k === '=') b.classList.add('op');
    b.addEventListener('click', () => calcPress(k, display));
    grid.appendChild(b);
  });
}

function calcPress(key, display) {
  const cur = display.value;
  if (key === 'C') { display.value = ''; return; }
  if (key === '←') { display.value = cur.slice(0, -1); return; }
  if (key === '=') {
    try {
      // eslint-disable-next-line no-new-func
      const result = Function('"use strict"; return (' + cur + ')')();
      display.value = (Math.round(result * 1e10) / 1e10).toString();
    } catch (e) { display.value = 'Fehler'; }
    return;
  }
  display.value += key;
}

/* ── init ───────────────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
  loadUser();
  Object.keys(FEEDS).forEach(loadFeed);
  // refresh feeds every 10 min
  setInterval(() => Object.keys(FEEDS).forEach(loadFeed), 10 * 60 * 1000);

  document.getElementById('grade-add').addEventListener('click', () => { gradeState().push({}); renderGradeRows(); });
  renderGradeRows();

  initKW();
  initPassword();
  initSplit();
  initTodo();
  initCalc();
});
