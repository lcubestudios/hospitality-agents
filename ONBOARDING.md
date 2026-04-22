# Onboarding — Hospitality Agents

Welcome. This document covers everything you need to be productive in this codebase from day one.

---

## What we're building

An invite-only web dashboard for F&B operators (restaurants, bars, cafes, hotels with dining). Operators pick AI agents that handle operational tasks they don't have time or staff for.

**MVP = one agent: Campaign Creator.** The operator provides their brand profile and reference product photos. The agent returns a downloadable campaign package: enhanced images, short videos, captions, and hashtags. No social publishing — they post themselves.

Post-MVP agents (Review Response, Reservation Assist, Menu Sync, Staff Comms, Promo Planner) are defined but not built. The dashboard may show "Coming soon" cards but nothing behind them.

---

## Phase status

We use a **PSB framework**: Plan → Setup → Build. Plan and Setup are complete. Build is next.

Read `docs/project-status.md` before writing a single line of code. It tells you exactly where we are, what's been decided, and what step to pick up.

---

## Stack

| Layer           | Tech                                               |
| --------------- | -------------------------------------------------- |
| Framework       | Next.js 16.2, App Router, TypeScript strict        |
| UI              | React 19, Tailwind v4, shadcn/ui, Radix UI, Lucide |
| Auth            | Clerk (deferred — see below)                       |
| Database        | Supabase Postgres + RLS                            |
| File storage    | Supabase Storage                                   |
| LLM             | Anthropic Claude API (server-side only)            |
| Image AI        | fal.ai Flux (server-side only)                     |
| Video           | Creatomate REST API (server-side only)             |
| Hosting         | Vercel (single repo, single deploy)                |
| Package manager | pnpm 10                                            |

**External SDKs are not installed until the feature that uses them ships.** If you `pnpm add @clerk/nextjs` before auth work begins, that is wrong.

---

## Project structure

```
src/
  app/                  # Next.js App Router routes and layouts
  components/
    ui/                 # shadcn/ui primitives — do not edit directly
    __tests__/          # colocated component tests
  hooks/                # custom React hooks
  lib/
    auth.ts             # getCurrentUserId() — the only place DEV_USER_ID lives
    utils.ts            # cn() and other shared utilities
  data/                 # typed, immutable constants
  test/setup.ts         # Vitest + Testing Library setup
docs/
  project-spec.md       # approval-gated — do not edit without explicit sign-off
  architecture.md       # system design, DB schema, API surface, cost model
  project-status.md     # live task tracker
  brainstorm.md         # original scope discussion (historical)
  research_report_architecture.md  # stack comparison that led to confirmed stack
CLAUDE.md               # project rules (extends global baseline)
ONBOARDING.md           # this file
.env.example            # canonical env var list with descriptions
```

---

## Dev environment

```bash
# one-time setup
corepack enable
corepack prepare pnpm@10 --activate
nvm use   # pins to Node 22 via .nvmrc

# daily
pnpm install
cp .env.example .env.local   # fill values from a team member
pnpm dev   # http://localhost:3000
```

Port is **3000** (not 5000 — macOS AirPlay Receiver holds 5000 on every Mac dev machine).

---

## Auth deferral — read this before touching any Supabase code

**Clerk is not installed yet.** Campaign Creator ships first, against a stubbed dev identity.

The stub lives in `src/lib/auth.ts`:

```ts
const DEV_USER_ID = 'dev-user-1'

export function getCurrentUserId(): string {
  return DEV_USER_ID
}
```

Every server-side call that needs a user ID goes through `getCurrentUserId()`. When Clerk is wired in later, only the body of that function changes — no call sites change.

**RLS is ON even with the stub.** The dev user is a real row in Supabase `auth.users`. Policies apply. Do not disable RLS "just for development."

---

## Key conventions

- **Feature branches only.** Never commit to `main` directly.
- **Conventional Commits enforced.** Husky + commitlint will reject bad messages. Format: `type(scope): subject` — imperative mood, no period, 50-char subject cap. Types: `feat fix docs refactor perf test chore ci revert`.
- **No `git add -A` or `git add .`.** Stage files by name.
- **All AI calls are server-side.** Route Handlers and Server Actions only. The browser never holds API keys.
- **One venue per user in MVP.** The schema supports multi-location via `brand_id` but the UI exposes one brand per user. Do not build a location switcher.
- **English only.** No i18n layer, no locale files.
- **Download-only output.** No social API wiring.

---

## Data model overview

Five tables, all RLS-protected:

| Table             | What it holds                                                                       |
| ----------------- | ----------------------------------------------------------------------------------- |
| `users`           | Mirrors Clerk user_id; FK anchor for everything else                                |
| `brands`          | Brand profile per user (name, tone, palette, logo, brand guide)                     |
| `campaigns`       | Campaign runs: brief, platform, status, post count                                  |
| `assets`          | Every generated or uploaded file (source photos, enhanced images, videos, captions) |
| `generation_jobs` | Pipeline step log — enables resume-on-failure                                       |

See `docs/architecture.md` for full column definitions and RLS policies.

---

## Generation pipeline

`POST /api/campaigns/[id]/generate` is the single orchestrator. The flow:

1. Create campaign row (`status=generating`)
2. Upload source photos to Supabase Storage
3. Kick off fal.ai (image enhancement) and Claude (captions + hashtags) in parallel
4. Wait for images → insert enhanced_image assets
5. Kick off Creatomate (image + text → short video clips)
6. Wait for videos → insert video assets
7. Mark `status=complete`

Each step writes to `generation_jobs` so a failed pipeline can be resumed without repeating completed work.

---

## API surface (planned)

| Route                          | Methods            | Purpose                            |
| ------------------------------ | ------------------ | ---------------------------------- |
| `/api/brands`                  | GET, POST          | List/create brands                 |
| `/api/brands/[id]`             | GET, PATCH, DELETE | Brand CRUD                         |
| `/api/assets/upload`           | POST               | Signed Supabase Storage upload URL |
| `/api/campaigns`               | GET, POST          | List/create campaigns              |
| `/api/campaigns/[id]`          | GET, DELETE        | Campaign detail                    |
| `/api/campaigns/[id]/generate` | POST               | Kick off generation pipeline       |
| `/api/campaigns/[id]/download` | GET                | Signed ZIP download URL            |
| `/api/webhooks/fal`            | POST               | fal.ai async completion            |
| `/api/webhooks/creatomate`     | POST               | Creatomate render completion       |

---

## Build sequence

This order is deliberate. Follow it.

1. Supabase project + first migration (schema + RLS policies + seed dev user)
2. Auth stub (`src/lib/auth.ts`)
3. Brand profile CRUD
4. Campaign Creator — images (fal.ai)
5. Campaign Creator — copy + hashtags (Claude)
6. Campaign Creator — video (Creatomate)
7. Campaign Creator — multi-post + ZIP download
8. Auth swap (Clerk)
9. Invite-only flow + waitlist page

---

## Documents to read before starting

1. `docs/project-status.md` — current state and what's next
2. `docs/project-spec.md` — what we're building (approval-gated, read-only)
3. `docs/architecture.md` — how it's built
4. `CLAUDE.md` — project rules (especially the hard guardrails section)

---

## Hard rules summary

- Do not install Clerk, Supabase, Anthropic, fal.ai, or Creatomate SDKs before their feature starts
- Do not disable RLS
- Do not scatter `DEV_USER_ID` — all reads go through `getCurrentUserId()`
- Do not edit `docs/project-spec.md` without explicit approval
- Do not commit to `main`
- Do not add agents beyond Campaign Creator (placeholder cards only)
- Do not add Docker, IaC, or deployment config beyond Vercel
- Do not use `git add -A` or `git add .`
- Verify UI changes in the browser before marking done — type-check is not a substitute
