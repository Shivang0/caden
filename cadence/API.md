# cadence API contract (for frontend wiring)

Everything the UI needs. All responses are JSON unless noted. New fields are additive —
existing UI keeps working without changes.

## Generate

`POST /api/generate`

```jsonc
{
  "repoUrl": "https://github.com/vercel/ai",   // required
  "since": "2026-08-14",                        // required, ISO date
  "until": "2026-08-28",                        // required, ISO date
  "company": "AI SDK",                          // optional
  "metricsNotes": "MRR 42k, +18% MoM",          // optional (voice-dictated or typed)
  "tone": "confident" | "humble" | "hype",      // optional
  "linearApiKey": "lin_api_...",                // optional — per-request only, never stored
  "notionToken": "ntn_...",                     // optional — per-request only, never stored
  "vercelToken": "...",                         // optional — per-request only, never stored
  "vercelProjectId": "prj_...",                 // optional — narrows Vercel deploys to one project
  "stripeMetricsKey": "rk_live_...",            // optional — the FOUNDER's Stripe key (revenue metrics)
  "figmaToken": "figd_...",                     // optional — requires figmaTeamId
  "figmaTeamId": "123456789",                   // optional — Figma team to scan
  "posthogKey": "phx_...",                      // optional — personal API key, requires posthogProjectId
  "posthogProjectId": "12345",                  // optional
  "posthogHost": "https://eu.posthog.com"       // optional — default https://us.posthog.com
}
```

**200** → `CadenceArtifacts` (see `lib/types.ts`) plus optional `sourceErrors: string[]`
(e.g. `["Linear: Linear API key was rejected"]` — show as a non-blocking warning banner;
GitHub data still generated).

### Sources

All optional, all per-request only (never stored or logged). A source failing — or missing
its required companion field — adds a `sourceErrors` entry instead of failing the request.

| Source | Fields | What it adds |
|---|---|---|
| Linear | `linearApiKey` | Issues completed in range → planning bullets |
| Notion | `notionToken` | Docs edited in range |
| Vercel | `vercelToken` (+ optional `vercelProjectId`) | Production deployments in range |
| Stripe (founder metrics) | `stripeMetricsKey` | MRR, active subs, new customers, charges → Metrics |
| Figma | `figmaToken` + `figmaTeamId` (both required) | Design files updated in range |
| PostHog | `posthogKey` + `posthogProjectId` (both required), optional `posthogHost` | Events + active users in range |
| Linkup (press) | none — server env `LINKUP_API_KEY`, automatic | Press & web mentions of the company in range |

**Errors** (all `{ "error": "..." }`):
| Status | error | UI action |
|---|---|---|
| 400 | validation message | show inline |
| 401 | `login_required` | free try used → send to `/api/auth/login` |
| 402 | `payment_required` | show paywall → `POST /api/billing/checkout`, redirect to its `url` |
| 404 | repo not found | show inline |
| 429 | GitHub rate limit | show inline, suggest GITHUB_TOKEN |
| 500 | anything else | generic error |

Free tier: 1 generation (tracked via signed `cadence_usage` cookie), then 401 (anonymous)
or 402 (logged-in, unpaid). Pro (active Stripe sub) = unlimited.
`CADENCE_OPEN_MODE=1` in env disables the whole gate (live-demo escape hatch).

## Auth (email/password, backed by MongoDB)

Sessions are a signed JWT cookie carrying only the userId; the user record is
resolved from MongoDB per request, so a session is strictly per-user.

- `POST /api/auth/signup` `{ email, password (min 8), name? }` → 200 `{ user:{id,email,name} }`
  + session cookie. 400 invalid, 409 `email already exists`.
- `POST /api/auth/signin` `{ email, password }` → 200 `{ user }` + cookie. 401 wrong creds.
- `POST /api/auth/logout` → 200 `{ ok:true }`, clears session.
- `GET /api/auth/session` →
  ```jsonc
  {
    "user": { "id", "email", "name" } | null,
    "entitlement": { "plan": "free"|"pro", "freeGenerationsUsed": 0, "freeGenerationLimit": 1 } | null
  }
  ```

## Billing (Stripe — only paid users may connect accounts)

- `POST /api/billing/checkout` → 200 `{ url }` (redirect browser there). Binds a per-user
  Stripe customer. 401 `login_required`, 501 `billing_not_configured`.
- `POST /api/billing/portal` → 200 `{ url }` manage/cancel. 401, 404 `no_customer`, 501.

When `STRIPE_SECRET_KEY` + `STRIPE_PRICE_ID` are both set, connecting accounts requires the
`pro` plan. When unset, connecting is open to any logged-in user (dev convenience).

## Media

- `POST /api/audio` `{ "text": "..." }` → `audio/mpeg` bytes (ElevenLabs voiceover).
  501 `no_key` without `ELEVENLABS_API_KEY` — hide/disable the voiceover button.
- `POST /api/transcribe` multipart field `audio` (webm) → `{ "text" }`. 501 `no_key` →
  the `VoiceNoteButton` component already falls back to browser speech recognition.

## Connect (one-click account linking — per-user, paid-gated)

Signed-in PRO users click "Connect" instead of pasting API keys. Tokens are stored
in MongoDB keyed by userId and encrypted at rest (A256GCM) — strictly per-user, so
one user can never see or mutate another's connections. OAuth app setup: `CONNECT-SETUP.md`.

- `GET /api/connect/status` →
  ```jsonc
  {
    "providers": [
      { "id": "linear", "label": "Linear", "configured": true, "connected": false },
      { "id": "figma", "label": "Figma", "configured": false, "connected": false,
        "note": "Figma also needs your team id (from the team URL) in the form" }
      // ... notion, vercel, stripe
    ],
    "authenticated": true,
    "plan": "free" | "pro" | null,
    "canConnect": false,          // true only when logged in AND (pro OR billing unconfigured)
    "billingConfigured": true
  }
  ```
  `connected` reflects the CURRENT user's connections. Gate the UI on `authenticated`
  (else prompt login) and `canConnect` (else prompt upgrade).
- `GET /api/connect/<provider>/start` — full-page redirect to the provider's OAuth
  consent screen (`<a href>`, not fetch). Redirects to `/login` if not signed in, or
  `/account?upgrade=1` if signed in but not pro. 404 `unknown_provider`, 501 `provider_not_configured`.
- `GET /api/connect/<provider>/callback` — internal. Stores the token against the
  signed-in user and redirects to `/connections?connected=<provider>`; failures →
  `/connections?connect_error=<provider>` (no details in the URL).
- `POST /api/connect/<provider>/disconnect` → `{ ok:true }` — deletes THIS user's
  connection (same-origin required). 401 if not signed in, 404 `unknown_provider`.

### Button flow

1. On page load, `GET /api/connect/status` and render one button per provider:
   configured + not connected → "Connect" linking to `/api/connect/<id>/start`;
   connected → "Connected" badge with a Disconnect action (POST `.../disconnect`,
   then refresh status); not configured → hide (or show disabled with setup hint).
2. Returning from the provider, the URL carries `?connected=<id>` (success) or
   `?connect_error=<id>` (failure) — refresh status and toast accordingly.
3. `POST /api/generate` automatically uses connected tokens for any credential
   field the request body leaves empty (an explicit body value always wins).

Note: connecting Figma provides only the token — the generate form still needs
`figmaTeamId` (from the team URL) for file listing. PostHog has no OAuth; its
manual key + project id fields remain.
