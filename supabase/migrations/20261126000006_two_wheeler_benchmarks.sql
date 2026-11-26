-- Migration 000006: Two-Wheeler (Bike & Scooter) Repair Benchmarks
-- Adds vehicle_category column to vehicle_repair_benchmarks and seeds Indian 2-wheeler OEM parts.

ALTER TABLE public.vehicle_repair_benchmarks
    ADD COLUMN IF NOT EXISTS vehicle_category TEXT NOT NULL DEFAULT 'car';

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'vehicle_repair_benchmarks_vehicle_category_check'
    ) THEN
        ALTER TABLE public.vehicle_repair_benchmarks
            ADD CONSTRAINT vehicle_repair_benchmarks_vehicle_category_check
            CHECK (vehicle_category IN ('car', 'two_wheeler'));
    END IF;
END $$;

UPDATE public.vehicle_repair_benchmarks
SET vehicle_category = 'car'
WHERE vehicle_category IS NULL;

INSERT INTO public.vehicle_repair_benchmarks
    (part_key, part_label, vehicle_category, material_type, std_depreciation_pct, minor_min, minor_max, moderate_min, moderate_max, severe_min, severe_max, labor_paint_avg)
VALUES
    ('bike_fairing', 'Fairing / Side Cowl', 'two_wheeler', 'plastic', 50, 600, 1800, 1800, 4500, 4500, 9500, 900),
    ('fuel_tank', 'Fuel Tank', 'two_wheeler', 'metal', 10, 1500, 3500, 3500, 7500, 7000, 14000, 1500),
    ('front_mudguard', 'Front Mudguard / Fender', 'two_wheeler', 'plastic', 50, 400, 1100, 1000, 2400, 2200, 4500, 500),
    ('rear_mudguard', 'Rear Mudguard / Tail Cowl', 'two_wheeler', 'plastic', 50, 450, 1200, 1200, 2800, 2500, 5200, 600),
    ('handlebar_levers', 'Handlebar & Clutch/Brake Levers', 'two_wheeler', 'metal', 10, 400, 1200, 1200, 3200, 3000, 6500, 600),
    ('front_fork', 'Front Fork Assembly', 'two_wheeler', 'metal', 10, 1500, 3500, 3500, 7500, 7500, 16000, 1200),
    ('exhaust_silencer', 'Exhaust / Silencer Assembly', 'two_wheeler', 'metal', 10, 900, 2200, 2500, 5500, 5500, 12500, 700),
    ('bike_headlamp', 'Headlamp & Visor Assembly', 'two_wheeler', 'plastic', 50, 600, 1600, 1600, 4200, 4200, 9500, 500),
    ('bike_taillight', 'Tail Light / Indicator Assembly', 'two_wheeler', 'plastic', 50, 350, 900, 900, 2200, 2000, 4500, 400),
    ('bike_mirror', 'Rear-View Mirror(s)', 'two_wheeler', 'glass', 0, 200, 500, 500, 1200, 1000, 2200, 200),
    ('bike_wheel_tyre', 'Wheel Rim / Alloy & Tyre', 'two_wheeler', 'rubber', 50, 1200, 2500, 2500, 5200, 5000, 9500, 600)
ON CONFLICT (part_key) DO UPDATE SET
    part_label = EXCLUDED.part_label,
    vehicle_category = EXCLUDED.vehicle_category,
    material_type = EXCLUDED.material_type,
    std_depreciation_pct = EXCLUDED.std_depreciation_pct,
    minor_min = EXCLUDED.minor_min,
    minor_max = EXCLUDED.minor_max,
    moderate_min = EXCLUDED.moderate_min,
    moderate_max = EXCLUDED.moderate_max,
    severe_min = EXCLUDED.severe_min,
    severe_max = EXCLUDED.severe_max,
    labor_paint_avg = EXCLUDED.labor_paint_avg;
