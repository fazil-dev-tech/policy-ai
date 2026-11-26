<div align="center">

# PolicyGuard AI
### Insurance Protection, IRDAI Claims Intelligence, Motor Estimator & Browser Scam Shield

[![React](https://img.shields.io/badge/React-18-e11d48?style=for-the-badge&logo=react&logoColor=white)](https://react.dev/)
[![Node.js](https://img.shields.io/badge/Node.js-20-339933?style=for-the-badge&logo=node.js&logoColor=white)](https://nodejs.org/)
[![Supabase](https://img.shields.io/badge/Supabase-Postgres%20%2B%20Auth-3ECF8E?style=for-the-badge&logo=supabase&logoColor=white)](https://supabase.com/)
[![FastAPI](https://img.shields.io/badge/ML%20Sidecar-FastAPI-009688?style=for-the-badge&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=for-the-badge)](LICENSE)

**PolicyGuard AI** combines table-aware policy PDF parsing, deterministic IRDAI 2024 compliance math, interactive claim payout simulation, Parinidhi AI voice/text counseling, a FastAPI motor repair estimator sidecar, and a Chrome Manifest V3 Browser Shield extension.

</div>

---

## Key Capabilities

- **Policy Vault & Table-Aware PDF Parser**: Extracts structured coverage terms, IRDAI Customer Information Sheet (CIS) summaries, 60-Month Moratorium timelines, and searchable page-indexed clauses (`policy_clauses` FTS).
- **Deterministic Claim Estimator (`claimEngine.service.js`)**: Zero-LLM arithmetic for proportionate room-rent deductions, consumables, deductibles, co-pay, interactive readiness checklists, What-If room-rent sliders, 3-hour Cashless Discharge SLA notices, and GRO settlement grievance PDFs.
- **Motor Damage AI & ML Sidecar**: Hybrid computer-vision & local FastAPI (`/ml-service`) OpenCV + scikit-learn severity analyzer mapped to Indian repair cost & statutory depreciation benchmarks.
- **Parinidhi AI & Live Research**: Policy-grounded RAG chat with clause citations, multilingual voice synthesis, and live Tavily / Serper web verification (`backend/src/services/search.service.js`).
- **Browser Shield & Chrome Extension (`extension/`)**: Real-time phishing, fake renewal, `.apk` malware, and reverse-UPI link scanning across Web, WhatsApp Web, and Gmail via local heuristics, RDAP domain age, and VirusTotal lookups.
- **Family Policy Vault & Signed Storage Uploads**: Links family members to active policies with emergency card PDFs and direct Supabase Storage signed uploads supporting files up to 10 MB.

---

## Project Layout

- `frontend/` — React 18, Vite, React Three Fiber 3D architecture scenes, Recharts analytics
- `backend/` — Express REST API, Zod validation, `pdfjs-dist` layout parser, deterministic IRDAI engine, Jest test suite
- `ml-service/` — Python FastAPI image quality & motor damage severity scoring sidecar
- `extension/` — Chrome MV3 extension packaged into `frontend/public/policyguard-extension.zip`
- `supabase/migrations/` — PostgreSQL schema, Row-Level Security (RLS), grants, and benchmark seeds

See [docs/architecture.md](docs/architecture.md) and [docs/deployment.md](docs/deployment.md) for setup and operational details.
