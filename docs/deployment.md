# PolicyAI — Deployment Guide

## Local Development

### Prerequisites
- Node.js 18+
- MongoDB 7+ (local or Atlas)
- Redis 7+ (optional, for chat caching)
- Git

### 1. Clone & Install

```bash
# Backend
cd backend
cp .env.example .env
# Edit .env with your API keys:
#   GEMINI_API_KEY=your_key
#   GROK_API_KEY=your_key  (optional)
npm install

# Frontend
cd ../frontend
npm install
```

### 2. Start Development Servers

```bash
# Terminal 1: Backend
cd backend
npm run dev

# Terminal 2: Frontend
cd frontend
npm run dev
```

Backend runs at `http://localhost:5000`, frontend at `http://localhost:5173`.
Swagger docs at `http://localhost:5000/api-docs`.

---

## Docker Deployment

### Prerequisites
- Docker & Docker Compose

### 1. Configure Environment

```bash
# Create .env in project root
GEMINI_API_KEY=your_gemini_key
GROK_API_KEY=your_grok_key
JWT_SECRET=your_production_secret_min_32_chars
JWT_REFRESH_SECRET=your_refresh_secret_min_32_chars
```

### 2. Build & Run

```bash
docker-compose up -d --build
```

Frontend: `http://localhost:80` | Backend: `http://localhost:5000`

---

## Kubernetes Deployment

### 1. Create Secrets

```bash
kubectl create secret generic policyai-secrets \
  --from-literal=MONGODB_URI=mongodb+srv://... \
  --from-literal=REDIS_URL=redis://... \
  --from-literal=JWT_SECRET=your_secret \
  --from-literal=JWT_REFRESH_SECRET=your_secret \
  --from-literal=GEMINI_API_KEY=your_key \
  --from-literal=GROK_API_KEY=your_key
```

### 2. Deploy

```bash
kubectl apply -f k8s/deployment.yaml
```

### 3. Verify

```bash
kubectl get pods
kubectl get services
kubectl get hpa
```

---

## Production Checklist

- [ ] Set strong JWT secrets (min 32 characters)
- [ ] Configure MongoDB Atlas with replica set
- [ ] Set up Redis Cluster or Elasticache
- [ ] Enable MongoDB indexing (auto-created on first connection)
- [ ] Configure CDN for static assets
- [ ] Set up SSL/TLS certificates
- [ ] Configure monitoring (Prometheus + Grafana)
- [ ] Set up log aggregation (ELK or CloudWatch)
- [ ] Configure backup strategy for MongoDB
- [ ] Set CORS_ORIGIN to your production domain
