# Project Status — Hospitality Agents

## Current Phase: Setup (PSB Framework) — closing out

### PSB Progress

| Step                                      | Status                                                    |
| ----------------------------------------- | --------------------------------------------------------- |
| (P) Brainstorm                            | Done — `docs/brainstorm.md`                               |
| (P) 3 key questions                       | Done — answered in session                                |
| (P) Project spec                          | Done — `docs/project-spec.md`                             |
| (P) Architecture / tech stack research    | Done — `docs/research_report_architecture.md`             |
| (P) Architecture review with user         | Done — stack confirmed as recommended                     |
| (P) Architecture doc                      | Done — `docs/architecture.md`                             |
| (S) Next.js 16 + tooling scaffold         | Done — `chore: scaffold Next.js 15 + tooling` (0a5fff8)   |
| (S) `.env.example`                        | Done — placeholders for all 6 services                    |
| (S) Project `CLAUDE.md`                   | Done — extends global baseline                            |
| (S) Husky + commitlint + semantic-release | Done — conventional commits enforced                      |
| (S) GitHub Actions CI + release workflow  | Done — `.github/workflows/`                               |
| (S) Dev server verified                   | Done — boots on port 3000 (5000 blocked by macOS AirPlay) |
| (S) GitHub repo — push to remote          | Done — `github.com/LukasAVB/hospitality-agents` (private) |
| (S) Plugins, MCP servers, slash commands  | Pending — deferred to next session                        |
| (B) Build                                 | Not started                                               |

---

## What's been decided

| Decision                | Choice                                                                                                        |
| ----------------------- | ------------------------------------------------------------------------------------------------------------- |
| First agent             | Campaign Creator (images + videos + captions)                                                                 |
| Publishing integrations | Skipped for MVP — output is downloadable assets                                                               |
| Image approach          | MVP: enhance client's uploaded product photos. Fast follow: full AI generation (product refs always required) |
| Video scope             | Short motion clips from images + text overlays + transitions                                                  |
| Access model            | Invite-only → waitlist → public                                                                               |
| Language                | English only at launch                                                                                        |
| Stack                   | Next.js 16.2 + React 19 + Tailwind v4 + shadcn + Clerk + Supabase + Claude API + fal.ai + Creatomate + Vercel |
| Dev port                | 3000 (was 5000 in architecture doc; changed because macOS AirPlay Receiver holds 5000)                        |
| **Build sequencing**    | **Campaign Creator first, then auth (Clerk).** Auth is stubbed with `DEV_USER_ID` until phase 2.              |

---

## Scaffold summary (what exists on disk and on remote)

- Next.js 16.2 App Router + TS strict + Tailwind v4 + shadcn primitives (Button, Card, Input, Label, Dialog)
- ESLint flat config + Prettier + prettier-plugin-tailwindcss
- Husky v9 + lint-staged + commitlint (9 Conventional Commit types, 50-char subject cap)
- semantic-release wired to `docs/changelog.md` (not yet created — will appear on first release)
- GitHub Actions CI (lint → type-check → build) and release workflow (main-only, gated on CI)
- `.env.example` enumerates Clerk, Supabase, Anthropic, fal.ai, Creatomate, Sentry with signup links
- Project `CLAUDE.md` covers 10 project-specific hard rules
- External service SDKs **not yet installed** — arrive in Build phase when their feature lands

Git: `main` branch, 4 commits, pushed to `github.com/LukasAVB/hospitality-agents`. SSH remote `github-personal-git:LukasAVB/hospitality-agents.git` configured via `~/.ssh/config` host alias.

---

## Build phase plan (next session onwards)

Order of features is **deliberate**. Auth is stubbed, not skipped — the data model exercises RLS from the first migration.

1. **Supabase project + first migration** — create project, wire client, run initial schema (`users`, `brands`, `campaigns`, `assets`, `generation_jobs`) with RLS policies. Seed the dev user.
2. **Auth stub** — `src/lib/auth.ts` exports `DEV_USER_ID` and `getCurrentUserId()`. Every Supabase call routes through the helper.
3. **Brand profile CRUD** — simple form + Supabase write; validates the stub → RLS path end-to-end.
4. **Campaign Creator wizard (images)** — upload product photo → fal.ai Flux image-to-image → preview + download. Single post, no video yet.
5. **Campaign Creator (copy + hashtags)** — add Claude Sonnet for caption + hashtag generation, prompt-cache the brand guide.
6. **Campaign Creator (video)** — wire Creatomate, assemble enhanced image + caption overlay into a short clip.
7. **Campaign Creator (multi-post + ZIP download)** — extend to `post_count` posts, bundle outputs as a ZIP.
8. **Auth swap (Clerk)** — install `@clerk/nextjs`, add middleware, replace `getCurrentUserId()` body. Wire Clerk→Supabase JWT template.
9. **Invite-only flow + waitlist page** — Clerk invite API + a public waitlist form.

Deployment and production readiness items (Vercel prod env vars, Sentry, uptime monitoring) happen after step 5 once there's a real pipeline to observe.

---

## Next session: pick up here

1. **Configure MCP servers + slash commands** — Supabase MCP is the main one; any others as needed
2. **Start Build step 1** — Supabase project creation (user action, then scaffold migration locally)

---

## Open questions (non-blocking)

- Pricing model post-launch: per campaign, per seat, or per location?
- Demo mode: live generation flow or pre-rendered campaign for investor pitches?
- Multi-location: stub data model now or add later?
