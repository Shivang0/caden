# elevenlabs-i2v-service

Let **other people** generate image-to-video clips through a hosted web app, rendered on
**your** laptop using **your** ElevenLabs Creator account.

```
Visitor ─▶ Web app (Vercel)                    Your laptop (the render worker)
           • upload image + prompt              • polls /api/worker/claim
           • job → Postgres (status: queued)    • drives your logged-in Chrome → makes the video
           • shows queue position               • uploads MP4 to Blob
           • polls until the video is ready     • POST /api/worker/complete
                     │                                        ▲
                     └──────▶ Vercel Postgres + Blob ◀────────┘
```

The laptop **pulls** work outbound — no inbound ports, tunnels, or firewall holes. hCaptcha
stays passive because it's genuinely your browser (see `../elevenlabs-i2v` for the why).

## Parts

| Folder | What it is | Runs on |
|---|---|---|
| `web/` | Next.js app: frontend + queue API + Postgres/Blob | Vercel |
| `worker/` | Local worker: pulls jobs, drives Chrome, uploads results | Your laptop |

## Deploy the web app (Vercel)

1. `cd web && npm install`
2. Create a Vercel project from `web/` (`vercel` or the dashboard).
3. In the project, add **Storage → Postgres** and **Storage → Blob**. Vercel injects
   `POSTGRES_URL` and `BLOB_READ_WRITE_TOKEN` automatically.
4. Add env vars (Project → Settings → Environment Variables):
   - `WORKER_SECRET` — long random string (the worker uses the same value)
   - `VISITOR_SALT` — any random string
   - optional: `GLOBAL_DAILY_CAP` (default 40), `PER_VISITOR_HOURLY` (3), `MAX_QUEUE` (15)
5. Deploy. Then create the tables once:
   ```bash
   curl -X POST https://your-app.vercel.app/api/init -H "x-worker-secret: $WORKER_SECRET"
   ```

## Run the worker (your laptop)

1. Quit Chrome, relaunch with remote debugging on your normal profile, log into elevenlabs.io:
   ```bash
   /Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome \
     --remote-debugging-port=9222 \
     --user-data-dir="$HOME/Library/Application Support/Google/Chrome"
   caffeinate -di &   # keep the laptop awake during the event
   ```
2. Configure + start the worker:
   ```bash
   cd worker
   npm install
   cp .env.example .env      # fill SERVICE_URL, WORKER_SECRET, BLOB_READ_WRITE_TOKEN
   node worker.mjs
   ```
   You should see `worker online. polling …`. Leave it running.

## Operating it during the demo

- **Pause intake** (kill switch) if credits run low or hCaptcha starts challenging:
  ```bash
  curl -X POST https://your-app.vercel.app/api/admin/intake \
    -H "x-worker-secret: $WORKER_SECRET" -H 'content-type: application/json' \
    -d '{"open": false}'          # {"open": true} to resume
  ```
- **Watch the worker terminal.** If it prints `BLOCKED: visible hCaptcha`, walk to the laptop
  and solve the one challenge in the Chrome window — the worker resumes automatically.

## Guardrails already built in

- **Serialized:** exactly one generation at a time (the single worker), with live queue position.
- **Caps:** global daily cap (~40 of your ~50 credits), per-visitor hourly limit, max queue length.
- **Moderation:** basic prompt filter before it touches your account; ElevenLabs' own moderation
  turns a rejected generation into a `failed` job.
- **Kill switch:** pause intake instantly without redeploying.

## Known limits / gotchas

- Throughput ≈ one clip every ~30–90s. This is a *demo*, not a service. Set expectations on the page.
- The laptop is the server: keep Chrome open, logged in, awake, and on WiFi.
- Image upload goes through a Vercel function (4 MB cap). For bigger files, switch `/api/jobs`
  to Vercel Blob client-uploads.
- **ToS:** you're exposing a paid single-seat account to many users. Fine for a hackathon demo;
  it's your call for anything beyond that. You're liable for what's generated on your account —
  hence the moderation filter and the kill switch.
