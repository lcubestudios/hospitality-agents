# Tech Stack Research Report — Hospitality Agents

> Researched April 2026. Covers the Campaign Creator MVP: an invite-only dashboard for F&B operators that ingests brand assets and product photos, then outputs enhanced images, short motion clips, and copy. No social publishing integrations in scope.

---

## Summary of Recommendations

| Layer | Recommended | Runner-up | Why |
|---|---|---|---|
| Frontend framework | Next.js (App Router) | Vite + React SPA | SSR optional but free; best ecosystem for the stack; investor demos want fast initial loads |
| Auth | Clerk | Supabase Auth | Native invite-only mode, prebuilt UI, 10 min integration; keep Supabase Auth as fallback if already using Supabase everywhere |
| Database | Supabase (Postgres) | Neon | Auth + DB + Storage in one bill and one SDK; RLS baked in; Neon had notable 2025 outages |
| File storage | Supabase Storage | Cloudflare R2 | Zero extra integration if already on Supabase; upgrade to R2 later if egress costs hurt |
| LLM / copy | Anthropic Claude API | OpenAI GPT-4o | Better long-context adherence for brand voice; large context window ingests full brand guide in one call |
| Image AI | fal.ai (Flux) | Replicate | 30-50% cheaper than Replicate, fastest inference, TypeScript SDK, image-to-image for photo enhancement |
| Video assembly | Creatomate | Shotstack | Cloud-rendered, no infrastructure, template-driven, 15 s render times, responsive to aspect ratio |
| Deployment | Vercel | Fly.io | Zero-config Next.js, preview URLs for investor demos, acceptable cost at MVP scale |

---

## 1. Frontend Framework

### Options compared

- **Next.js 15 (App Router)** — React meta-framework with SSR, SSG, RSC, built-in routing, and tight Vercel integration. 900k+ live sites, dominant npm share in 2025-2026.
- **Remix** — Full-stack React with a strong progressive-enhancement story and web-standards focus. Backed by Shopify, uses Vite under the hood as of v2.
- **Vite + React SPA** — Fastest dev server (sub-second HMR), zero-config TypeScript, ideal for pure client-side dashboards behind login.

### Evaluation against project constraints

| Criterion | Next.js | Remix | Vite SPA |
|---|---|---|---|
| Setup speed | High — `create-next-app` | Medium | High — `npm create vite` |
| Works behind login only | Yes | Yes | Yes — SPA is ideal for auth-gated apps |
| File uploads / API routes | Built-in Route Handlers | Built-in Actions | Needs separate backend |
| Investor demo polish | High — fast initial load via SSR | Medium | Lower — blank screen until JS loads |
| Ecosystem / hiring | Largest | Smaller | Largest (plain React) |
| Vercel integration | Native first-class | Good | Good (static) |
| App Router complexity | Medium learning curve | Lower | None |

The critical differentiator for this project is that the dashboard sits entirely behind auth — no public marketing pages to SEO-index. This makes Vite SPA a real contender for pure DX. However, the investor demo argument tips the scales: Next.js gives a perceived-performance advantage (shell HTML arrives before JS), and its App Router enables streaming partial renders during AI generation calls — which matters when video rendering takes 10-30 s. Remix is capable but the community is smaller, making it harder to find answers quickly for a ship-fast team.

### Recommendation

**Next.js 15 with App Router.** Use the App Router streaming model to show incremental progress as AI tasks complete. The Vite SPA is a legitimate second choice if the team wants to keep things simpler — in that case, pair it with an Express or Hono API server on the same Vercel project. But Next.js eliminates the need for a separate API layer entirely.

---

## 2. Auth

### Options compared

- **Clerk** — Dedicated auth platform. Prebuilt React components (SignIn, UserButton, OrganizationSwitcher). Native Next.js App Router middleware. Invite-only and allowlist modes built in.
- **Supabase Auth** — Auth module bundled with Supabase. Row Level Security ties auth identity directly to database policies. Simpler if you are already on Supabase.
- **NextAuth (Auth.js v5)** — Open-source, self-hosted or adapter-based. 80+ OAuth providers, maximum flexibility, no vendor lock-in.

### Evaluation against project constraints

| Criterion | Clerk | Supabase Auth | NextAuth |
|---|---|---|---|
| Invite-only mode | First-class — "Restricted" mode + invitation API from dashboard | Partial — send invite links but limited to org email domains in default config | DIY — implement via magic links or custom flows |
| Setup time | 1-3 hours (component drop-in) | 1-2 days (SSR package + RLS setup) | 2-5 days (adapters, session config) |
| Prebuilt UI | Yes — polished, matches Tailwind tokens | Minimal | None |
| Invite management dashboard | Yes | No | No |
| Composability with Supabase DB | Good — use Clerk JWT in Supabase RLS | Native (same product) | Requires custom JWT setup |
| Free tier | 10k MAU | 50k MAU | Free (self-host) |
| Paid | $0.02/MAU | $0.00325/MAU | None (hosting cost only) |

For an invite-only product with a small known user list (<100 users for MVP), cost difference is irrelevant — everyone is under the free tier. Clerk's invite API is exactly the workflow needed: send invite → user signs up via invite link only → dashboard shows invited/accepted status. With Supabase Auth you'd need to build that flow yourself.

The one tradeoff: if using Supabase for DB, you need to pass Clerk's JWT to Supabase RLS policies. This is a documented pattern (about 30 min of config) and not a blocker.

### Recommendation

**Clerk.** The invite-only mode is native, the UI components are production-quality and look polished for demos, and integration with Next.js App Router is first-class. If the team later decides to collapse onto a pure Supabase stack, switching to Supabase Auth is a one-sprint migration — not a rewrite. For MVP speed, Clerk wins.

---

## 3. Database

### Options compared

- **Supabase (Postgres)** — Managed Postgres with built-in auth, storage, realtime, edge functions, and RLS. The "Firebase for Postgres" positioning is accurate.
- **Neon** — Serverless Postgres with database branching, scale-to-zero, and a Vercel Marketplace integration. Acquired by Databricks in May 2025.
- **PlanetScale** — Managed MySQL (Vitess) built for horizontal scale. Removed free tier in April 2024; entry price is now $39/month.
- **Firebase (Firestore)** — NoSQL document database. Removed Cloud Storage from the free tier in February 2026. No longer the default recommendation for web apps.

### Evaluation against project constraints

| Criterion | Supabase | Neon | PlanetScale | Firebase |
|---|---|---|---|---|
| Database type | Postgres | Postgres | MySQL (Vitess) | NoSQL |
| Free tier | 500 MB + auth + storage | 0.5 GB, up to 100 projects | None ($39/mo min) | Spark plan (degraded 2026) |
| Reliability | High, multi-region | Multiple outages in 2025 (5.5 hr incident in May) | High | High |
| Bundles auth + storage | Yes | No | No | Partially (degraded) |
| RLS / security model | Native at DB layer | Manual (PostgRESS policies) | Manual | Security rules (different paradigm) |
| Schema / SQL | Full Postgres SQL | Full Postgres SQL | MySQL — no Postgres extensions | N/A (NoSQL) |
| Vercel integration | Native | Native (Marketplace) | Native | Yes |

PlanetScale and Firebase are eliminated. PlanetScale's free tier removal in 2024 makes it uneconomical for MVP, and Firebase's free tier erosion in early 2026 removes its cost advantage. Neon's branching story is genuinely appealing for staging environments, but the 2025 outage history (particularly the 5.5-hour US-East-1 incident caused by Kubernetes IP exhaustion) introduces reliability risk that is unacceptable for a product being demo'd to investors.

Supabase is the clear winner: it bundles the database, auth (backup if Clerk is swapped), storage, and edge functions into one platform with one dashboard, one billing account, and one SDK. This is a meaningful complexity reduction for a small team.

### Recommendation

**Supabase (Postgres).** Start on the free tier, graduate to Pro ($25/month) when you have real users. Use RLS policies on the `campaigns`, `assets`, and `brands` tables from day one — it takes 30 minutes to set up and prevents entire classes of data-leak bugs without application-layer code.

---

## 4. File Storage

### Options compared

- **Supabase Storage** — S3-compatible object storage bundled with Supabase. Access policies inherit Supabase Auth/RLS, so a user can only read their own uploads. $5/month per 250 GB on the Pro plan.
- **Cloudflare R2** — S3-compatible object storage with zero egress fees. ~$0.015/GB/month storage. No bandwidth charge to deliver to end users.
- **AWS S3** — The standard. $0.023/GB/month storage, $0.09/GB egress. Most ecosystem tooling targets S3 API compatibility (which R2 and Supabase Storage both speak).

### Evaluation against project constraints

The project stores: uploaded product photos (typically 2-5 MB each), AI-enhanced output images (3-10 MB), short video clips (15-30 s, 10-50 MB per clip), and downloadable campaign ZIP archives. For an MVP with 50-100 users, monthly storage stays well under 50 GB; egress volume is moderate (each user downloads their campaign outputs once).

| Criterion | Supabase Storage | Cloudflare R2 | AWS S3 |
|---|---|---|---|
| Zero extra integration | Yes (same Supabase client) | No (separate SDK) | No |
| Auth-integrated access policies | Native via RLS | Manual (signed URLs) | Manual (IAM / signed URLs) |
| Egress pricing | 1 TB included in $5/mo Pro | Zero egress | $0.09/GB — expensive at scale |
| Setup time | Minutes | 1-2 hours | 2-4 hours (IAM policies) |
| S3-compatible API | Yes | Yes | Native |
| Migration path | Easy — S3-compatible | Easy | N/A |

At MVP scale the egress advantage of R2 over Supabase Storage is negligible in absolute dollars. The integration advantage of Supabase Storage is significant: you get access policies that inherit from your auth identity for free. With R2 you would implement signed URL generation manually.

### Recommendation

**Supabase Storage for MVP.** The zero-configuration integration with Supabase Auth is the deciding factor. When campaign asset volumes grow (post-MVP, with dozens of venues running daily campaigns), evaluate migrating to Cloudflare R2 for egress savings — the S3-compatible API means migration is a configuration change, not a code rewrite.

---

## 5. LLM / Copy Generation

### Options compared

- **Anthropic Claude API (claude-sonnet-4-6 or claude-opus-4)** — Strong creative writing, high instruction-following fidelity, 200k token context window via API.
- **OpenAI GPT-4o** — Fast, multimodal (vision + text), 128k context window. Well-documented, massive ecosystem.

### Evaluation against project constraints

The Campaign Creator requires: reading a brand voice guide, processing product descriptions, then generating Instagram captions, hashtag sets, and a campaign brief that stays on-brand across multiple output formats. The quality of adherence to a supplied style guide is the primary evaluation axis.

| Criterion | Claude API | GPT-4o |
|---|---|---|
| Instruction adherence / brand voice | Higher — consistently applies tone, avoids jargon when told to, maintains persona across long outputs | Good, but more variable on multi-constraint prompts |
| Context window | 200k tokens (full brand guide + product catalog in one call) | 128k tokens |
| Creative writing quality | Marginally better for marketing copy per 2025-2026 independent comparisons | Strong, especially for structured formats |
| Multimodal (image input) | Yes (vision) | Yes (vision) |
| Pricing | Sonnet-tier: ~$3/$15 per M tokens in/out | GPT-4o: ~$2.50/$10 per M tokens in/out |
| SDK / TypeScript support | Official `@anthropic-ai/sdk` | Official `openai` npm package |
| Structured output / tool use | Strong (tool use + JSON mode) | Strong (JSON mode, function calling) |

The 200k context window is a practical advantage: you can send the full brand guidelines document, a competitor analysis excerpt, all product descriptions for the campaign, and previous captions in a single call with no chunking. GPT-4o's 128k is sufficient for most cases but tighter.

Multiple 2025-2026 practitioner reviews describe Claude as producing smoother, more human-sounding marketing copy — the "Claude writes for the customer, GPT writes for the brief" characterization appears consistently. For a restaurant operator audience, conversational copy outperforms structured-sounding copy.

GPT-4o's image-generation feature (GPT Image 1.5) is a genuine advantage if you want a single API for both copy and image generation. However, given that we're recommending a dedicated image AI layer (fal.ai), this bundling benefit is not needed.

### Recommendation

**Anthropic Claude API.** Use `claude-sonnet-4-6` for caption/hashtag generation (fast, cheap) and optionally `claude-opus-4` for campaign brief generation where quality matters most. Enable prompt caching on the system prompt + brand guide to reduce cost on repeated calls from the same account. Keep GPT-4o as a fallback model to swap in if Anthropic has an outage.

---

## 6. Image Enhancement / Generation

### Options compared

- **fal.ai (Flux)** — AI inference aggregator with 985+ endpoints. Hosts Black Forest Labs' Flux models (Flux 1.1 Pro, Flux Dev image-to-image, Flux Schnell). Custom CUDA kernel optimizations give 2-3x faster generation than standard GPU inference.
- **Replicate** — AI model marketplace with 50,000+ community models. Per-second GPU billing. Better documentation and community coverage for niche models.
- **OpenAI DALL-E 3 / GPT Image 1.5** — OpenAI's latest image generation (DALL-E 3 replaced by GPT Image 1.5 in 2026). Strong prompt adherence. Bundled with the OpenAI API key.
- **Cloudinary AI** — Image transformation and enhancement CDN. Strong for non-generative operations (resize, crop, background removal, upscale). Generative features are secondary to its transformation pipeline.

### Evaluation against project constraints

The primary use case is photo enhancement: a restaurant operator uploads a phone photo of a dish — you need to improve lighting, clean the background, possibly upscale, and produce a social-media-ready hero image. The secondary use case (fast follow post-MVP) is full generation from a text description.

| Criterion | fal.ai | Replicate | GPT Image 1.5 | Cloudinary AI |
|---|---|---|---|---|
| Image-to-image (photo enhancement) | Yes — Flux Dev i2i, Topaz upscaler, background removal | Yes — any Replicate model | Yes — GPT Image inpainting | Yes — but transformation-focused, not generative |
| Text-to-image generation | Yes — Flux 1.1 Pro, Schnell | Yes — Flux, SDXL, anything | Yes — strong prompt adherence | Limited |
| Latency | Under 3 s (1024×1024), Flux Schnell under 1 s | 5-15 s typical | 5-10 s | Sub-second (transforms), 5-10 s (generative) |
| Pricing | $0.03/image (Flux Dev i2i), $0.05 (Flux 1.1 Pro) | Per GPU second — less predictable | $0.009-$0.034/image (GPT Image) | Per transformation credit — adds up |
| TypeScript SDK | Yes — strong official SDK | Yes | Yes (via openai SDK) | Yes |
| Setup complexity | Low — single API key | Low — single API key | Low — same key as GPT-4o | Medium — CDN config + signed URLs |
| Food photo quality | Flux models produce photorealistic food imagery | Same (same models available) | Good, slightly over-processed look | Good for background removal |
| Model variety | 985 curated endpoints | 50k+ community models | Limited (1 model) | Limited |

Cloudinary's strength is its CDN and non-generative transformations (resize, format conversion, background removal). It is not the right tool for AI enhancement of food photos. If you need background removal specifically, Cloudinary's Remove.bg integration is excellent — but fal.ai also provides this via dedicated models.

GPT Image 1.5 produces good results but the pricing is per-image flat-rate, making it 30-50% more expensive than fal.ai's per-megapixel Flux pricing at typical image sizes. More importantly, it locks image generation to OpenAI — fal.ai gives access to a wider model palette (including specialized food photography LoRAs) as needs evolve.

Replicate is a strong alternative and has better community documentation, but fal.ai's consistent pricing-per-output (not per-GPU-second) makes cost projection easier, and its inference speed is materially faster on the same Flux models.

### Recommendation

**fal.ai with Flux models.** Use `fal-ai/flux/dev/image-to-image` for photo enhancement (the primary MVP use case). Use `fal-ai/flux-pro/v1.1` for full text-to-image generation in the fast-follow phase. Use `fal-ai/topaz-upscaler` for final resolution boost before download. The TypeScript SDK is clean, the pricing is predictable, and the latency is best-in-class. Sign up with Replicate as a fallback — the APIs are similar enough to swap in under an hour.

---

## 7. Video Assembly

### Options compared

- **Remotion** — React-based video framework. You write React components that render to video frames. Render on-device (Node.js) or via Lambda. Free/open-source framework; company license required for teams of 4+.
- **Creatomate** — Cloud video editing API with a visual template editor. JSON-driven, template-based rendering. Most videos render in under 15 seconds. Starts at $54/month.
- **Shotstack** — Cloud video editing API with a declarative JSON editing structure. Credit-based pricing per rendered minute. Starts at $0.20/rendered-minute on subscription ($49/month for 200 credits).

### Evaluation against project constraints

The Campaign Creator needs to turn enhanced product images + text overlays (captions, brand name, hashtags) into 15-30 second short-form clips suitable for Instagram Reels / TikTok. The MVP does not need a complex visual editor — it needs reliable, fast, API-driven assembly from a set of pre-designed templates.

| Criterion | Remotion | Creatomate | Shotstack |
|---|---|---|---|
| Infrastructure required | Yes — Lambda or self-hosted Node | None — cloud-rendered | None — cloud-rendered |
| Template design | Code (React) | Visual editor + JSON API | JSON API (no visual editor) |
| Render time | 30-120 s (Lambda) | Under 15 s | 30-90 s typical |
| Team license cost | Free (<4 people) / $100/month (4+) | $54/month (2000 credits) | $49/month (200 credits, ~$0.20/min) |
| Aspect ratio flexibility | Full control (code) | Responsive templates (one template, multiple ratios) | Fixed per template |
| Animation quality | Excellent — full React ecosystem | Excellent — keyframes, shadows, filters, 3D | Basic — limited motion effects |
| TypeScript/JS API | Yes | Yes (REST + Node SDK) | Yes (REST + Node SDK) |
| Setup time | 1-2 days (Lambda config) | 2-4 hours | 2-4 hours |
| Maintenance overhead | Medium (Lambda infra) | Low | Low |

Remotion is the most powerful option and gives complete creative control — but it requires managing Lambda infrastructure, dealing with cold start issues, and paying AWS Lambda costs on top of any licensing. For a small team shipping fast, the operational overhead is not justified at MVP stage. It also requires React expertise for any template changes; a designer cannot iterate on templates without an engineer.

Shotstack's per-minute credit model makes cost opaque: a 30-second clip costs ~0.1 credits at $0.20/credit on subscription, but the starter plan (200 credits) only covers ~33 minutes of rendered video per month — potentially tight if generating previews during development. Shotstack's motion effects are also described consistently as basic compared to Creatomate.

Creatomate is the right level of abstraction: you design templates once in the visual editor, then call the API with dynamic values (image URLs, caption text, brand colors) to generate each video. The responsive template system means one template covers 1:1, 4:5, and 9:16 aspect ratios without duplicate maintenance. At $54/month you get 2,000 credits — enough for 550+ 15-second videos at 720p, well beyond MVP usage.

### Recommendation

**Creatomate.** Design 2-3 base templates in the visual editor (one per output format: square, portrait, story), then drive generation entirely via the REST API. The 15-second render time enables a real-time progress experience in the dashboard. No Lambda, no infrastructure, no AWS account required for video. When post-MVP usage volume grows to where Creatomate's per-credit pricing becomes expensive, consider migrating to Remotion with Lambda at that point — the creative templates will inform the React component design.

---

## 8. Deployment

### Options compared

- **Vercel** — The native home for Next.js. Preview deployments, edge network, streaming SSR, zero-config. Pro plan at $20/month/seat.
- **Fly.io** — Container-based global edge deployment. VMs with fast boot times, persistent compute, WebSockets, background workers. Pay-per-resource.
- **Cloudflare Pages + Workers** — Edge-first static + serverless. Unlimited bandwidth on free tier. Next.js support via `@cloudflare/next-on-pages`, though some App Router features lag.

### Evaluation against project constraints

| Criterion | Vercel | Fly.io | Cloudflare Pages |
|---|---|---|---|
| Next.js App Router support | Full, first-class | Good (Docker) | Partial — new features lag |
| Preview deployments | Yes — automatic per PR | Manual | Yes |
| Setup time | Minutes | 30-60 min (Dockerfile) | 30-60 min (adapter config) |
| Background workers | No (function timeout limits) | Yes — persistent VMs | Yes — Workers (duration limits) |
| Investor demo experience | Excellent — preview URLs | Good | Good |
| Cold start | None (serverless edge) | Minimal (fast VMs) | None (edge) |
| Cost at MVP scale | ~$20/month (Pro, 1 seat) | ~$5-20/month (light usage) | Free-$20/month |
| Cost at scale | Can spike with overages | Predictable (VM-based) | Predictable |
| Streaming / SSR | Native | Native (container) | Partial |

One legitimate concern with Vercel: the Pro plan's overage model (bandwidth at $0.15/GB, function CPU at $0.128/CPU-hour) can surprise teams. After Vercel's September 2025 pricing restructure, there's a default $200 budget cap to prevent runaway costs — this is adequate protection for MVP scale.

The key constraint favoring Vercel is the investor demo workflow: each git push creates a preview URL with a unique domain. Stakeholders can click a link in Slack to see the exact state of any branch — this has real value during a fundraising process.

Fly.io is the right choice when you need persistent background workers (e.g., a queue worker that processes video rendering jobs asynchronously). At MVP scale, Next.js Route Handlers with a simple job queue (using Supabase's postgres_changes or a basic table-polling pattern) can handle this without needing persistent workers. Revisit Fly.io when background processing volume justifies persistent compute.

Cloudflare Pages is eliminated from primary consideration: the `@cloudflare/next-on-pages` adapter lags on App Router features, and the developer experience friction is not worth the cost savings at MVP scale.

### Recommendation

**Vercel Pro.** The zero-config Next.js deployment, per-PR preview URLs, and streaming SSR support are decisive advantages for a team shipping fast toward investor demos. Set the $200 spend cap immediately to avoid surprise bills. If background job processing becomes a bottleneck post-MVP, add a Fly.io worker service alongside Vercel — the two compose cleanly.

---

## Full Recommended Stack

**Next.js 15 (App Router) + Clerk + Supabase (Postgres + Storage) + Anthropic Claude API + fal.ai Flux + Creatomate + Vercel**

All components use TypeScript-first SDKs. Supabase consolidates database, file storage, and RLS into one integration. Clerk handles the invite-only auth requirement out of the box. fal.ai and Creatomate are pure API services — no infrastructure to manage. The entire stack deploys from a single Next.js repo to Vercel with one `git push`. Total recurring cost at zero revenue: ~$100/month (Vercel Pro $20 + Supabase Pro $25 + Clerk free + Creatomate $54 + fal.ai pay-per-use + Anthropic pay-per-use).
