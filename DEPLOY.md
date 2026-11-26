# PolicyAI — Deploy Guide (Supabase + Node.js)

## Architecture

- **Frontend:** React + Vite (`frontend/dist` served by backend in production or static host)
- **Backend:** Node.js + Express (`backend/server.js`)
- **Database, Auth & Storage:** Supabase (PostgreSQL + RLS, Supabase Auth with Custom SMTP, Private Storage bucket `policy-files`)

---

## Step 1 — Supabase Setup

1. Link your Supabase project and apply `supabase/migrations/20261126000001_initial_schema.sql`.
2. Copy `backend/.env.example` to `backend/.env` and `frontend/.env.example` to `frontend/.env` and fill in your Supabase URL, Anon Key, Service Role Key, SMTP credentials, and AI API key.

---

## Step 2 — Run Locally

```powershell
# Install dependencies
npm run install:all

# Terminal 1 — Backend (http://localhost:5000)
npm run dev:backend

# Terminal 2 — Frontend (http://localhost:5173)
npm run dev:frontend
```

---

## Step 3 — Production Build

```powershell
npm run build
NODE_ENV=production npm start
```

Health check endpoint: `/api/health` -> returns `{"status":"ok","database":"connected","databaseProvider":"supabase"}`.
