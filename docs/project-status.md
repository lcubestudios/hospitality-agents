# Project Status — Hospitality Agents

## Current Phase: Setup (PSB Framework)

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
| (S) GitHub repo — push to remote          | **Next up — user owns this step**                         |
| (S) Plugins, MCP servers, slash commands  | Pending                                                   |
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

---

## Scaffold summary (what exists on disk)

- Next.js 16.2 App Router + TS strict + Tailwind v4 + shadcn primitives (Button, Card, Input, Label, Dialog)
- ESLint flat config + Prettier + prettier-plugin-tailwindcss
- Husky v9 + lint-staged + commitlint (9 Conventional Commit types, 50-char subject cap)
- semantic-release wired to `docs/changelog.md` (not yet created — will appear on first release)
- GitHub Actions CI (lint → type-check → build) and release workflow (main-only, gated on CI)
- `.env.example` enumerates Clerk, Supabase, Anthropic, fal.ai, Creatomate, Sentry with signup links
- Project `CLAUDE.md` covers eight project-specific hard rules
- External service SDKs **not yet installed** — arrive in Build phase when their feature lands

Git: `main` branch, two commits locally. Remote `github-personal-git:LukasAVB/hospitality-agents.git` not yet added — user will push.

---

## Next session: pick up here

1. **Push to GitHub** (user action) — add remote, push main, confirm CI workflow runs green
2. **Configure project MCP servers + slash commands** — Supabase MCP, any others needed
3. **Begin Build phase** — first feature: auth flow (Clerk middleware + sign-in page) or brand profile CRUD, depending on priority

---

## Open questions (non-blocking)

- Pricing model post-launch: per campaign, per seat, or per location?
- Demo mode: live generation flow or pre-rendered campaign for investor pitches?
- Multi-location: stub data model now or add later?
