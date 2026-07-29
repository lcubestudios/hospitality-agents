# CLAUDE.md — Hospitality Agents

> Project-specific rules. Extends the global baseline at `~/.claude/CLAUDE.md` (agent roster, tech stack defaults, naming, testing, guardrails). Read that first. This file only records what is different or load-bearing for this project.

_Last updated: 2026-07-29_
_Owner: @lukasavb_

## Project Overview

Hospitality Agents is an F&B image-enhancing tool. The pitch is **time and cost
saved on photoshoots and creative direction** — not "our images look better
than a photographer's." An operator uploads one product photo plus their
brand profile; the product runs it through a single generation pipeline and
returns 4 brand-grounded campaign images, a caption, and hashtags.

This is a pivot from the original plan (a multi-agent dashboard where
"Campaign Creator" was one of several selectable agents). That framing is
retired — the product **is** this one generation flow, not a dashboard of
agents. The richer, earlier build (chat interface, archives, video
generation, agent grid) still exists on `main` but was deliberately cut back
on the current working branch — see **Branch note** below.

## Current Phase

**August 2026 — internal testing**, ahead of a September sales push. Product
is functional end-to-end. Priorities right now: a test doc for internal
testers, wireframes/UI-UX refinement, and clearing pending issues (see
`ONBOARDING.md` → Timeline to launch for the full breakdown). This replaced
the original PSB (Plan → Setup → Build) framing — `docs/project-status.md`
still describes PSB and is pending a rewrite to match.

## Branch note

**`feat/product-pivot` is the real trunk right now, not `main`.** `main`
holds an earlier, more complex build (chat-first UI, `ArchivesTab`,
`CampaignCreator`, `SocialMockups`, a video-generation route, an agent grid)
that was deliberately stripped back on this branch to the single-form
generation flow described above. Don't treat `main` as ground truth for
"how things currently work" until/unless this branch merges into it.

## Stack + Deviations

| Area            | Value                                       | Note                                                                                                                                                                       |
| --------------- | ------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Framework       | Next.js 16.2 (App Router), Turbopack        | Global baseline says 15 — the bump to 16 is intentional                                                                                                                    |
| Runtime         | React 19.2, Node 22, pnpm 10 (via corepack) | Per global baseline                                                                                                                                                        |
| Styling         | Tailwind v4 + shadcn/ui + Radix             | Per global baseline                                                                                                                                                        |
| Auth            | Custom session cookie + PBKDF2              | **Not Clerk.** Real, shipped — not a stub. See `src/lib/session.ts` + `src/lib/password.ts`                                                                                |
| Data            | Supabase (Postgres + Storage)               | RLS status **unverified** under this custom auth model — see Hard Rules                                                                                                    |
| AI — strategy   | Anthropic Claude, `claude-sonnet-4-6`       | Vision + text: analyzes uploaded photo + brand profile → JSON shot briefs                                                                                                  |
| AI — captions   | Anthropic Claude, `claude-opus-4-1`         | **Deprecated, retires 2026-08-05 — migrate before then.** See Hard Rules                                                                                                   |
| AI — images     | Google Gemini, `gemini-3.1-flash-image`     | Raw REST call, no SDK. **Not fal.ai** — original architecture plan specified fal.ai/Flux; the switch to Gemini is undocumented (ask @lukasavb for the "why" if it matters) |
| AI — video      | Not built on this branch                    | Existed on `main` (Creatomate) pre-pivot; not part of the current product                                                                                                  |
| Hosting         | Vercel                                      | Git-integration auto-deploy: preview per branch, production from `main`                                                                                                    |
| Dev server port | **3000** (Next.js default)                  | Port 5000 is held by macOS AirPlay Receiver on every macOS dev machine                                                                                                     |

**Not installed, despite being listed in `.env.example` and `README.md`:**
Clerk, fal.ai, Creatomate. Those files are stale leftovers from the
pre-pivot plan — flagged, not yet cleaned up.

## Critical Documents

| Path                                   | Status                                                                                                                |
| -------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `ONBOARDING.md`                        | **Current.** Rewritten 2026-07-29 to match the pivoted product — start here.                                          |
| `docs/project-spec.md`                 | **Pre-pivot, stale.** Approval-gated — do not edit without explicit user approval. Read for historical context only.  |
| `docs/architecture.md`                 | **Pre-pivot, stale.** Schema/API/cost-model sections describe the old Clerk+fal.ai+Creatomate stack. Pending rewrite. |
| `docs/project-status.md`               | **Pre-pivot, stale.** Still tracks PSB framework and the old stack. Pending rewrite.                                  |
| `docs/archive/onboarding-pre-pivot.md` | Archived — the old multi-agent-dashboard onboarding doc, kept for historical reference only.                          |
| `docs/brainstorm.md`                   | Original scope discussion — historical, pre-pivot.                                                                    |
| `docs/research_report_architecture.md` | Stack comparison that led to the original (now partly superseded) stack choice.                                       |

## Project-Specific Hard Rules

These **add to** the global guardrails in `~/.claude/CLAUDE.md`.

- **`claude-opus-4-1` retires 2026-08-05.** It currently powers captions and
  hashtags (`src/app/api/campaigns/[id]/generate/route.ts`). This is a hard
  external deadline, not optional cleanup — migrate before that date or
  caption/hashtag generation breaks in production.
- **Keys never leave the server.** All external AI calls (Claude, Gemini) run
  inside Route Handlers. The browser never holds provider keys.
- **No secrets in git.** `.env.local` is gitignored. `.env.example` is
  supposed to be the canonical key list, but it's currently stale (still
  lists Clerk/fal.ai/Creatomate that aren't installed) — don't trust it
  blindly, and clean it up if you're touching it anyway.
- **RLS status needs verifying, not assuming.** Supabase RLS policies are
  written against `auth.uid()`, which assumes Supabase's own Auth system —
  but this app authenticates via a custom session cookie instead. Whether
  RLS policies do anything meaningful under the current login system is an
  open question. Do not disable RLS as a workaround; verify what's actually
  enforced first.
- **Generation pipeline endpoint.** `/api/campaigns/[id]/generate` is the
  single orchestrator: Claude (strategy) → Gemini ×4 (images) → Claude
  (caption + hashtags). It is **not** fal.ai/Creatomate — that was the
  pre-pivot plan.
- **Dev server port is 3000** (Next.js default). Do not override unless you
  have a specific reason — port 5000 is held by macOS AirPlay Receiver.
- **Single flow, not a dashboard.** No chat interface, no archives tab, no
  video generation, no "coming soon" agent grid on this branch — those
  existed pre-pivot on `main` and were deliberately cut. Don't reintroduce
  them without an explicit decision to do so.
- **English only.** No i18n layer, no locale files, no translation
  scaffolding.
- **Download-only output.** No social publishing integration. Outputs are
  downloadable/displayable assets. Do not wire Instagram/TikTok/Meta APIs.
- **No version-controlled DB schema.** There's no `supabase/migrations`
  directory — schema changes are made directly against the Supabase
  project. Worth fixing eventually; don't assume migrations exist.

## Agent Team Usage

Team roster lives in `~/.claude/CLAUDE.md`. For this project, the most relevant agents are:

| Agent                          | When to use                                                                       |
| ------------------------------ | --------------------------------------------------------------------------------- |
| `frontend-engineer`            | `GenerateForm`, `AppShell`, signup/login flows, wireframe/UI-UX work              |
| `tech-writer`                  | This file, `ONBOARDING.md`, design system prose                                   |
| `release-devops-engineer`      | Semantic-release, husky, commitlint, Vercel wiring                                |
| `code-reviewer`                | Final gate before merge to `main`                                                 |
| `performance-security-auditor` | Verify RLS actually applies under the custom session model; audit for key leakage |
| `design-system-curator`        | Component token and spec work as shadcn primitives are adopted                    |
| `qa-automation-engineer`       | Puppeteer + visual regression once UI stabilizes                                  |

## Do Not

- Do not install Clerk, fal.ai, or Creatomate SDKs — not used, despite being
  listed in `.env.example`/README.
- Do not treat `main` as the current product — it's a superseded, more
  complex build (see Branch note above).
- Do not disable RLS or assume it's a no-op without verifying — see Hard Rules.
- Do not sprinkle session/user-ID reads across call sites — all reads go
  through `getCurrentUserId()` in `src/lib/auth.ts`.
- Do not edit `docs/project-spec.md` without explicit user approval.
- Do not edit `docs/changelog.md` — semantic-release owns it.
- Do not commit directly to `main`. Feature branches only.
- Do not add Docker, IaC, or any deployment config beyond Vercel until
  explicitly requested.
- Do not use `git add -A` or `git add .` — stage by name.

## Commands

```bash
pnpm dev          # Next.js dev server on :3000
pnpm build        # Production build
pnpm start        # Production server on :3000
pnpm lint         # ESLint flat config
pnpm type-check   # tsc --noEmit
pnpm format       # Prettier write
pnpm format:check # Prettier check (use in CI)
```
