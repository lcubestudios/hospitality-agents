# Hospitality Agents

An invite-only dashboard for F&B operators (restaurants, bars, cafes, hotels with dining). Operators pick AI agents that automate operational tasks.

**MVP ships one agent — Campaign Creator.** It takes a brand profile and uploaded product photos and returns a downloadable campaign package: enhanced images, short motion videos, captions, and hashtags. No social publishing integration.

---

## Prerequisites

- Node 22 (pin via `.nvmrc`)
- pnpm 10 (`corepack enable && corepack prepare pnpm@10 --activate`)

## Setup

```bash
git clone git@github-personal-git:LukasAVB/hospitality-agents.git
cd hospitality-agents
pnpm install
cp .env.example .env.local   # fill in values (get from a team member via secure channel)
pnpm dev                     # → http://localhost:3000
```

## Commands

```bash
pnpm dev          # Next.js dev server on :3000
pnpm build        # Production build
pnpm start        # Production server on :3000
pnpm lint         # ESLint
pnpm type-check   # tsc --noEmit
pnpm format       # Prettier write
pnpm format:check # Prettier check (CI)
```

## Docs

| File                     | What it contains                                          |
| ------------------------ | --------------------------------------------------------- |
| `docs/project-spec.md`   | Product requirements, user flows, constraints             |
| `docs/architecture.md`   | System design, DB schema, API surface, cost model         |
| `docs/project-status.md` | Current build phase, task list, decisions log             |
| `CLAUDE.md`              | Project rules and conventions for AI-assisted development |
| `ONBOARDING.md`          | Full contributor onboarding guide                         |

## Stack

Next.js 16.2 (App Router) · React 19 · TypeScript · Tailwind v4 · shadcn/ui · Clerk · Supabase · Anthropic Claude API · fal.ai · Creatomate · Vercel
