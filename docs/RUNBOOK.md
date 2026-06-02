# Outage runbook

The backend is designed to degrade gracefully rather than fail. This runbook
walks an on-call engineer through diagnosing and mitigating the most common
production incidents.

## At-a-glance

| Symptom                                | First place to look                                  | Mitigation                                 |
|----------------------------------------|------------------------------------------------------|--------------------------------------------|
| 5xx spike on `/api/story/*`            | `/api/system/monitoring` → `keyConfigurations`        | Toggle chaos off, check Gemini key budget   |
| All requests 503                       | Cloud Run / Fly health check + `/readyz`              | Roll back last deploy, scale up min-instances |
| 429 storm                              | `/metrics` → `http_requests_failed_total`             | Increase rate-limit; enable Redis backend  |
| "Quota or billing limit exceeded" msg  | Google Cloud Console → Generative Language API quotas | Raise quota, rotate key, lean on OpenAI fallback |
| SPA loads but no data                  | Browser console → Firebase errors                     | Check Firestore rules, App Check key       |
| Image generation failing               | `/api/system/selftest`                                | Falls back to `IMAGE_FALLBACK_MODEL` automatically |

## Diagnostic endpoints

- `GET /healthz` — process is alive (used for liveness probes).
- `GET /readyz` — Firebase Admin + Gemini key are both reachable (readiness probe).
- `GET /metrics` — Prometheus-format metrics: heap, cache, queue, telemetry.
- `GET /api/system/monitoring` — JSON snapshot of cache, queue, chaos state.
- `POST /api/system/selftest` — runs the cache / rate-limit / queue / Gemini-ping assertions.
- `POST /api/system/chaos` — programmatically inject latency, DB outage, key expiry, or rate-limit failures. Use this in pre-prod load testing; **never enable in production**.

## Common incidents

### 1. Gemini quota exhausted

The error sanitizer (`getCleanErrorMessage`) returns a stable, vendor-neutral
message and the request pipeline:

1. retries with exponential backoff for transient 5xx,
2. falls back from `TEXT_PRIMARY_MODEL` to `TEXT_FALLBACK_MODEL` on quota errors,
3. then falls back to OpenAI (`OPENAI_FALLBACK_MODEL`) when `OPENAI_API_KEY` is set,
4. and finally serves the last-good cached response (`apiCache.getStale`) for the affected request.

Operator action:
- Raise the Gemini quota in the Cloud Console.
- Ensure `OPENAI_API_KEY` is set in Secret Manager — without it step 3 is skipped.
- Confirm `REDIS_URL` is set in prod so multiple instances share the cache.

### 2. Single region down

If you have deployed to ≥ 2 Cloud Run regions (or ≥ 2 Fly regions) behind a
load balancer, the platform health-checks `/healthz` and steers traffic to the
healthy region automatically. Manual steps:
- In Cloud Console, drain the unhealthy backend.
- Scale the healthy region: `gcloud run services update echoes-of-choice --min-instances=4 --region us-central1`.

### 3. Stripe webhook signature failures

- Verify `STRIPE_WEBHOOK_SECRET` matches the webhook configured in Stripe.
- Check that the webhook is hitting `/api/stripe-webhook` (not a cached path).
- The endpoint uses `express.raw` and verifies signatures before any JSON parsing.

### 4. Memory creep

- Hit `/metrics` and look at `process_heap_used_bytes` over time.
- `cache_items` will plateau at 500 by default; if it doesn't, restart the pod.
- The in-memory `apiCache` and `asyncTaskQueue` are flushed on restart, which
  is safe (writes are idempotent and Firestore is the source of truth).

## Deploy / rollback

- Cloud Run: `gcloud run services update-traffic echoes-of-choice --to-revisions PREVIOUS_REVISION=100 --region us-central1`
- Fly: `fly releases` → `fly deploy --image registry.fly.io/echoes-of-choice:<sha>`
- Firebase Hosting (SPA only): `firebase hosting:rollback`

## Post-incident

1. File an incident in the issue tracker tagged `incident`.
2. Capture metrics & logs (`gcloud logging read` / `fly logs`).
3. Run `POST /api/system/selftest` to confirm the system is back to OPTIMAL_A.
4. Update this runbook if the playbook changed.
