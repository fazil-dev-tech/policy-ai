# PolicyAI — Deploy in 2 Steps

## Architecture (Simple)

```
Render.com (1 service)
├── Runs: Node.js backend (port from $PORT)
├── The backend ALSO serves the React frontend (dist/)
└── Connected to: MongoDB Atlas (cloud DB)
```

No Vercel needed. No CORS config. One URL for everything.

---

## Step 1 — MongoDB Atlas (Free Cloud Database)

1. Go to [https://cloud.mongodb.com](https://cloud.mongodb.com) → **Sign up free** (Google login works)

2. Click **"Build a Cluster"** → Choose **M0 Free Tier** → Pick any region → **Create**

3. **Create database user:**
   - Left sidebar → **Database Access** → **Add New Database User**
   - Username: `policyai_user`
   - Password: click **"Autogenerate Secure Password"** → **Copy and save it!**
   - Role: **Atlas admin** → **Add User**

4. **Allow all connections:**
   - Left sidebar → **Network Access** → **Add IP Address** → **Allow Access from Anywhere** → **Confirm**

5. **Get your connection string:**
   - Left sidebar → **Database** → **Connect** → **Drivers**
   - Copy the string. Looks like:
   ```
   mongodb+srv://policyai_user:<password>@cluster0.abc123.mongodb.net/?retryWrites=true&w=majority
   ```
   - Replace `<password>` with your actual password
   - Add the database name before `?`:
   ```
   mongodb+srv://policyai_user:YOURPASSWORD@cluster0.abc123.mongodb.net/policyai?retryWrites=true&w=majority
   ```
   ✅ **Save this string — you'll need it in Step 2**

---

## Step 2 — Deploy on Render.com (Free)

1. **Push your code to GitHub** (if not already):
   ```bash
   git init
   git add .
   git commit -m "PolicyAI initial commit"
   # Create a repo on github.com, then:
   git remote add origin https://github.com/YOUR_USERNAME/policyai.git
   git push -u origin main
   ```
   > ⚠️ Make sure `.env` is in `.gitignore` (it already is)

2. Go to [https://render.com](https://render.com) → **Sign up with GitHub**

3. Click **New +** → **Web Service** → **Connect your GitHub repo**

4. **Configure the service:**

   | Setting | Value |
   |---------|-------|
   | **Name** | `policyai` |
   | **Root Directory** | *(leave empty — use repo root)* |
   | **Runtime** | Node |
   | **Build Command** | `npm run build` |
   | **Start Command** | `npm start` |
   | **Plan** | Free |

5. **Add Environment Variables** (click "Environment" tab):

   | Key | Value |
   |-----|-------|
   | `NODE_ENV` | `production` |
   | `PORT` | `5000` |
   | `MONGODB_URI` | *(paste your Atlas SRV string from Step 1)* |
   | `JWT_SECRET` | `policyai_jwt_s3cr3t_k3y_sup3r_str0ng_2024_x9z7w2q8m5n1p4k6v3h0` |
   | `JWT_REFRESH_SECRET` | `policyai_refresh_jwt_s3cr3t_ultra_str0ng_2024_y8x6v4t2r1p9n7m5k3` |
   | `JWT_EXPIRES_IN` | `15m` |
   | `JWT_REFRESH_EXPIRES_IN` | `7d` |
   | `SMTP_HOST` | `smtp.gmail.com` |
   | `SMTP_PORT` | `587` |
   | `SMTP_USER` | `mohamedfazilpasha156@gmail.com` |
   | `SMTP_PASS` | `thfp kpts isxr labk` |
   | `SMTP_FROM` | `noreply@policyai.com` |
   | `MAX_FILE_SIZE` | `10485760` |
   | `LOG_LEVEL` | `info` |

6. Click **Create Web Service** → wait ~5 minutes for build + deploy

7. ✅ **Your app is live at:** `https://policyai.onrender.com`
   - Both frontend AND backend at the same URL
   - Test: `https://policyai.onrender.com/api/health` → should return `{"status":"ok","database":"connected"}`

---

## Running Locally

```powershell
# Terminal 1 — Backend
cd backend
npm run dev
# Runs on http://localhost:5000

# Terminal 2 — Frontend
cd frontend
npm run dev
# Runs on http://localhost:5173
# /api calls are proxied to localhost:5000 automatically
```

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| `MongoDB connection failed` | Check Atlas Network Access → must be `0.0.0.0/0` |
| Build fails on Render | Check Render build logs — usually a missing npm package |
| App loads but API fails | Check `MONGODB_URI` env var is set correctly |
| Render free tier slow | First request after 15 min takes ~30s (cold start). Normal. |
| `SMTP auth failed` | Double-check Gmail app password in `SMTP_PASS` |
