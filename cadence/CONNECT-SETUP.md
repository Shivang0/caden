# One-click "Connect account" setup (per provider OAuth apps)

Each provider needs an OAuth app created under YOUR account (~2 min each). Paste the
client id/secret into `.env.local` and the Connect button for that provider lights up
automatically (`/api/connect/status` reports which are configured).

Callback URL for every provider below (replace host in prod):
`http://localhost:3000/api/connect/<provider>/callback`

## Linear — https://linear.app/settings/api/applications/new
- Name: caden · Callback: `.../api/connect/linear/callback`
- Env: `LINEAR_CLIENT_ID=`, `LINEAR_CLIENT_SECRET=`
- Scopes requested by the app: `read`

## Notion — https://www.notion.so/my-integrations → New integration → Public
- Redirect URI: `.../api/connect/notion/callback`
- Env: `NOTION_CLIENT_ID=`, `NOTION_CLIENT_SECRET=`

## Figma — https://www.figma.com/developers/apps → Create app
- Callback: `.../api/connect/figma/callback`
- Env: `FIGMA_CLIENT_ID=`, `FIGMA_CLIENT_SECRET=`
- Scopes: `files:read`, `projects:read`

## Vercel — https://vercel.com/dashboard → Integrations → Create (or OAuth app)
- Redirect: `.../api/connect/vercel/callback`
- Env: `VERCEL_CLIENT_ID=`, `VERCEL_CLIENT_SECRET=`

## Stripe (founder revenue) — optional, has review friction
- Connect settings → OAuth: `.../api/connect/stripe/callback`
- Env: `STRIPE_CONNECT_CLIENT_ID=` (uses your existing platform secret key)
- Fallback without Connect: the single "restricted key" field (read-only key,
  Dashboard → Developers → API keys → Create restricted key).

## PostHog — no OAuth; manual key + project id fields remain.

Tokens from these flows are stored ONLY in encrypted httpOnly cookies in the user's
browser (`cadence_conn_<provider>`), never in any database. Disconnect deletes the cookie.
