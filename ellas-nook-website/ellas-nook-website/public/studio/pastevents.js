/* Ella's Studio: Past Events tab. Uses the helper functions from studio.js, which loads just before this file. */
const pe = { rows: [], sel: null };

async function viewPastEvents() {
  $('#view').replaceChildren(h('div', { class: 'bar' }, h('h2', {}, 'Past Events')), h('p', {}, 'Loading…'));
  pe.rows = await rest('past_events', '?select=*&order=sort_order.asc');
  drawPastEvents();
}

function drawPastEvents() {
  const v = $('#view');
  const list = h('div', { class: 'list' },
    pe.rows.length
      ? pe.rows.map(r => h('button', { class: 'item', 'aria-current': pe.sel && pe.sel.id === r.id ? 'true' : null, onclick: () => { pe.sel = r; drawPastEvents(); } },
          h('b', {}, (r.date_label ? r.date_label + ' · ' : '') + (r.title || '')),
          h('small', {}, (r.description || '') + ' '),
          h('span', { class: 'tag' + (r.status === 'published' ? '' : ' draft') }, r.status === 'published' ? 'Published' : 'Hidden')))
      : h('p', { class: 'empty' }, 'No past events yet.'));
  put(v,
    h('div', { class: 'bar' }, h('h2', {}, 'Past Events'), h('span', { class: 'sp' }),
      h('button', { class: 'btn', onclick: () => { pe.sel = { id: null }; drawPastEvents(); } }, '+ New past event')),
    h('div', { class: 'split' }, list,
      pe.sel ? pastEventEditor(pe.sel) : h('div', { class: 'card empty' }, 'Choose a past event to edit, or add a new one. Published ones appear on your site.')));
}

function pastEventEditor(r) {
  const isNew = !r.id;
  const f = {
    l: h('input', { id: 'p-l', maxlength: 40, value: r.date_label || '' }),
    t: h('input', { id: 'p-t', required: true, maxlength: 180, value: r.title || '' }),
    d: h('textarea', { id: 'p-d', rows: 4, maxlength: 8000 }, r.description || ''),
    o: h('input', { id: 'p-o', type: 'number', value: r.sort_order != null ? r.sort_order : pe.rows.length + 1 }),
    s: h('select', { id: 'p-s' },
      h('option', { value: 'published' }, 'Published (visible on the site)'),
      h('option', { value: 'draft' }, 'Hidden (draft)'))
  };
  f.s.value = r.status || 'published';
  const save = h('button', { class: 'btn', type: 'submit' }, isNew ? 'Add past event' : 'Save changes');
  const form = h('form', { novalidate: true },
    h('h3', {}, isNew ? 'New past event' : 'Edit past event'),
    field('Date label', f.l, 'Free text, for example: Aug 15, 2 Days, Oct 02 & 03'),
    field('Title', f.t),
    field('Description', f.d),
    field('Order (1 shows first)', f.o),
    field('Visibility', f.s),
    h('div', { class: 'actions' }, save,
      !isNew && h('button', { type: 'button', class: 'btn danger', onclick: async () => {
        if (await ask('Delete this past event for good?', 'Delete')) {
          try { await remove('past_events', r.id); toast('Past event deleted'); pe.sel = null; viewPastEvents(); }
          catch (x) { toast(x.message, 1); }
        }
      } }, 'Delete')));
  form.onsubmit = async e => {
    e.preventDefault();
    const date_label = clean(f.l.value), title = clean(f.t.value), desc = clean(f.d.value), ord = parseInt(f.o.value, 10);
    if (!title) return toast('Please enter a title.', 1);
    if (!Number.isFinite(ord)) return toast('Order must be a number.', 1);
    save.disabled = true;
    try {
      const row = { date_label, title, description: desc, sort_order: ord, status: f.s.value };
      const saved = isNew ? await insert('past_events', row) : await update('past_events', r.id, row);
      toast(isNew ? 'Past event added' : 'Past event saved');
      await viewPastEvents();
      pe.sel = pe.rows.find(x => x.id === saved.id) || null;
      drawPastEvents();
    } catch (x) { toast(x.message, 1); }
    save.disabled = false;
  };
  return h('div', { class: 'card' }, form);
}

TABS.pastevents = viewPastEvents;
