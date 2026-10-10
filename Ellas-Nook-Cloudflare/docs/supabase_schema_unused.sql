-- Ella's Nook: run in Supabase SQL editor. Auth: enable Google provider.
create table profiles(id uuid primary key references auth.users on delete cascade,email text unique,full_name text,role text not null default 'writer' check(role in('admin','writer')));
create table roles(name text primary key);insert into roles values('admin'),('writer');
create function is_admin() returns boolean language sql security definer stable as $$select exists(select 1 from profiles where id=auth.uid() and role='admin')$$;
create function new_user() returns trigger language plpgsql security definer as $$begin
 if new.email !~* '@ellanook\.org$' then raise exception 'Only @ellanook.org accounts allowed';end if;
 insert into profiles(id,email,full_name,role) values(new.id,new.email,new.raw_user_meta_data->>'full_name',case when lower(new.email) in('team@ellanook.org','hello@ellanook.org') then 'admin' else 'writer' end);return new;end$$;
create trigger on_signup after insert on auth.users for each row execute function new_user();
create table events(id uuid primary key default gen_random_uuid(),event_date date not null,activity text not null,description text,start_time text,end_time text,image_url text,video_url text,booking_status text,seats text,whatsapp_enabled boolean default true);
create table past_events(id uuid primary key default gen_random_uuid(),date_label text,title text not null,description text,image_url text,sort int default 0);
create table gallery(id uuid primary key default gen_random_uuid(),image_url text not null,caption text,alt_text text,tags text[],sort int default 0);
create table media(id uuid primary key default gen_random_uuid(),url text not null,kind text,alt_text text);
create table blog_posts(id uuid primary key default gen_random_uuid(),title text not null,featured_image text,author text,post_date date,content text,tags text[],seo_title text,seo_description text);
create table facilities(id uuid primary key default gen_random_uuid(),name text not null,description text,images text[],availability text,booking_info text,price text,cta_label text);
create table site_settings(key text primary key,value jsonb);
create table contact_settings(key text primary key,value text);
create table approval_requests(id uuid primary key default gen_random_uuid(),table_name text,row_id uuid,requested_by uuid default auth.uid(),decision text,note text,created_at timestamptz default now());
create table feedback(id uuid primary key default gen_random_uuid(),name text not null,email text,rating int check(rating between 1 and 5),message text not null,submitted_at timestamptz default now());
-- shared workflow columns + RLS (draft -> submitted -> approved/rejected -> published)
do $$declare t text;begin foreach t in array array['events','past_events','gallery','media','blog_posts','facilities','feedback'] loop
 execute format('alter table %I add column status text not null default %L check(status in(%L,%L,%L,%L,%L,%L)), add column created_by uuid default auth.uid(), add column review_note text',t,'draft','draft','submitted','approved','rejected','published','pending');
 execute format('alter table %I enable row level security',t);
 execute format('create policy pub on %I for select using(status=%L)',t,'published');
 execute format('create policy adm on %I for all using(is_admin()) with check(is_admin())',t);
 if t<>'feedback' then
  execute format('create policy w_sel on %I for select using(created_by=auth.uid())',t);
  execute format('create policy w_ins on %I for insert with check(created_by=auth.uid() and status in(%L,%L))',t,'draft','submitted');
  execute format('create policy w_upd on %I for update using(created_by=auth.uid() and status in(%L,%L)) with check(status in(%L,%L))',t,'draft','rejected','draft','submitted');
 end if;end loop;end$$;
create policy fb_ins on feedback for insert to anon,authenticated with check(status='pending');
alter table profiles enable row level security;create policy me on profiles for select using(id=auth.uid() or is_admin());create policy adm on profiles for all using(is_admin());
alter table site_settings enable row level security;create policy r on site_settings for select using(true);create policy a on site_settings for all using(is_admin());
alter table contact_settings enable row level security;create policy r on contact_settings for select using(true);create policy a on contact_settings for all using(is_admin());
alter table approval_requests enable row level security;create policy a on approval_requests for all using(is_admin());create policy w on approval_requests for insert with check(requested_by=auth.uid());
-- storage: public bucket for approved media, private bucket for writer drafts
insert into storage.buckets(id,name,public) values('public-media','public-media',true),('draft-media','draft-media',false);
create policy pm_r on storage.objects for select using(bucket_id='public-media');
create policy pm_a on storage.objects for all using(bucket_id='public-media' and is_admin());
create policy dm_w on storage.objects for insert with check(bucket_id='draft-media' and auth.uid() is not null);
create policy dm_r on storage.objects for select using(bucket_id='draft-media' and (owner=auth.uid() or is_admin()));
create policy dm_a on storage.objects for all using(bucket_id='draft-media' and is_admin());
