"""
PolicyGuard Optional Local ML Sidecar (FastAPI + CPU YOLOv8 + scikit-learn)
Designed for on-demand Tier 2 vehicle damage verification & fallback estimation
on CPU-only laptops (7.68 GB RAM safe via lazy model loading).
"""

import io
import os
import gc
import asyncio
from typing import List

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="PolicyGuard Local ML Sidecar", version="2.0.1")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# COCO vehicle class IDs: car=2, motorcycle=3, bus=5, truck=7
VEHICLE_COCO_CLASSES = {2, 3, 5, 7}
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
CARDD_WEIGHTS_PATH = os.path.join(BASE_DIR, "models", "cardd_yolov8.pt")
DEFAULT_YOLO_PATH = os.path.join(BASE_DIR, "yolov8n.pt")
MAX_IMAGE_BYTES = 10 * 1024 * 1024

_yolo_model = None
_yolo_mode = "unloaded"
_cost_regressor = None


def get_cost_regressor():
    """Fit lightweight Indian vehicle severity/age multiplier calibrator lazily."""
    global _cost_regressor
    if _cost_regressor is not None:
        return _cost_regressor

    import numpy as np
    from sklearn.ensemble import RandomForestRegressor

    # Features: [severity_score (1=minor,2=mod,3=severe), vehicle_age_years, segment (0=hatch,1=sedan,2=suv), damaged_zone_count]
    X = np.array([
        [1, 1, 0, 1], [2, 2, 0, 2], [3, 2, 0, 3],
        [1, 3, 1, 1], [2, 3, 1, 2], [3, 4, 1, 4],
        [1, 1, 2, 1], [2, 2, 2, 3], [3, 2, 2, 4],
        [2, 6, 0, 2], [3, 7, 1, 3], [2, 5, 2, 2],
    ], dtype=float)
    # Calibrated repair multiplier factor against base matrix
    y = np.array([0.85, 1.0, 1.25, 0.95, 1.15, 1.45, 1.2, 1.4, 1.75, 0.9, 1.25, 1.35], dtype=float)

    model = RandomForestRegressor(n_estimators=24, random_state=42)
    model.fit(X, y)
    _cost_regressor = model
    return _cost_regressor


def get_yolo_model():
    """Lazy-load custom CarDD weights if present, else standard CPU yolov8n."""
    global _yolo_model, _yolo_mode
    if _yolo_model is not None:
        return _yolo_model, _yolo_mode

    from ultralytics import YOLO

    if os.path.exists(CARDD_WEIGHTS_PATH):
        _yolo_model = YOLO(CARDD_WEIGHTS_PATH)
        _yolo_mode = "cardd_damage"
    else:
        weights = DEFAULT_YOLO_PATH if os.path.exists(DEFAULT_YOLO_PATH) else "yolov8n.pt"
        _yolo_model = YOLO(weights)
        _yolo_mode = "coco_vehicle_guard"

    return _yolo_model, _yolo_mode


def map_cardd_label(label: str) -> tuple:
    low = str(label or "").lower()
    if "front" in low and "bumper" in low:
        return ("front_bumper", "plastic")
    if "rear" in low and "bumper" in low:
        return ("rear_bumper", "plastic")
    if "bumper" in low:
        return ("front_bumper", "plastic")
    if "windshield" in low or "glass" in low:
        return ("windshield", "glass")
    if "headlight" in low or "lamp" in low:
        return ("headlight", "glass")
    if "taillight" in low:
        return ("taillight", "glass")
    if "hood" in low or "bonnet" in low:
        return ("bonnet_hood", "metal")
    if "fender" in low:
        return ("fender", "metal")
    if "mirror" in low:
        return ("side_mirror", "plastic")
    if "tyre" in low or "tire" in low or "wheel" in low:
        return ("alloy_wheel_tyre", "rubber")
    return ("door_panel", "metal")


def assess_image_quality(bgr_img) -> dict:
    import cv2
    import numpy as np
    gray = cv2.cvtColor(bgr_img, cv2.COLOR_BGR2GRAY)
    blur_var = float(cv2.Laplacian(gray, cv2.CV_64F).var())
    brightness = float(np.mean(gray))
    warnings = []
    if blur_var < 60:
        warnings.append("Image appears blurry — retake close-up photo in clear focus")
    if brightness < 48:
        warnings.append("Low lighting detected — retake in daylight or flash")
    elif brightness > 225:
        warnings.append("Heavy glare / overexposure detected")

    rating = "poor" if len(warnings) >= 2 or blur_var < 35 else "fair" if warnings else "good"
    return {
        "rating": rating,
        "blurScore": round(blur_var, 1),
        "brightness": round(brightness, 1),
        "warnings": warnings,
    }


def infer_damaged_zones_from_box(bgr_img, box_xyxy, vehicle_category: str = "car") -> List[dict]:
    """Heuristic surface anomaly detector inside detected vehicle bounding box."""
    import cv2
    import numpy as np
    h, w = bgr_img.shape[:2]
    x1, y1, x2, y2 = [max(0, int(v)) for v in box_xyxy]
    crop = bgr_img[y1:max(y1 + 20, y2), x1:max(x1 + 20, x2)]
    if crop.size == 0:
        crop = bgr_img

    gray = cv2.cvtColor(crop, cv2.COLOR_BGR2GRAY)
    edges = cv2.Canny(gray, 80, 190)
    ch, cw = edges.shape[:2]

    # Split detected vehicle region into upper, middle, and lower damage zones
    lower_density = float(np.mean(edges[int(ch * 0.6):, :] > 0))
    mid_density = float(np.mean(edges[int(ch * 0.28):int(ch * 0.65), :] > 0))
    upper_density = float(np.mean(edges[:int(ch * 0.35), :] > 0))

    zones = []
    if vehicle_category == "two_wheeler":
        if lower_density > 0.08:
            sev = "severe" if lower_density > 0.16 else "moderate"
            zones.append({
                "partKey": "front_mudguard",
                "partLabel": "Front Mudguard / Fork Area",
                "severity": sev,
                "material": "plastic",
                "action": "Replace" if sev == "severe" else "Repair / Repaint",
                "damageDescription": f"High surface irregularity density ({round(lower_density * 100, 1)}%) in lower mudguard / fork zone",
                "confidence": 70,
            })
        if mid_density > 0.09:
            sev = "moderate" if mid_density < 0.17 else "severe"
            zones.append({
                "partKey": "fuel_tank",
                "partLabel": "Fuel Tank / Side Cowl",
                "severity": sev,
                "material": "metal",
                "action": "Dent & Repaint" if sev == "moderate" else "Replace",
                "damageDescription": "Surface crease/dent edge cluster detected in mid tank/fairing zone",
                "confidence": 68,
            })
        if upper_density > 0.10:
            zones.append({
                "partKey": "bike_headlamp",
                "partLabel": "Headlamp & Visor Assembly",
                "severity": "moderate",
                "material": "plastic",
                "action": "Repair / Replace",
                "damageDescription": "Upper visor / headlamp cowl edge anomaly detected",
                "confidence": 65,
            })
        return zones

    if lower_density > 0.085:
        sev = "severe" if lower_density > 0.16 else "moderate"
        zones.append({
            "partKey": "front_bumper",
            "partLabel": "Front / Lower Bumper",
            "severity": sev,
            "material": "plastic",
            "action": "Replace" if sev == "severe" else "Repair / Repaint",
            "damageDescription": f"High surface irregularity density ({round(lower_density * 100, 1)}%) in lower bumper zone",
            "confidence": 72,
        })
    if mid_density > 0.095:
        sev = "moderate" if mid_density < 0.17 else "severe"
        zones.append({
            "partKey": "fender",
            "partLabel": "Fender / Side Panel",
            "severity": sev,
            "material": "metal",
            "action": "Dent & Repaint" if sev == "moderate" else "Replace",
            "damageDescription": "Surface crease/dent edge cluster detected in mid vehicle zone",
            "confidence": 68,
        })
    if upper_density > 0.11:
        zones.append({
            "partKey": "bonnet_hood",
            "partLabel": "Bonnet / Hood Area",
            "severity": "moderate",
            "material": "metal",
            "action": "Dent & Repaint",
            "damageDescription": "Upper hood/glass edge anomaly detected",
            "confidence": 65,
        })

    return zones


@app.get("/")
def root():
    return {
        "service": "PolicyGuard Local ML Sidecar",
        "status": "running",
        "healthCheck": "/health",
        "docs": "/docs",
        "frontendApp": "http://localhost:5173",
    }


@app.get("/health")
def health():
    return {
        "status": "ok",
        "device": "cpu",
        "yoloMode": _yolo_mode,
        "carddWeightsPresent": os.path.exists(CARDD_WEIGHTS_PATH),
    }


@app.post("/unload")
def unload_models():
    global _yolo_model, _yolo_mode
    _yolo_model = None
    _yolo_mode = "unloaded"
    gc.collect()
    return {"status": "unloaded", "message": "YOLOv8 model unloaded to free RAM"}


@app.post("/analyze-damage")
async def analyze_damage(
    files: List[UploadFile] = File(...),
    vehicle_age: int = Form(2),
    vehicle_segment: str = Form("hatchback_sedan"),
):
    import cv2
    import numpy as np
    from PIL import Image, ImageFile

    ImageFile.LOAD_TRUNCATED_IMAGES = True
    model, mode = get_yolo_model()
    segment_map = {"hatchback": 0, "hatchback_sedan": 1, "sedan": 1, "suv": 2, "two_wheeler": 0}
    seg_key = vehicle_segment.lower()
    seg_code = segment_map.get(seg_key, 1)
    requested_category = "two_wheeler" if seg_key in {"two_wheeler", "2w", "bike", "motorcycle", "scooter"} else "car"
    detected_vehicle_category = requested_category

    vehicle_found = False
    quality_reports = []
    collected_parts = []

    for upload in files[:4]:
        raw = await upload.read(MAX_IMAGE_BYTES + 1)
        if len(raw) > MAX_IMAGE_BYTES:
            raise HTTPException(status_code=413, detail=f"Image '{upload.filename}' exceeds 10MB limit")
        try:
            pil_img = Image.open(io.BytesIO(raw)).convert("RGB")
            pil_img.thumbnail((1920, 1920))
        except Exception as exc:
            raise HTTPException(status_code=400, detail=f"Unreadable image file '{upload.filename}': {exc}") from exc
        rgb_np = np.array(pil_img)
        bgr_np = cv2.cvtColor(rgb_np, cv2.COLOR_RGB2BGR)
        quality_reports.append(assess_image_quality(bgr_np))

        results = await asyncio.to_thread(
            model.predict, source=rgb_np, imgsz=640, conf=0.25, device="cpu", verbose=False
        )
        for r in results:
            boxes = r.boxes
            if boxes is None or len(boxes) == 0:
                continue
            if mode == "coco_vehicle_guard":
                # Evaluate ONLY the largest/primary vehicle bounding box per frame so background traffic is ignored
                primary_box = None
                primary_cls_id = None
                best_score = -1.0
                for box in boxes:
                    cls_id = int(box.cls[0])
                    if cls_id not in VEHICLE_COCO_CLASSES:
                        continue
                    x1, y1, x2, y2 = box.xyxy[0].tolist()
                    area = max(1.0, (x2 - x1) * (y2 - y1))
                    rank = area * float(box.conf[0])
                    if rank > best_score:
                        best_score = rank
                        primary_box = box.xyxy[0].tolist()
                        primary_cls_id = cls_id
                if primary_box is not None:
                    vehicle_found = True
                    frame_category = "two_wheeler" if (primary_cls_id == 3 or requested_category == "two_wheeler") else "car"
                    if primary_cls_id == 3:
                        detected_vehicle_category = "two_wheeler"
                    collected_parts.extend(infer_damaged_zones_from_box(bgr_np, primary_box, frame_category))
            else:
                for box in boxes:
                    cls_id = int(box.cls[0])
                    conf = float(box.conf[0])
                    vehicle_found = True
                    label = r.names.get(cls_id, "damage")
                    part_key, material = map_cardd_label(label)
                    sev = "severe" if conf > 0.72 else "moderate" if conf > 0.45 else "minor"
                    collected_parts.append({
                        "partKey": part_key,
                        "partLabel": label.title(),
                        "severity": sev,
                        "material": material,
                        "action": "Replace" if sev == "severe" else "Dent & Repaint",
                        "damageDescription": f"CarDD YOLOv8 detection ({round(conf * 100)}% confidence)",
                        "confidence": round(conf * 100),
                    })

    if not vehicle_found:
        return {
            "is_vehicle": False,
            "detection_source": f"local_ml_{mode}",
            "image_quality": quality_reports[0] if quality_reports else {"rating": "poor", "warnings": []},
            "damaged_parts": [],
        }

    # Deduplicate detected parts by partKey keeping highest severity
    sev_rank = {"minor": 1, "moderate": 2, "severe": 3}
    dedup = {}
    for p in collected_parts:
        k = p["partKey"]
        if k not in dedup or sev_rank.get(p["severity"], 1) > sev_rank.get(dedup[k]["severity"], 1):
            dedup[k] = p
    final_parts = list(dedup.values())

    avg_sev = float(np.mean([sev_rank.get(p["severity"], 2) for p in final_parts])) if final_parts else 1.5
    reg = get_cost_regressor()
    multiplier = float(reg.predict(np.array([[avg_sev, float(vehicle_age), float(seg_code), float(len(final_parts))]]))[0])

    merged_warnings = []
    for q in quality_reports:
        merged_warnings.extend(q.get("warnings", []))

    return {
        "is_vehicle": True,
        "detected_vehicle_category": detected_vehicle_category,
        "detection_source": f"local_yolov8_sklearn ({mode})",
        "image_quality": {
            "rating": quality_reports[0]["rating"] if quality_reports else "good",
            "warnings": list(dict.fromkeys(merged_warnings)),
        },
        "sklearnCostMultiplier": round(multiplier, 2),
        "damaged_parts": final_parts,
    }
