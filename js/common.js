/* eslint-disable */
// ===== SECTION: Namespace =====
const LT = (() => {
  // ===== SECTION: Theme (runs immediately, before paint) =====
  const THEME_KEY = 'lt-theme';
  function currentTheme() {
    return localStorage.getItem(THEME_KEY) || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  }
  function applyTheme(t) { document.documentElement.setAttribute('data-theme', t); }
  function toggleTheme() {
    const t = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    try { localStorage.setItem(THEME_KEY, t); } catch {}
    applyTheme(t); const b = document.getElementById('theme-btn'); if (b) b.textContent = themeLabel();
  }
  const themeLabel = () => (document.documentElement.getAttribute('data-theme') === 'dark' ? '☀ সাধারণ মোড' : '🌙 ডার্ক মোড');
  applyTheme(currentTheme());

  // ===== SECTION: Helpers (Bangla digits, safe DOM builder) =====
  const toBn = (v) => String(v ?? '').replace(/\d/g, (d) => '০১২৩৪৫৬৭৮৯'[d]);
  // h('div', {class:'x', onclick:fn}, 'text', childNode) — text is always inserted as text, never as HTML
  function h(tag, attrs, ...kids) {
    const e = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) {
      if (k === 'class') e.className = v;
      else if (k.startsWith('on') && typeof v === 'function') e.addEventListener(k.slice(2), v);
      else if (v !== false && v != null) e.setAttribute(k, v);
    }
    kids.flat(Infinity).forEach((c) => e.append(c ?? ''));
    return e;
  }

  const fmtDate = (v) => { if (!v) return '—'; const [y, m, d] = String(v).slice(0, 10).split('-'); return toBn(`${d}/${m}/${y}`); };
  const fmtMoney = (n) => toBn(Number(n).toLocaleString('en-IN')) + ' টাকা';

  // Bangla digits -> ASCII (for numeric inputs typed in Bangla)
  const en = (v) => String(v ?? '').trim().replace(/[০-৯]/g, (d) => '০১২৩৪৫৬৭৮৯'.indexOf(d));
  const todayIso = () => new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  // profile <dl> from /api/auth/me user
  const profileList = (u) => h('dl', { class: 'kv' }, [['নাম', u.full_name], ['পদবি', u.designation], ['প্রতিষ্ঠান / অফিস', u.office_name],
    ['আইডি', u.office_code && toBn(u.office_code)], ['জেলা', u.district], ['উপজেলা', u.upazila]].filter(([, v]) => v).flatMap(([k, v]) => [h('dt', {}, k), h('dd', {}, v)]));

  // ===== SECTION: Toast =====
  function toast(msg, type = 'ok') {
    let box = document.getElementById('toasts');
    if (!box) { box = h('div', { id: 'toasts', 'aria-live': 'polite' }); document.body.append(box); }
    const t = h('div', { class: 'toast' + (type === 'error' ? ' error' : ''), role: type === 'error' ? 'alert' : 'status' }, msg);
    box.append(t); setTimeout(() => t.remove(), 5000);
  }

  // ===== SECTION: API helper (same-origin cookie session; optional citizen token header) =====
  async function api(path, { method = 'GET', body } = {}) {
    const headers = { Accept: 'application/json' };
    const isForm = typeof FormData !== 'undefined' && body instanceof FormData;
    if (body && !isForm) headers['Content-Type'] = 'application/json';
    const tok = sessionStorage.getItem('lt-land-token'); if (tok) headers['x-land-token'] = tok;
    let res, data;
    try {
      res = await fetch(path, { method, headers, credentials: 'same-origin', body: body ? (isForm ? body : JSON.stringify(body)) : undefined });
      data = await res.json();
    } catch { throw Object.assign(new Error('সার্ভারের সাথে যোগাযোগ করা যাচ্ছে না। ইন্টারনেট সংযোগ দেখুন।'), { status: 0 }); }
    if (!res.ok || !data.ok) throw Object.assign(new Error(data.error || 'কিছু একটা সমস্যা হয়েছে'), { status: res.status });
    return data;
  }

  // ===== SECTION: Layout (header, nav, breadcrumb, footer) =====
  function mountLayout({ crumbs = [], user = null, help = false } = {}) {
    const here = location.pathname;
    const link = (href, text) => h('a', { href, 'aria-current': here === href ? 'page' : false }, text);
    const emblem = (() => { const d = document.createElement('div');
      d.innerHTML = '<svg viewBox="0 0 48 48" aria-hidden="true"><circle cx="24" cy="24" r="22" fill="#fff"/><circle cx="24" cy="24" r="15" fill="#006A4E"/><circle cx="22" cy="24" r="8" fill="#C8102E"/></svg>';
      return d.firstChild; })(); // static markup, no user data
    const nav = h('nav', { class: 'nav', id: 'main-nav', 'aria-label': 'প্রধান মেনু' },
      link('/index.html', 'হোম'), link('/nagorik-seba.html', 'নাগরিক সেবা'), link('/seba/scams.html', 'প্রতারণা সতর্কতা'),
      user ? h('span', { class: 'muted', style: 'color:#fff;padding:0 .5rem' }, user.full_name) : link('/login.html', 'লগইন'),
      user ? h('button', { onclick: logout }, 'লগআউট') : '',
      h('button', { class: 'theme', id: 'theme-btn', onclick: toggleTheme }, themeLabel()));
    const menuBtn = h('button', { class: 'menu-btn', 'aria-expanded': 'false', 'aria-controls': 'main-nav',
      onclick: (e) => { const o = nav.classList.toggle('open'); e.currentTarget.setAttribute('aria-expanded', o); } }, '☰ মেনু');
    document.body.prepend(
      h('a', { class: 'skip', href: '#main' }, 'মূল অংশে যান'),
      h('div', { class: 'topstrip' }, 'হ্যাকাথন ডেমো প্রোটোটাইপ — সকল তথ্য কাল্পনিক'),
      h('header', { class: 'site-header' }, h('div', { class: 'container' },
        h('a', { class: 'brand', href: '/index.html' }, emblem, h('span', {}, h('b', {}, 'ডিজিটাল ভূমি সেবা পোর্টাল'), h('small', {}, 'ভূমি রেকর্ড যাচাই ও ডিজিটাইজেশন'))),
        menuBtn, nav)));
    const all = [['হোম', '/index.html'], ...crumbs];
    document.querySelector('.site-header').after(h('div', { class: 'crumbs' }, h('div', { class: 'container' },
      h('ol', { 'aria-label': 'ব্রেডক্রাম্ব' }, all.map(([t, href], i) => h('li', {}, href && i < all.length - 1 ? h('a', { href }, t) : t))))));
    const ext = (href, t) => h('a', { href, target: '_blank', rel: 'noopener' }, t);
    document.body.append(h('footer', { class: 'site-footer' }, h('div', { class: 'container' },
      h('ul', {}, h('li', {}, ext('https://land.gov.bd', 'ভূমি মন্ত্রণালয়')), h('li', {}, ext('https://eporcha.gov.bd', 'ই-পর্চা')),
        h('li', {}, ext('https://bangladesh.gov.bd', 'জাতীয় তথ্য বাতায়ন')), h('li', {}, link('/seba/scams.html', 'প্রতারণা সতর্কতা'))),
      h('p', {}, 'জাতীয় হেল্পলাইন: ৩৩৩ • এটি হ্যাকাথনের ডেমো প্রোটোটাইপ; কোনো প্রকৃত সরকারি ব্যবস্থা নয়। © ২০২৬ LandTech Innovation Hackathon'))));
    if (help) mountHelp();
  }

  // ===== SECTION: Floating help button (chatbot placeholder) =====
  // TODO: connect the assistant — POST /api/chat { message } -> { ok:true, reply }. Set CHAT_ENDPOINT to enable the input.
  const CHAT_ENDPOINT = null;
  function mountHelp() {
    const log = h('div', { class: 'help-log', 'aria-live': 'polite' }, h('p', {}, '🤖 নমস্কার! আমি আপনার ভূমি সহায়ক। সহায়ক সেবাটি খুব শীঘ্রই চালু হবে।'));
    const input = h('input', { id: 'help-input', placeholder: CHAT_ENDPOINT ? 'আপনার প্রশ্ন লিখুন…' : 'শীঘ্রই আসছে', disabled: !CHAT_ENDPOINT, 'aria-label': 'প্রশ্ন লিখুন' });
    async function send() {
      const msg = input.value.trim(); if (!msg || !CHAT_ENDPOINT) return;
      log.append(h('p', { class: 'me' }, msg)); input.value = '';
      try { const r = await api(CHAT_ENDPOINT, { method: 'POST', body: { message: msg } }); log.append(h('p', {}, r.reply)); }
      catch (e) { log.append(h('p', { class: 'muted' }, e.message)); }
    }
    const panel = h('section', { class: 'help-panel hidden', id: 'help-panel', role: 'dialog', 'aria-label': 'ভূমি সহায়ক' },
      h('div', { class: 'help-head' }, h('b', {}, 'ভূমি সহায়ক'), h('button', { class: 'help-x', 'aria-label': 'বন্ধ করুন', onclick: () => toggle(false) }, '✕')),
      log, h('div', { class: 'help-form' }, input, h('button', { class: 'btn', disabled: !CHAT_ENDPOINT, onclick: send }, 'পাঠান')));
    const fab = h('button', { class: 'fab', 'aria-label': 'সহায়তা', 'aria-expanded': 'false', 'aria-controls': 'help-panel', onclick: () => toggle(panel.classList.contains('hidden')) }, '💬 সহায়তা');
    function toggle(open) { panel.classList.toggle('hidden', !open); fab.setAttribute('aria-expanded', String(open)); }
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') send(); });
    document.body.append(fab, panel);
  }

  // ===== SECTION: Auth (guard + logout) =====
  async function logout() {
    try { await api('/api/auth/logout', { method: 'POST' }); } catch {}
    sessionStorage.removeItem('lt-land-token'); location.href = '/index.html';
  }
  // Frontend guard is only UX; every API route re-checks the role on the server.
  async function requireRole(role) {
    try { const { user } = await api('/api/auth/me'); if (user.role !== role) throw new Error('role'); return user; }
    catch { location.replace('/login.html?portal=' + encodeURIComponent(role)); return new Promise(() => {}); }
  }
  async function initPortal(role, crumbs) {
    const user = await requireRole(role); mountLayout({ crumbs, user }); return user;
  }

  return { en, todayIso, profileList, toBn, fmtDate, fmtMoney, h, toast, api, mountLayout, requireRole, initPortal, logout, toggleTheme };
})();
