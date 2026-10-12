// Same Supabase project your site already uses. The publishable key is meant to be public;
// what protects your data is the admin login plus the row-level security rules in setup.sql.
// Never put a service_role key in this file.
window.STUDIO = {
  url: 'https://iocwzwjkwfzotvjljski.supabase.co',
  key: 'sb_publishable_vB2S93n4anGuE73lEZsbIg_AuvmiFEF',
  // Your live site's calendar currently shows October 2026 only. While this is set, the Studio
  // warns before you publish an event in any other month. Set to null once the site calendar
  // has been updated (see README, "Optional site update").
  siteMonth: '2026-10',
  idleMinutes: 30
};
