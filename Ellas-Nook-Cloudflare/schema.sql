PRAGMA foreign_keys = ON;
CREATE TABLE IF NOT EXISTS blog_posts (id TEXT PRIMARY KEY, title TEXT NOT NULL, featured_image TEXT, author TEXT, post_date TEXT, content TEXT NOT NULL DEFAULT '', tags TEXT, seo_title TEXT, seo_description TEXT, created_at TEXT NOT NULL, status TEXT NOT NULL CHECK(status IN ('draft','published')));
CREATE INDEX IF NOT EXISTS blog_status_date ON blog_posts(status, post_date);
CREATE TABLE IF NOT EXISTS events (id TEXT PRIMARY KEY, event_date TEXT NOT NULL, activity TEXT NOT NULL, description TEXT, start_time TEXT, end_time TEXT, image_url TEXT, video_url TEXT, booking_status TEXT, seats TEXT, whatsapp_enabled INTEGER NOT NULL DEFAULT 1, status TEXT NOT NULL CHECK(status IN ('draft','published')), created_at TEXT NOT NULL);
CREATE INDEX IF NOT EXISTS events_date_status ON events(event_date,status);
CREATE TABLE IF NOT EXISTS feedback (id TEXT PRIMARY KEY, name TEXT NOT NULL, email TEXT, rating INTEGER CHECK(rating BETWEEN 1 AND 5), message TEXT NOT NULL, submitted_at TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved')));
CREATE INDEX IF NOT EXISTS feedback_submitted ON feedback(submitted_at DESC);
CREATE TABLE IF NOT EXISTS sessions (token_hash TEXT PRIMARY KEY, created_at INTEGER NOT NULL, expires_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS rate_limits (ip_hash TEXT NOT NULL, bucket INTEGER NOT NULL, hits INTEGER NOT NULL, PRIMARY KEY(ip_hash,bucket));
