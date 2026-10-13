/* Ella's Studio: admin dashboard (calendar, blog, feedback).
   Plain JS, no libraries. All page content is built with textContent / DOM nodes (never innerHTML),
   so nothing a visitor types into the feedback form can run as code here. */
'use strict';
const C = window.STUDIO, $ = s => document.querySelector(s), p2 = n => String(n).padStart(2, '0');
const MAX_IMG = 5 * 1024 * 1024, TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

/* ---------- small helpers ---------- */
function h(tag, a, ...kids) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(a || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') e.className = v;
    else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
    else e.setAttribute(k, v === true ? '' : v);
  }
  for (const c of kids.flat()) if (c != null && c !== false) e.append(c.nodeType ? c : document.createTextNode(c));
  return e;
}
let tt;
function toast(msg, err) {
  const t = $('#toast'); t.textContent = msg; t.className = err ? 'err' : ''; t.hidden = false;
  clearTimeout(tt); tt = setTimeout(() => t.hidden = true, 4000);
}
function ask(q, ok) {
  return new Promise(res => {
    const d = $('#ask'); $('#askq').textContent = q; $('#askok').textContent = ok || 'OK';
    const done = v => { d.close(); res(v) };
    $('#askok').onclick = () => done(true); $('#askno').onclick = () => done(false); d.oncancel = () => res(false);
    d.showModal();
  });
}
const put = (el, ...kids) => el.replaceChildren(...kids.flat(Infinity).filter(c => c != null && c !== false && c !== ''));
const field = (label, input, hint) => h('div', { class: 'field' }, h('label', { for: input.id }, label), input, hint && h('p', { class: 'hint' }, hint));
const ymd = (y, m, d) => `${y}-${p2(m + 1)}-${p2(d)}`;
const to12 = t => { if (!t) return null; const [H, M] = t.split(':').map(Number), hh = H % 12 || 12; return `${hh}${M ? ':' + p2(M) : ''} ${H >= 12 ? 'PM' : 'AM'}` };
const to24 = s => { const m = /^(\d{1,2})(?::(\d{2}))?\s*(AM|PM)$/i.exec((s || '').trim()); if (!m) return ''; return `${p2(+m[1] % 12 + (m[3].toUpperCase() == 'PM' ? 12 : 0))}:${m[2] || '00'}` };
const clean = s => (s || '').trim();

/* ---------- Cloudflare API/session ---------- */
let loggedIn=false;
async function request(path, options={}){const r=await fetch((C.apiBase||'/api')+path,{method:options.method||'GET',credentials:'same-origin',headers:{...(options.body && !(options.body instanceof Blob)?{'Content-Type':'application/json'}:{}),...(options.headers||{})},body:options.body===undefined?undefined:(options.body instanceof Blob?options.body:JSON.stringify(options.body))});if(!r.ok){const j=await r.json().catch(()=>({}));throw new Error(j.error||j.message||`Request failed (${r.status})`)}return r.status===204?null:r.json().catch(()=>null)}
const call=async(path,o={})=>{if(path==='/auth/v1/token?grant_type=password')return request('/admin/login',{method:'POST',body:o.body});if(path==='/auth/v1/logout')return request('/admin/logout',{method:'POST'});if(path==='/rest/v1/rpc/is_studio_admin')return request('/admin/me');if(path.startsWith('/rest/v1/')){const restPath=path.slice('/rest/v1/'.length).replace(/^([a-z_]+)\?id=eq\./,(o.method==='PATCH'||o.method==='DELETE')?'$1/':'$&');return request('/admin/data/'+restPath,{method:o.method||'GET',body:o.body,headers:o.headers})}if(path.startsWith('/storage/v1/object/')){const restPath=path.slice('/storage/v1/object/'.length);if(o.method==='POST'){const folder=restPath.split('/').slice(1).join('/').split('/')[0]||'misc';return request('/admin/media?folder='+encodeURIComponent(folder),{method:'POST',body:o.body,headers:o.headers})}if(o.method==='DELETE')return request('/admin/media?url='+encodeURIComponent(path),{method:'DELETE'});}throw new Error('Unsupported API request')};
const rest=(t,q='')=>call(`/rest/v1/${t}${q}`);const ret={Prefer:'return=representation'};
const insert=async(t,row)=>(await call(`/rest/v1/${t}`,{method:'POST',body:row,headers:ret}))[0]||await Promise.resolve(null);
const update=async(t,id,row)=>{const r=await call(`/rest/v1/${t}?id=eq.${encodeURIComponent(id)}`,{method:'PATCH',body:row,headers:ret});if(!r||!r.length)throw new Error('Nothing was saved. Please sign in again.');return r[0]};
const remove=(t,id)=>call(`/rest/v1/${t}?id=eq.${encodeURIComponent(id)}`,{method:'DELETE'});
/* ---------- images ---------- */
async function shrink(f) {
  if (f.type === 'image/gif') { if (f.size > MAX_IMG) throw new Error('That GIF is over 5 MB.'); return f }
  const bmp = await createImageBitmap(f), s = Math.min(1, 1600 / Math.max(bmp.width, bmp.height));
  const c = document.createElement('canvas'); c.width = Math.round(bmp.width * s); c.height = Math.round(bmp.height * s);
  const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height); x.drawImage(bmp, 0, 0, c.width, c.height);
  const b = await new Promise(r => c.toBlob(r, 'image/jpeg', .86));
  if (!b || b.size > MAX_IMG) throw new Error('That image is too large (limit 5 MB).'); return b;
}
async function upload(file, folder) {const b=await shrink(file);const r=await fetch(`${C.apiBase||'/api'}/admin/media?folder=${encodeURIComponent(folder)}`,{method:'POST',credentials:'same-origin',headers:{'Content-Type':b.type,'X-File-Name':file.name||'upload.jpg'},body:b});const j=await r.json().catch(()=>({}));if(!r.ok)throw new Error(j.error||'Image upload failed');return j.url;}
const dropImage=async url=>{if(url&&url.startsWith(location.origin+'/media/')){try{await request('/admin/media?url='+encodeURIComponent(url),{method:'DELETE'})}catch(e){}}};
function picker(url, id) {
  const st = { url, file: null, removed: false };
  const img = h('img', { alt: 'Selected image', hidden: !url, src: url || null });
  const input = h('input', { type: 'file', id, accept: TYPES.join(',') });
  const rm = h('button', { type: 'button', class: 'btn ghost sm', hidden: !url }, 'Remove image');
  input.onchange = () => {
    const f = input.files[0]; if (!f) return;
    if (!TYPES.includes(f.type)) { toast('Please choose a JPG, PNG, WebP or GIF image.', 1); input.value = ''; return }
    st.file = f; st.removed = false; img.src = URL.createObjectURL(f); img.hidden = false; rm.hidden = false;
  };
  rm.onclick = () => { st.file = null; st.removed = true; img.hidden = true; img.removeAttribute('src'); rm.hidden = true; input.value = '' };
  return { st, el: h('div', { class: 'imgbox' }, img, h('div', {}, input, rm)) };
}
/* Upload a newly chosen image, or keep / clear the old one. Returns the url to store and the old url to delete afterwards. */
async function resolveImage(st, folder) {
  if (st.file) return { url: await upload(st.file, folder), old: st.url, fresh: true };
  if (st.removed) return { url: null, old: st.url };
  return { url: st.url || null };
}

/* ---------- sign in / out ---------- */
function showLogin(msg,err){$('#app').hidden=true;$('#login').hidden=false;$('#lm').textContent=msg||'';$('#lm').className='msg'+(err?' err':'');$('#view').replaceChildren();$('#lp').value=''}
async function enter(){await request('/admin/me');loggedIn=true;$('#login').hidden=true;$('#lp').value='';$('#app').hidden=false;idle();route();badge();return true}
async function signOut(msg,err){try{await request('/admin/logout',{method:'POST'})}catch(e){}loggedIn=false;location.href='/cdn-cgi/access/logout'}
$('#lf').onsubmit=async e=>{e.preventDefault();const b=$('#lb');b.disabled=true;$('#lm').textContent='';try{await request('/admin/login',{method:'POST',body:{email:clean($('#le').value),password:$('#lp').value}});await enter()}catch(x){showLogin(x.message||'Could not sign in.',1)}finally{b.disabled=false}};
$('#out').onclick=()=>signOut('You have been signed out.');
let it, idleOn = false;
function idle() {
  const go = () => { clearTimeout(it); it = setTimeout(() => loggedIn && signOut('Signed out after a period of inactivity.'), C.idleMinutes * 60000) };
  if (!idleOn) { idleOn = true; ['click', 'keydown', 'mousemove', 'touchstart'].forEach(ev => document.addEventListener(ev, go, { passive: true })) } go();
}

/* ---------- tabs ---------- */
const TABS = { calendar: viewCalendar, blog: viewBlog, feedback: viewFeedback };
function route() {
  const t = TABS[location.hash.slice(1)] ? location.hash.slice(1) : 'calendar';
  document.querySelectorAll('nav [data-tab]').forEach(b => b.dataset.tab === t ? b.setAttribute('aria-current', 'page') : b.removeAttribute('aria-current'));
  if (loggedIn) TABS[t]().catch(e => { if (e.message !== 'Session ended') toast(e.message, 1) });
}
document.querySelector('nav').onclick = e => { const b = e.target.closest('[data-tab]'); if (b) location.hash = b.dataset.tab };
window.addEventListener('hashchange', route);
async function badge() {
  try {
    const r = await call('/rest/v1/feedback?select=id&status=eq.pending', { headers: { Prefer: 'count=exact', Range: '0-0' }, resp: 1 });
    const n = +(r.headers.get('content-range') || '').split('/')[1] || 0, b = $('#fbn'); b.textContent = n; b.hidden = !n;
  } catch (e) { }
}

/* ================= CALENDAR ================= */
const now = new Date(), cal = { y: now.getFullYear(), m: now.getMonth(), ev: [] };
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
async function viewCalendar() {
  const v = $('#view'), a = ymd(cal.y, cal.m, 1), b = cal.m == 11 ? ymd(cal.y + 1, 0, 1) : ymd(cal.y, cal.m + 1, 1);
  const go = d => { cal.m += d; if (cal.m < 0) { cal.m = 11; cal.y-- } if (cal.m > 11) { cal.m = 0; cal.y++ } viewCalendar().catch(e => toast(e.message, 1)) };
  const bar = h('div', { class: 'bar' },
    h('button', { class: 'btn ghost sm', 'aria-label': 'Previous month', onclick: () => go(-1) }, '‹'),
    h('h2', { 'aria-live': 'polite' }, new Date(cal.y, cal.m, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })),
    h('button', { class: 'btn ghost sm', 'aria-label': 'Next month', onclick: () => go(1) }, '›'),
    h('button', { class: 'btn ghost sm', onclick: () => { cal.y = now.getFullYear(); cal.m = now.getMonth(); viewCalendar() } }, 'Today'),
    h('span', { class: 'sp' }),
    h('button', { class: 'btn', onclick: () => eventDialog(null, ymd(cal.y, cal.m, cal.y == now.getFullYear() && cal.m == now.getMonth() ? now.getDate() : 1)) }, '+ New event'));
  v.replaceChildren(bar, h('p', {}, 'Loading…'));
  cal.ev = await rest('events', `?select=*&event_date=gte.${a}&event_date=lt.${b}&order=event_date.asc,start_time.asc`);
  const first = new Date(cal.y, cal.m, 1).getDay(), n = new Date(cal.y, cal.m + 1, 0).getDate(), cells = [];
  DAYS.forEach(d => cells.push(h('div', { class: 'dh' }, d.slice(0, 3))));
  for (let i = 0; i < first; i++) cells.push(h('div', { class: 'cell blank' }));
  for (let d = 1; d <= n; d++) {
    const ds = ymd(cal.y, cal.m, d), today = ds === ymd(now.getFullYear(), now.getMonth(), now.getDate());
    cells.push(h('div', { class: 'cell' + (today ? ' today' : ''), 'data-date': ds },
      h('button', { class: 'dn', 'aria-label': `Add event on ${DAYS[new Date(cal.y, cal.m, d).getDay()]} ${d}`, onclick: () => eventDialog(null, ds) }, p2(d), h('span', { class: 'wd' }, ' ' + DAYS[new Date(cal.y, cal.m, d).getDay()].slice(0, 3))),
      cal.ev.filter(e => e.event_date === ds).map(e => h('button', { class: `chip ${e.status === 'published' ? 'pub' : 'draft'}${e.image_url ? ' photo' : ''}`, title: e.status === 'published' ? 'Published' : 'Draft (not on the site)', onclick: () => eventDialog(e, ds) }, (e.start_time ? e.start_time + ' · ' : '') + e.activity))));
  }
  put(v, bar, h('div', { class: 'cal' }, cells), h('p', { class: 'hint' }, 'Solid = published on the site. Dashed = draft. ◧ = has a photo.'));
}
function eventDialog(ev, date) {
  const d = $('#dlg'), isNew = !ev, e = ev || {};
  const f = {
    date: h('input', { id: 'e-date', type: 'date', required: true, value: e.event_date || date }),
    act: h('input', { id: 'e-act', required: true, maxlength: 120, value: e.activity || '' }),
    desc: h('textarea', { id: 'e-desc', rows: 4, maxlength: 1000 }, e.description || ''),
    st: h('input', { id: 'e-st', type: 'time', value: to24(e.start_time) }), en: h('input', { id: 'e-en', type: 'time', value: to24(e.end_time) }),
    book: h('input', { id: 'e-book', maxlength: 120, placeholder: 'Limited seats • DM to book', value: e.booking_status || '' }),
    wa: h('input', { id: 'e-wa', type: 'checkbox' }),
    stat: h('select', { id: 'e-stat' }, h('option', { value: 'published' }, 'Published (visible on the site)'), h('option', { value: 'draft' }, 'Draft (hidden)'))
  };
  f.wa.checked = e.whatsapp_enabled !== false; f.stat.value = e.status || 'published';
  const pk = picker(e.image_url, 'e-img'), warn = h('p', { class: 'warn', hidden: true, role: 'status' });
  const check = () => {
    const msgs = [], pub = f.stat.value === 'published', dt = f.date.value;
    if (pub && C.siteMonth && dt && !dt.startsWith(C.siteMonth)) msgs.push('Your live site currently shows only the October 2026 grid, and it matches events by day number only. Publishing an event in another month would replace what shows on that day number in October. Save as Draft until the site calendar is updated (see README).');
    if (pub && dt && cal.ev.some(x => x.event_date === dt && x.status === 'published' && x.id !== e.id)) msgs.push('Another published event is already on this date. The live site shows one event per day.');
    warn.textContent = msgs.join(' '); warn.hidden = !msgs.length; return msgs;
  };
  [f.date, f.stat].forEach(x => { x.onchange = check; x.oninput = check });
  const save = h('button', { class: 'btn', type: 'submit' }, isNew ? 'Add event' : 'Save changes');
  const form = h('form', { novalidate: true },
    h('h3', {}, isNew ? 'New event' : 'Edit event'),
    field('Date', f.date), field('Activity name', f.act), field('Description (optional)', f.desc, 'Plain text. The characters < and > are not allowed.'),
    h('div', { class: 'row' }, field('Starts', f.st), field('Ends', f.en)),
    field('Booking note (optional)', f.book), h('div', { class: 'field check' }, f.wa, h('label', { for: 'e-wa' }, 'Show the "Reserve on WhatsApp" button')),
    h('div', { class: 'field' }, h('label', { for: 'e-img' }, 'Photo (optional)'), pk.el, h('p', { class: 'hint' }, 'JPG, PNG, WebP or GIF. Large photos are resized automatically.')),
    field('Visibility', f.stat), warn,
    h('div', { class: 'actions' }, save, h('button', { type: 'button', class: 'btn ghost', onclick: () => d.close() }, 'Cancel'),
      !isNew && h('button', { type: 'button', class: 'btn danger', onclick: async () => { if (await ask('Delete this event for good?', 'Delete')) { try { await remove('events', e.id); await dropImage(e.image_url); d.close(); toast('Event deleted'); viewCalendar() } catch (x) { toast(x.message, 1) } } } }, 'Delete')));
  form.onsubmit = async ev2 => {
    ev2.preventDefault();
    const act = clean(f.act.value), desc = clean(f.desc.value), book = clean(f.book.value), pub = f.stat.value === 'published';
    const bad = (!f.date.value && 'Please choose a date.') || (!act && 'Please enter an activity name.') ||
      (/[<>]/.test(act + desc + book) && 'The characters < and > are not allowed in event text.') ||
      (!f.st.value !== !f.en.value && 'Set both a start and an end time, or leave both empty.') ||
      (f.st.value && f.en.value && f.en.value <= f.st.value && 'The end time must be after the start time.');
    if (bad) return toast(bad, 1);
    if (check().length && pub && C.siteMonth && !f.date.value.startsWith(C.siteMonth) && !await ask('This will affect the live October calendar, as described above. Publish anyway?', 'Publish anyway')) return;
    save.disabled = true; let img;
    try {
      img = await resolveImage(pk.st, 'events');
      const row = { event_date: f.date.value, activity: act, description: desc || null, start_time: to12(f.st.value), end_time: to12(f.en.value), booking_status: book || null, whatsapp_enabled: f.wa.checked, image_url: img.url, status: f.stat.value };
      try { isNew ? await insert('events', row) : await update('events', e.id, row) } catch (x) { if (img.fresh) await dropImage(img.url); throw x }
      await dropImage(img.old); d.close(); toast(isNew ? 'Event added' : 'Event saved');
      const [y, m] = f.date.value.split('-').map(Number); cal.y = y; cal.m = m - 1; viewCalendar();
    } catch (x) { toast(x.message, 1) }
    save.disabled = false;
  };
  d.replaceChildren(form); check(); d.showModal();
}

/* ================= BLOG ================= */
const blog = { posts: [], sel: null };
async function viewBlog() {
  const v = $('#view');
  v.replaceChildren(h('div', { class: 'bar' }, h('h2', {}, 'Blog')), h('p', {}, 'Loading…'));
  blog.posts = await rest('blog_posts', '?select=*&order=created_at.desc');
  drawBlog();
}
function drawBlog() {
  const v = $('#view'), list = h('div', { class: 'list' }, blog.posts.length ? blog.posts.map(p => h('button', { class: 'item', 'aria-current': blog.sel && blog.sel.id === p.id ? 'true' : null, onclick: () => { blog.sel = p; drawBlog() } },
    h('b', {}, p.title), h('small', {}, [p.author, p.post_date].filter(Boolean).join(' · ') + ' '), h('span', { class: 'tag' + (p.status === 'published' ? '' : ' draft') }, p.status === 'published' ? 'Published' : 'Draft'))) : h('p', { class: 'empty' }, 'No posts yet.'));
  put(v, h('div', { class: 'bar' }, h('h2', {}, 'Blog'), h('span', { class: 'sp' }), h('button', { class: 'btn', onclick: () => { blog.sel = { id: null }; drawBlog() } }, '+ New post')),
    h('div', { class: 'split' }, list, blog.sel ? blogEditor(blog.sel) : h('div', { class: 'card empty' }, 'Choose a post, or start a new one. Published posts appear on your site.')));
}
function blogEditor(p) {
  const isNew = !p.id;
  const f = {
    t: h('input', { id: 'b-t', required: true, maxlength: 150, value: p.title || '' }), a: h('input', { id: 'b-a', maxlength: 100, value: p.author || '' }),
    d: h('input', { id: 'b-d', type: 'date', value: p.post_date || '' }), c: h('textarea', { id: 'b-c', rows: 14, maxlength: 20000 }, p.content || '')
  };
  const pk = picker(p.featured_image, 'b-img');
  // The preview is built once and updated in place, so typing or clicking never shifts the page under the cursor.
  const pt = h('h3'), pby = h('p', { class: 'by' }), pimg = h('img', { alt: '' }), pbody = h('div'), prev = h('div', { class: 'post' }, pt, pby, pimg, pbody);
  const text = () => {
    pt.textContent = f.t.value || 'Untitled'; const by = [f.a.value, f.d.value].filter(Boolean).join(' · '); pby.textContent = by; pby.hidden = !by;
    pbody.replaceChildren(...f.c.value.split(/\n\s*\n/).map(clean).filter(Boolean).map(x => h('p', {}, x)));
  };
  const image = () => {
    const cur = pk.st.file ? pk.el.querySelector('img').src : (pk.st.removed ? null : p.featured_image);
    if (cur) pimg.src = cur; else pimg.removeAttribute('src'); pimg.hidden = !cur;
  };
  [f.t, f.a, f.d, f.c].forEach(e => e.addEventListener('input', text));
  ['change', 'click'].forEach(ev => pk.el.addEventListener(ev, image));
  const save = async status => {
    const title = clean(f.t.value), content = clean(f.c.value);
    if (!title) return toast('Please add a title.', 1);
    if (status === 'published' && !content) return toast('Add some text before publishing.', 1);
    btns.forEach(b => b.disabled = true); let img;
    try {
      img = await resolveImage(pk.st, 'blog');
      const row = { title, author: clean(f.a.value) || null, post_date: f.d.value || null, content, featured_image: img.url, status };
      let saved; try { saved = isNew ? await insert('blog_posts', row) : await update('blog_posts', p.id, row) } catch (x) { if (img.fresh) await dropImage(img.url); throw x }
      await dropImage(img.old);
      toast(status === 'published' ? 'Published to the site' : 'Saved as draft'); blog.sel = saved; await viewBlog().catch(() => { }); blog.sel = blog.posts.find(x => x.id === saved.id) || null; drawBlog();
    } catch (x) { toast(x.message, 1); btns.forEach(b => b.disabled = false) }
  };
  const live = p.status === 'published';
  const btns = [
    h('button', { class: 'btn', type: 'button', onclick: () => save('published') }, live ? 'Save changes' : 'Publish'),
    !live && h('button', { class: 'btn ghost', type: 'button', onclick: () => save('draft') }, 'Save draft'),
    live && h('button', { class: 'btn ghost', type: 'button', onclick: async () => { if (await ask('Take this post off the site? It stays here as a draft.', 'Unpublish')) save('draft') } }, 'Unpublish'),
    !isNew && h('button', { class: 'btn danger', type: 'button', onclick: async () => { if (await ask('Delete this post for good?', 'Delete')) { try { await remove('blog_posts', p.id); await dropImage(p.featured_image); toast('Post deleted'); blog.sel = null; viewBlog() } catch (x) { toast(x.message, 1) } } } }, 'Delete')
  ].filter(Boolean);
  text(); image();
  return h('div', { class: 'card' }, h('h3', {}, isNew ? 'New post' : 'Edit post'), field('Title', f.t), h('div', { class: 'row' }, field('Author (optional)', f.a), field('Date (optional)', f.d)),
    h('div', { class: 'field' }, h('label', { for: 'b-img' }, 'Featured image (optional)'), pk.el),
    field('Text', f.c, 'Leave a blank line between paragraphs. Plain text only.'), h('div', { class: 'actions' }, btns), h('h3', {}, 'Preview'), prev);
}

/* ================= FEEDBACK ================= */
const fb = { f: 'new', rows: [], more: false };
const FQ = { new: '&status=eq.pending', reviewed: '&status=eq.approved', all: '' }, PAGE = 50;
async function viewFeedback() { fb.rows = []; await loadFb(); }
async function loadFb() {
  const v = $('#view'); if (!fb.rows.length) v.replaceChildren(h('div', { class: 'bar' }, h('h2', {}, 'Feedback')), h('p', {}, 'Loading…'));
  const r = await rest('feedback', `?select=*&order=submitted_at.desc&limit=${PAGE + 1}&offset=${fb.rows.length}${FQ[fb.f]}`);
  fb.more = r.length > PAGE; fb.rows = fb.rows.concat(r.slice(0, PAGE)); drawFb(); badge();
}
function drawFb() {
  const v = $('#view'), seg = h('div', { class: 'seg', role: 'group', 'aria-label': 'Filter' }, [['new', 'New'], ['reviewed', 'Reviewed'], ['all', 'All']].map(([k, l]) => h('button', { 'aria-pressed': fb.f === k, onclick: () => { fb.f = k; viewFeedback() } }, l)));
  put(v, h('div', { class: 'bar' }, h('h2', {}, 'Feedback'), seg, h('span', { class: 'sp' }), h('button', { class: 'btn ghost sm', onclick: viewFeedback }, 'Refresh')),
    fb.rows.length ? fb.rows.map(r => {
      const mail = r.email && /^[^\s@<>]+@[^\s@<>]+$/.test(r.email) ? r.email : null, done = r.status === 'approved';
      return h('article', { class: 'card fb' },
        h('div', { class: 'meta' }, h('b', {}, r.name), r.rating && h('span', { class: 'stars', role: 'img', 'aria-label': `${r.rating} out of 5` }, '★'.repeat(r.rating) + '☆'.repeat(5 - r.rating)),
          h('small', {}, new Date(r.submitted_at).toLocaleString()), h('span', { class: 'tag' + (done ? ' draft' : '') }, done ? 'Reviewed' : 'New')),
        h('p', {}, r.message), mail && h('p', { class: 'hint' }, 'Reply to: ', h('a', { href: 'mailto:' + mail }, mail)),
        h('div', { class: 'actions' },
          h('button', { class: 'btn ghost sm', onclick: async () => { try { await update('feedback', r.id, { status: done ? 'pending' : 'approved' }); viewFeedback() } catch (x) { toast(x.message, 1) } } }, done ? 'Mark as new' : 'Mark as reviewed'),
          h('button', { class: 'btn danger sm', onclick: async () => { if (await ask('Delete this message for good?', 'Delete')) { try { await remove('feedback', r.id); viewFeedback() } catch (x) { toast(x.message, 1) } } } }, 'Delete')));
    }) : h('p', { class: 'empty card' }, fb.f === 'new' ? 'No new messages.' : 'Nothing here yet.'),
    fb.more && h('button', { class: 'btn ghost', onclick: () => loadFb().catch(x => toast(x.message, 1)) }, 'Load more'));
}

/* ---------- start ---------- */
(async()=>{try{await enter()}catch(e){showLogin()}})();
