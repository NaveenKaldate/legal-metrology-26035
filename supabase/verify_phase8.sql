-- =============================================================================
-- Verify migration 20260911_phase8_report_integrity.sql applied correctly.
-- READ-ONLY. Changes nothing. Safe to run any time.
-- Expected: 15 rows, every status = OK
-- =============================================================================

SELECT '1. inspections.report_status column' AS item,
       CASE WHEN COUNT(*) = 1 THEN 'OK' ELSE 'MISSING' END AS status
FROM information_schema.columns
WHERE table_schema='public' AND table_name='inspections' AND column_name='report_status'
UNION ALL
SELECT '2. finalization columns (finalized_at/by, token)',
       CASE WHEN COUNT(*) = 3 THEN 'OK' ELSE 'MISSING ('||COUNT(*)||'/3)' END
FROM information_schema.columns
WHERE table_schema='public' AND table_name='inspections'
  AND column_name IN ('finalized_at','finalized_by','verification_token')
UNION ALL
SELECT '3. report_status defaults to DRAFT',
       CASE WHEN column_default LIKE '%DRAFT%' THEN 'OK' ELSE 'MISSING' END
FROM information_schema.columns
WHERE table_schema='public' AND table_name='inspections' AND column_name='report_status'
UNION ALL
SELECT '4. report_audit_log table',
       CASE WHEN COUNT(*) = 1 THEN 'OK' ELSE 'MISSING' END
FROM information_schema.tables
WHERE table_schema='public' AND table_name='report_audit_log'
UNION ALL
SELECT '5. audit log RLS enabled',
       CASE WHEN bool_or(rowsecurity) THEN 'OK' ELSE 'MISSING' END
FROM pg_tables WHERE schemaname='public' AND tablename='report_audit_log'
UNION ALL
SELECT '6. audit log is read-only for users (SELECT policy only)',
       CASE WHEN COUNT(*) FILTER (WHERE cmd='SELECT') = 1
             AND COUNT(*) FILTER (WHERE cmd <> 'SELECT') = 0
            THEN 'OK' ELSE 'UNEXPECTED POLICIES' END
FROM pg_policies WHERE tablename='report_audit_log'
UNION ALL
SELECT '7. audit append-only trigger',
       CASE WHEN COUNT(*) = 1 THEN 'OK' ELSE 'MISSING' END
FROM pg_trigger WHERE tgname='report_audit_log_no_update'
UNION ALL
SELECT '8. inspections immutability trigger',
       CASE WHEN COUNT(*) = 1 THEN 'OK' ELSE 'MISSING' END
FROM pg_trigger WHERE tgname='inspections_protect_finalized'
UNION ALL
SELECT '9. inspection_tests immutability trigger',
       CASE WHEN COUNT(*) = 1 THEN 'OK' ELSE 'MISSING' END
FROM pg_trigger WHERE tgname='inspection_tests_protect_finalized'
UNION ALL
SELECT '10. finalize_inspection() is SECURITY DEFINER',
       CASE WHEN bool_or(prosecdef) THEN 'OK' ELSE 'MISSING' END
FROM pg_proc WHERE proname='finalize_inspection'
UNION ALL
SELECT '11. verify_report() is SECURITY DEFINER',
       CASE WHEN bool_or(prosecdef) THEN 'OK' ELSE 'MISSING' END
FROM pg_proc WHERE proname='verify_report'
UNION ALL
SELECT '12. anon may execute verify_report only',
       CASE WHEN has_function_privilege('anon','public.verify_report(uuid)','EXECUTE')
             AND NOT has_function_privilege('anon','public.finalize_inspection(uuid)','EXECUTE')
            THEN 'OK' ELSE 'WRONG GRANTS' END
UNION ALL
SELECT '13. unique verification token index',
       CASE WHEN COUNT(*) = 1 THEN 'OK' ELSE 'MISSING' END
FROM pg_indexes WHERE schemaname='public' AND indexname='inspections_verification_token_key'
UNION ALL
SELECT '14. FINAL requires overall_result IN (PASS, FAIL)',
       CASE WHEN bool_or(pg_get_constraintdef(oid) LIKE '%PASS%'
                     AND pg_get_constraintdef(oid) LIKE '%FAIL%')
            THEN 'OK' ELSE 'MISSING' END
FROM pg_constraint WHERE conname = 'inspections_final_result_check'
UNION ALL
SELECT '15. one FINALIZED audit row per inspection',
       CASE WHEN COUNT(*) = 1 THEN 'OK' ELSE 'MISSING' END
FROM pg_indexes
WHERE schemaname='public' AND indexname='report_audit_one_finalized_per_inspection';


-- Anonymous access must NOT be able to read the inspections table directly.
-- Expected: no rows (there is no policy granting anon SELECT).
SELECT 'ANON POLICIES ON inspections (expect none)' AS check_name,
       policyname, cmd, roles
FROM pg_policies
WHERE tablename = 'inspections' AND 'anon' = ANY(roles);
