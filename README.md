# AgentFB

Agentic Facebook auto-posting admin panel. Next.js 14 + Supabase + shadcn/ui.

## Setup

1. Copy env template and fill in credentials:
   ```
   cp .env.local.example .env.local
   ```
2. Install dependencies:
   ```
   npm install
   ```
3. Run the SQL migration in the Supabase dashboard (file: `supabase/migrations/001_initial_schema.sql` — populated in Sprint 2).
4. Start the dev server:
   ```
   npm run dev
   ```
5. Visit http://localhost:3000

## Scripts

- `npm run dev` — start dev server
- `npm run build` — production build
- `npm run start` — run production build
- `npm run lint` — eslint

## Stack

- Next.js 16 (App Router, Server Components default)
- TypeScript, strict mode
- Tailwind CSS v4 + shadcn/ui
- Supabase (Postgres, Auth, Storage, Edge Functions, pg_cron)
- Claude Sonnet 4.5 (content), Gemini 2.5 Flash Image (images)
- Facebook Graph API v21.0

## Sprints

Sprint 1 (current): scaffold — folders, clients, placeholders.
Sprint 2: Supabase schema + Auth + login.
Sprint 3: Brands CRUD + API settings.
Sprint 4: Queue + history + post preview.
Sprint 5: Schedule + logs.
Sprint 6: Agent pipeline (content → image → publisher) + pg_cron.
