/* Ella's Studio: Creative Combos tab. Uses the helper functions from studio.js, which loads just before this file. */
const cmb = { rows: [], sel: null };

async function viewCombos() {
  $('#view').replaceChildren(h('div', { class: 'bar' }, h('h2', {}, 'Creative Combos')), h('p', {}, 'Loading…'));
  cmb.rows = await rest('creative_combos', '?select=*&order=sort_order.asc');
  drawCombos();
}

function drawCombos() {
  const v = $('#view');
  const list = h('div', { class: 'list' },
    cmb.rows.length
      ? cmb.rows.map(r => h('button', { class: 'item', 'aria-current': cmb.sel && cmb.sel.id === r.id ? 'true' : null, onclick: () => { cmb.sel = r; drawCombos(); } },
          h('b', {}, r.title),
          h('small', {}, (r.description || '') + ' '),
          h('span', { class: 'tag' + (r.status === 'published' ? '' : ' draft') }, r.status === 'published' ? 'Published' : 'Hidden')))
      : h('p', { class: 'empty' }, 'No combos yet.'));
  put(v,
    h('div', { class: 'bar' }, h('h2', {}, 'Creative Combos'), h('span', { class: 'sp' }),
      h('button', { class: 'btn', onclick: () => { cmb.sel = { id: null }; drawCombos(); } }, '+ New combo')),
    h('div', { class: 'split' }, list,
      cmb.sel ? comboEditor(cmb.sel) : h('div', { class: 'card empty' }, 'Choose a combo to edit, or add a new one. Published combos appear on your site.')));
}

function comboEditor(r) {
  const isNew = !r.id;
  const f = {
    t: h('input', { id: 'c-t', required: true, maxlength: 120, value: r.title || '' }),
    d: h('textarea', { id: 'c-d', rows: 3, maxlength: 600 }, r.description || ''),
    o: h('input', { id: 'c-o', type: 'number', value: r.sort_order != null ? r.sort_order : cmb.rows.length + 1 }),
    s: h('select', { id: 'c-s' },
      h('option', { value: 'published' }, 'Published (visible on the site)'),
      h('option', { value: 'draft' }, 'Hidden (draft)'))
  };
  f.s.value = r.status || 'published';
  const save = h('button', { class: 'btn', type: 'submit' }, isNew ? 'Add combo' : 'Save changes');
  const form = h('form', { novalidate: true },
    h('h3', {}, isNew ? 'New combo' : 'Edit combo'),
    field('Name', f.t),
    field('What it includes', f.d, 'For example: Journaling + Mini Clay Creation'),
    field('Order (1 shows first)', f.o),
    field('Visibility', f.s),
    h('div', { class: 'actions' }, save,
      !isNew && h('button', { type: 'button', class: 'btn danger', onclick: async () => {
        if (await ask('Delete this combo for good?', 'Delete')) {
          try { await remove('creative_combos', r.id); toast('Combo deleted'); cmb.sel = null; viewCombos(); }
          catch (x) { toast(x.message, 1); }
        }
      } }, 'Delete')));
  form.onsubmit = async e => {
    e.preventDefault();
    const title = clean(f.t.value), desc = clean(f.d.value), ord = parseInt(f.o.value, 10);
    if (!title) return toast('Please enter a name.', 1);
    if (!Number.isFinite(ord)) return toast('Order must be a number.', 1);
    save.disabled = true;
    try {
      const row = { title, description: desc, sort_order: ord, status: f.s.value };
      const saved = isNew ? await insert('creative_combos', row) : await update('creative_combos', r.id, row);
      toast(isNew ? 'Combo added' : 'Combo saved');
      await viewCombos();
      cmb.sel = cmb.rows.find(x => x.id === saved.id) || null;
      drawCombos();
    } catch (x) { toast(x.message, 1); }
    save.disabled = false;
  };
  return h('div', { class: 'card' }, form);
}

TABS.combos = viewCombos;
