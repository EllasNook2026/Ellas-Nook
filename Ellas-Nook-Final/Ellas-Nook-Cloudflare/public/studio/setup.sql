-- Ella's Studio: one-time database setup for Supabase.
-- Run once in Supabase -> SQL Editor. Safe to run again (it only adds things).
-- It does NOT delete or change any existing rows, and your live site keeps working:
-- the site still reads only rows with status = 'published'.

-- 1. Who is allowed into the Studio ------------------------------------------
create table if not exists public.studio_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email   text
);
alter table public.studio_admins enable row level security;
-- No policies on purpose: nobody can read or edit this list from the browser.

create or replace function public.is_studio_admin() returns boolean
language sql security definer stable set search_path = public as $$
  select exists (select 1 from public.studio_admins where user_id = auth.uid());
$$;
revoke all on function public.is_studio_admin() from public;
grant execute on function public.is_studio_admin() to authenticated;

-- 2. Tables (same columns your site already reads) ----------------------------
create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  event_date date not null,
  activity text not null,
  description text,
  start_time text,
  end_time text,
  image_url text,
  video_url text,
  booking_status text,
  seats text,
  whatsapp_enabled boolean default true,
  status text not null default 'draft',
  created_by uuid default auth.uid(),
  review_note text
);
create table if not exists public.blog_posts (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  featured_image text,
  author text,
  post_date date,
  content text,
  tags text[],
  seo_title text,
  seo_description text,
  created_at timestamptz default now(),
  status text not null default 'draft',
  created_by uuid default auth.uid(),
  review_note text
);
create table if not exists public.feedback (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text,
  rating int check (rating between 1 and 5),
  message text not null,
  submitted_at timestamptz default now(),
  status text not null default 'pending',
  created_by uuid default auth.uid(),
  review_note text
);
-- If these tables already existed from an older setup, make sure the workflow columns are there.
alter table public.events     add column if not exists status text not null default 'draft';
alter table public.blog_posts add column if not exists status text not null default 'draft';
alter table public.feedback   add column if not exists status text not null default 'pending';
alter table public.blog_posts add column if not exists created_at timestamptz default now();
alter table public.events     add column if not exists created_by uuid default auth.uid();
alter table public.blog_posts add column if not exists created_by uuid default auth.uid();
alter table public.feedback   add column if not exists created_by uuid default auth.uid();
alter table public.events     add column if not exists review_note text;
alter table public.blog_posts add column if not exists review_note text;
alter table public.feedback   add column if not exists review_note text;

-- Size limits on what visitors can submit (applies to new rows only).
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'feedback_size_limits') then
    alter table public.feedback add constraint feedback_size_limits check (
      char_length(name) <= 200 and char_length(message) <= 5000
      and (email is null or char_length(email) <= 320)) not valid;
  end if;
end $$;

create index if not exists events_date_idx on public.events (event_date);
create index if not exists feedback_submitted_idx on public.feedback (submitted_at desc);

-- 3. Row-level security -------------------------------------------------------
alter table public.events     enable row level security;
alter table public.blog_posts enable row level security;
alter table public.feedback   enable row level security;

-- Visitors: read published events and posts only.
drop policy if exists studio_public_read on public.events;
create policy studio_public_read on public.events for select to anon, authenticated using (status = 'published');
drop policy if exists studio_public_read on public.blog_posts;
create policy studio_public_read on public.blog_posts for select to anon, authenticated using (status = 'published');

-- Visitors: send feedback (it always starts as 'pending'); they can never read it back.
drop policy if exists studio_feedback_insert on public.feedback;
create policy studio_feedback_insert on public.feedback for insert to anon, authenticated with check (status = 'pending');

-- Studio admins: full control of all three.
drop policy if exists studio_admin_all on public.events;
create policy studio_admin_all on public.events for all to authenticated using (public.is_studio_admin()) with check (public.is_studio_admin());
drop policy if exists studio_admin_all on public.blog_posts;
create policy studio_admin_all on public.blog_posts for all to authenticated using (public.is_studio_admin()) with check (public.is_studio_admin());
drop policy if exists studio_admin_all on public.feedback;
create policy studio_admin_all on public.feedback for all to authenticated using (public.is_studio_admin()) with check (public.is_studio_admin());

grant select on public.events, public.blog_posts to anon;
grant insert on public.feedback to anon;
grant select, insert, update, delete on public.events, public.blog_posts, public.feedback to authenticated;

-- 4. Image storage (its own bucket; your existing buckets are untouched) ------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('studio-media', 'studio-media', true, 5242880, array['image/jpeg','image/png','image/webp','image/gif'])
on conflict (id) do nothing;

drop policy if exists studio_media_read on storage.objects;
create policy studio_media_read on storage.objects for select to anon, authenticated using (bucket_id = 'studio-media');
drop policy if exists studio_media_admin on storage.objects;
create policy studio_media_admin on storage.objects for all to authenticated
  using (bucket_id = 'studio-media' and public.is_studio_admin())
  with check (bucket_id = 'studio-media' and public.is_studio_admin());

-- 5. Keep your current blog post on the site -----------------------------------
-- The site shows its built-in post only while there are no published posts in the database.
-- This copies that post in (once, only if the blog table is empty) so it stays visible
-- after you publish your first new post. You can edit or unpublish it in the Studio.
insert into public.blog_posts (title, content, status)
select 'Pista clan of ella’s nook',
$post$Most people just crack open a pista, eat the nut, and sweep the empty shells right into the dustbin.

Around here, we couldn't bring ourselves to throw them away.

We ended up keeping a little bowl of them on the table. They’re just hard, pale leftover shells, but the more you look at them, the more they look like little heads waiting for a story. So one quiet afternoon, we pulled out some fine brushes. Two tiny black dots for eyes. One quick little curve for a crooked smile. And just like that, this hard little scrap had a face looking right back at us.

That was the day the Pista Clan started taking over Ella’s Nook.$post$,
'published'
where not exists (select 1 from public.blog_posts);

-- 6. AFTER you create your admin login (see README step 2), run this ONE line,
--    with your own email, to let that account into the Studio:
--
--   insert into public.studio_admins (user_id, email)
--   select id, email from auth.users where email = 'YOU@EXAMPLE.COM';
