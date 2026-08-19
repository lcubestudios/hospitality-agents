# Dev tasks — current sprint

_As of: 2026-08-12_
_Audience: the onboarded contractor_

This is the current, prioritized task list for engineering work — not repo
history (see `HANDOFF.md` for that: branch cleanup, what's safe to delete,
local dev setup). Do these roughly in order; Task 1 is time-sensitive.

---

## Task 0 — Ship today's tester-blocking fixes (2026-08-19, do this before Task 1)

Internal testers hit 4 issues: Brave desktop upload failing on every
attempt, a one-off mobile Safari upload failure, mobile campaigns only
returning 1 of 4 images, and generated images not feeling brand-grounded
enough. All four now have code fixes in the working tree — **uncommitted,
unpushed, same situation Task 1 warns about below.** Don't let this sit.

**Root cause found for the Brave/mobile upload failures —
`src/lib/auth.ts`:** `getCurrentUserId()` was silently falling back to a
hardcoded shared "dev user" ID whenever a request's session cookie was
missing, in every environment including production. Effect: if a
tester's cookie failed to attach on a given request (plausible on Brave's
stricter cookie handling; a timing glitch would explain the mobile
Safari one-off), the app treated them as the wrong user, their real
brand lookup came back empty, and `/api/campaigns` returned a confusing
404 "Brand not found" right at the first step of Generate — which reads
to a tester as "upload just fails." Fixed by gating the dev-user fallback
to non-production and throwing `UnauthorizedError` otherwise; all
call sites (`/api/campaigns`, `/api/brands`, `/api/brands/[id]`) now
return a clear `401 "Please log in again"` instead. **Verified live**
against a real production build (`pnpm start`, real `NODE_ENV=production`):
unauthenticated request → 401 as expected; real signup → session cookie
→ campaign creation still succeeds (201). Not yet confirmed against the
original tester's exact failure — ask them to retry; the error message
they see now will be specific instead of generic, so if it's something
else it'll be obvious immediately.

**Mobile generating 1 of 4 images — `generate/route.ts`:** two
independent bugs could each cap the count at 1, both fixed:

1. The fallback strategy (used whenever Claude's shot-planning call
   fails or returns malformed JSON) only ever planned **1** shot, which
   permanently caps output at 1 regardless of Gemini's success rate.
   Expanded to plan 4 distinct generic shots instead.
2. `generateImageWithGemini()` had no retry — a single transient failure
   (safety-filter false positive, rate limit, API blip) permanently
   dropped that shot with just a `console.warn`. Added one automatic
   retry per shot.
   Also added `total_planned` / `strategy_fallback` to the response and
   a partial-results notice in the UI, so if this recurs it's immediately
   diagnosable which of the two paths (or something else) caused it.
   **Not yet confirmed against a real recurrence** — logic-verified via
   type-check/build only, not exercised against live Gemini calls.

**Upload hardening — `api/upload/route.ts`, `GenerateForm.tsx`:** real
magic-byte content sniffing instead of trusting the client's `file.type`
(catches HEIC and mislabeled files), explicit HEIC/HEIF rejection with a
clear message, a real enforced 4MB size limit client+server (Vercel's
serverless body limit is ~4.5MB and isn't configurable — this used to be
unenforced despite the UI advertising "max 10MB," risking a silent
platform-level 413), and server error messages now surface in the UI
instead of generic "Upload failed" text.

**Brand grounding — `generate/route.ts`, `BrandEditModal.tsx`:**
`brand.description` (fetched but silently dropped before) now reaches
the Claude strategy prompt; `brand.personality` (fully wired
server-side, `PATCH /api/brands/[id]` already accepted it, but no UI
ever set it) now has a working toggle in the brand edit modal, capped at
`MAX_PERSONALITY` per `data/brand-options.ts`. Verified live in a
browser: toggles, caps at 2, saves, and persists correctly.

**Do:** review the diff across
`src/lib/auth.ts`, `src/app/api/campaigns/route.ts`,
`src/app/api/brands/route.ts`, `src/app/api/brands/[id]/route.ts`,
`src/app/api/campaigns/[id]/generate/route.ts`,
`src/app/api/upload/route.ts`, `src/components/GenerateForm.tsx`,
`src/components/BrandEditModal.tsx` — then commit and push to
`feat/product-pivot` so it actually reaches the testers who are blocked
on it.

---

## Task 1 — Ship the pending opus-5 fix (do this first)

`claude-opus-4-1` retired on 2026-08-05. It's already 7+ days past that
date, and the fix for it exists **only as uncommitted, unpushed changes**
in the working tree — nothing has landed since the last commit
(`6fe9522`, 2026-07-29). Until this ships, production may be running on a
retired model or silently degraded.

The fix itself looks correct already, it just needs to go out:

- `src/app/api/campaigns/[id]/generate/route.ts` — both the caption and
  hashtag calls are switched from `model: 'claude-opus-4-1'` to
  `model: 'claude-opus-5'`, with `thinking: { type: 'disabled' }` and
  `output_config: { effort: 'low' }` added. (Opus 5 thinks by default;
  the route's `max_tokens: 100` budget is too tight to share with
  thinking tokens, hence disabling it.)
- `CLAUDE.md` and `ONBOARDING.md` — matching doc updates for the model
  change.

**Do:**

1. Review the diff (`git diff -- src/app/api/campaigns/[id]/generate/route.ts CLAUDE.md ONBOARDING.md`).
2. Commit and push to `feat/product-pivot`.
3. Confirm it deploys (Vercel auto-deploys on push to this branch).
4. Verify in production: run one real generation on an existing test
   account (Ember / Siam Kitchen / Sunnyside Cafe, password
   `password123`) and confirm captions/hashtags come back without error.

---

## Task 2 — Sync your repo copy

You're currently working from your own separate copy of the repo, and
nothing from you has synced back to `feat/product-pivot` yet. `HANDOFF.md`
already documents a past incident where `main` and `origin/main` silently
diverged and had to be reconciled after the fact — don't let that happen
again between your copy and this one.

**Do:** get your work onto a shared branch/PR against `feat/product-pivot`
this week, even if it's not finished — so it's visible and doesn't
silently drift out of sync.

---

## Task 3 — RLS / data-isolation assessment

**What's actually happening:** every database call in this app uses
Supabase's **service-role key** (`src/lib/supabase/server.ts`), which
bypasses Row Level Security entirely. RLS policies exist but are written
against `auth.uid()`, which assumes Supabase's own Auth system — this app
uses a custom cookie-based session instead
(`src/lib/auth.ts::getCurrentUserId()`), so those policies likely don't
apply to anything in practice.

**Why it matters:** the _only_ thing currently preventing one customer's
data (uploaded photos, brand info, campaigns) from being visible to
another customer is the app code correctly filtering "only rows for this
session's user/brand" in every single API route. There's no independent,
database-level backstop catching a mistake if one route ever gets that
filtering wrong. Low real risk right now (3 dummy test accounts, trusted
internal testers) — real risk once September brings actual restaurant
customers and their real data.

**Do:** audit whether every API route (`src/app/api/**/route.ts`) that
reads or writes `campaigns`, `brands`, `assets`, etc. correctly scopes its
query to the current session's user/brand. Come back with:

- an assessment of actual exposure (is filtering airtight today, or are
  there gaps?)
- a proposed timeline/approach for closing any gaps (audit-only fix in app
  code vs. getting RLS working under the custom session model)

This isn't pre-prioritized — your assessment of real exposure should
drive whether it's urgent or can wait.

---

## Task 4 — Confirm Gemini output resolution

`ONBOARDING.md`'s cost model assumes Gemini returns images at roughly the
1024×1024 tier, but the actual REST call
(`generateImageWithGemini` in `route.ts`) only sets
`generationConfig: { response_modalities: ['IMAGE'] }` — no explicit size
parameter. Confirm what resolution is actually coming back (add an
explicit size param if needed, or confirm the default matches the
assumption). This feeds directly into the September cost-model work, so
worth nailing down now rather than later.

---

## Task 5 — Image distinctness (watch, don't fix blind)

The 4 shots per campaign are already prompted to be "DISTINCT and
VISUALLY STRIKING" with explicit anti-repetition instructions per shot,
but this has never been verified against real output — no test/eval
exists. Once the internal testing cycle starts, watch for tester feedback
specifically on this before deciding whether the prompts need another
tuning pass. Don't preemptively rework it without that signal.

---

## Task 6 — Wireframe / UI-UX refinement (later, not now)

This is explicitly meant to happen _based on_ real internal-testing
feedback, so hold off starting it until the 2-week tester feedback window
closes (~2026-08-27/28). Flagging it here now just so it's not forgotten,
not as something to pick up yet.

---

## Backlog — low priority, don't let it compete for time

- `docs/architecture.md` / `docs/project-spec.md` rewrites (currently
  still describe the pre-pivot Clerk/fal.ai/Creatomate stack) — real
  cleanup, but pure documentation debt. Doesn't block testing, the fix
  cycle, or the September push. Pick up only if there's spare time after
  Tasks 1–5.
