# PolicyGuard AI — System Architecture

## High-Level Architecture

```
+------------------------------------------------------------------------+
|                Clients: React 18 SPA (Vite) & Chrome MV3 Ext            |
|        Web / Mobile / WhatsApp & Gmail DOM Shield / Voice UI           |
+-----------------------------------+------------------------------------+
                                    | HTTPS (Bearer Supabase JWT / Signed Storage URLs)
+-----------------------------------v------------------------------------+
|                     Express API Server (backend/)                       |
|  - Auth & RBAC (Supabase Auth JWT verification + profiles roles)        |
|  - Zod Input Validation, Helmet CSP, Cors Allowlist, Rate Limiters      |
|  - Policy Vault & Table-Aware PDF Parser (pdfjs-dist + DPDP PII mask)   |
|  - Deterministic IRDAI Engine (claimEngine.service.js)                  |
|  - Parinidhi RAG + Standard Chat (free-first NVIDIA NIM / Groq / Gemini) |
|  - Browser Shield Inspector (localRules + RDAP + VirusTotal + cache)    |
|  - Storage Bridge (10MB signed URLs + magic-byte validation)            |
+---------+-------------------------+--------------------------+----------+
          |                         |                          |
          v                         v                          v
+------------------+   +-------------------------+   +-------------------+
| Supabase Stack   |   | Free-First AI & Search  |   | Python ML Sidecar |
| - PostgreSQL+RLS |   | - NVIDIA NIM (Free API) |   | - FastAPI (:8000) |
| - Supabase Auth  |   | - Groq / Gemini / Puter |   | - OpenCV/Pillow + |
| - Storage Bucket |   | - Tavily & Serper Live  |   |   sklearn scoring |
|   (policy-files) |   | - VirusTotal + RDAP     |   |   (motor damage)  |
+------------------+   +-------------------------+   +-------------------+
```

## Core API Modules

| Prefix | Router | Auth | Purpose |
|---|---|---|---|
| `/api/auth` | `auth.routes.js` | Mixed | Register, login, OTP passwordless sign-in, token refresh, profile |
| `/api/policy` | `policy.routes.js` | Bearer | Upload/OCR PDF or E-Card, CIS & insights, renewal diff, agent mis-selling audit, emergency card PDF |
| `/api/claims` | `claim.routes.js` | Bearer | Traditional claims CRUD with AI guidance |
| `/api/incidents` & `/api/damage` & `/api/settlements` | `incidents.routes.js` | Bearer | 7-scenario multi-evidence estimator, What-If simulator, 3h SLA notice, motor damage AI, settlement decoder & GRO PDF |
| `/api/documents` | `document.routes.js` | Bearer | General PDF analyzer & Q&A |
| `/api/chat` | `chat.routes.js` | Bearer | Standard policy AI chat + session history |
| `/api/parinidhi`, `/api/family`, `/api/research`, `/api/storage` | `platform.routes.js` | Bearer | Parinidhi counselor, Family Vault, live search/benchmarks, direct signed upload URLs |
| `/api/security` | `platform.routes.js` | Public / Optional Bearer | URL threat checks, batch checks, verified domains, scam reports, extension zip |
| `/api/market` | `market.routes.js` | Bearer / Admin | Insurer benchmarks & cached global AI insights (`research_cache`) |
| `/api/admin` | `admin.routes.js` | Admin | Aggregate telemetry, user directory, scam report moderation, verified domains CRUD |

## Security & Determinism Model

- **Zero-LLM Math Policy**: Coverage scores, moratorium checks, room-rent deductions, motor depreciation, and grievance calculations execute deterministically in `backend/src/services/claimEngine.service.js`.
- **Supabase RLS & Ownership Scoping**: Every user query explicitly filters by `req.user.id` and validates storage object paths with `assertSafeUserStoragePath`.
- **Magic-Byte Inspection & Temp Cleanup**: Uploads are verified by binary header (`PDF`, `JPG`, `PNG`, `WEBP`) and temporary signed-storage uploads are deleted on error or completion.
- **Cost-Safe AI Routing**: `AI_ALLOW_PAID=false` enforces free NVIDIA NIM endpoints (`nvidia/nemotron-3.5-lightning-30b-a3b` primary with multi-key rotation) and free fallback tiers unless explicitly enabled.
