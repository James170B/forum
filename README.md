# Anonymous imageboard

A text-only imageboard built with Next.js App Router, TypeScript, Tailwind CSS, and Supabase.

## Run locally

Install dependencies and run the development server:

```bash
npm install
npm run dev
```

The browser Supabase client reads `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` from `.env.local`. These must be the project's public URL and publishable/anon key; never put a service role key in a browser app. Posting also requires the server-only `SUPABASE_SERVICE_ROLE_KEY` and `FORUM_BLOCKED_WORDS` variables. Set the latter to a comma- or newline-separated list of terms prohibited by your moderation policy. Posting fails closed when either variable is missing. Do not prefix either variable with `NEXT_PUBLIC_`.

## Features

- Browse boards, start threads, and reply; boards are bumped by the latest reply.
- Anonymous posting with optional profile-name display, per-thread hashed IDs, numbered posts, quote links, and hover previews.
- Server-validated thread/reply submission with a configurable blocked-word filter.
- Sign up and log in with email; signup stores the chosen username in auth user metadata.
- Edit your bio, avatar URL, and accent color from your profile. Avatars are URL-only; uploads are not implemented.
- Chat with Supabase Realtime updates from the `messages` table.
- Report threads, replies, and chat messages.
- Admins and moderators can review unresolved reports, delete reported content, and resolve reports.

## Supabase setup

The frontend uses the existing `profiles`, `boards`, `threads`, `posts`, `messages`, and `reports` tables. Configure Row Level Security policies for every table: the browser only uses the public key, and the admin page's role check is only a UI gate. Policies must enforce who can read, insert, update, and delete records, including moderator-only report review and moderation actions. Ensure signed-in users can only create content as themselves and edit their own profile.

Apply `supabase/migrations/20261117000000_imageboard_anonymity.sql` to add `is_anonymous` to `threads` and `posts`. Existing rows default to anonymous, and `author_id` remains unchanged for moderation and account-linked features.

Set both server-only posting variables before enabling posts. The route handlers validate the caller's Supabase session and account status before inserting with the service role. Deny direct `INSERT` access to `threads` and `posts` for browser roles in RLS policies, so new content must pass through the server-side filter. Keep the existing read, report, and moderation policies in place.

Enable the `messages` table for Supabase Realtime (the `postgres_changes` publication) for live chat. Signup passes the selected username as auth user metadata; configure the existing profile creation flow/trigger to use that metadata if new users should get a `profiles` row automatically.

Run checks with:

```bash
npm run lint
npx tsc --noEmit
npm run build
```
