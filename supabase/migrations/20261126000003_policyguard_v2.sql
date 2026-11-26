-- ============================================================================
-- PolicyGuard v2 Additive Schema Migration (Non-Breaking Extension)
-- Preserves all Stage 1 tables (profiles, policies, claims, documents,
-- chat_history, market_data) and extends storage + tables additively.
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ----------------------------------------------------------------------------
-- 1. Expand policy-files bucket to accept PDFs + evidence images (10 MB cap)
-- ----------------------------------------------------------------------------
UPDATE storage.buckets
SET allowed_mime_types = ARRAY[
        'application/pdf',
        'image/jpeg',
        'image/png',
        'image/webp'
    ],
    file_size_limit = 10485760
WHERE id = 'policy-files';

-- ----------------------------------------------------------------------------
-- 2. Family Members Vault
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.family_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    full_name TEXT NOT NULL,
    relationship TEXT NOT NULL DEFAULT 'self'
        CHECK (relationship IN ('self', 'spouse', 'child', 'parent', 'in_law', 'sibling', 'other')),
    date_of_birth DATE,
    blood_group TEXT DEFAULT '',
    emergency_contact TEXT DEFAULT '',
    chronic_conditions TEXT[] NOT NULL DEFAULT '{}',
    notes TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_family_members_user ON public.family_members(user_id, created_at DESC);

DROP TRIGGER IF EXISTS trg_family_members_updated_at ON public.family_members;
CREATE TRIGGER trg_family_members_updated_at
    BEFORE UPDATE ON public.family_members
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.family_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own family members" ON public.family_members;
CREATE POLICY "Users manage own family members"
    ON public.family_members FOR ALL
    USING (auth.uid() = user_id OR public.is_admin())
    WITH CHECK (auth.uid() = user_id);

-- ----------------------------------------------------------------------------
-- 3. Non-breaking column additions to public.policies
-- ----------------------------------------------------------------------------
ALTER TABLE public.policies
    ADD COLUMN IF NOT EXISTS structured_terms JSONB NOT NULL DEFAULT '{}'::jsonb,
    ADD COLUMN IF NOT EXISTS health_score INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS inception_date TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS cis_summary JSONB NOT NULL DEFAULT '{}'::jsonb,
    ADD COLUMN IF NOT EXISTS renewal_diff JSONB NOT NULL DEFAULT '{}'::jsonb,
    ADD COLUMN IF NOT EXISTS family_member_id UUID REFERENCES public.family_members(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_policies_family_member ON public.policies(family_member_id);

-- ----------------------------------------------------------------------------
-- 4. Policy Clauses (Zero-Quota Postgres FTS for Page + Clause Citations)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.policy_clauses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    policy_id UUID NOT NULL REFERENCES public.policies(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    page_number INTEGER NOT NULL DEFAULT 1,
    section_title TEXT NOT NULL DEFAULT '',
    clause_text TEXT NOT NULL,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    search_vector TSVECTOR GENERATED ALWAYS AS (
        to_tsvector('english', coalesce(section_title, '') || ' ' || coalesce(clause_text, ''))
    ) STORED,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_policy_clauses_policy_page ON public.policy_clauses(policy_id, page_number);
CREATE INDEX IF NOT EXISTS idx_policy_clauses_search ON public.policy_clauses USING GIN(search_vector);

ALTER TABLE public.policy_clauses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own policy clauses" ON public.policy_clauses;
CREATE POLICY "Users manage own policy clauses"
    ON public.policy_clauses FOR ALL
    USING (auth.uid() = user_id OR public.is_admin())
    WITH CHECK (auth.uid() = user_id);

-- ----------------------------------------------------------------------------
-- 5. Incidents (7-Scenario Multi-File Claim & Audit Packets)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.incidents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    policy_id UUID REFERENCES public.policies(id) ON DELETE SET NULL,
    scenario_type TEXT NOT NULL DEFAULT 'medical_claim'
        CHECK (scenario_type IN (
            'full_policy',
            'card_only',
            'medical_claim',
            'motor_accident',
            'settlement_audit',
            'agent_mis_selling',
            'renewal_diff',
            'general'
        )),
    incident_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    title TEXT NOT NULL DEFAULT 'Claim Assessment',
    description TEXT NOT NULL DEFAULT '',
    estimated_amount NUMERIC NOT NULL DEFAULT 0 CHECK (estimated_amount >= 0),
    claimant_details JSONB NOT NULL DEFAULT '{}'::jsonb,
    payout_calculation JSONB NOT NULL DEFAULT '{}'::jsonb,
    readiness_score INTEGER NOT NULL DEFAULT 0 CHECK (readiness_score >= 0 AND readiness_score <= 100),
    readiness_checklist JSONB NOT NULL DEFAULT '[]'::jsonb,
    audit_trail JSONB NOT NULL DEFAULT '{}'::jsonb,
    status TEXT NOT NULL DEFAULT 'analyzed'
        CHECK (status IN ('draft', 'analyzed', 'submitted', 'settled', 'escalated')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_incidents_user_date ON public.incidents(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_incidents_policy ON public.incidents(policy_id);

DROP TRIGGER IF EXISTS trg_incidents_updated_at ON public.incidents;
CREATE TRIGGER trg_incidents_updated_at
    BEFORE UPDATE ON public.incidents
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.incidents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own incidents" ON public.incidents;
CREATE POLICY "Users manage own incidents"
    ON public.incidents FOR ALL
    USING (auth.uid() = user_id OR public.is_admin())
    WITH CHECK (auth.uid() = user_id);

-- ----------------------------------------------------------------------------
-- 6. Evidence Files (PDF, X-Ray, Doctor Script, Photos, Garage Quotes)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.evidence_files (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    incident_id UUID REFERENCES public.incidents(id) ON DELETE CASCADE,
    policy_id UUID REFERENCES public.policies(id) ON DELETE SET NULL,
    file_name TEXT NOT NULL,
    mime_type TEXT NOT NULL,
    file_size BIGINT NOT NULL DEFAULT 0,
    storage_path TEXT NOT NULL,
    doc_category TEXT NOT NULL DEFAULT 'other'
        CHECK (doc_category IN (
            'policy_pdf', 'e_card', 'doctor_script', 'lab_xray',
            'hospital_estimate', 'discharge_summary', 'vehicle_photo',
            'garage_quote', 'settlement_sheet', 'brochure', 'other'
        )),
    ocr_text TEXT NOT NULL DEFAULT '',
    extracted_data JSONB NOT NULL DEFAULT '{}'::jsonb,
    confidence_score INTEGER NOT NULL DEFAULT 75 CHECK (confidence_score >= 0 AND confidence_score <= 100),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_evidence_incident ON public.evidence_files(incident_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_evidence_user ON public.evidence_files(user_id, created_at DESC);

ALTER TABLE public.evidence_files ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own evidence files" ON public.evidence_files;
CREATE POLICY "Users manage own evidence files"
    ON public.evidence_files FOR ALL
    USING (auth.uid() = user_id OR public.is_admin())
    WITH CHECK (auth.uid() = user_id);

-- ----------------------------------------------------------------------------
-- 7. Vehicle Damage Reports
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.damage_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    incident_id UUID REFERENCES public.incidents(id) ON DELETE SET NULL,
    policy_id UUID REFERENCES public.policies(id) ON DELETE SET NULL,
    vehicle_info JSONB NOT NULL DEFAULT '{}'::jsonb,
    detection_source TEXT NOT NULL DEFAULT 'openrouter_vision',
    image_quality JSONB NOT NULL DEFAULT '{}'::jsonb,
    damaged_parts JSONB NOT NULL DEFAULT '[]'::jsonb,
    estimated_repair_min NUMERIC NOT NULL DEFAULT 0,
    estimated_repair_max NUMERIC NOT NULL DEFAULT 0,
    estimated_payout NUMERIC NOT NULL DEFAULT 0,
    out_of_pocket NUMERIC NOT NULL DEFAULT 0,
    breakdown JSONB NOT NULL DEFAULT '{}'::jsonb,
    disclaimer TEXT NOT NULL DEFAULT 'Internal/mechanical damage cannot be confirmed solely from exterior photos.',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_damage_reports_user ON public.damage_reports(user_id, created_at DESC);

DROP TRIGGER IF EXISTS trg_damage_reports_updated_at ON public.damage_reports;
CREATE TRIGGER trg_damage_reports_updated_at
    BEFORE UPDATE ON public.damage_reports
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.damage_reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own damage reports" ON public.damage_reports;
CREATE POLICY "Users manage own damage reports"
    ON public.damage_reports FOR ALL
    USING (auth.uid() = user_id OR public.is_admin())
    WITH CHECK (auth.uid() = user_id);

-- ----------------------------------------------------------------------------
-- 8. Settlement Audits & Discrepancy Letters
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.settlements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    incident_id UUID REFERENCES public.incidents(id) ON DELETE SET NULL,
    policy_id UUID REFERENCES public.policies(id) ON DELETE SET NULL,
    claimed_amount NUMERIC NOT NULL DEFAULT 0,
    approved_amount NUMERIC NOT NULL DEFAULT 0,
    shortfall_amount NUMERIC NOT NULL DEFAULT 0,
    line_items JSONB NOT NULL DEFAULT '[]'::jsonb,
    discrepancy_flags JSONB NOT NULL DEFAULT '[]'::jsonb,
    grievance_letter TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_settlements_user ON public.settlements(user_id, created_at DESC);

ALTER TABLE public.settlements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own settlements" ON public.settlements;
CREATE POLICY "Users manage own settlements"
    ON public.settlements FOR ALL
    USING (auth.uid() = user_id OR public.is_admin())
    WITH CHECK (auth.uid() = user_id);

-- ----------------------------------------------------------------------------
-- 9. Agent Promise & Mis-selling Tracking
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.agent_followups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    policy_id UUID REFERENCES public.policies(id) ON DELETE CASCADE,
    agent_name TEXT NOT NULL DEFAULT '',
    intermediary_code TEXT NOT NULL DEFAULT '',
    channel TEXT NOT NULL DEFAULT 'agent'
        CHECK (channel IN ('agent', 'broker', 'bank', 'online', 'direct', 'other')),
    promised_terms JSONB NOT NULL DEFAULT '{}'::jsonb,
    discrepancy_report JSONB NOT NULL DEFAULT '[]'::jsonb,
    status TEXT NOT NULL DEFAULT 'open'
        CHECK (status IN ('open', 'verified_match', 'mis_selling_risk', 'resolved')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_agent_followups_policy ON public.agent_followups(policy_id, created_at DESC);

DROP TRIGGER IF EXISTS trg_agent_followups_updated_at ON public.agent_followups;
CREATE TRIGGER trg_agent_followups_updated_at
    BEFORE UPDATE ON public.agent_followups
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.agent_followups ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own agent followups" ON public.agent_followups;
CREATE POLICY "Users manage own agent followups"
    ON public.agent_followups FOR ALL
    USING (auth.uid() = user_id OR public.is_admin())
    WITH CHECK (auth.uid() = user_id);

-- ----------------------------------------------------------------------------
-- 10. Verified Domains Registry (Insurers, Payment Gateways, TPAs, Portals)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.verified_domains (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    domain TEXT NOT NULL UNIQUE,
    provider_name TEXT NOT NULL,
    category TEXT NOT NULL DEFAULT 'insurer'
        CHECK (category IN ('insurer', 'regulator', 'payment_gateway', 'tpa', 'aggregator')),
    official_helpline TEXT NOT NULL DEFAULT '',
    grievance_email TEXT NOT NULL DEFAULT '',
    is_active BOOLEAN NOT NULL DEFAULT true,
    verified_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_verified_domains_active ON public.verified_domains(domain) WHERE is_active = true;

DROP TRIGGER IF EXISTS trg_verified_domains_updated_at ON public.verified_domains;
CREATE TRIGGER trg_verified_domains_updated_at
    BEFORE UPDATE ON public.verified_domains
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.verified_domains ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can read verified domains" ON public.verified_domains;
CREATE POLICY "Public can read verified domains"
    ON public.verified_domains FOR SELECT
    USING (auth.role() IN ('authenticated', 'anon'));

DROP POLICY IF EXISTS "Admins manage verified domains" ON public.verified_domains;
CREATE POLICY "Admins manage verified domains"
    ON public.verified_domains FOR ALL
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

INSERT INTO public.verified_domains (domain, provider_name, category, official_helpline, grievance_email)
VALUES
    ('starhealth.in', 'Star Health and Allied Insurance', 'insurer', '1800-425-2255', 'gro@starhealth.in'),
    ('hdfcergo.com', 'HDFC ERGO General Insurance', 'insurer', '022-6234-6234', 'grievance@hdfcergo.com'),
    ('icicilombard.com', 'ICICI Lombard General Insurance', 'insurer', '1800-2666', 'customersupport@icicilombard.com'),
    ('licindia.in', 'Life Insurance Corporation of India', 'insurer', '022-6827-6827', 'co_crm_grv@licindia.com'),
    ('bajajallianz.com', 'Bajaj Allianz General Insurance', 'insurer', '1800-209-5858', 'bagichelp@bajajallianz.co.in'),
    ('newindia.co.in', 'The New India Assurance Co. Ltd.', 'insurer', '1800-209-1415', 'tech.support@newindia.co.in'),
    ('tataaig.com', 'Tata AIG General Insurance', 'insurer', '1800-266-7780', 'customersupport@tataaig.com'),
    ('careinsurance.com', 'Care Health Insurance', 'insurer', '1800-102-4488', 'customerfirst@careinsurance.com'),
    ('nivabupa.com', 'Niva Bupa Health Insurance', 'insurer', '1860-500-8888', 'customercare@nivabupa.com'),
    ('acko.com', 'Acko General Insurance', 'insurer', '1800-266-2256', 'gro@acko.com'),
    ('godigit.com', 'Go Digit General Insurance', 'insurer', '1800-258-5956', 'hello@godigit.com'),
    ('sbigeneral.in', 'SBI General Insurance', 'insurer', '1800-102-1111', 'customer.care@sbigeneral.in'),
    ('irdai.gov.in', 'Insurance Regulatory and Development Authority of India', 'regulator', '155255', 'complaints@irdai.gov.in'),
    ('bimabharosa.irdai.gov.in', 'IRDAI Bima Bharosa Portal', 'regulator', '155255', 'complaints@irdai.gov.in'),
    ('policybazaar.com', 'Policybazaar Insurance Brokers', 'aggregator', '1800-208-8787', 'care@policybazaar.com'),
    ('razorpay.com', 'Razorpay Payment Gateway', 'payment_gateway', '', ''),
    ('billdesk.com', 'BillDesk Payment Gateway', 'payment_gateway', '', ''),
    ('payu.in', 'PayU Payment Gateway', 'payment_gateway', '', ''),
    ('mediassistindia.com', 'Medi Assist TPA', 'tpa', '1800-425-9449', ''),
    ('fhpl.net', 'Family Health Plan Insurance TPA', 'tpa', '1800-425-0333', ''),
    ('vidalhealthtpa.com', 'Vidal Health TPA', 'tpa', '1800-425-8888', '')
ON CONFLICT (domain) DO NOTHING;

-- ----------------------------------------------------------------------------
-- 11. Site Scans Cache & Extension Telemetry
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.site_scans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    url TEXT NOT NULL,
    domain TEXT NOT NULL UNIQUE,
    source_surface TEXT NOT NULL DEFAULT 'web'
        CHECK (source_surface IN ('web', 'whatsapp', 'gmail', 'manual')),
    status TEXT NOT NULL DEFAULT 'safe'
        CHECK (status IN ('safe', 'suspicious', 'threat')),
    risk_score INTEGER NOT NULL DEFAULT 0 CHECK (risk_score >= 0 AND risk_score <= 100),
    reasons JSONB NOT NULL DEFAULT '[]'::jsonb,
    vt_stats JSONB NOT NULL DEFAULT '{}'::jsonb,
    rdap_age_days INTEGER,
    hit_count INTEGER NOT NULL DEFAULT 1,
    last_scanned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '24 hours'),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_site_scans_status ON public.site_scans(status, last_scanned_at DESC);
CREATE INDEX IF NOT EXISTS idx_site_scans_user ON public.site_scans(user_id, last_scanned_at DESC);

ALTER TABLE public.site_scans ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users view own or public scan cache" ON public.site_scans;
CREATE POLICY "Users view own or public scan cache"
    ON public.site_scans FOR SELECT
    USING (auth.uid() = user_id OR user_id IS NULL OR public.is_admin());

-- ----------------------------------------------------------------------------
-- 12. Community Scam Reports (Moderated by Admin)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.scam_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    reported_url TEXT NOT NULL,
    domain TEXT NOT NULL,
    source_surface TEXT NOT NULL DEFAULT 'web'
        CHECK (source_surface IN ('web', 'whatsapp', 'gmail', 'manual')),
    category TEXT NOT NULL DEFAULT 'phishing'
        CHECK (category IN ('phishing', 'fake_renewal', 'apk_malware', 'upi_scam', 'impersonation', 'other')),
    description TEXT NOT NULL DEFAULT '',
    evidence JSONB NOT NULL DEFAULT '{}'::jsonb,
    moderation_status TEXT NOT NULL DEFAULT 'pending'
        CHECK (moderation_status IN ('pending', 'verified', 'rejected')),
    moderator_notes TEXT NOT NULL DEFAULT '',
    reviewed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    reviewed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_scam_reports_status ON public.scam_reports(moderation_status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_scam_reports_domain ON public.scam_reports(domain);

DROP TRIGGER IF EXISTS trg_scam_reports_updated_at ON public.scam_reports;
CREATE TRIGGER trg_scam_reports_updated_at
    BEFORE UPDATE ON public.scam_reports
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.scam_reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users view own or verified scam reports" ON public.scam_reports;
CREATE POLICY "Users view own or verified scam reports"
    ON public.scam_reports FOR SELECT
    USING (auth.uid() = user_id OR moderation_status = 'verified' OR public.is_admin());

DROP POLICY IF EXISTS "Authenticated users submit scam reports" ON public.scam_reports;
CREATE POLICY "Authenticated users submit scam reports"
    ON public.scam_reports FOR INSERT
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins moderate scam reports" ON public.scam_reports;
CREATE POLICY "Admins moderate scam reports"
    ON public.scam_reports FOR UPDATE
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

-- ----------------------------------------------------------------------------
-- 13. Research Cache & Indian Benchmark Tables (Zero-Quota Fallback)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.research_cache (
    cache_key TEXT PRIMARY KEY,
    source TEXT NOT NULL DEFAULT 'tavily',
    query TEXT NOT NULL,
    result_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '24 hours'),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_research_cache_expires ON public.research_cache(expires_at);

ALTER TABLE public.research_cache ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated read research cache" ON public.research_cache;
CREATE POLICY "Authenticated read research cache"
    ON public.research_cache FOR SELECT
    USING (auth.role() = 'authenticated');

CREATE TABLE IF NOT EXISTS public.vehicle_repair_benchmarks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    part_key TEXT NOT NULL UNIQUE,
    part_label TEXT NOT NULL,
    material_type TEXT NOT NULL DEFAULT 'plastic'
        CHECK (material_type IN ('plastic', 'rubber', 'glass', 'metal', 'electrical', 'paint')),
    std_depreciation_pct NUMERIC NOT NULL DEFAULT 50,
    minor_min NUMERIC NOT NULL DEFAULT 1500,
    minor_max NUMERIC NOT NULL DEFAULT 4500,
    moderate_min NUMERIC NOT NULL DEFAULT 4500,
    moderate_max NUMERIC NOT NULL DEFAULT 14000,
    severe_min NUMERIC NOT NULL DEFAULT 12000,
    severe_max NUMERIC NOT NULL DEFAULT 38000,
    labor_paint_avg NUMERIC NOT NULL DEFAULT 3500
);

INSERT INTO public.vehicle_repair_benchmarks
    (part_key, part_label, material_type, std_depreciation_pct, minor_min, minor_max, moderate_min, moderate_max, severe_min, severe_max, labor_paint_avg)
VALUES
    ('front_bumper', 'Front Bumper', 'plastic', 50, 2000, 4500, 5000, 12000, 11000, 26000, 4000),
    ('rear_bumper', 'Rear Bumper', 'plastic', 50, 1800, 4200, 4800, 11500, 10500, 24000, 3800),
    ('headlight', 'Headlamp Assembly', 'glass', 0, 1500, 4000, 4500, 14000, 12000, 42000, 1500),
    ('taillight', 'Tail Lamp Assembly', 'glass', 0, 1200, 3000, 3500, 9000, 8000, 22000, 1200),
    ('windshield', 'Front Windshield Glass', 'glass', 0, 2000, 4500, 6500, 15000, 14000, 32000, 2500),
    ('bonnet_hood', 'Bonnet / Hood Panel', 'metal', 15, 2500, 6000, 7000, 16000, 15000, 38000, 5500),
    ('fender', 'Front Fender', 'metal', 15, 2000, 4500, 5000, 12000, 11000, 24000, 4000),
    ('door_panel', 'Side Door Panel', 'metal', 15, 2200, 5500, 6500, 16000, 15000, 36000, 5000),
    ('side_mirror', 'ORVM Side Mirror', 'plastic', 50, 1200, 2800, 3000, 7500, 7000, 18000, 1000),
    ('grille', 'Front Grille', 'plastic', 50, 1000, 2500, 3000, 8000, 7000, 16000, 1000),
    ('boot_lid', 'Boot / Tailgate', 'metal', 15, 2500, 6000, 7500, 18000, 16000, 40000, 5000),
    ('alloy_wheel_tyre', 'Wheel / Tyre / Rim', 'rubber', 50, 1500, 4000, 5000, 12000, 11000, 28000, 1200)
ON CONFLICT (part_key) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.medical_cost_benchmarks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    procedure_key TEXT NOT NULL UNIQUE,
    procedure_name TEXT NOT NULL,
    category TEXT NOT NULL,
    avg_cost_tier1 NUMERIC NOT NULL,
    avg_cost_tier2 NUMERIC NOT NULL,
    typical_los_days INTEGER NOT NULL DEFAULT 2,
    standard_waiting_months INTEGER NOT NULL DEFAULT 24
);

INSERT INTO public.medical_cost_benchmarks
    (procedure_key, procedure_name, category, avg_cost_tier1, avg_cost_tier2, typical_los_days, standard_waiting_months)
VALUES
    ('appendectomy', 'Appendectomy (Laparoscopic)', 'surgery', 65000, 42000, 2, 1),
    ('cataract_single', 'Cataract Surgery (Single Eye)', 'ophthalmology', 45000, 28000, 1, 24),
    ('knee_replacement', 'Total Knee Replacement (Unilateral)', 'orthopedics', 240000, 165000, 5, 24),
    ('gallbladder_stones', 'Cholecystectomy / Gallbladder Stones', 'gi_surgery', 85000, 55000, 2, 24),
    ('angioplasty', 'Coronary Angioplasty (PTCA + Stent)', 'cardiac', 210000, 145000, 3, 1),
    ('dengue_hospitalization', 'Acute Viral / Dengue ICU Care', 'medical', 55000, 35000, 4, 1),
    ('fracture_fixation', 'Orthopedic Fracture ORIF', 'trauma', 95000, 62000, 3, 0),
    ('hernia_repair', 'Laparoscopic Hernia Repair', 'surgery', 78000, 50000, 2, 24)
ON CONFLICT (procedure_key) DO NOTHING;

ALTER TABLE public.vehicle_repair_benchmarks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.medical_cost_benchmarks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read vehicle benchmarks" ON public.vehicle_repair_benchmarks;
CREATE POLICY "Public read vehicle benchmarks"
    ON public.vehicle_repair_benchmarks FOR SELECT
    USING (auth.role() IN ('authenticated', 'anon'));

DROP POLICY IF EXISTS "Public read medical benchmarks" ON public.medical_cost_benchmarks;
CREATE POLICY "Public read medical benchmarks"
    ON public.medical_cost_benchmarks FOR SELECT
    USING (auth.role() IN ('authenticated', 'anon'));
