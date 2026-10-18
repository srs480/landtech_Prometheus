// ===== SECTION: ReadonlyPortal — shared page builder for DC, Court and Citizen portals =====
// Usage: ReadonlyPortal.init({ role:'dc'|'court'|'citizen', title, intro })
const ReadonlyPortal = (() => {
  const h = LT.h;

  async function init({ role, title, intro }) {
    const user = await LT.initPortal(role, [[title]]);
    const root = document.getElementById('root');
    const result = h('div', { style: 'margin-top:1rem', 'aria-live': 'polite' });
    let lastQuery = null;

    // ===== SECTION: Citizen token gate (server enforces; this is only the form) =====
    function tokenForm(box) {
      const input = h('input', { id: 'token', placeholder: 'যেমন: LAND-DEMO-1111', autocomplete: 'off' });
      const err = h('div', { class: 'alert hidden', role: 'alert', style: 'margin-bottom:1rem' });
      const btn = h('button', { class: 'btn', type: 'button' }, 'আনলক করুন');
      async function submit() {
        btn.disabled = true; err.classList.add('hidden');
        try {
          const r = await LT.api('/api/citizen/unlock', { method: 'POST', body: { token: input.value } });
          sessionStorage.setItem('lt-land-token', input.value.trim());
          LT.toast(`টোকেন সফল। আর ${LT.toBn(r.remaining)} বার ব্যবহার করা যাবে।`);
          show(lastQuery);
        } catch (e) { err.textContent = e.message; err.classList.remove('hidden'); btn.disabled = false; }
      }
      btn.addEventListener('click', submit);
      input.addEventListener('keydown', (e) => { if (e.key === 'Enter') submit(); });
      box.append(h('div', { class: 'card', style: 'margin-top:1rem' },
        h('h3', {}, '🔒 সুরক্ষা টোকেন দিন'), err,
        h('div', { class: 'field' }, h('label', { for: 'token' }, 'সুরক্ষা টোকেন'), input), btn,
        h('details', { style: 'margin-top:1rem' }, h('summary', {}, 'টোকেন কীভাবে পাবেন'),
          h('p', {}, 'সুরক্ষা টোকেন সংশ্লিষ্ট কর্তৃপক্ষ প্রদান করে। এটি স্প্যাম, প্রতারণা ও তথ্য সংগ্রহ ঠেকাতে ব্যবহৃত হয়। প্রতিটি টোকেনের মেয়াদ ও ব্যবহারের সীমা আছে।')),
        h('div', { class: 'alert info', style: 'margin-top:1rem' }, h('b', {}, 'ডেমো টোকেন: '), 'LAND-DEMO-1111, LAND-DEMO-2222 (মেয়াদোত্তীর্ণ টোকেন পরীক্ষার জন্য: LAND-DEMO-9999)')));
    }

    function show(q) {
      lastQuery = q;
      TrackRecord.render(result, q, role === 'citizen' ? { onLocked: tokenForm } : {});
    }

    const picker = h('div');
    LandPicker.mount(picker, { allowDag: true, onSelect: show });
    root.replaceChildren(
      h('h1', {}, title),
      h('section', { class: 'card', 'aria-labelledby': 'pf-h' }, h('h2', { id: 'pf-h' }, 'প্রোফাইল'), LT.profileList(user),
        h('a', { class: 'btn outline', href: '/seba/rapid-check.html' }, 'দ্রুত যাচাই (নথি আপলোড)')),
      h('section', { class: 'section' }, h('h2', {}, 'জমি খুঁজুন'), h('p', { class: 'muted' }, intro), h('div', { class: 'card' }, picker), result));
  }
  return { init };
})();
