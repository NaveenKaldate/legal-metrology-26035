-- =============================================================================
-- Migration 20260911: Compliance engine hardening
-- SIH 2026 PS 26035 - Non-Automatic Weighing Instruments
-- =============================================================================
--
-- SAFETY
--   * Additive and idempotent. No DROP TABLE, no DROP COLUMN, no TRUNCATE,
--     and no DELETE without a WHERE clause.
--   * Two CHECK constraints are widened (dropped and re-created with MORE
--     permitted values). Widening a CHECK cannot reject or remove existing
--     rows - every row that was valid before stays valid.
--   * Section 2 creates UNIQUE indexes. If duplicate rows already exist they
--     will FAIL LOUDLY rather than delete anything. Section 1 tells you whether
--     that is the case BEFORE you run the rest.
--
-- HOW TO RUN
--   Paste into the Supabase SQL Editor and run section by section, top to
--   bottom. Read the output of Section 1 first.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- SECTION 1 - DIAGNOSTIC ONLY (changes nothing; run this first)
-- -----------------------------------------------------------------------------
-- Duplicate MPE rules make the applicable-MPE lookup ambiguous. The application
-- now refuses to issue a verdict when it detects them, so this must be clean.

SELECT
  'DUPLICATE MPE RULES' AS check_name,
  rule_set_id,
  accuracy_class,
  control_stage,
  lower_load_e,
  upper_load_e,
  COUNT(*) AS copies
FROM public.mpe_rules
GROUP BY rule_set_id, accuracy_class, control_stage, lower_load_e, upper_load_e
HAVING COUNT(*) > 1
ORDER BY accuracy_class, control_stage, lower_load_e;

-- Overlapping bands (a different problem from exact duplicates): two rules
-- covering the same load. With half-open bands (lower exclusive, upper
-- inclusive) adjacent rows sharing a limit like 500 are NOT an overlap.
SELECT
  'OVERLAPPING MPE BANDS' AS check_name,
  a.id AS rule_a,
  b.id AS rule_b,
  a.accuracy_class,
  a.control_stage,
  a.lower_load_e AS a_lower, a.upper_load_e AS a_upper,
  b.lower_load_e AS b_lower, b.upper_load_e AS b_upper
FROM public.mpe_rules a
JOIN public.mpe_rules b
  ON a.rule_set_id = b.rule_set_id
 AND a.accuracy_class = b.accuracy_class
 AND a.control_stage = b.control_stage
 AND a.id < b.id
 AND a.lower_load_e < COALESCE(b.upper_load_e, 'infinity'::numeric)
 AND b.lower_load_e < COALESCE(a.upper_load_e, 'infinity'::numeric);

-- Duplicate TEST ROWS inside a single inspection. Section 2 adds a unique
-- index on (inspection_id, test_type); saves made before the rollback fix
-- could have written the same test twice, which would make that index fail.
SELECT
  'DUPLICATE INSPECTION TEST ROWS' AS check_name,
  inspection_id,
  test_type,
  COUNT(*) AS copies
FROM public.inspection_tests
GROUP BY inspection_id, test_type
HAVING COUNT(*) > 1
ORDER BY inspection_id;

-- If the FIRST query returns rows, duplicates exist. Removing them deletes
-- data, so it is NOT done automatically. The statement below is deliberately
-- left commented out - review the duplicates, then run it only if you approve.
-- It keeps the oldest row of each identical group and removes later copies.
--
-- DELETE FROM public.mpe_rules m
-- USING public.mpe_rules keep
-- WHERE m.rule_set_id   = keep.rule_set_id
--   AND m.accuracy_class = keep.accuracy_class
--   AND m.control_stage  = keep.control_stage
--   AND m.lower_load_e   = keep.lower_load_e
--   AND m.upper_load_e IS NOT DISTINCT FROM keep.upper_load_e
--   AND m.ctid > keep.ctid;
--
-- Likewise, if the DUPLICATE INSPECTION TEST ROWS query returns rows, review
-- them first. This keeps the earliest row per (inspection, test) and removes
-- later copies. Run only if you approve:
--
-- DELETE FROM public.inspection_tests t
-- USING public.inspection_tests keep
-- WHERE t.inspection_id = keep.inspection_id
--   AND t.test_type     = keep.test_type
--   AND t.ctid > keep.ctid;


-- -----------------------------------------------------------------------------
-- SECTION 2 - Make the rule seeds idempotent
-- -----------------------------------------------------------------------------
-- schema.sql, the phase3b migration and the seed script all INSERT the same
-- MPE rows with no conflict target, so running more than one of them duplicates
-- every rule. These unique indexes make re-running a seed a no-op instead.
-- (Requires Section 1 to be clean.)

CREATE UNIQUE INDEX IF NOT EXISTS mpe_rules_unique_band
  ON public.mpe_rules (rule_set_id, accuracy_class, control_stage, lower_load_e);

CREATE UNIQUE INDEX IF NOT EXISTS test_applicability_unique_profile
  ON public.test_applicability_rules (
    test_definition_id,
    COALESCE(instrument_type, ''),
    COALESCE(accuracy_class, '')
  );

-- Re-saving an inspection must not silently duplicate its test rows.
CREATE UNIQUE INDEX IF NOT EXISTS inspection_tests_unique_per_inspection
  ON public.inspection_tests (inspection_id, test_type);

-- Deterministic, indexed MPE lookup (rule set + class + stage + band).
CREATE INDEX IF NOT EXISTS idx_mpe_rules_band_lookup
  ON public.mpe_rules (rule_set_id, accuracy_class, control_stage, lower_load_e);


-- -----------------------------------------------------------------------------
-- SECTION 3 - Allow an inspection to be saved while tests are still PENDING
-- -----------------------------------------------------------------------------
-- Previously inspection_tests.result allowed only PASS/FAIL/NOT_APPLICABLE,
-- while the engine, the TypeScript types and the Zod schema all also produce
-- PENDING. Because the inspection header is inserted before its test rows, a
-- single PENDING test left behind an inspection with an overall result and NO
-- test rows. Widening the CHECK keeps that record whole and matches
-- inspections.overall_result, which already permits PENDING.

ALTER TABLE public.inspection_tests
  DROP CONSTRAINT IF EXISTS inspection_tests_result_check;

ALTER TABLE public.inspection_tests
  ADD CONSTRAINT inspection_tests_result_check
  CHECK (result IN ('PASS', 'FAIL', 'NOT_APPLICABLE', 'PENDING'));

-- Keep test_status to a known vocabulary as well (previously unconstrained).
ALTER TABLE public.inspection_tests
  DROP CONSTRAINT IF EXISTS inspection_tests_status_check;

ALTER TABLE public.inspection_tests
  ADD CONSTRAINT inspection_tests_status_check
  CHECK (test_status IS NULL OR test_status IN ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'SKIPPED'));


-- -----------------------------------------------------------------------------
-- SECTION 4 - Let an inspector roll back their own failed save
-- -----------------------------------------------------------------------------
-- There was no DELETE policy on inspections, so a partially-written record
-- could not be cleaned up. Scoped strictly to the inspector's own rows.

DROP POLICY IF EXISTS "Inspectors can delete their own inspections" ON public.inspections;
CREATE POLICY "Inspectors can delete their own inspections"
  ON public.inspections FOR DELETE TO authenticated
  USING (inspector_id = auth.uid());

DROP POLICY IF EXISTS "Inspectors can delete tests for their inspections" ON public.inspection_tests;
CREATE POLICY "Inspectors can delete tests for their inspections"
  ON public.inspection_tests FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.inspections
      WHERE id = inspection_id AND inspector_id = auth.uid()
    )
  );


-- -----------------------------------------------------------------------------
-- SECTION 5 - SECURITY: stop a user from granting themselves ADMIN
-- -----------------------------------------------------------------------------
-- The existing profiles UPDATE policy had no WITH CHECK and no column
-- restriction, so any authenticated user could set their own role to 'ADMIN'.
-- Harmless while roles do nothing, but it must be closed BEFORE role-based
-- admin features are added.
--
-- Approach: users may still update their own profile, but the role column is
-- frozen for non-admins by a trigger (RLS alone cannot restrict a column).

DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE OR REPLACE FUNCTION public.prevent_self_role_escalation()
RETURNS TRIGGER AS $$
DECLARE
  caller_role TEXT;
BEGIN
  IF NEW.role IS DISTINCT FROM OLD.role THEN
    SELECT role INTO caller_role FROM public.profiles WHERE id = auth.uid();

    IF caller_role IS DISTINCT FROM 'ADMIN' THEN
      RAISE EXCEPTION 'Only an administrator may change a user role.';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS profiles_prevent_role_escalation ON public.profiles;
CREATE TRIGGER profiles_prevent_role_escalation
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.prevent_self_role_escalation();


-- -----------------------------------------------------------------------------
-- SECTION 6 - Data quality guards on instruments
-- -----------------------------------------------------------------------------
-- NOT VALID means existing rows are left untouched and are never rejected;
-- only new and updated rows are checked. Nothing is deleted.

ALTER TABLE public.instruments
  DROP CONSTRAINT IF EXISTS instruments_capacity_order_check;

ALTER TABLE public.instruments
  ADD CONSTRAINT instruments_capacity_order_check
  CHECK (
    max_capacity IS NULL
    OR min_capacity IS NULL
    OR min_capacity < max_capacity
  ) NOT VALID;

ALTER TABLE public.instruments
  DROP CONSTRAINT IF EXISTS instruments_e_positive_check;

ALTER TABLE public.instruments
  ADD CONSTRAINT instruments_e_positive_check
  CHECK (verification_interval_e IS NULL OR verification_interval_e > 0) NOT VALID;


-- =============================================================================
-- NOT INCLUDED - requires verification against the OIML R-76 source text
-- =============================================================================
-- The TYPE_EVALUATION control stage is accepted by the inspections CHECK
-- constraint and offered in the UI, but NO mpe_rules rows exist for it. Every
-- metrological test therefore reports "No MPE rules are configured for this
-- control stage" instead of producing a verdict.
--
-- MPE values for type evaluation have deliberately NOT been invented here.
-- Resolve this in one of two ways once the correct values are confirmed:
--
--   (a) seed real TYPE_EVALUATION bands, e.g.
--       INSERT INTO public.mpe_rules
--         (rule_set_id, accuracy_class, control_stage,
--          lower_load_e, upper_load_e, mpe_multiplier, mpe_unit, clause)
--       VALUES (...)   -- NEEDS VERIFICATION against R-76 before use
--       ON CONFLICT (rule_set_id, accuracy_class, control_stage, lower_load_e)
--       DO NOTHING;
--
--   (b) remove TYPE_EVALUATION from the control-stage selector until the
--       values are confirmed.
-- =============================================================================
