-- ============================================================================
-- Migration 5: Enum Sync & Sub-Category Documentation (Non-Destructive)
-- Keeps existing CHECK constraints compatible while optionally allowing 'dl_rc'
-- in evidence_files.doc_category if an environment runs direct SQL inserts.
-- ============================================================================

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.table_constraints
        WHERE table_schema = 'public'
          AND table_name = 'evidence_files'
          AND constraint_type = 'CHECK'
          AND constraint_name = 'evidence_files_doc_category_check'
    ) THEN
        ALTER TABLE public.evidence_files DROP CONSTRAINT evidence_files_doc_category_check;
        ALTER TABLE public.evidence_files
            ADD CONSTRAINT evidence_files_doc_category_check
            CHECK (doc_category IN (
                'policy_pdf', 'e_card', 'dl_rc', 'doctor_script', 'lab_xray',
                'hospital_estimate', 'discharge_summary', 'vehicle_photo',
                'garage_quote', 'settlement_sheet', 'brochure', 'other'
            ));
    END IF;
END $$;
