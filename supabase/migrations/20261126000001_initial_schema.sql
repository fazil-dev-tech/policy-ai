-- ============================================================================
-- PolicyAI Supabase Initial Schema, RLS Policies, Triggers & Storage Setup
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ----------------------------------------------------------------------------
-- Helper: auto-update updated_at column
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

-- ----------------------------------------------------------------------------
-- 1. Profiles (linked 1:1 with auth.users)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin')),
    last_login TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_profiles_email ON public.profiles(email);
CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role);
CREATE INDEX IF NOT EXISTS idx_profiles_created_at ON public.profiles(created_at DESC);

DROP TRIGGER IF EXISTS trg_profiles_updated_at ON public.profiles;
CREATE TRIGGER trg_profiles_updated_at
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Helper function to check admin role without RLS recursion
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND role = 'admin'
    );
$$;

-- Auto-create profile when a new auth user signs up (always forces 'user' role)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    INSERT INTO public.profiles (id, name, email, role)
    VALUES (
        NEW.id,
        COALESCE(NULLIF(TRIM(NEW.raw_user_meta_data->>'name'), ''), split_part(NEW.email, '@', 1)),
        LOWER(NEW.email),
        'user'
    )
    ON CONFLICT (id) DO UPDATE
    SET email = EXCLUDED.email,
        name = COALESCE(NULLIF(TRIM(EXCLUDED.name), ''), public.profiles.name);
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
CREATE POLICY "Users can view own profile"
    ON public.profiles FOR SELECT
    USING (auth.uid() = id OR public.is_admin());

DROP POLICY IF EXISTS "Users can update own non-role profile fields" ON public.profiles;
CREATE POLICY "Users can update own non-role profile fields"
    ON public.profiles FOR UPDATE
    USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id AND role = (SELECT role FROM public.profiles WHERE id = auth.uid()));

-- ----------------------------------------------------------------------------
-- 2. Policies
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.policies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    policy_number TEXT NOT NULL,
    provider_name TEXT NOT NULL,
    policy_type TEXT NOT NULL DEFAULT 'other'
        CHECK (policy_type IN ('health', 'life', 'auto', 'home', 'travel', 'business', 'other', 'document', 'general')),
    coverage_amount NUMERIC NOT NULL DEFAULT 0 CHECK (coverage_amount >= 0),
    start_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    end_date TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '365 days'),
    pdf_url TEXT NOT NULL DEFAULT '',
    storage_path TEXT NOT NULL DEFAULT '',
    ai_summary JSONB NOT NULL DEFAULT '{}'::jsonb,
    verification_score INTEGER NOT NULL DEFAULT 0 CHECK (verification_score >= 0 AND verification_score <= 100),
    status TEXT NOT NULL DEFAULT 'active'
        CHECK (status IN ('active', 'expired', 'cancelled', 'pending_review')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_policies_user_status ON public.policies(user_id, status);
CREATE INDEX IF NOT EXISTS idx_policies_user_type ON public.policies(user_id, policy_type);
CREATE INDEX IF NOT EXISTS idx_policies_created_at ON public.policies(created_at DESC);

DROP TRIGGER IF EXISTS trg_policies_updated_at ON public.policies;
CREATE TRIGGER trg_policies_updated_at
    BEFORE UPDATE ON public.policies
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.policies ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own policies" ON public.policies;
CREATE POLICY "Users manage own policies"
    ON public.policies FOR ALL
    USING (auth.uid() = user_id OR public.is_admin())
    WITH CHECK (auth.uid() = user_id);

-- ----------------------------------------------------------------------------
-- 3. Claims
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.claims (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    policy_id UUID NOT NULL REFERENCES public.policies(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    claim_amount NUMERIC NOT NULL CHECK (claim_amount >= 0),
    claim_status TEXT NOT NULL DEFAULT 'pending'
        CHECK (claim_status IN ('pending', 'under_review', 'approved', 'rejected', 'settled')),
    claim_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    description TEXT NOT NULL,
    ai_guidance JSONB NOT NULL DEFAULT '{}'::jsonb,
    supporting_documents JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_claims_policy_status ON public.claims(policy_id, claim_status);
CREATE INDEX IF NOT EXISTS idx_claims_user_date ON public.claims(user_id, claim_date DESC);

DROP TRIGGER IF EXISTS trg_claims_updated_at ON public.claims;
CREATE TRIGGER trg_claims_updated_at
    BEFORE UPDATE ON public.claims
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.claims ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own claims" ON public.claims;
CREATE POLICY "Users manage own claims"
    ON public.claims FOR ALL
    USING (auth.uid() = user_id OR public.is_admin())
    WITH CHECK (auth.uid() = user_id);

-- ----------------------------------------------------------------------------
-- 4. General Documents
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    document_name TEXT NOT NULL,
    document_type TEXT NOT NULL DEFAULT 'general'
        CHECK (document_type IN ('contract', 'invoice', 'report', 'letter', 'legal', 'general')),
    pdf_url TEXT NOT NULL DEFAULT '',
    storage_path TEXT NOT NULL DEFAULT '',
    file_size BIGINT NOT NULL DEFAULT 0,
    ai_summary JSONB NOT NULL DEFAULT '{}'::jsonb,
    status TEXT NOT NULL DEFAULT 'analyzed'
        CHECK (status IN ('analyzed', 'failed', 'pending')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_documents_user_status ON public.documents(user_id, status);
CREATE INDEX IF NOT EXISTS idx_documents_user_type ON public.documents(user_id, document_type);
CREATE INDEX IF NOT EXISTS idx_documents_created_at ON public.documents(created_at DESC);

DROP TRIGGER IF EXISTS trg_documents_updated_at ON public.documents;
CREATE TRIGGER trg_documents_updated_at
    BEFORE UPDATE ON public.documents
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own documents" ON public.documents;
CREATE POLICY "Users manage own documents"
    ON public.documents FOR ALL
    USING (auth.uid() = user_id OR public.is_admin())
    WITH CHECK (auth.uid() = user_id);

-- ----------------------------------------------------------------------------
-- 5. Chat History
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.chat_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    policy_id UUID REFERENCES public.policies(id) ON DELETE SET NULL,
    session_id TEXT NOT NULL,
    message TEXT NOT NULL,
    ai_response TEXT NOT NULL,
    metadata JSONB NOT NULL DEFAULT '{"model":"ai","tokensUsed":0,"responseTimeMs":0}'::jsonb,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_chat_user_session_ts ON public.chat_history(user_id, session_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_chat_user_policy ON public.chat_history(user_id, policy_id);

ALTER TABLE public.chat_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own chat history" ON public.chat_history;
CREATE POLICY "Users manage own chat history"
    ON public.chat_history FOR ALL
    USING (auth.uid() = user_id OR public.is_admin())
    WITH CHECK (auth.uid() = user_id);

-- ----------------------------------------------------------------------------
-- 6. Market Data
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.market_data (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    provider_name TEXT NOT NULL UNIQUE,
    claim_settlement_ratio NUMERIC NOT NULL CHECK (claim_settlement_ratio >= 0 AND claim_settlement_ratio <= 100),
    average_claim_time NUMERIC NOT NULL CHECK (average_claim_time >= 0),
    rating NUMERIC NOT NULL CHECK (rating >= 0 AND rating <= 5),
    premium_range JSONB NOT NULL DEFAULT '{"min":0,"max":0}'::jsonb,
    policy_types TEXT[] NOT NULL DEFAULT '{}',
    customer_reviews JSONB NOT NULL DEFAULT '{"total":0,"averageRating":0}'::jsonb,
    fraud_reports INTEGER NOT NULL DEFAULT 0,
    last_updated TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_market_settlement ON public.market_data(claim_settlement_ratio DESC);
CREATE INDEX IF NOT EXISTS idx_market_rating ON public.market_data(rating DESC);

DROP TRIGGER IF EXISTS trg_market_data_updated_at ON public.market_data;
CREATE TRIGGER trg_market_data_updated_at
    BEFORE UPDATE ON public.market_data
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.market_data ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can read market data" ON public.market_data;
CREATE POLICY "Authenticated users can read market data"
    ON public.market_data FOR SELECT
    USING (auth.role() IN ('authenticated', 'anon'));

DROP POLICY IF EXISTS "Admins manage market data" ON public.market_data;
CREATE POLICY "Admins manage market data"
    ON public.market_data FOR ALL
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

-- Seed baseline market providers
INSERT INTO public.market_data (
    provider_name, claim_settlement_ratio, average_claim_time, rating,
    premium_range, policy_types, customer_reviews, fraud_reports
)
VALUES
    ('HDFC ERGO', 98.4, 7, 4.7, '{"min":6500,"max":42000}'::jsonb, ARRAY['health','auto','home','travel'], '{"total":1240,"averageRating":4.7}'::jsonb, 2),
    ('ICICI Lombard', 97.8, 8, 4.6, '{"min":5800,"max":38000}'::jsonb, ARRAY['health','auto','travel','business'], '{"total":1580,"averageRating":4.6}'::jsonb, 3),
    ('LIC India', 98.6, 12, 4.8, '{"min":8000,"max":65000}'::jsonb, ARRAY['life','health'], '{"total":3420,"averageRating":4.8}'::jsonb, 1),
    ('Star Health', 90.2, 10, 4.3, '{"min":5200,"max":34000}'::jsonb, ARRAY['health'], '{"total":980,"averageRating":4.3}'::jsonb, 5),
    ('Bajaj Allianz', 96.5, 9, 4.5, '{"min":4900,"max":36000}'::jsonb, ARRAY['health','auto','home','travel','business'], '{"total":1120,"averageRating":4.5}'::jsonb, 2)
ON CONFLICT (provider_name) DO NOTHING;

-- ----------------------------------------------------------------------------
-- 7. Supabase Storage Bucket for Policy & Document PDFs
-- ----------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('policy-files', 'policy-files', false, 10485760, ARRAY['application/pdf'])
ON CONFLICT (id) DO UPDATE
SET public = false,
    file_size_limit = 10485760,
    allowed_mime_types = ARRAY['application/pdf'];

DROP POLICY IF EXISTS "Users manage own policy files" ON storage.objects;
CREATE POLICY "Users manage own policy files"
    ON storage.objects FOR ALL
    USING (
        bucket_id = 'policy-files'
        AND auth.uid()::text = (storage.foldername(name))[1]
    )
    WITH CHECK (
        bucket_id = 'policy-files'
        AND auth.uid()::text = (storage.foldername(name))[1]
    );
