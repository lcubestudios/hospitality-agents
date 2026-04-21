# Hospitality Agents — MVP Brainstorm

## Project Goal

Build a hospitality agent dashboard that lets operators select and deploy AI agents to automate tasks and workflows specific to the hospitality industry — starting with Food & Beverage (F&B).

The first agent: **Campaign Creator** — takes brand inputs and generates a complete, visually consistent campaign (images + short videos + copy) ready to post.

---

## Decided

| Question | Decision |
|----------|----------|
| First clients | Warm leads in the industry — not confirmed yet, but likely to onboard if packaged well. Build to impress. |
| Publishing | Skipped. Output is downloadable assets the client posts themselves. |
| Access model | Invite-only → waitlist → public. No payment infra needed for MVP. |
| Agent #1 scope | Full campaign generation: consistent images + short videos + captions/copy, driven by brand profile + image inputs. |
| Image approach | MVP: enhance/uplevel client's own product photos into polished, on-brand assets. Fast follow: full AI generation option (with product reference images always required for food & drinks). |
| Language | English only at launch. |
| Tech stack | TBD — deferred to build phase. |

---

## Agent #1: Campaign Creator

### Inputs (what the client provides)

| Input | Purpose |
|-------|---------|
| Brand profile | Name, cuisine type, tone, language preference, color palette |
| Logo / brand assets | Uploaded once, referenced in every generation |
| Reference images | 1–3 photos of dishes, venue, or vibe to anchor visual style |
| Campaign brief | Topic (e.g. "weekend brunch launch"), target platform, number of posts |

### Outputs (what the agent generates)

| Output | Detail |
|--------|--------|
| Images | 3–6 on-brand generated or composited images per campaign |
| Short videos | 3–6 short clips (slideshow/motion style) with text overlays, transitions, music suggestion |
| Captions | Per-post copy in client's language and brand voice |
| Hashtag sets | Platform-appropriate hashtag packs per post |
| Campaign brief summary | One-pager of the full campaign for review before download |

### Consistency mechanism (the hard part)

All assets in a campaign share: color palette, typography style, layout template, and visual mood — derived from the brand profile + reference images. This is what separates it from one-off generation.

### Image generation — two phases

**MVP:** Client uploads their own product photos (dishes, drinks, venue). The agent enhances and reframes them into polished, on-brand visuals — consistent style, overlays, layout. Real product always anchors the output.

**Fast follow:** Full AI generation option, but still requires product reference images for food & drinks (you can't fabricate a specific dish — it has to look like what they actually serve).

---

## Milestone Breakdown

### Milestone 0 — Foundation (Week 1)
- [ ] Next.js + Tailwind + Supabase scaffolded
- [ ] Invite-code auth
- [ ] Dashboard shell with agent card grid
- [ ] "Coming soon" stubs for future agents

### Milestone 1 — Brand Profile (Week 1–2)
- [ ] Onboarding: name, cuisine, language, tone, platforms, color palette
- [ ] Logo + reference image upload (stored in Supabase)
- [ ] Brand profile edit page
- [ ] Brand profile feeds into all generation prompts

### Milestone 2 — Copy & Caption Generation (Week 2)
- [ ] Campaign brief input form
- [ ] Claude generates: captions (per language), hooks, hashtag sets
- [ ] 2–3 variants per post, edit inline
- [ ] Campaign summary view

### Milestone 3 — Image Generation (Week 3)
- [ ] Flux/DALL-E integration for on-brand image generation
- [ ] Reference image + brand style prompt chaining
- [ ] 3–6 images per campaign, regenerate individual frames
- [ ] Download as ZIP or per-image

### Milestone 4 — Video Assembly (Week 3–4)
- [ ] Remotion/Creatomate: stitch images into short motion clips
- [ ] Text overlays from generated captions
- [ ] Transition style options (minimal, energetic)
- [ ] Music suggestion (BPM/mood tag, not actual audio for MVP)
- [ ] Export as MP4

### Milestone 5 — Pitch Polish (Week 4–5)
- [ ] Campaign history + remix
- [ ] Demo mode with seed brand + pre-generated campaign
- [ ] Mobile-responsive
- [ ] Waitlist landing page

---

## Investor / Client Pitch Angles

**Pain addressed:** F&B operators need consistent, professional social content but have no creative team. Agencies are expensive. DIY tools (Canva, CapCut) require skill and time.

**Value prop:** Give us your brand and a brief. We give you a full campaign — images, videos, captions — in your language, in your style, ready to post.

**Why this wins:** Consistency across a campaign is what makes a brand look professional. One-off posts are easy; a cohesive campaign is what operators actually need and can't produce themselves.

**Expansion story:** Campaign Creator is the wedge. Future agents handle review responses, reservation management, staff comms — all within the same dashboard.

**Moat:** Brand profiles trained per property, multi-language support, hospitality-specific prompting, multi-location rollup.

---

## Agent Roadmap (Post-MVP)

| Agent | What it automates |
|-------|------------------|
| Review Response | Auto-draft replies to Google/Yelp reviews |
| Reservation Assist | Handles inquiry emails/DMs, confirms bookings |
| Menu Sync | Pushes menu updates to Google, website, delivery apps |
| Staff Comms | Shift reminders, policy Q&A via WhatsApp/SMS |
| Promo Planner | Generates weekly specials + promotional calendar |

---

## Open Questions

- Pricing post-launch: per campaign, per seat, or per location?
- Will first clients need multi-location support at launch or is single-venue enough?
- What does "demo mode" need to show to convert an investor — a live generation flow or a pre-rendered campaign example?
