# LevelArc — Student Career Tracker

A real, deployable version of the tracker: student accounts, a Postgres database,
Stripe subscriptions, and live LeetCode/GitHub syncing.

**Stack:** static HTML/CSS/JS frontend · Supabase (Postgres + Auth) · Stripe (payments)
· Vercel serverless functions (checkout, webhook, LeetCode/GitHub proxies)

No framework build step — you can also open `public/index.html` locally once
Supabase is wired up, though Stripe/LeetCode/GitHub features need the `/api`
functions, which only run on Vercel (or `vercel dev` locally).

---

## 1. What changed vs. the original file

The original `career-tracker.html` was a beautiful **static demo** — all numbers
(LeetCode solved, GitHub commits, resume score, heatmap, leaderboard) were
hardcoded or randomly generated, "Get Started" didn't create an account, and
the pricing cards didn't charge anyone. Fixed/added:

- **Real accounts** — Supabase Auth (email + password), session persists across visits
- **Real database** — every stat now reads/writes an actual Postgres row (see `supabase/schema.sql`)
- **Real payments** — Stripe Checkout + webhook keep a `subscriptions` table in sync
- **Real LeetCode/GitHub data** — serverless proxies pull live public stats
- **Bugs fixed**: heatmap was `Math.random()` on every load (now reads real activity); onboarding modal collected data but discarded it; pricing buttons only showed a toast; no logout; sidebar items had no real destinations for Settings/Add-topic/Log-activity flows (now built); no keyboard-accessible focus states; no `prefers-reduced-motion` handling; `.lb-row` had `cursor:pointer` with no click behavior (removed); mobile layout collapsed awkwardly below 1100px (added breakpoints)
- **Visual refresh** — a champagne-gold accent now marks premium/paid elements, added a subtle grain texture for a less "flat digital" feel, refined empty/loading states, cleaner mobile breakpoints

## 2. What I didn't build (and why)

- **A resume parser** — scoring an actual uploaded PDF resume needs either an
  LLM call or a rules engine; the Resume modal currently lets a student (or
  you, as admin) enter a score directly. Wiring a real parser is a follow-up
  task, not a bug fix.
- **Dark-pattern conversion tactics** — you mentioned wanting students to feel
  they have "no choice" but to buy this. I built a genuinely strong value
  loop instead (real progress tracking → real weekly plan → visible gaps vs.
  peers), which converts better long-term than fake urgency or scarcity, and
  won't get the product flagged by app stores or payment processors.

---

## 3. Deploy — step by step

### A. Supabase (auth + database)
1. Create a project at [supabase.com](https://supabase.com) (free tier is fine to start).
2. **SQL Editor → New query** → paste the entire contents of `supabase/schema.sql` → Run.
3. **Project Settings → API** → copy:
   - `Project URL` → goes in `public/js/supabaseClient.js` (`SUPABASE_URL`) and `.env` (`SUPABASE_URL`)
   - `anon public` key → `public/js/supabaseClient.js` (`SUPABASE_ANON_KEY`) and `.env`
   - `service_role` key → `.env` only (`SUPABASE_SERVICE_ROLE_KEY`) — **never put this in frontend code**
4. **Authentication → Providers** → Email is on by default. Under **Authentication → URL Configuration**, set your Site URL once you have your Vercel domain (step D).

### B. Stripe (payments)
1. Create a [Stripe](https://stripe.com) account, stay in **test mode** first.
2. **Product catalog → Add product** → create three recurring monthly Prices:
   - Starter — ₹149/month
   - Pro — ₹299/month
   - Placement Ready — ₹499/month
   (If Stripe doesn't support INR in your account region, use USD equivalents or enable Indian Rupee under Settings → Payment methods.)
3. Copy each Price ID into `.env` (`STRIPE_PRICE_STARTER`, etc.)
4. **Developers → API keys** → copy the Secret key into `STRIPE_SECRET_KEY`.
5. Webhook: you'll finish this in step D (needs your live URL first).

### C. GitHub token (optional but recommended)
Without a token, GitHub stats fall back to public repo/follower counts only
(no yearly commit count, and a low 60 req/hour rate limit).
1. [github.com/settings/tokens](https://github.com/settings/tokens) → Generate new token (classic) → no scopes needed for public data → copy it into `GITHUB_TOKEN`.

### D. Deploy to Vercel
1. Push this folder to a GitHub repo, then [import it in Vercel](https://vercel.com/new).
2. **Project Settings → Environment Variables** → add every key from `.env.example` with your real values (including `SITE_URL` = your Vercel domain, e.g. `https://levelarc.vercel.app`).
3. Deploy.
4. Back in **Stripe → Developers → Webhooks → Add endpoint**:
   - URL: `https://YOUR-DOMAIN/api/stripe-webhook`
   - Events: `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_failed`
   - Copy the **Signing secret** into Vercel's `STRIPE_WEBHOOK_SECRET` env var, then redeploy.
5. Update `public/js/supabaseClient.js` with your real Supabase URL/anon key (this file ships to the browser, so no other secrets belong here), commit, and redeploy.
6. Go live: switch Stripe out of test mode and swap the API keys when you're ready to accept real payments.

### E. Custom domain (optional)
Vercel → Project → Settings → Domains → add your domain, follow the DNS instructions they give you.

---

## 4. Connecting LeetCode & GitHub — how it actually works

**LeetCode has no official public API.** `api/leetcode-stats.js` calls the
same unofficial GraphQL endpoint LeetCode's own profile pages use
(`https://leetcode.com/graphql`). It's what most third-party LeetCode
trackers use, but it's unsupported — LeetCode can change or rate-limit it
without notice. The function fails gracefully (shows the last synced numbers
instead of erroring the whole dashboard) if that happens.

**GitHub** has a real public REST API for repo/follower counts (no token
needed, 60 req/hr limit) and a GraphQL API for yearly contribution counts
(needs a token — see step C above, raises the limit to 5,000 req/hr too).

Students connect both by typing their username during signup or in
**Settings**, then hitting **Sync Now** — no OAuth needed since we're only
reading public profile data.

## 5. Wiring a real AI coach (optional upgrade)

Right now `regenerateAI()` in `public/js/dashboard.js` builds the weekly plan
with a simple rule (pick the student's two weakest DSA topics). To make it
genuinely generative, replace that function's body with a call to the
Anthropic API from a new serverless function (`api/ai-coach.js`), passing
the student's real stats as context and asking for a short, specific plan —
keep the API key server-side only, same pattern as the Stripe secret key.

## 6. Local development
```bash
npm install
npm i -g vercel   # once
vercel dev        # serves public/ and api/ together with .env loaded
```

## 7. Security notes
- Every table has Row Level Security — a signed-in student can only ever read/write their own rows (see `supabase/schema.sql`). Verify this in Supabase → Authentication → Policies after running the schema.
- The `service_role` key and `STRIPE_SECRET_KEY` must only ever live in Vercel env vars / your `.env` — never in anything under `public/`.
- The leaderboard is the one public-read view, and it intentionally exposes only `full_name` and `xp` — no email, no college, no CGPA.
