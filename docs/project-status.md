# Project Status — Hospitality Agents

## Current Phase: Build (PSB Framework) — Step 3 complete

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

## Build phase plan (ordered feature sequence)

Order of features is **deliberate**. Auth is stubbed, not skipped — the data model exercises RLS from the first migration.

1. ✅ **Supabase project + first migration** — create project, wire client, run initial schema (`users`, `brands`, `campaigns`, `assets`, `generation_jobs`) with RLS policies. Seed the dev user. | _Completed 2026-04-27_
2. ✅ **Auth stub** — `src/lib/auth.ts` exports `DEV_USER_ID` and `getCurrentUserId()`. Every Supabase call routes through the helper. | _Completed 2026-04-27_
3. ✅ **Brand profile CRUD** — simple form + Supabase write; validates the stub → RLS path end-to-end. Tested locally, form saves brands with `user_id` properly set. | _Completed 2026-04-27_
4. ⚠️ **Campaign Creator wizard (images)** — Working. Upload flow complete (photo → Supabase Storage). Image generation wired to Google Gemini 2.5 Flash (free tier). Generated image saves to Supabase and displays with download button. Vision analysis silently fails (see issues). | _In progress 2026-04-29_
   - **Vision Issue 1:** `gemini-3-flash` model returns 404 — invalid model ID for v1beta. Vision silently fails and falls back to generic prompt. Fix: swap to `gemini-2.0-flash` or `gemini-1.5-flash`.
   - **Vision Issue 2:** Even when vision works, Gemini misidentifies products (pizza → writer's study). Next iteration: Claude Vision for analysis + Gemini for generation (hybrid).
   - **Safety filter crash:** Gemini returns candidate with no `content` when prompt is blocked. Fixed with optional chaining on `candidates[0].content?.parts?.find()` — 2026-04-29.
   - **Known trigger:** Post topic "New pizza launching: Mapo Tofu Pizza" caused a safety filter block. "Mapo" was a user typo (unrecognised word) — Gemini flagged it as suspicious content. Workaround: use real, recognisable product names. Fix: add `safetySettings: BLOCK_ONLY_HIGH` to generation payload when vision fix is tackled.
   - **Notes:** Pollinations.ai down (Error 522). Replicate requires credits. Google Gemini free tier (gemini-3.1-flash-image) quota-limited. Using gemini-2.5-flash-image with `response_modalities: ["IMAGE"]` as workaround (~10 req/min, 500/day).
5. ⚠️ **Campaign Creator (copy + hashtags)** — Caption + hashtag generation wired via Claude Sonnet. brand*voice + post_topic fields added to brands/campaigns. | \_In progress 2026-04-29*
   - **Caption fix:** Claude wraps JSON in markdown fences. Strip before JSON.parse — fixed 2026-04-29.
6. ✅ **Basic UI** — Completed 2026-04-29:
   - **Brand context panel** — brand name + description load from Supabase, editable inline with save (PATCH `/api/brands/[id]`). Brand voice deferred (future addition).
   - **Multi-photo upload** — up to 3 photos, hover to replace/remove. All uploaded to Supabase Storage. Single enhanced image output. Multiple outputs noted as future possibility.
   - **Step progress indicator** — live pipeline steps shown during generation (Uploading → Generating image → Writing caption).
   - **Isolated regenerate buttons** — separate Regenerate on image and caption cards. Uploaded URLs stored in own state; cache-busted with `?t=Date.now()` so new image renders. Fixed silent early return bug (no feedback when campaignId/uploadedUrls missing).
7. **Campaign Creator (video)** — wire Creatomate, assemble enhanced image + caption overlay into a short clip.
8. **Campaign Creator (multi-post + ZIP download)** — extend to `post_count` posts, bundle outputs as a ZIP.
9. **Auth swap (Clerk)** — install `@clerk/nextjs`, add middleware, replace `getCurrentUserId()` body. Wire Clerk→Supabase JWT template.
10. **Invite-only flow + waitlist page** — Clerk invite API + a public waitlist form.

Deployment and production readiness items (Vercel prod env vars, Sentry, uptime monitoring) happen after step 5 once there's a real pipeline to observe.

---

## ⚠️ TOP PRIORITY — Fix vision analysis before anything else

Image generation produces incorrect results because vision analysis is broken. Must fix before moving to video or any other step.

**What's broken:**

- `gemini-3-flash` returns 404 — invalid model ID. Vision silently fails, generation falls back to a generic prompt with no product context.
- Even with a valid model, Gemini misidentifies products (pizza → writer's study).

**Recommended fix:**

1. Swap `gemini-3-flash` → `gemini-2.0-flash` in the generate route (quick, one line)
2. Test if Gemini 2.0 Flash vision accurately describes the uploaded product
3. If still inaccurate → implement hybrid: Claude Vision (paid, ~$0.003/image) for analysis + Gemini for generation

**Do not start step 7 (video) until image generation reflects the actual uploaded product.**

---

## Next session: pick up here

1. **Fix vision analysis** (see TOP PRIORITY above)
2. **Merge feature branch** `feat/campaign-images` → `main` once vision is working
3. **Start step 7** — video generation (Creatomate)

---

## Open questions (non-blocking)

- Pricing model post-launch: per campaign, per seat, or per location?
- Demo mode: live generation flow or pre-rendered campaign for investor pitches?
- Multi-location: stub data model now or add later?
