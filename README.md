# 🎾 Grand Slam Hub

A lightweight, minimalist web forum dedicated to tennis enthusiasts. Built as a CRUD application with a clay-and-green color palette inspired by tennis courts.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19 + Vite |
| Database | Supabase (PostgreSQL) |
| Styling | Tailwind CSS v4 + Bulma CSS |
| Routing | React Router v6 |
| Auth | Pseudo-auth via `localStorage` UUID |

## Features

- 📋 **Home Feed** — posts with title, creation time, and upvote count
- 🔀 **Sort Toggle** — Newest or Most Popular
- 🔍 **Modal Search** — open Search dialog, filter by words (title/content), tags, or both combined
- 🏷️ **Tag System** — add tags to posts for better discovery
- ✍️ **Create Post** — title (required), tags, content, and cover media URL or local upload, plus optional caption
- 📄 **Post Detail** — full post view with comments
- ▲ **Upvoting** — unlimited upvotes per user
- 💬 **Comments** — append, edit, and delete comments, including optional media attachments
- ✏️ **Edit / Delete** — shown only to the post's original author
- 🔒 **Pseudo-Auth** — randomized UUID stored in `localStorage`, no sign-up needed

## Supabase Setup

1. Create a new [Supabase](https://supabase.com) project.
2. Disable Row Level Security (RLS) on both tables for local development.
3. Create the following tables:

### `posts` table

| Column | Type | Properties |
|--------|------|-----------|
| `id` | UUID | Primary Key, Auto-generated |
| `created_at` | TIMESTAMPTZ | Default `now()` |
| `edited_at` | TIMESTAMPTZ | Nullable, auto-updated when post content is edited |
| `title` | TEXT | Not Null |
| `tags` | TEXT[] | Default empty array |
| `content` | TEXT | Nullable |
| `image_url` | TEXT | Nullable |
| `image_caption` | TEXT | Nullable |
| `upvotes` | INTEGER | Default `0` |
| `author_id` | TEXT | Stores localStorage UUID |

### `comments` table

| Column | Type | Properties |
|--------|------|-----------|
| `id` | UUID | Primary Key, Auto-generated |
| `created_at` | TIMESTAMPTZ | Default `now()` |
| `post_id` | UUID | Foreign Key → `posts.id`, ON DELETE CASCADE |
| `content` | TEXT | Not Null |
| `media_url` | TEXT | Nullable |
| `author_id` | TEXT | Stores localStorage UUID |

For a SQL-first setup (recommended), run the script in `supabase/sql/tags_setup.sql` inside Supabase SQL Editor.

Then run `supabase/sql/media_setup.sql` to add post cover captions, comment media URLs, and the public media bucket used for local uploads.

This script ensures:
- `posts.tags` is `TEXT[]` with `NOT NULL` + default empty array
- one post can store multiple self-defined tags
- `posts.edited_at` stores the latest edit time (title/content/image/tags edits)
- tag search is indexed with `GIN`
- SQL function `search_posts(query, tags, sort)` is available for combined criteria searching
- cover media captions and comment media URLs are stored in Supabase
- local media uploads are saved to the `grand-slam-media` public bucket

## Local Development

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```
3. Create `.env.local` and fill in your Supabase credentials:
   ```
   VITE_SUPABASE_URL=https://your-project.supabase.co
   VITE_SUPABASE_ANON_KEY=your-anon-key

   # Optional: Sportsradar ATP feed (recommended when you have a key)
   SPORTRADAR_API_KEY=your-sportsradar-key

   # Optional: API-Tennis fallback feed
   API_TENNIS_KEY=your-api-tennis-key

   # Optional overrides
   VITE_ATP_PROVIDER=auto
   VITE_SPORTRADAR_PROXY_URL=/api/sportsradar/tennis/atp-live
   VITE_API_TENNIS_PROXY_URL=/api/api-tennis/atp-live
   VITE_SUPABASE_MEDIA_BUCKET=grand-slam-media
   SPORTRADAR_API_HOST=https://api.sportradar.com
   SPORTRADAR_TENNIS_PATH=/tennis/trial/v3/en/schedules/live/summaries.json
   API_TENNIS_HOST=https://api.api-tennis.com
   API_TENNIS_PATH=/tennis/?method=get_livescore
   ```
   Notes:
   - `VITE_ATP_PROVIDER=auto` compares Sportsradar, API-Tennis, and ESPN, then picks the feed with better scored recent matches.
   - `VITE_ATP_PROVIDER=sportsradar` forces Sportsradar only.
   - `VITE_ATP_PROVIDER=apitennis` forces API-Tennis only.
   - `VITE_ATP_PROVIDER=espn` skips Sportsradar entirely.
   - Navbar ATP ticker only shows matches that already have scores.

4. Start the dev server:
   ```bash
   npm run dev
   ```
5. Open [http://localhost:5173](http://localhost:5173)
