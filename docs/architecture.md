# Architecture — Hospitality Agents

> Confirmed stack: **Next.js 15 (App Router) + Clerk + Supabase (Postgres + Storage) + Anthropic Claude API + fal.ai (Flux) + Creatomate + Vercel**. All TypeScript. Single repo, single deploy.

---

## System Overview

```
┌────────────────────────────────────────────────────────────────┐
│  Browser (Next.js App Router — RSC + Client Components)        │
└───────────────┬────────────────────────────────────────────────┘
                │ HTTPS
┌───────────────▼────────────────────────────────────────────────┐
│  Vercel — Next.js Route Handlers + Server Actions              │
│  ├── /api/campaigns        — orchestrates generation pipeline   │
│  ├── /api/assets/upload    — signs Supabase Storage uploads     │
│  ├── /api/brands           — brand profile CRUD                 │
│  └── middleware.ts         — Clerk auth gate                    │
└───┬──────────┬──────────┬──────────┬──────────┬────────────────┘
    │          │          │          │          │
┌───▼──┐  ┌────▼────┐ ┌───▼───┐ ┌────▼────┐ ┌───▼──────┐
│Clerk │  │Supabase │ │Claude │ │ fal.ai  │ │Creatomate│
│(Auth)│  │(DB+Stor)│ │(Copy) │ │(Images) │ │ (Video)  │
└──────┘  └─────────┘ └───────┘ └─────────┘ └──────────┘
```

**Key design principle:** All external AI calls happen server-side. The browser never holds API keys. Generation is orchestrated through a single `/api/campaigns/generate` endpoint that streams progress back to the client via Server-Sent Events or Next.js streaming RSC.

---

## Component Map

| Layer | Tech | Responsibility |
|-------|------|----------------|
| UI shell | Next.js App Router + Tailwind v4 + shadcn/ui | Routes, layouts, auth-gated pages |
| State | React Context + URL state | Brand profile, active campaign, form state |
| Auth | Clerk (middleware + `<SignIn />`) | Invite-only access, session management |
| DB | Supabase Postgres + RLS | Brands, campaigns, assets, users |
| File storage | Supabase Storage | Uploaded product photos, AI outputs, ZIP archives |
| LLM | Anthropic SDK (`@anthropic-ai/sdk`) | Captions, hashtags, campaign briefs |
| Image AI | fal.ai SDK (`@fal-ai/client`) | Photo enhancement, upscaling, generation |
| Video | Creatomate REST API | Short motion clips from image + text inputs |
| Hosting | Vercel | Next.js deploy, preview URLs, edge functions |

---

## Data Model (Postgres / Supabase)

Minimal schema for MVP. All tables are row-level-security protected by `user_id` or `brand_id` tied to the Clerk JWT sub.

```sql
-- Users are tracked by Clerk, mirrored into Supabase for FK relationships
users (
  id            uuid primary key,         -- mirrors Clerk user_id
  email         text unique not null,
  created_at    timestamptz default now()
)

brands (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid references users(id) on delete cascade,
  name          text not null,
  cuisine_type  text,
  tone          text,                     -- "warm", "playful", "premium"
  color_palette jsonb,                    -- { primary, secondary, accent }
  logo_url      text,                     -- Supabase Storage URL
  brand_guide   text,                     -- long-form voice doc for LLM context
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
)

campaigns (
  id            uuid primary key default gen_random_uuid(),
  brand_id      uuid references brands(id) on delete cascade,
  title         text not null,
  brief         text,                     -- user-supplied topic
  platform      text,                     -- "instagram", "tiktok", "multi"
  post_count    int default 3,
  status        text default 'draft',     -- draft | generating | complete | failed
  created_at    timestamptz default now(),
  completed_at  timestamptz
)

assets (
  id            uuid primary key default gen_random_uuid(),
  campaign_id   uuid references campaigns(id) on delete cascade,
  kind          text not null,            -- source_photo | enhanced_image | video | caption
  storage_path  text,                     -- Supabase Storage path (null for text assets)
  content       text,                     -- caption/hashtag text (null for binary assets)
  metadata      jsonb,                    -- { model, cost, duration, aspect_ratio }
  created_at    timestamptz default now()
)

generation_jobs (
  id            uuid primary key default gen_random_uuid(),
  campaign_id   uuid references campaigns(id) on delete cascade,
  step          text not null,            -- enhance_image | generate_video | write_copy
  status        text default 'pending',   -- pending | running | complete | failed
  external_id   text,                     -- fal.ai request_id or Creatomate render_id
  error         text,
  started_at    timestamptz,
  completed_at  timestamptz
)
```

**RLS policies** (every query enforced at DB layer):
- `brands`: `user_id = auth.jwt()->>'sub'`
- `campaigns`: via `brand_id` → `brands.user_id`
- `assets`: via `campaign_id` → `campaigns.brand_id` → `brands.user_id`

---

## Generation Pipeline

The core flow orchestrated by `POST /api/campaigns/generate`:

```
1. Validate input  ──▶  create campaign row (status=generating)
2. Upload source photos to Supabase Storage  ──▶  insert asset rows (kind=source_photo)
3. Parallel kickoff:
   ├── fal.ai     flux/dev/image-to-image × post_count   (photo enhancement)
   └── Claude     sonnet-4-6                            (captions + hashtags + brief)
4. Wait for images  ──▶  insert asset rows (kind=enhanced_image)
5. Creatomate render × post_count  (images + text → short clips)
6. Wait for videos  ──▶  insert asset rows (kind=video)
7. Mark campaign status=complete
8. Client polls or streams updates via generation_jobs
```

**Resilience:** each step writes to `generation_jobs` so a failed campaign can be resumed without repeating completed work. No background queue at MVP — Next.js Route Handlers run the pipeline inline with streaming response. If latency becomes an issue, migrate to a Supabase edge function or Fly.io worker.

**Cost controls:**
- Claude prompt caching on system prompt + brand guide (saves 90% on cached tokens)
- Cap `post_count` at 5 per campaign for MVP
- Store `metadata.cost` per asset for usage analytics

---

## API Surface

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/brands` | GET, POST | List user's brands; create new brand |
| `/api/brands/[id]` | GET, PATCH, DELETE | Brand CRUD |
| `/api/assets/upload` | POST | Returns signed Supabase Storage upload URL |
| `/api/campaigns` | GET, POST | List user's campaigns; create draft |
| `/api/campaigns/[id]` | GET, DELETE | Campaign detail and delete |
| `/api/campaigns/[id]/generate` | POST | Kick off generation pipeline (streaming response) |
| `/api/campaigns/[id]/download` | GET | Returns signed URL for ZIP archive |
| `/api/webhooks/fal` | POST | Async fal.ai job completion (if using webhook mode) |
| `/api/webhooks/creatomate` | POST | Async Creatomate render completion |

Server Actions handle mutations from Client Components directly (Next.js 15 pattern) — Route Handlers above exist for webhooks, file uploads, and the generation pipeline.

---

## File Storage Layout (Supabase Storage)

```
brand-assets/         -- logos, brand guide attachments
  {user_id}/
    {brand_id}/
      logo.png
      brand-guide.pdf

campaign-inputs/      -- user-uploaded product photos
  {brand_id}/
    {campaign_id}/
      source-{n}.jpg

campaign-outputs/     -- AI-generated assets
  {brand_id}/
    {campaign_id}/
      enhanced-{n}.jpg
      video-{n}.mp4
      captions.json
      campaign.zip    -- assembled download
```

Storage policies mirror DB RLS: a user can only read paths under `{brand_id}` they own.

---

## Auth Flow (Clerk + Supabase)

1. User clicks invite link → Clerk sign-up form (email + password or OAuth)
2. On successful sign-up, Clerk webhook (`user.created`) → insert row in `users` table
3. All subsequent requests: Clerk middleware verifies session, attaches JWT to request
4. Supabase client is initialized with Clerk JWT as `Authorization: Bearer <jwt>`
5. Supabase RLS evaluates `auth.jwt()->>'sub'` against row `user_id` — native integration via Clerk's Supabase JWT template

No session tokens ever touch the browser's localStorage — Clerk handles httpOnly cookies.

---

## Deployment

- **Vercel Pro** single project, main branch auto-deploys to production
- Preview URLs per pull request (investor-demo-friendly)
- Environment variables split by environment (`.env.local`, Vercel dashboard for preview/prod)
- `$200/month` budget cap enabled
- Edge runtime for middleware only; Node runtime for generation endpoints (needed for AI SDK streaming)

---

## Observability

MVP-minimum set:
- **Vercel logs** for request traces
- **Supabase logs** for DB queries and RLS denials
- **Sentry** (free tier) for frontend + backend error tracking — add in Setup phase
- Custom table `generation_jobs` serves as the pipeline audit trail

Formal metrics/analytics deferred to post-MVP.

---

## Environment Variables (to go into `.env.example`)

```bash
# Next.js
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Clerk
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=
CLERK_SECRET_KEY=
CLERK_WEBHOOK_SECRET=

# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=          # server-side only, never exposed

# Anthropic
ANTHROPIC_API_KEY=

# fal.ai
FAL_KEY=

# Creatomate
CREATOMATE_API_KEY=

# Sentry (added in Setup)
SENTRY_DSN=
```

---

## Cost Model (MVP — zero to 50 users)

| Service | Plan | Est. monthly |
|---------|------|--------------|
| Vercel | Pro | $20 |
| Supabase | Pro | $25 |
| Clerk | Free (under 10k MAU) | $0 |
| Creatomate | Starter | $54 |
| Anthropic | Pay-per-use | ~$10–30 |
| fal.ai | Pay-per-use | ~$15–40 |
| **Total** | | **~$125–170** |

Scales roughly linearly with active users until Supabase free tier exhaustion (~500 MB DB or ~50 GB storage) or Creatomate credit cap.

---

## What's Explicitly NOT in This Architecture (MVP Boundary)

- No background job queue (inline pipeline instead)
- No multi-tenancy / org model (single user → single brand)
- No social API publishing (downloadable output only)
- No payment / billing infra (invite-only, no Stripe yet)
- No mobile app (responsive web only)
- No analytics / event tracking beyond server logs
- No admin panel (ops access via Supabase dashboard)
- No i18n (English only)

Each is a known deferral, not an oversight.
