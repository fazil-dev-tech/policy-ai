# PolicyGuard AI — Deployment Guide

## 1. Local Development

### Prerequisites
- Node.js 20+
- Python 3.10+ (optional locally, recommended for `ml-service/`)
- A Supabase project with migrations applied from `supabase/migrations/` and a private storage bucket (`policy-files`)

### Backend Setup

```bash
cd backend
cp .env.example .env
# Populate SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY,
# and free NVIDIA NIM / Groq / Tavily / VirusTotal keys as needed.
npm ci
npm run lint
npm test
npm run dev
```

### ML Sidecar Setup (Optional for Motor Vision Scoring)

```bash
cd ml-service
python -m venv .venv
.venv/Scripts/activate   # Windows (or source .venv/bin/activate on Linux/macOS)
pip install -r requirements.txt
uvicorn main:app --host 127.0.0.1 --port 8000
```

### Frontend Setup

```bash
cd frontend
cp .env.example .env
# Configure VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, VITE_API_URL
npm ci --legacy-peer-deps
npm run dev
```

Default local ports:
- Backend API + Swagger (`/api-docs`): `http://localhost:5000`
- Frontend Vite SPA: `http://localhost:5173`
- ML Sidecar: `http://127.0.0.1:8000`

---

## 2. Chrome Extension Setup

1. Keep `extension/popup.html`, `extension/shared/localRules.js`, and `frontend/public/policyguard-extension.zip` synchronized.
2. In Chrome, open `chrome://extensions`, enable **Developer mode**, and load the `extension/` folder (or extract `/policyguard-extension.zip`).

---

## 3. Docker Compose Deployment

Configure root environment variables referenced in `docker-compose.yml` (`SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `NVIDIA_API_KEY`, `NVIDIA_API_KEYS`, `AI_ALLOW_PAID=false`, etc.), then start all three services (`backend`, `ml-service`, `frontend`):

```bash
docker compose up -d --build
```

---

## 4. Vercel + Supabase Deployment

`vercel.json` routes `/api/(.*)` directly to `api/index.js` and builds the static bundle from `frontend/dist`. Set `SUPABASE_*`, `AI_PROVIDER=nvidia`, `AI_MODEL=nvidia/nemotron-3.5-lightning-30b-a3b`, `NVIDIA_API_KEY`, `NVIDIA_API_KEYS`, `AI_ALLOW_PAID=false`, and `CORS_ORIGIN` in Vercel project environment variables. Files exceeding 3.8 MB bypass serverless body limits automatically via `POST /api/storage/signed-upload`.

---

## 5. Production Readiness Checklist

- [ ] All migrations (`20261126000001` through `20261126000005`) applied in Supabase
- [ ] `AI_ALLOW_PAID=false` verified when only `:free` models should run
- [ ] `CORS_ORIGIN` matches your deployed Vercel/custom domains
- [ ] Backend Jest unit tests and frontend `vite build` pass in GitHub Actions CI
