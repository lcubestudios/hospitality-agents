# Project Status — Hospitality Agents

## Current Phase: Plan (PSB Framework)

### PSB Progress

| Step | Status |
|------|--------|
| (P) Brainstorm | Done — `docs/brainstorm.md` |
| (P) 3 key questions | Done — answered in session |
| (P) Project spec | Done — `docs/project-spec.md` |
| (P) Architecture / tech stack research | Done — `docs/research_report_architecture.md` |
| (P) Architecture review with user | Done — stack confirmed as recommended |
| (P) Architecture doc | Done — `docs/architecture.md` |
| (S) GitHub repo | **Next up** |
| (S) `.env.example` | Pending |
| (S) `CLAUDE.md` | Pending |
| (S) Automated docs | Pending |
| (S) Plugins | Pending |
| (S) MCP servers | Pending |
| (S) Slash commands + subagents | Pending |
| (B) Build | Not started |

---

## What's been decided

| Decision | Choice |
|----------|--------|
| First agent | Campaign Creator (images + videos + captions) |
| Publishing integrations | Skipped for MVP — output is downloadable assets |
| Image approach | MVP: enhance client's uploaded product photos. Fast follow: full AI generation (product refs always required) |
| Video scope | Short motion clips from images + text overlays + transitions |
| Access model | Invite-only → waitlist → public |
| Language | English only at launch |
| Stack | Next.js 15 + Clerk + Supabase + Claude API + fal.ai + Creatomate + Vercel — **confirmed** |

---

## Next session: pick up here

Plan phase is complete. Moving into **Setup**:

1. **GitHub repo** — init Next.js 15 project, push to new repo
2. **`.env.example`** — all keys documented (see architecture.md for full list)
3. **`CLAUDE.md`** — project-level rules that extend the global baseline
4. **Automated docs** — changelog via semantic-release, commit hooks via husky
5. **Plugins, MCP servers, slash commands** — configure for this project's stack

---

## Open questions (non-blocking)

- Pricing model post-launch: per campaign, per seat, or per location?
- Demo mode: live generation flow or pre-rendered campaign for investor pitches?
- Multi-location: stub data model now or add later?
