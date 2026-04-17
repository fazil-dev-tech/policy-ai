# PolicyAI — System Architecture

## High-Level Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                         CDN (CloudFlare)                         │
│                    Static assets, SSL termination                │
└──────────────────────────┬───────────────────────────────────────┘
                           │
┌──────────────────────────┴───────────────────────────────────────┐
│                    Load Balancer (Nginx/K8s Ingress)             │
│                    Rate limiting, request routing                 │
└──────────┬───────────────────────────────────────┬───────────────┘
           │                                       │
┌──────────┴──────────┐               ┌────────────┴──────────────┐
│  Frontend (React)    │               │  Backend API (Express)    │
│  Vite + React 18     │               │  3-20 replicas (HPA)     │
│  Nginx serving       │               │                          │
│  SPA routing         │               │  ┌────────────────────┐  │
│                      │               │  │ Auth Module        │  │
│  Pages:              │               │  │ JWT + Refresh      │  │
│  • Dashboard         │  ───────────► │  │ bcrypt, RBAC       │  │
│  • Policies          │    REST API   │  ├────────────────────┤  │
│  • AI Chat           │               │  │ Policy Module      │  │
│  • Claims            │               │  │ PDF parse, upload  │  │
│  • Market Analysis   │               │  ├────────────────────┤  │
│  • Admin Panel       │               │  │ Chat Module        │  │
│                      │               │  │ Streaming, sessions│  │
└──────────────────────┘               │  ├────────────────────┤  │
                                       │  │ Claims Module      │  │
                                       │  ├────────────────────┤  │
                                       │  │ Admin Module       │  │
                                       │  ├────────────────────┤  │
                                       │  │ Market Module      │  │
                                       │  └────────────────────┘  │
                                       └────┬──────┬──────┬───────┘
                                            │      │      │
                    ┌───────────────────────┘      │      └──────────────────┐
                    │                              │                         │
          ┌─────────┴─────────┐      ┌─────────────┴──────────┐   ┌─────────┴─────────┐
          │   MongoDB          │      │   Redis                │   │   AI Services     │
          │   Primary + Replica│      │   Conversation cache   │   │                   │
          │                    │      │   Session store         │   │   Google Gemini   │
          │   Collections:     │      │   Rate limiting         │   │   xAI Grok        │
          │   • Users          │      │                         │   │                   │
          │   • Policies       │      └─────────────────────────┘   │   Functions:      │
          │   • Claims         │                                    │   • Policy extract│
          │   • ChatHistory    │                                    │   • Chatbot       │
          │   • MarketData     │                                    │   • Fraud scoring │
          │                    │                                    │   • Market insight│
          └────────────────────┘                                    └───────────────────┘
```

## API Endpoints

| Method | Endpoint               | Auth | Description                    |
|--------|------------------------|------|--------------------------------|
| POST   | /api/auth/register     | No   | Register new user              |
| POST   | /api/auth/login        | No   | Login                          |
| POST   | /api/auth/refresh      | No   | Refresh access token           |
| GET    | /api/auth/me           | Yes  | Get current user               |
| POST   | /api/policy/upload     | Yes  | Upload PDF for AI analysis     |
| GET    | /api/policy            | Yes  | List user's policies           |
| GET    | /api/policy/:id        | Yes  | Get policy details             |
| DELETE | /api/policy/:id        | Yes  | Delete policy                  |
| POST   | /api/chat/message      | Yes  | Send chat message              |
| GET    | /api/chat/history      | Yes  | Get chat history               |
| GET    | /api/chat/sessions     | Yes  | List chat sessions             |
| POST   | /api/claims            | Yes  | File a claim                   |
| GET    | /api/claims            | Yes  | List user's claims             |
| GET    | /api/claims/:policyId  | Yes  | Claims for a policy            |
| GET    | /api/admin/stats       | Admin| Dashboard statistics           |
| GET    | /api/admin/users       | Admin| User management                |
| GET    | /api/market/providers  | Yes  | List providers                 |
| GET    | /api/market/insights   | Yes  | AI market insights             |
| POST   | /api/market/providers  | Admin| Add provider data              |

## Security Model

- **JWT** access tokens (15min) + refresh tokens (7d)
- **bcrypt** password hashing (12 salt rounds)
- **Helmet.js** security headers
- **CORS** with allowed origins
- **Rate limiting** per endpoint type
- **Zod** input validation
- **File validation** (PDF only, 10MB max)
- **Prompt injection** protection in AI service
- **RBAC** admin vs user roles

## Database Indexes

| Collection   | Indexes                                                |
|-------------|--------------------------------------------------------|
| Users       | email (unique), role, createdAt                        |
| Policies    | userId+status, userId+type, providerName, policyNumber |
| Claims      | policyId+status, userId+claimDate, createdAt           |
| ChatHistory | userId+sessionId+timestamp, userId+policyId            |
| MarketData  | providerName (unique), claimSettlementRatio, rating    |
