# Echoes of Choice Adventure

An AI-powered choose-your-own-adventure web app (Romance / True Crime / Paranormal)
with dynamically generated narrative branches, images, voice narration, a Google-Keep-style
note workspace, a player codex, snapshot sharing, real-time co-play rooms, and Stripe-backed
credits. The backend is a hardened Express server with response caching, exponential-backoff
retries, model fallbacks, an async-job queue, a chaos-engineering harness and a self-test
runbook.

The project was originally scaffolded in Google AI Studio, but **it has no runtime
dependency on AI Studio**. It runs on plain Node.js with a Gemini API key (issued by
AI Studio or Google Cloud), a Firebase project, and — optionally — Stripe, Redis,
ElevenLabs and OpenAI.

---

## Quick start (local development)

Prerequisites: Node.js 20+.

1. Install dependencies:
   ```bash
   npm install
   ```
2. Copy the environment template and fill in at least `GEMINI_API_KEY`:
   ```bash
   cp .env.example .env.local
   ```
   See [`.env.example`](.env.example) for every variable.
3. Run the dev server (Vite middleware + Express on port 3000):
   ```bash
   npm run dev
   ```

## Building & running for production

```bash
npm run build   # produces dist/ (SPA) and dist/server.cjs (bundled server)
npm start       # node dist/server.cjs
```

## Tests & lint

```bash
npm run lint                 # TypeScript type-check (tsc --noEmit)
npm test                     # unit + integration tests (vitest)
npm run test:rules           # Firestore security-rules tests (requires the Firebase emulator)
```

The Firestore-rules tests exercise the "Dirty Dozen" payloads documented in
[`security_spec.md`](security_spec.md).

---

## Production deployment

### Container

```bash
docker build -t echoes-of-choice .
docker run --rm -p 3000:3000 --env-file .env.local echoes-of-choice
```

### Google Cloud Run (recommended)

The repository ships with [`deploy/cloudrun-service.yaml`](deploy/cloudrun-service.yaml).
For real high availability set `min-instances` ≥ 2 and deploy to two regions behind
a global HTTPS load balancer. Pull secrets from **Google Secret Manager** rather
than baking them into `--set-env-vars`:

```bash
gcloud run services replace deploy/cloudrun-service.yaml --region us-central1
gcloud run services replace deploy/cloudrun-service.yaml --region europe-west1
```

Liveness/readiness probes are configured on `/healthz` and `/readyz`.
Prometheus-format metrics are exposed at `/metrics`.

### Fly.io

A minimal manifest is provided at [`deploy/fly.toml`](deploy/fly.toml); use
`fly launch --copy-config` and add machines in at least two regions.

### Static assets on a CDN

`firebase.json` is configured to publish `dist/` to Firebase Hosting and rewrite
`/api/**` to the Cloud Run service. The SPA will stay up even while the API is
restarting. Alternatively, point Cloudflare or Cloud CDN at the same `dist/`
output of `npm run build`.

---

## High-availability checklist

| Concern                | Mechanism                                                                 |
|------------------------|---------------------------------------------------------------------------|
| Gemini transient 5xx   | Exponential-backoff retry (`callGeminiWithRetry`)                         |
| Gemini quota / 429     | Automatic model fallback chain (`generateContentWithFallback`)            |
| Gemini hard outage     | Cross-vendor fallback to OpenAI when `OPENAI_API_KEY` is set              |
| Cached responses       | `ResponseCache` (in-memory or Redis if `REDIS_URL` is set)                |
| Multiple instances     | `REDIS_URL` externalizes cache, async jobs and rate-limiter counters      |
| Process crash          | Platform restarts container; `SIGTERM` handler drains in-flight async jobs|
| Region outage          | Deploy to ≥ 2 regions behind a global load balancer                       |
| Static assets          | Served from Firebase Hosting / CDN, independent of Express                |
| Observability          | `/api/system/monitoring`, `/metrics`, structured JSON logs (pino)         |
| Self-diagnostics       | `POST /api/system/selftest`, `POST /api/system/chaos`                     |

See [`docs/RUNBOOK.md`](docs/RUNBOOK.md) for the outage runbook.

---

## Firebase setup

1. Create your own Firebase / GCP project.
2. Enable **Firestore** (Native mode), **Storage**, **Authentication** (Google provider),
   and the **Generative Language API**.
3. Deploy security rules:
   ```bash
   firebase deploy --only firestore:rules,storage
   ```
4. Create a service account with `roles/datastore.user` + `roles/storage.objectAdmin`
   and download its JSON key. Point `GOOGLE_APPLICATION_CREDENTIALS` at the file
   for local dev. On Cloud Run / GKE, attach the service account directly and omit
   the env var (workload identity will be used automatically).
5. Set `VITE_FIREBASE_*` env vars from your Firebase web app config. **Restrict the
   web API key** in the Cloud Console (HTTP referrers, allowed APIs) and turn on
   **Firebase App Check** by setting `VITE_FIREBASE_APP_CHECK_SITE_KEY`.

> ⚠️ Earlier revisions of this repository committed a development Firebase web
> API key in `firebase-applet-config.json`. That key has been removed; the file
> is now a template and all values must be supplied via `VITE_FIREBASE_*` env
> vars at build time. Rotate any key that was previously exposed.

---

## Repository layout

```
server.ts                       # Express backend
src/                            # React 19 SPA
  config/models.ts              # Centralized Gemini / fallback model IDs
  lib/firebase.ts               # Firebase client init + App Check
  lib/logger.ts                 # Structured logger (pino)
  lib/store/                    # Pluggable cache / queue / rate-limit (memory or Redis)
deploy/                         # Dockerfile context, Cloud Run, Fly manifests
docs/RUNBOOK.md                 # Outage / on-call runbook
firestore.rules / storage.rules # Firebase security rules
firebase.json                   # Firebase Hosting + rules deployment config
firebase-applet-config.json     # Template — overridden by VITE_FIREBASE_* env
.github/workflows/ci.yml        # Lint + build + tests on every PR
tests/                          # Vitest test suite, including firestore.rules tests
```
