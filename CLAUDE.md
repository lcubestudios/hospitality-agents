# CLAUDE.md — Hospitality Agents

> Project-specific rules. Extends the global baseline at `~/.claude/CLAUDE.md` (agent roster, tech stack defaults, naming, testing, guardrails). Read that first. This file only records what is different or load-bearing for this project.

_Last updated: 2026-04-21_
_Owner: @lukasavb_

## Project Overview

Hospitality Agents is an invite-only dashboard for F&B operators (restaurants, bars, cafes, hotels with dining). Operators pick AI agents that automate operational tasks. The MVP ships exactly one agent — **Campaign Creator** — which takes a brand profile plus uploaded product photos and returns a downloadable campaign package: enhanced images, short motion videos, captions, and hashtags. No publishing integrations.

## Current Phase

**Setup** (PSB: Plan → Setup → Build). Plan is complete. For live status, next-up tasks, and decisions log, see `docs/project-status.md`.

## Stack + Deviations

| Area            | Value                               | Note                                                                     |
| --------------- | ----------------------------------- | ------------------------------------------------------------------------ |
| Framework       | Next.js 16.2 (App Router)           | Global baseline says 15 — the bump to 16 is intentional for this project |
| Runtime         | React 19.2, Node 22, pnpm 10        | Per global baseline                                                      |
| Styling         | Tailwind v4 + shadcn/ui + Radix     | Per global baseline                                                      |
| Auth            | Clerk                               | Invite-only access, middleware-gated                                     |
| Data            | Supabase (Postgres + Storage + RLS) | All tables RLS-protected from first migration                            |
| AI — copy       | Anthropic Claude API                | Server-side only                                                         |
| AI — images     | fal.ai (Flux)                       | Server-side only                                                         |
| AI — video      | Creatomate REST                     | Server-side only                                                         |
| Hosting         | Vercel                              | Single repo, single deploy                                               |
| Dev server port | **3000** (Next.js default)          | Originally planned 5000, but macOS AirPlay Receiver holds that port      |

External SDKs (`@clerk/nextjs`, `@supabase/supabase-js`, `@anthropic-ai/sdk`, `@fal-ai/client`, Creatomate client) are **not installed until their feature ships in Build phase**. Do not pre-install them.

## Critical Documents

| Path                                   | Purpose                                                                                            |
| -------------------------------------- | -------------------------------------------------------------------------------------------------- |
| `docs/project-spec.md`                 | Product + technical requirements. **Approval-gated — do not edit without explicit user approval.** |
| `docs/architecture.md`                 | System design, DB schema, API surface, generation pipeline, cost model                             |
| `docs/project-status.md`               | PSB progress tracker; kept current across sessions                                                 |
| `docs/brainstorm.md`                   | Original scope discussion                                                                          |
| `docs/research_report_architecture.md` | Stack comparison report that led to the confirmed stack                                            |

## Project-Specific Hard Rules

These **add to** the global guardrails in `~/.claude/CLAUDE.md`.

- **Keys never leave the server.** All external AI calls (Claude, fal.ai, Creatomate) run inside Route Handlers or Server Actions. The browser never holds provider keys.
- **No secrets in git.** `.env.local` is gitignored. `.env.example` is the canonical key list — add a documented placeholder there for every env var, even before the feature that uses it ships.
- **RLS from day one.** Every Supabase table is row-level-security protected by `user_id` or `brand_id` tied to the Clerk JWT sub. No unprotected tables, not even for scratch work.
- **Generation pipeline endpoint.** `/api/campaigns/[id]/generate` is the single orchestrator for fal.ai + Claude + Creatomate. See the flow diagram and cost model in `docs/architecture.md`.
- **Dev server port is 3000** (Next.js default). Do not override unless you have a specific reason — port 5000 is held by macOS AirPlay Receiver on every macOS dev machine.
- **One agent only.** Campaign Creator is the sole agent in MVP. The dashboard may render "Coming soon" placeholder cards for the post-MVP agents listed in `docs/project-spec.md` (Review Response, Reservation Assist, Menu Sync, Staff Comms, Promo Planner), but those are UI-only — no routes, no data models, no logic.
- **English only.** No i18n layer, no locale files, no translation scaffolding.
- **Single venue per user.** Schema in `docs/architecture.md` supports multi-location via `brand_id`, but the MVP UI exposes exactly one brand/venue per user. Do not build a location switcher.
- **Download-only output.** No social publishing integration in MVP. Outputs are packaged as downloadable assets (ZIP or per-file). Do not wire Instagram/TikTok/Meta APIs.

## Agent Team Usage

Team roster lives in `~/.claude/CLAUDE.md`. For this project, the most relevant agents are:

| Agent                          | When to use                                                                          |
| ------------------------------ | ------------------------------------------------------------------------------------ |
| `frontend-engineer`            | Dashboard shell, Campaign Creator wizard, form flows                                 |
| `tech-writer`                  | This file, onboarding, design system prose                                           |
| `release-devops-engineer`      | Semantic-release, husky, commitlint, Vercel wiring                                   |
| `code-reviewer`                | Final gate before merge to `main`                                                    |
| `performance-security-auditor` | Required once the generation pipeline is live — audit for key leakage, N+1, RLS gaps |
| `design-system-curator`        | Component token and spec work as shadcn primitives are adopted                       |
| `qa-automation-engineer`       | Puppeteer + visual regression once UI stabilizes                                     |

## Do Not

- Do not install Clerk, Supabase, Anthropic, fal.ai, or Creatomate SDKs until their feature is actively being built.
- Do not scaffold agents beyond Campaign Creator. Placeholder cards are fine; routes and data models are not.
- Do not write tests before the feature exists (global rule, restated because it bites on greenfield work).
- Do not edit `docs/project-spec.md` without explicit user approval.
- Do not edit `docs/changelog.md` — semantic-release owns it.
- Do not commit directly to `main`. Feature branches only.
- Do not add Docker, IaC, or any deployment config beyond Vercel until explicitly requested.
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
