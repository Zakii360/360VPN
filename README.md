# 360VPN — free stack (no VPS)

This runs entirely on free tiers. Nothing to install on a server, nothing
that needs to stay running on your own machine.

| Piece | What it does | Cost |
|---|---|---|
| **Cloudflare Zero Trust (WARP + Gateway)** | The actual VPN tunnel + per-category DNS filtering (malware, phishing, adult, gambling, drugs, social) | Free, up to 50 users |
| **Cloudflare Pages** | Hosts this dashboard (`index.html`/`app.js`/`style.css`) | Free |
| **Cloudflare Pages Functions** (`/functions`) | Small serverless functions that talk to Cloudflare's API on the dashboard's behalf — Cloudflare runs these, nothing for you to host | Free |

## 1. Set up Zero Trust (one-time, ~10 min)

1. Go to https://one.dash.cloudflare.com and create a free Zero Trust team
   (pick any team name — this is what people type into WARP to enroll).
2. **Zero Trust → Settings → WARP Client** → set up device enrollment
   (easiest: "One-time PIN" via email, so anyone with your family's email
   addresses can enroll their own device).
3. Install the **Cloudflare WARP** app (iOS/Android/Windows/macOS/Linux) on
   each device, sign in with your team name, and turn it on. That device
   is now tunneling through Cloudflare and shows up under
   **Zero Trust → My Team → Devices**.
4. **Zero Trust → Gateway → DNS** → make sure DNS filtering is on for your
   default policy (Gateway needs at least one location/policy set up
   before the API calls below will have somewhere to attach to).

At this point you already have a working, free VPN with no code involved
— the dashboard in this repo is a nicer control panel on top of it.

## 2. Get a Cloudflare API token

**dash.cloudflare.com → profile icon → API Tokens → Create Token** →
custom token with **Zero Trust: Edit** permission on your account. Copy
the token (you won't see it again).

Also grab your **Account ID** — shown on the right sidebar of almost any
page in the Cloudflare dashboard.

## 3. Deploy to Cloudflare Pages

1. Push this `site/` folder to a GitHub repo (or use `wrangler pages deploy`
   directly if you'd rather skip GitHub).
2. **Cloudflare dashboard → Workers & Pages → Create → Pages** → connect
   the repo → build settings can be left blank (this is a static site,
   no build step).
3. **Settings → Environment variables** on the Pages project, add (mark
   sensitive ones "Encrypt"):
   - `CF_API_TOKEN` — the token from step 2
   - `CF_ACCOUNT_ID` — your account ID
   - `DASH_TOKEN` — any password you make up; this is what protects your
     dashboard's API from random visitors, since the site itself is public
4. Deploy. Cloudflare gives you a `*.pages.dev` URL — open it.

## 4. Connect the dashboard

Open the deployed site → **Settings → Dashboard connection** → paste the
same `DASH_TOKEN` you set in step 3 → Connect. From here, the protection
toggles and blocked-domain list on the Overview/Protection pages actually
edit your live Cloudflare Gateway policies.

## About the admin domain (`360-search.com`)

Once you point that domain here, it's added to the **"360VPN - Always
Allowed"** Gateway list, which has an `allow` policy with the lowest
precedence number — meaning it's checked first and always wins, even if a
device's other filtering would otherwise block it. That's the real,
visible version of what the old `proxy.pac` file tried to do with a
hardcoded bypass: same effect, but it's a normal list you can see and
edit in the dashboard or directly in the Cloudflare Zero Trust UI, not
something buried in routing logic.

## Things worth knowing

- **Gateway policies here are account-wide**, not literally per
  individual device — Cloudflare's free tier ties filtering to policies
  you can scope by user/group, not raw device ID. For a family, the
  simplest version is one shared policy set (what's built here). Per-kid
  *different* rules would mean setting up Zero Trust "groups" per person
  and scoping policies to each group — a reasonable next step, not
  included yet.
- **Verify category names once deployed.** `functions/api/policies.js`
  matches Cloudflare's DNS content categories by keyword rather than
  hardcoded IDs (safer against Cloudflare renaming things), but it's
  worth hitting `/api/categories` after your first deploy to confirm the
  matches make sense for your account.
- **Free tier caps at 50 enrolled devices/users** — plenty for a family,
  worth knowing if "eventually public" ever becomes real; that would be a
  paid Zero Trust seat count at that point.
