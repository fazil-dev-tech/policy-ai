# PolicyGuard AI — Scaling Strategy

## Component Scaling Profile

- **Frontend (`frontend/`)**: Static Vite build served behind Vercel CDN or Nginx (`frontend/nginx.conf`); scales horizontally with zero origin state.
- **API Tier (`backend/`)**: Stateless Express server (or Kubernetes HPA pods / serverless functions). Rate limiting can be backed by Redis when `REDIS_URL` is configured, falling back to per-instance memory buckets locally.
- **Database & Object Storage (`Supabase`)**:
  - Postgres tables (`profiles`, `policies`, `policy_clauses`, `incidents`, `evidence_files`, `damage_reports`, `settlements`, `site_scans`, `scam_reports`, `research_cache`) use B-tree and GIN indexes (`idx_policy_clauses_search`).
  - Large files (`>3.8 MB`, up to `10 MB`) upload directly from browser to Supabase Storage via short-lived signed URLs (`POST /api/storage/signed-upload`), keeping API memory and Vercel payload limits unconstrained.
- **Python ML Sidecar (`ml-service/`)**: Stateless FastAPI inference worker (`uvicorn`) scaled independently behind `ML_SERVICE_URL` for motor accident image quality & scikit-learn repair multiplier estimation.

## Caching Strategy

- **Market Insights (`research_cache`)**: Global market insights (`market_insights_global_v1`) cache for 1 hour unless `?refresh=1` is requested.
- **URL Intelligence (`site_scans` & `research_cache`)**: RDAP domain age and VirusTotal scan verdicts persist in Supabase with TTL expiration so repeated Chrome extension tab checks avoid redundant external API calls.
- **In-Memory / Redis Cache (`cache.service.js`)**: Chat context and frequent lookups cache locally with optional Redis sharing across replicas.

## Cost-Control Guardrails

- Free-first OpenRouter routing (`AI_ALLOW_PAID=false`) prevents unintended paid model fallback unless explicitly enabled.
- Deterministic calculators (`claimEngine.service.js`) handle all financial arithmetic, moratorium dates, and readiness checklists without consuming LLM tokens.
