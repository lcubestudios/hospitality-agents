# Project Spec — Hospitality Agents

## Product Requirements

### Who it's for

F&B operators (restaurants, bars, cafes, hotels with dining) who need consistent, professional social content but have no dedicated marketing team or creative staff. Initial users are warm leads — owner-operators from the team's personal network.

### Problems it solves

| Problem | How painful |
|---------|------------|
| Creating consistent social content takes 3–5 hrs/week | High — recurring, every week |
| DIY tools (Canva, CapCut) require skill and time | Medium — operators aren't designers |
| Agencies are expensive and slow | High — not accessible for most independents |
| Brand looks inconsistent post-to-post | Medium — kills trust and recognition |
| Generating campaigns around events/specials is ad hoc | High — missed revenue opportunities |

### What it does

A web dashboard where F&B operators select and run AI agents to automate operational tasks. MVP ships one agent.

**Agent #1: Campaign Creator**

The operator provides:
- Their brand profile (name, tone, cuisine type, color palette)
- A campaign brief (topic, e.g. "weekend brunch launch")
- Reference photos of their actual product (dishes, drinks, venue)

The agent outputs a complete, visually consistent campaign:
- **Images** — enhanced/upleveled versions of client photos, styled to brand
- **Short videos** — motion clips built from images with text overlays and transitions
- **Captions** — per-post copy in brand voice and language
- **Hashtags** — platform-appropriate sets per post

Everything is downloadable. No publishing integration in MVP — operators post themselves.

### Access model

Invite-only at launch (no self-serve sign-up). Waitlist page added once early users are onboarded. Public access in a later phase.

---

## Agent Roadmap (post-MVP, for pitch narrative)

| Agent | What it automates |
|-------|------------------|
| Review Response | Auto-draft replies to Google/Yelp reviews |
| Reservation Assist | Handles inquiry DMs/emails, confirms bookings |
| Menu Sync | Pushes menu updates to Google, website, delivery apps |
| Staff Comms | Shift reminders, policy Q&A |
| Promo Planner | Weekly specials + promotional calendar |

---

## Technical Requirements

> Tech stack TBD — to be decided after architecture review.

### System overview

The product is a web application with the following top-level concerns:

1. **Auth** — invite-code gated access; no public sign-up at launch
2. **Brand profiles** — per-operator config stored and versioned; drives all generation
3. **Asset ingestion** — operators upload reference photos; stored and associated with their brand profile
4. **Campaign generation pipeline** — orchestrates 3 generation steps (image enhancement → video assembly → copy generation) into a single campaign output
5. **Output delivery** — generated assets downloadable as ZIP or individually
6. **Dashboard** — agent card grid; one active agent, rest shown as "Coming soon"

### Key user flows

**Onboarding (first use)**
1. Accept invite → create account
2. Set up brand profile (name, cuisine, tone, color palette, logo upload)
3. Land on dashboard

**Create a campaign**
1. Open Campaign Creator agent
2. Upload 1–3 reference product photos
3. Enter campaign brief (topic, platform, number of posts)
4. Agent generates campaign (images + videos + copy)
5. Review, edit, download

**Return use**
- Dashboard → Campaign Creator → new brief (brand profile pre-loaded)
- Access campaign history, remix or duplicate past campaigns

### Image generation — two phases

- **MVP:** Enhance and restyle client's uploaded product photos into on-brand assets. Real product photos always required.
- **Fast follow:** Full AI generation option, still anchored by product reference images.

### Key constraints

- English only at launch
- No social platform API integrations in MVP
- Single venue per account for MVP (architecture should support multi-location later)
- No payment infrastructure needed for MVP (invite-only)

---

## Open Questions (to resolve before or during build)

- Pricing model post-launch: per campaign, per seat, or per location?
- What does demo mode need to show to convert an investor — live generation or pre-rendered example?
- Multi-location: stub out the data model now, or add later?
