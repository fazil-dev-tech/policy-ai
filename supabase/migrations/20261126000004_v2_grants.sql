-- ============================================================================
-- PolicyGuard v2 Role Grants & Schema Cache Reload
-- ============================================================================
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO postgres, service_role;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO postgres, anon, authenticated, service_role;
GRANT ALL PRIVILEGES ON ALL FUNCTIONS IN SCHEMA public TO postgres, anon, authenticated, service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.family_members TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.policy_clauses TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.incidents TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.evidence_files TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.damage_reports TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.settlements TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.agent_followups TO authenticated;
GRANT SELECT ON public.verified_domains TO anon, authenticated;
GRANT SELECT ON public.site_scans TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.scam_reports TO authenticated;
GRANT SELECT ON public.research_cache TO authenticated;
GRANT SELECT ON public.vehicle_repair_benchmarks TO anon, authenticated;
GRANT SELECT ON public.medical_cost_benchmarks TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
