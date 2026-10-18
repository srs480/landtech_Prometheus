// ===== SECTION: LandPicker — shared cascading selector (বিভাগ → জেলা → উপজেলা → মৌজা → ধরন → খতিয়ান / দাগ) =====
// Usage: LandPicker.mount(el, { allowDag: bool, onSelect(query) })
//   query = { khatian: id }  or  { mouza, dag }   (both accepted by /api/land/track)
const LandPicker = (() => {
  let counter = 0;
  const TYPES = [['CS', 'সিএস (CS)'], ['RS', 'আরএস (RS)'], ['SA', 'এসএ (SA)'], ['BRS', 'বিআরএস (BRS)']];

  function mount(box, { allowDag = false, onSelect }) {
    const h = LT.h, id = 'lp' + (++counter);
    const err = h('div', { class: 'alert hidden', role: 'alert' });
    const showErr = (m) => { err.textContent = m || ''; err.classList.toggle('hidden', !m); };
    const empty = () => h('option', { value: '' }, 'নির্বাচন করুন');
    const mk = (name) => h('select', { id: `${id}-${name}`, disabled: true }, empty());
    const field = (label, el) => h('div', { class: 'field' }, h('label', { for: el.id }, label), el);
    const s = { division: mk('division'), district: mk('district'), upazila: mk('upazila'), mouza: mk('mouza'), khatian: mk('khatian') };
    s.type = h('select', { id: id + '-type', disabled: true }, empty(), TYPES.map(([v, t]) => h('option', { value: v }, t)));
    s.mode = h('select', { id: id + '-mode' }, h('option', { value: 'khatian' }, 'খতিয়ান নম্বর দিয়ে'), h('option', { value: 'dag' }, 'দাগ নম্বর দিয়ে'));
    const dag = h('input', { id: id + '-dag', placeholder: 'যেমন: 101', inputmode: 'numeric' });
    const dagField = field('দাগ নম্বর', dag), typeField = field('খতিয়ানের ধরন', s.type), khField = field('খতিয়ান নম্বর', s.khatian);
    const btn = h('button', { class: 'btn', type: 'button' }, 'জমির তথ্য দেখুন');

    const reset = (...els) => els.forEach((e) => { e.replaceChildren(empty()); e.disabled = true; });
    const fill = (e, items, label) => { e.replaceChildren(empty(), ...items.map((i) => h('option', { value: i.id }, label(i)))); e.disabled = !items.length; };
    async function load(path, e, label) {
      try { fill(e, (await LT.api(path)).items, label); showErr(''); } catch (x) { showErr(x.message); }
    }
    async function loadKhatians() {
      reset(s.khatian);
      if (s.mouza.value && s.type.value) await load(`/api/khatians?mouza=${s.mouza.value}&type=${s.type.value}`, s.khatian, (k) => LT.toBn(k.khatian_no));
    }
    function syncMode() {
      const d = s.mode.value === 'dag'; dagField.classList.toggle('hidden', !d); typeField.classList.toggle('hidden', d); khField.classList.toggle('hidden', d);
    }

    s.division.addEventListener('change', () => { reset(s.district, s.upazila, s.mouza, s.khatian); if (s.division.value) load('/api/geo/districts?division=' + s.division.value, s.district, (x) => x.name_bn); });
    s.district.addEventListener('change', () => { reset(s.upazila, s.mouza, s.khatian); if (s.district.value) load('/api/geo/upazilas?district=' + s.district.value, s.upazila, (x) => x.name_bn); });
    s.upazila.addEventListener('change', () => { reset(s.mouza, s.khatian); if (s.upazila.value) load('/api/geo/mouzas?upazila=' + s.upazila.value, s.mouza, (x) => `${x.name_bn} (জেএল ${LT.toBn(x.jl_no)})`); });
    s.mouza.addEventListener('change', () => { s.type.disabled = !s.mouza.value; loadKhatians(); });
    s.type.addEventListener('change', loadKhatians);
    s.mode.addEventListener('change', syncMode);
    btn.addEventListener('click', () => {
      if (!s.mouza.value) return showErr('অনুগ্রহ করে মৌজা পর্যন্ত নির্বাচন করুন');
      if (s.mode.value === 'dag') {
        const d = dag.value.trim().replace(/[০-৯]/g, (c) => '০১২৩৪৫৬৭৮৯'.indexOf(c));
        if (!d) return showErr('দাগ নম্বর লিখুন');
        showErr(''); return onSelect({ mouza: s.mouza.value, dag: d });
      }
      if (!s.khatian.value) return showErr('খতিয়ানের ধরন ও নম্বর নির্বাচন করুন');
      showErr(''); onSelect({ khatian: s.khatian.value });
    });

    box.replaceChildren(err,
      allowDag ? field('খোঁজার ধরন', s.mode) : '',
      h('div', { class: 'grid' }, field('বিভাগ', s.division), field('জেলা', s.district), field('উপজেলা', s.upazila), field('মৌজা', s.mouza), typeField, khField, dagField),
      btn);
    syncMode();
    load('/api/geo/divisions', s.division, (x) => x.name_bn);
  }
  return { mount };
})();
