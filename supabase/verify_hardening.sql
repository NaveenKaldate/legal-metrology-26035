-- =============================================================================
-- Verify that migration 20260911_compliance_hardening.sql actually applied.
-- Read-only. Changes nothing. Safe to run any time.
-- Expected: 8 rows, every status_check = OK
-- =============================================================================

-- Section 2: unique indexes exist
SELECT 'S2 mpe_rules unique band' AS item,
       CASE WHEN COUNT(*) = 1 THEN 'OK' ELSE 'MISSING' END AS status_check
FROM pg_indexes WHERE schemaname='public' AND indexname='mpe_rules_unique_band'
UNION ALL
SELECT 'S2 inspection_tests unique per inspection',
       CASE WHEN COUNT(*) = 1 THEN 'OK' ELSE 'MISSING' END
FROM pg_indexes WHERE schemaname='public' AND indexname='inspection_tests_unique_per_inspection'

-- Section 3: PENDING accepted as a test result
UNION ALL
SELECT 'S3 inspection_tests.result accepts PENDING',
       CASE WHEN pg_get_constraintdef(oid) LIKE '%PENDING%' THEN 'OK' ELSE 'MISSING' END
FROM pg_constraint WHERE conname = 'inspection_tests_result_check'

-- Section 4: DELETE policies for rollback
UNION ALL
SELECT 'S4 DELETE policy on inspections',
       CASE WHEN COUNT(*) = 1 THEN 'OK' ELSE 'MISSING' END
FROM pg_policies WHERE tablename='inspections' AND cmd='DELETE'
UNION ALL
SELECT 'S4 DELETE policy on inspection_tests',
       CASE WHEN COUNT(*) = 1 THEN 'OK' ELSE 'MISSING' END
FROM pg_policies WHERE tablename='inspection_tests' AND cmd='DELETE'

-- Section 5: ADMIN self-promotion blocked
UNION ALL
SELECT 'S5 profiles UPDATE policy has WITH CHECK',
       CASE WHEN bool_or(with_check IS NOT NULL) THEN 'OK' ELSE 'MISSING' END
FROM pg_policies WHERE tablename='profiles' AND cmd='UPDATE'
UNION ALL
SELECT 'S5 role-escalation trigger installed',
       CASE WHEN COUNT(*) = 1 THEN 'OK' ELSE 'MISSING' END
FROM pg_trigger WHERE tgname = 'profiles_prevent_role_escalation'

-- Section 6: instrument guards
UNION ALL
SELECT 'S6 instrument capacity/e guards',
       CASE WHEN COUNT(*) = 2 THEN 'OK' ELSE 'MISSING' END
FROM pg_constraint
WHERE conname IN ('instruments_capacity_order_check','instruments_e_positive_check');
