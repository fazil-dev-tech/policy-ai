# PolicyAI — Scaling Strategy for 100K Users

## Architecture for Scale

### Horizontal Scaling
- **Backend**: 3-20 pods via Kubernetes HPA, auto-scales on CPU (70%) and memory (80%)
- **Frontend**: 2+ Nginx pods serving static build
- **MongoDB**: Atlas M30+ with replica set (1 primary, 2 secondaries)
- **Redis**: Cluster mode with 3+ nodes

### Estimated Server Requirements (100K Users)

| Component        | Specs                          | Count | Monthly Cost Est. |
|------------------|--------------------------------|-------|--------------------|
| Backend Pods     | 2 vCPU, 4GB RAM               | 5-10  | $400-$800          |
| Frontend Pods    | 0.5 vCPU, 512MB RAM           | 2-3   | $50-$100           |
| MongoDB Atlas    | M30 (8GB RAM, 40GB SSD)       | 3     | $500               |
| Redis Cluster    | 3GB cache                     | 3     | $150               |
| Load Balancer    | Cloud LB                      | 1     | $20                |
| CDN              | ~500GB/month                   | 1     | $50                |
| Object Storage   | PDFs, ~1TB                     | 1     | $25                |
| **Total**        |                                |       | **$1,200-$1,650/mo** |

### API Throughput

| Endpoint Type     | Expected RPS | P99 Latency Target |
|-------------------|--------------|--------------------|
| Auth (login)      | 50           | 200ms              |
| Policy CRUD       | 100          | 300ms              |
| Policy Upload     | 10           | 5s (AI processing) |
| Chat Message      | 200          | 3s (AI response)   |
| Admin Stats       | 5            | 500ms              |

### Database Optimization
- **Compound indexes** on all query-heavy fields (pre-configured in schemas)
- **Aggregation pipeline** for admin stats (pre-computed)
- **Read preference**: secondary for analytics queries
- **Connection pooling**: 50 connections per backend instance

### Caching Strategy
- **Redis**: Chat conversation cache (1hr TTL), session store
- **CDN**: Frontend static assets, uploaded PDFs
- **API response cache**: Market data (5min TTL)

### Queue Processing (BullMQ)
- **PDF Analysis**: Offload AI extraction to background workers
- **Email Notifications**: Async email delivery
- **Fraud Analysis**: Non-blocking fraud scoring

### Memory Allocation
- Backend: ~300MB per pod at steady state, ~500MB peak
- Redis: ~1GB for 100K user conversation cache
- MongoDB: Working set ~4GB, total storage ~40GB

### Monitoring Metrics
- Response time P50/P95/P99
- Error rate per endpoint
- CPU/Memory utilization
- MongoDB query performance
- Redis hit/miss ratio
- AI API latency and error rates
