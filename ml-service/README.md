# PolicyGuard Local ML Sidecar (`ml-service/`)

Optional on-demand **Tier 2** motor accident fallback running locally on CPU (`FastAPI + CPU PyTorch + YOLOv8 + scikit-learn`).

- On cloud deployments (e.g., Vercel) or when stopped to save laptop RAM, Node/Express cleanly bypasses Tier 2 and uses **Tier 1 (NVIDIA NIM Vision + Tavily/Serper)** and **Tier 3 (Supabase Benchmarks + Deterministic Engine)**.
- Place optional custom CarDD weights at `ml-service/models/cardd_yolov8.pt` to upgrade from base `yolov8n.pt` vehicle verification to direct part-damage class boxes.

## Run Locally (On-Demand)
```powershell
cd ml-service
.\.venv\Scripts\activate
uvicorn main:app --host 127.0.0.1 --port 8000
```
