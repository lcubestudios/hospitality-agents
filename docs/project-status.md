# Project Status — Hospitality Agents

_Last updated: 2026-07-29_

## Current Phase: August 2026 — Internal Testing

The PSB (Plan → Setup → Build) framing below this point is retired along
with the pre-pivot product plan — see **History** at the bottom. Current
phase is plain: internal testing through August, sales/launch push in
September (see `ONBOARDING.md` → Timeline to launch for the full breakdown).

### Where things stand

- Product is functional end-to-end on **`feat/product-pivot`** — treat this
  as the real trunk, not `main` (see `CLAUDE.md` → Branch note). `main` holds
  an earlier, richer build (chat UI, archives, video, agent grid) that was
  deliberately cut back on this branch.
- Working flow: signup/login → upload one product photo + brand context →
  Claude builds a brand-grounded creative strategy → Gemini renders 4 images
  → Claude writes caption + hashtags. All server-side, one synchronous
  request, no queue.
- Deployed to Vercel via GitHub Git integration — preview build per branch,
  production build on `main`.

### What's been decided (current)

| Decision          | Current state                                                                                                                                                                                          |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Product framing   | One AI marketing agent / one generation flow — not a multi-agent dashboard. The dashboard framing is retired, not just deferred.                                                                       |
| Auth              | Custom session cookie + PBKDF2 password hashing. **Not Clerk.**                                                                                                                                        |
| Image generation  | Google Gemini (`gemini-3.1-flash-image`), direct REST call. **Not fal.ai** — the original plan specified fal.ai/Flux; the switch to Gemini isn't documented anywhere, rationale needed from @lukasavb. |
| Video             | Cut from this branch. Existed pre-pivot on `main` as a Veo 3 Fast integration.                                                                                                                         |
| Captions/hashtags | Claude, currently `claude-opus-4-1`. **Retires 2026-08-05 — must migrate before then.**                                                                                                                |
| Dev port          | 3000 (macOS AirPlay Receiver holds 5000)                                                                                                                                                               |

### Next priorities — August 2026 (internal testing)

1. **Fix `claude-opus-4-1` retirement** — hard deadline 2026-08-05, breaks
   caption/hashtag generation in production if missed
2. **Create a test doc** — what's needed from internal testers, how feedback
   and testimonials get captured
3. **Wireframes + UI/UX refinement**
4. **Clear other pending issues before September:**
   - Verify the 4 generated images per campaign are visually distinct
   - Confirm actual Gemini image resolution/cost (currently an estimate —
     see `ONBOARDING.md` → Cost per generation)
   - Resolve the RLS-under-custom-session-model question (`CLAUDE.md` → Hard
     Rules)
   - Finish the doc pivot-alignment pass — `ONBOARDING.md` and this file are
     done; `docs/architecture.md` and `docs/project-spec.md` are still
     pre-pivot and stale

### Next priorities — September 2026 (sales & launch)

1. Sales initiative — hand off to the sales team
2. Calculate real per-generation and per-customer costs — validate the
   `ONBOARDING.md` cost estimate against actual production usage
3. Sell
4. Invite real restaurants to test, collect case studies

---

## History (pre-pivot)

Everything below this point predates the 2026-06-11 product pivot: the
original PSB tracking, the multi-agent dashboard framing, Veo 3 video
generation, multi-photo upload, ZIP-download planning, and the Clerk
auth-swap plan. That work still exists on the `main` branch and in this
file's git history, but no longer reflects the current product on
`feat/product-pivot`. For the retired product vision in narrative form, see
`docs/archive/onboarding-pre-pivot.md`. For the detailed pre-pivot build log,
`git log -p -- docs/project-status.md`.

---

## Open questions (non-blocking)

- Pricing model post-launch: per campaign, per seat, or per location?
- Demo mode: live generation flow or pre-rendered campaign for investor pitches?
- Multi-location: stub data model now or add later?
