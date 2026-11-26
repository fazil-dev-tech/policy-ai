const env = require('../config/env');
const { supabaseAdmin } = require('../config/supabase');
const aiService = require('./ai.service');
const searchService = require('./search.service');
const claimEngine = require('./claimEngine.service');
const logger = require('../utils/logger');

const NON_VEHICLE_MESSAGE = 'Uploaded image does not appear to contain a vehicle or car damage. Please upload clear exterior accident photos.';

const callLocalMlSidecar = async ({ files = [], vehicleInfo = {} }) => {
    const mlUrl = env.ML_SERVICE_URL;
    if (!mlUrl || files.length === 0) return null;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 12000);
    try {
        const form = new FormData();
        files.slice(0, 4).forEach((f, idx) => {
            const safeMime = f.mimetype === 'image/jpg' ? 'image/jpeg' : f.mimetype || 'image/jpeg';
            const blob = new Blob([f.buffer], { type: safeMime });
            form.append('files', blob, f.originalname || `photo_${idx}.jpg`);
        });
        form.append('vehicle_age', String(Math.max(0, new Date().getFullYear() - (Number(vehicleInfo.year) || 2022))));
        form.append('vehicle_segment', String(vehicleInfo.segment || 'hatchback_sedan'));

        const resp = await fetch(`${mlUrl.replace(/\/$/, '')}/analyze-damage`, {
            method: 'POST',
            body: form,
            signal: controller.signal,
        });
        if (!resp.ok) return null;
        return await resp.json();
    } catch (err) {
        logger.debug(`Local ml-service unreachable (${err.message}) — skipping Tier 2 cleanly.`);
        return null;
    } finally {
        clearTimeout(timer);
    }
};

const analyzeVehicleWithVision = async ({ imageFiles = [], vehicleInfo = {} }) => {
    const images = imageFiles
        .filter((f) => String(f.mimetype || '').startsWith('image/'))
        .slice(0, 4)
        .map((f) => ({
            mimeType: f.mimetype === 'image/jpg' ? 'image/jpeg' : f.mimetype,
            base64: f.buffer.toString('base64'),
        }));

    if (images.length === 0) return null;

    const vehicleDesc = [vehicleInfo.make, vehicleInfo.model, vehicleInfo.year].filter(Boolean).join(' ') || 'Indian passenger car';
    const prompt = `You are a certified Indian Motor Insurance Surveyor & Automotive Damage Estimator.
Analyze these exterior accident photo(s) for vehicle "${vehicleDesc}". Respond ONLY with valid JSON:
{
  "isVehicle": true,
  "vehicleDetected": "make/model/body type observed or empty string",
  "imageQuality": {
    "rating": "good | fair | poor",
    "warnings": ["list dark, blurry, cropped, rain, or glare issues if any"]
  },
  "damagedParts": [
    {
      "partKey": "one of: front_bumper, rear_bumper, headlight, taillight, windshield, bonnet_hood, fender, door_panel, side_mirror, grille, boot_lid, alloy_wheel_tyre",
      "partLabel": "Human readable part name",
      "severity": "minor | moderate | severe",
      "material": "plastic | metal | glass | rubber",
      "action": "Dent & Repaint | Repair | Replace",
      "damageDescription": "short factual observation of dent/scratch/crack",
      "confidence": 0-100
    }
  ],
  "overallSummary": "2-sentence visual damage summary"
}`;

    const res = await aiService.generateVisionJson({ prompt, images });
    return {
        ...res.data,
        aiModel: res.model,
        aiProvider: res.provider,
    };
};

const analyzeMotorAccident = async ({
    userId,
    policyId = null,
    incidentId = null,
    imageFiles = [],
    vehicleInfo = {},
    manualParts = [],
    garageQuoteTotal = 0,
}) => {
    let policy = {};
    if (policyId) {
        const { data: pol } = await supabaseAdmin
            .from('policies')
            .select('*')
            .eq('id', policyId)
            .eq('user_id', userId)
            .maybeSingle();
        if (pol) policy = pol;
    }

    const { data: benchmarks } = await supabaseAdmin.from('vehicle_repair_benchmarks').select('*');

    let detectionSource = 'benchmark_manual';
    let imageQuality = { rating: 'not_assessed', warnings: [] };
    let damagedParts = Array.isArray(manualParts) ? manualParts : [];
    let overallSummary = '';
    let isVehicle = true;

    const onlyPhotos = imageFiles.filter((f) => String(f.mimetype || '').startsWith('image/'));

    // Tier 1: OpenRouter Vision (Primary)
    if (onlyPhotos.length > 0) {
        try {
            const visionRes = await analyzeVehicleWithVision({ imageFiles: onlyPhotos, vehicleInfo });
            if (visionRes) {
                isVehicle = visionRes.isVehicle !== false;
                imageQuality = visionRes.imageQuality || { rating: 'good', warnings: [] };
                overallSummary = visionRes.overallSummary || '';
                if (!isVehicle) {
                    return {
                        rejected: true,
                        error: NON_VEHICLE_MESSAGE,
                        imageQuality,
                    };
                }
                if (Array.isArray(visionRes.damagedParts) && visionRes.damagedParts.length > 0) {
                    damagedParts = visionRes.damagedParts;
                    detectionSource = `openrouter_vision (${visionRes.aiModel || 'vision'})`;
                }
            }
        } catch (err) {
            logger.warn(`Tier 1 OpenRouter Vision failed (${err.message}), trying Tier 2 ml-service...`);
        }
    }

    let mlCostMultiplier = null;
    // Tier 2: Local ml-service/ (FastAPI + YOLOv8 + scikit-learn) fallback
    if ((detectionSource === 'benchmark_manual' || damagedParts.length === 0) && onlyPhotos.length > 0) {
        const mlRes = await callLocalMlSidecar({ files: onlyPhotos, vehicleInfo });
        if (mlRes) {
            if (mlRes.is_vehicle === false) {
                return {
                    rejected: true,
                    error: NON_VEHICLE_MESSAGE,
                    imageQuality: mlRes.image_quality || imageQuality,
                };
            }
            if (Number.isFinite(Number(mlRes.sklearnCostMultiplier))) {
                mlCostMultiplier = Number(mlRes.sklearnCostMultiplier);
            }
            if (Array.isArray(mlRes.damaged_parts) && mlRes.damaged_parts.length > 0) {
                damagedParts = mlRes.damaged_parts;
                detectionSource = mlRes.detection_source || 'local_yolov8_ml_service';
                imageQuality = mlRes.image_quality || imageQuality;
            }
        }
    }

    if (damagedParts.length === 0 && onlyPhotos.length > 0 && detectionSource === 'benchmark_manual') {
        detectionSource = 'vision_unavailable_manual_recommended';
        overallSummary =
            overallSummary ||
            'Automated damage detection could not inspect visible panels right now (Vision rate-limited & local ML sidecar unavailable). Select affected parts manually below for instant OEM repair & depreciation estimation.';
    }

    // Optional live OEM repair context from Tavily/Serper
    let oemLookup = null;
    if (damagedParts.length > 0 && (vehicleInfo.make || vehicleInfo.model)) {
        oemLookup = await searchService
            .lookupOemRepairCosts(vehicleInfo, damagedParts.map((p) => p.partLabel || p.partKey))
            .catch(() => null);
    }

    const estimate = claimEngine.computeMotorClaimEstimate({
        damagedParts,
        benchmarks: benchmarks || [],
        vehicleInfo,
        policy,
        garageQuoteTotal,
    });

    const disclaimer =
        'Internal/mechanical damage (radiator, chassis alignment, AC condenser, sensors) cannot be confirmed solely from exterior photos. Obtain a physical surveyor & workshop inspection.';

    const insertPayload = {
        user_id: userId,
        incident_id: incidentId || null,
        policy_id: policy.id || null,
        vehicle_info: vehicleInfo,
        detection_source: detectionSource,
        image_quality: imageQuality,
        damaged_parts: estimate.itemizedParts,
        estimated_repair_min: estimate.repairEstimate.min,
        estimated_repair_max: estimate.repairEstimate.max,
        estimated_payout: estimate.insurancePayout.estimatedPayout,
        out_of_pocket: estimate.insurancePayout.outOfPocket,
        breakdown: {
            summary: overallSummary,
            repairEstimate: estimate.repairEstimate,
            insurancePayout: estimate.insurancePayout,
            sklearnCostMultiplier: mlCostMultiplier,
            oemReferences: (oemLookup?.results || []).slice(0, 3),
        },
        disclaimer,
    };

    const { data: savedReport, error } = await supabaseAdmin
        .from('damage_reports')
        .insert(insertPayload)
        .select()
        .single();

    if (error) {
        logger.warn('Failed saving damage_report:', error.message);
    }

    return {
        rejected: false,
        analysisUnavailable: detectionSource === 'vision_unavailable_manual_recommended',
        report: savedReport || insertPayload,
        ...estimate,
        detectionSource,
        imageQuality,
        summary: overallSummary,
        oemReferences: (oemLookup?.results || []).slice(0, 3),
        disclaimer,
    };
};

module.exports = {
    analyzeMotorAccident,
};
