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
2. ✅ **Auth stub** — `src/lib/auth.ts` exports `getCurrentUserId()`, reads from session (multi-step signup) or falls back to `DEV_USER_ID`. Every Supabase call routes through the helper. | _Completed 2026-04-27_
3. ✅ **Brand profile CRUD** — simple form + Supabase write; validates the stub → RLS path end-to-end. Tested locally, form saves brands with `user_id` properly set. | _Completed 2026-04-27_
4. ✅ **Campaign Creator wizard (images)** — Complete. Upload flow works (photo → Supabase Storage). Image generation uses Claude Vision for product analysis + Gemini 2.5 Flash for generation. Generated image saves to Supabase and displays with download button. | _Completed 2026-04-30_
   - **Vision analysis fix:** Hybrid approach implemented. Claude Sonnet 4.6 analyzes uploaded photos (accurate), output feeds to Gemini for generation. Replaced broken Gemini-3-flash vision endpoint.
   - **Safety filter fix:** Added `safetySettings: [BLOCK_ONLY_HIGH]` for all harm categories to Gemini payload. Typos (e.g., "Mapo") no longer block generation.
   - **Cost:** Claude Vision ~$0.003/image; billing enabled on Anthropic account.
5. ✅ **Campaign Creator (copy + hashtags)** — Caption + hashtag generation wired via Claude Sonnet. brand*voice + post_topic fields added to brands/campaigns. | \_Completed 2026-04-29*
   - **Caption handling:** Users select outputs via checkboxes (image, caption, video) before generating — solves JSON parsing without workarounds.
6. ✅ **Basic UI** — Completed 2026-04-29:
   - **Brand context panel** — brand name + description load from Supabase, editable inline with save (PATCH `/api/brands/[id]`). Brand voice deferred (future addition).
   - **Multi-photo upload** — up to 3 photos, hover to replace/remove. All uploaded to Supabase Storage. Single enhanced image output. Multiple outputs noted as future possibility.
   - **Step progress indicator** — live pipeline steps shown during generation, dynamically includes only selected outputs.
   - **Isolated regenerate buttons** — separate Regenerate on image, caption, and video cards. Uploaded URLs stored in own state; cache-busted with `?t=Date.now()` so new renders display. Archives store up to 2 previous campaigns.
7. ✅ **Campaign Creator (video)** — Veo 3 Fast (Google AI Studio) wired via `/api/campaigns/[id]/video`. Prompt built from caption, async polling until done, video uploaded to Supabase Storage, saved to `assets` table. Video generation is opt-in via checkbox, integrates into main "Generate Campaign" flow. | _Completed 2026-04-30_
   - **Approach:** Skipped Creatomate — Veo 3 Fast available on existing Google AI Studio key, no new account needed.
   - **API pattern:** POST `:predictLongRunning` → poll operation every 5s (max 3 min) → download from temp URI → upload to Supabase.
   - **Duration:** 8 seconds (valid range: 4–8s; 9:16 aspect ratio).
   - **UX decision:** Video opt-in via checkbox, progress indicator includes "Generating video" when selected, outputs stack vertically.
8. ✅ **Multi-step signup with session-based auth** — Signup (`/auth/signup`) → Setup brand (`/auth/setup-brand`) → Home. Password hashing with pbkdf2Sync (100k iterations). httpOnly session cookies. Returns users via login page. All flows tested end-to-end with Siam Kitchen brand. | _Completed 2026-05-05_
9. ~~**Campaign Creator (multi-post + ZIP download)**~~ — **Backlogged (low pri).** Doesn't match real F&B workflow. Revisit post-launch.
10. ~~**Auth swap (Clerk)**~~ — **Backlogged (higher pri than step 9).** Session-based auth is good enough for invite-only MVP. Swap when scaling. Consider simple invite code on signup form as short-term gate.
11. **Invite-only flow + waitlist page** — Deferred with Clerk.

Deployment and production readiness items (Vercel prod env vars, Sentry, uptime monitoring) happen after step 5 once there's a real pipeline to observe.

---

## ✅ Vision analysis fixed (2026-04-30)

Implemented hybrid Claude Vision + Gemini approach:

- Claude Sonnet 4.6 analyzes product photos (accurate)
- Result feeds to Gemini 2.5 Flash for generation
- Safety filters set to `BLOCK_ONLY_HIGH` (typos no longer block)

Ready to proceed to step 7 (video generation).

---

## Next session: pick up here

### Completed (2026-05-25)

- ✅ **Dashboard redesign** — Brand settings refactored (edit name/description), brand voice now in Campaign Creator, Log Out moved to sidebar bottom, standardized auth copy (Username instead of Brand Name, simplified headings)

### In Progress / Next Priority

1. **Improve signup flow** — Make onboarding more guided and intuitive. Current flow (signup → setup-brand → home) works but needs better UX polish, progress indicators, field validation messaging, and clearer intent at each step.
2. **Image + video prompt refinement** — improve generation relevance and quality across F&B use-cases
3. **Brand voice captioning** — captions should reflect the brand's voice, not generic copy

---

## QA Notes — Output Quality (Deferred Polish)

As of 2026-05-05 testing (Siam Kitchen brand):

- **Photo generation:** Still questionable relevance; consider adjusting prompts
- **Video generation:** Food-relevant, quality acceptable; prompt refinement possible
- **Caption generation:** Consistency to validate across different brands

Not blocking MVP, but marked for refinement post-launch.

---

## Open questions (non-blocking)

- Pricing model post-launch: per campaign, per seat, or per location?
- Demo mode: live generation flow or pre-rendered campaign for investor pitches?
- Multi-location: stub data model now or add later?
