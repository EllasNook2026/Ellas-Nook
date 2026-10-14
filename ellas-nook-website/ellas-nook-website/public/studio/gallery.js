/* Ella's Studio: Gallery tab. Uses the helper functions from studio.js, which loads just before this file. */
const gal = { rows: [], sel: null };

async function viewGallery() {
  $('#view').replaceChildren(h('div', { class: 'bar' }, h('h2', {}, 'Gallery')), h('p', {}, 'Loading…'));
  gal.rows = await rest('gallery_items', '?select=*&order=sort_order.asc');
  drawGallery();
}

function drawGallery() {
  const v = $('#view');
  const list = h('div', { class: 'list' },
    gal.rows.length
      ? gal.rows.map(r => {
          const th = h('img', { src: r.image_url, alt: '', loading: 'lazy' });
          Object.assign(th.style, { width: '56px', height: '56px', objectFit: 'cover', borderRadius: '6px', display: 'block', marginBottom: '4px' });
          return h('button', { class: 'item', 'aria-current': gal.sel && gal.sel.id === r.id ? 'true' : null, onclick: () => { gal.sel = r; drawGallery(); } },
            th,
            h('b', {}, r.title || ('Photo ' + r.sort_order)),
            h('small', {}, (r.caption || '') + ' '),
            h('span', { class: 'tag' + (r.status === 'published' ? '' : ' draft') }, r.status === 'published' ? 'Published' : 'Hidden'));
        })
      : h('p', { class: 'empty' }, 'No photos yet.'));
  put(v,
    h('div', { class: 'bar' }, h('h2', {}, 'Gallery'), h('span', { class: 'sp' }),
      h('button', { class: 'btn', onclick: () => { gal.sel = { id: null }; drawGallery(); } }, '+ New photo')),
    h('div', { class: 'split' }, list,
      gal.sel ? galleryEditor(gal.sel) : h('div', { class: 'card empty' }, 'Choose a photo to edit, or add a new one. Published photos appear in the gallery on your site.')));
}

function galleryEditor(r) {
  const isNew = !r.id;
  const f = {
    t: h('input', { id: 'g-t', maxlength: 120, value: r.title || '' }),
    c: h('textarea', { id: 'g-c', rows: 3, maxlength: 300 }, r.caption || ''),
    o: h('input', { id: 'g-o', type: 'number', value: r.sort_order != null ? r.sort_order : gal.rows.length + 1 }),
    s: h('select', { id: 'g-s' },
      h('option', { value: 'published' }, 'Published (visible on the site)'),
      h('option', { value: 'draft' }, 'Hidden (draft)'))
  };
  f.s.value = r.status || 'published';
  const pk = picker(r.image_url, 'g-img');
  const save = h('button', { class: 'btn', type: 'submit' }, isNew ? 'Add photo' : 'Save changes');
  const form = h('form', { novalidate: true },
    h('h3', {}, isNew ? 'New photo' : 'Edit photo'),
    h('div', { class: 'field' }, h('label', { for: 'g-img' }, 'Photo'), pk.el, h('p', { class: 'hint' }, 'JPG, PNG, WebP or GIF. Large photos are resized automatically.')),
    field('Title (optional)', f.t),
    field('Caption (optional)', f.c, 'Also used as the photo description for screen readers.'),
    field('Order (1 shows first)', f.o),
    field('Visibility', f.s),
    h('div', { class: 'actions' }, save,
      !isNew && h('button', { type: 'button', class: 'btn danger', onclick: async () => {
        if (await ask('Delete this photo for good?', 'Delete')) {
          try { await remove('gallery_items', r.id); await dropImage(r.image_url); toast('Photo deleted'); gal.sel = null; viewGallery(); }
          catch (x) { toast(x.message, 1); }
        }
      } }, 'Delete')));
  form.onsubmit = async e => {
    e.preventDefault();
    const title = clean(f.t.value), caption = clean(f.c.value), ord = parseInt(f.o.value, 10);
    if (!pk.st.file && (pk.st.removed || !pk.st.url)) return toast('Please choose a photo.', 1);
    if (!Number.isFinite(ord)) return toast('Order must be a number.', 1);
    save.disabled = true; let img;
    try {
      img = await resolveImage(pk.st, 'gallery');
      const row = { image_url: img.url, title, caption, sort_order: ord, status: f.s.value };
      let saved;
      try { saved = isNew ? await insert('gallery_items', row) : await update('gallery_items', r.id, row); }
      catch (x) { if (img.fresh) await dropImage(img.url); throw x; }
      await dropImage(img.old);
      toast(isNew ? 'Photo added' : 'Photo saved');
      await viewGallery();
      gal.sel = gal.rows.find(x => x.id === saved.id) || null;
      drawGallery();
    } catch (x) { toast(x.message, 1); }
    save.disabled = false;
  };
  return h('div', { class: 'card' }, form);
}

TABS.gallery = viewGallery;
