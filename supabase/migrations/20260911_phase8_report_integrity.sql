-- =============================================================================
-- Migration 20260911: Phase 8 - Report Integrity (DRAFT -> FINAL)
-- SIH 2026 PS 26035 - Non-Automatic Weighing Instruments
-- =============================================================================
--
-- WHAT THIS ADDS
--   * A report lifecycle (DRAFT -> FINAL) on inspections, separate from the
--     compliance verdict. overall_result (PASS/FAIL/PENDING) answers "did the
--     instrument comply"; report_status answers "has the report been issued".
--     They are deliberately NOT merged - a FAIL report still gets issued.
--   * Finalization metadata and a non-guessable public verification token.
--   * An append-only audit log.
--   * Database-level immutability for finalized reports, enforced by triggers
--     so it holds against a direct PostgREST call, not just the UI.
--   * Two SECURITY DEFINER functions: atomic finalization, and a narrow public
--     verification lookup that returns only safe fields.
--
-- SAFETY
--   * Additive. No DROP TABLE, no DROP COLUMN, no TRUNCATE, no unqualified
--     DELETE. Existing rows default to DRAFT and stay editable.
--   * Compliance logic is untouched: no MPE value, band, class, control stage
--     or calculation is read, written or altered here.
--   * Re-runnable.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- SECTION 1 - Report lifecycle columns on inspections
-- -----------------------------------------------------------------------------

ALTER TABLE public.inspections
  ADD COLUMN IF NOT EXISTS report_status TEXT NOT NULL DEFAULT 'DRAFT';

ALTER TABLE public.inspections
  DROP CONSTRAINT IF EXISTS inspections_report_status_check;
ALTER TABLE public.inspections
  ADD CONSTRAINT inspections_report_status_check
  CHECK (report_status IN ('DRAFT', 'FINAL'));

ALTER TABLE public.inspections
  ADD COLUMN IF NOT EXISTS finalized_at TIMESTAMPTZ;

ALTER TABLE public.inspections
  ADD COLUMN IF NOT EXISTS finalized_by UUID REFERENCES public.profiles(id);

-- Public verification token. A random UUID (122 bits) - not derived from the
-- inspection id, the user, or anything else, so it reveals nothing and cannot
-- be enumerated.
ALTER TABLE public.inspections
  ADD COLUMN IF NOT EXISTS verification_token UUID;

CREATE UNIQUE INDEX IF NOT EXISTS inspections_verification_token_key
  ON public.inspections (verification_token)
  WHERE verification_token IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_inspections_report_status
  ON public.inspections (report_status);

-- A FINAL report must carry complete finalization metadata.
-- NOT VALID: existing rows are never re-checked or rejected.
ALTER TABLE public.inspections
  DROP CONSTRAINT IF EXISTS inspections_final_metadata_check;
ALTER TABLE public.inspections
  ADD CONSTRAINT inspections_final_metadata_check
  CHECK (
    report_status <> 'FINAL'
    OR (finalized_at IS NOT NULL
        AND finalized_by IS NOT NULL
        AND verification_token IS NOT NULL)
  ) NOT VALID;

-- A finalized report must carry an explicit verdict.
--
-- Stated as a positive whitelist rather than "<> 'PENDING'". A CHECK evaluates
-- to NULL (and therefore passes) when a compared column is NULL, so
-- `overall_result <> 'PENDING'` would not have blocked a NULL verdict. The base
-- schema declares overall_result NOT NULL, so that is defence in depth rather
-- than a live hole, but the whitelist also rejects any value added to the
-- vocabulary later that is not a decided outcome.
ALTER TABLE public.inspections
  DROP CONSTRAINT IF EXISTS inspections_final_not_pending_check;
ALTER TABLE public.inspections
  DROP CONSTRAINT IF EXISTS inspections_final_result_check;
ALTER TABLE public.inspections
  ADD CONSTRAINT inspections_final_result_check
  CHECK (
    report_status <> 'FINAL'
    OR (overall_result IS NOT NULL AND overall_result IN ('PASS', 'FAIL'))
  ) NOT VALID;


-- -----------------------------------------------------------------------------
-- SECTION 2 - Append-only audit log
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.report_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inspection_id UUID NOT NULL REFERENCES public.inspections(id) ON DELETE CASCADE,
  action TEXT NOT NULL CHECK (
    action IN ('CREATED', 'UPDATED', 'FINALIZED', 'FINALIZATION_REJECTED')
  ),
  performed_by UUID REFERENCES public.profiles(id),
  performed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  metadata JSONB
);

CREATE INDEX IF NOT EXISTS idx_report_audit_inspection
  ON public.report_audit_log (inspection_id, performed_at DESC);

-- One FINALIZED record per inspection - a second finalization cannot create a
-- duplicate even if two requests race.
CREATE UNIQUE INDEX IF NOT EXISTS report_audit_one_finalized_per_inspection
  ON public.report_audit_log (inspection_id)
  WHERE action = 'FINALIZED';

ALTER TABLE public.report_audit_log ENABLE ROW LEVEL SECURITY;

-- Readable by authenticated users, matching the existing inspection read model.
DROP POLICY IF EXISTS "Authenticated users can read report audit log" ON public.report_audit_log;
CREATE POLICY "Authenticated users can read report audit log"
  ON public.report_audit_log FOR SELECT TO authenticated USING (true);

-- Deliberately NO insert/update/delete policy. Rows are written only by the
-- SECURITY DEFINER finalization function below, so the log is append-only for
-- every normal user. The trigger that follows is defence in depth.

CREATE OR REPLACE FUNCTION public.report_audit_log_is_append_only()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'report_audit_log is append-only: % is not permitted', TG_OP;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS report_audit_log_no_update ON public.report_audit_log;
CREATE TRIGGER report_audit_log_no_update
  BEFORE UPDATE OR DELETE ON public.report_audit_log
  FOR EACH ROW EXECUTE FUNCTION public.report_audit_log_is_append_only();


-- -----------------------------------------------------------------------------
-- SECTION 3 - Immutability of finalized reports (database level)
-- -----------------------------------------------------------------------------
-- These triggers are the actual protection. They fire for ANY caller reaching
-- the table - the app, a direct PostgREST request, or psql - so hiding a button
-- in React is not what is keeping a finalized report safe.
--
-- DOCUMENTED: there is no admin bypass. FINAL means immutable for every role,
-- including ADMIN. Correcting a finalized report is a deliberate DBA action
-- (disable the trigger, correct, re-enable) and is intentionally not reachable
-- from the application.

CREATE OR REPLACE FUNCTION public.protect_finalized_inspection()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.report_status = 'FINAL' THEN
      RAISE EXCEPTION
        'This report has been finalized and cannot be deleted.'
        USING ERRCODE = 'check_violation';
    END IF;
    RETURN OLD;
  END IF;

  -- UPDATE: once FINAL, nothing on the row may change.
  IF OLD.report_status = 'FINAL' THEN
    RAISE EXCEPTION
      'This report has been finalized and can no longer be modified.'
      USING ERRCODE = 'check_violation';
  END IF;

  -- While DRAFT, the finalization metadata may only be written by the
  -- finalization function, never by a direct update.
  IF NEW.report_status IS DISTINCT FROM OLD.report_status
     OR NEW.finalized_at IS DISTINCT FROM OLD.finalized_at
     OR NEW.finalized_by IS DISTINCT FROM OLD.finalized_by
     OR NEW.verification_token IS DISTINCT FROM OLD.verification_token
  THEN
    IF COALESCE(current_setting('app.finalizing', true), '') <> 'on' THEN
      RAISE EXCEPTION
        'Report lifecycle fields can only be changed by finalizing the report.'
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS inspections_protect_finalized ON public.inspections;
CREATE TRIGGER inspections_protect_finalized
  BEFORE UPDATE OR DELETE ON public.inspections
  FOR EACH ROW EXECUTE FUNCTION public.protect_finalized_inspection();


CREATE OR REPLACE FUNCTION public.protect_finalized_inspection_tests()
RETURNS TRIGGER AS $$
DECLARE
  parent_status TEXT;
  parent_id UUID;
BEGIN
  parent_id := CASE WHEN TG_OP = 'DELETE' THEN OLD.inspection_id ELSE NEW.inspection_id END;

  SELECT report_status INTO parent_status
  FROM public.inspections WHERE id = parent_id;

  IF parent_status = 'FINAL' THEN
    RAISE EXCEPTION
      'The parent report has been finalized; its test results can no longer be changed.'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS inspection_tests_protect_finalized ON public.inspection_tests;
CREATE TRIGGER inspection_tests_protect_finalized
  BEFORE INSERT OR UPDATE OR DELETE ON public.inspection_tests
  FOR EACH ROW EXECUTE FUNCTION public.protect_finalized_inspection_tests();


-- -----------------------------------------------------------------------------
-- SECTION 4 - Atomic finalization
-- -----------------------------------------------------------------------------
-- A single function call is a single transaction, so the report cannot become
-- FINAL without its FINALIZED audit record, and vice versa.
--
-- SECURITY DEFINER is required to write the audit log (normal users have no
-- INSERT policy on it). Authorization is therefore checked explicitly below
-- against auth.uid(), and search_path is pinned.

CREATE OR REPLACE FUNCTION public.finalize_inspection(p_inspection_id UUID)
RETURNS TABLE (
  inspection_id UUID,
  report_status TEXT,
  finalized_at TIMESTAMPTZ,
  verification_token UUID
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller UUID := auth.uid();
  v_caller_role TEXT;
  v_inspection public.inspections%ROWTYPE;
  v_pending_count INT;
  v_incomplete_count INT;
  v_test_count INT;
  v_token UUID;
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'You must be signed in to finalize a report.';
  END IF;

  -- Lock the row so two concurrent finalization attempts serialize; the second
  -- one then sees report_status = 'FINAL' and is rejected.
  SELECT * INTO v_inspection
  FROM public.inspections
  WHERE id = p_inspection_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Inspection not found.';
  END IF;

  SELECT role INTO v_caller_role FROM public.profiles WHERE id = v_caller;

  -- Authorization: the inspector who recorded it, or an ADMIN.
  IF v_inspection.inspector_id <> v_caller
     AND COALESCE(v_caller_role, '') <> 'ADMIN' THEN
    RAISE EXCEPTION 'You are not authorized to finalize this report.';
  END IF;

  IF v_inspection.report_status = 'FINAL' THEN
    RAISE EXCEPTION 'This report has already been finalized.';
  END IF;

  -- Required data present.
  IF v_inspection.rule_set_id IS NULL THEN
    RAISE EXCEPTION 'This inspection has no rule set recorded and cannot be finalized.';
  END IF;

  SELECT COUNT(*) INTO v_test_count
  FROM public.inspection_tests WHERE inspection_tests.inspection_id = p_inspection_id;

  IF v_test_count = 0 THEN
    RAISE EXCEPTION 'This inspection has no recorded tests and cannot be finalized.';
  END IF;

  -- No unresolved tests. PENDING is never silently converted to PASS or FAIL.
  --
  -- `result` is the authoritative per-test outcome: it is NOT NULL and is
  -- written by the compliance engine. A test counts as resolved only when it
  -- holds a decided outcome. NOT_APPLICABLE IS resolved - the engine already
  -- excludes it from the overall result - so it must not block finalization.
  -- Stated as a whitelist so a NULL, or any value added to the vocabulary
  -- later, blocks rather than slips through (`result <> 'PENDING'` would
  -- evaluate to NULL for a NULL result and therefore not match).
  SELECT COUNT(*) INTO v_pending_count
  FROM public.inspection_tests
  WHERE inspection_tests.inspection_id = p_inspection_id
    AND (result IS NULL OR result NOT IN ('PASS', 'FAIL', 'NOT_APPLICABLE'));

  IF v_pending_count > 0 THEN
    RAISE EXCEPTION
      'This report still has % unresolved test(s). Complete every applicable test before finalizing.',
      v_pending_count;
  END IF;

  -- test_status is a workflow field, distinct from `result`.
  --
  -- IN_PROGRESS unambiguously means the inspector has not finished the test,
  -- so it blocks. 'PENDING' deliberately does NOT block here: the column was
  -- added by migration 20260905 with DEFAULT 'PENDING', which backfilled every
  -- pre-existing row, so a legitimately completed legacy test can still carry
  -- test_status = 'PENDING' alongside result = 'PASS'. Blocking on it would
  -- reject valid historical inspections. NULL is likewise treated as unknown
  -- rather than incomplete, for the same reason. `result` remains the
  -- authoritative signal, and it is checked above.
  SELECT COUNT(*) INTO v_incomplete_count
  FROM public.inspection_tests
  WHERE inspection_tests.inspection_id = p_inspection_id
    AND test_status = 'IN_PROGRESS';

  IF v_incomplete_count > 0 THEN
    RAISE EXCEPTION
      'This report has % test(s) still marked in progress. Finish them before finalizing.',
      v_incomplete_count;
  END IF;

  -- The overall verdict must be an explicit decided outcome.
  IF v_inspection.overall_result IS NULL
     OR v_inspection.overall_result NOT IN ('PASS', 'FAIL') THEN
    RAISE EXCEPTION
      'The overall result must be PASS or FAIL before this report can be finalized.';
  END IF;

  v_token := COALESCE(v_inspection.verification_token, gen_random_uuid());

  -- Tell the immutability trigger this update is a legitimate finalization.
  PERFORM set_config('app.finalizing', 'on', true);

  UPDATE public.inspections
  SET report_status      = 'FINAL',
      finalized_at       = NOW(),
      finalized_by       = v_caller,
      verification_token = v_token
  WHERE id = p_inspection_id;

  PERFORM set_config('app.finalizing', 'off', true);

  INSERT INTO public.report_audit_log (inspection_id, action, performed_by, metadata)
  VALUES (
    p_inspection_id,
    'FINALIZED',
    v_caller,
    jsonb_build_object(
      'overall_result', v_inspection.overall_result,
      'test_count', v_test_count,
      'rule_set_id', v_inspection.rule_set_id,
      'rule_version', v_inspection.rule_version
    )
  );

  RETURN QUERY
  SELECT p_inspection_id, 'FINAL'::TEXT, NOW()::TIMESTAMPTZ, v_token;
END;
$$;

REVOKE ALL ON FUNCTION public.finalize_inspection(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.finalize_inspection(UUID) TO authenticated;


-- -----------------------------------------------------------------------------
-- SECTION 5 - Public verification
-- -----------------------------------------------------------------------------
-- Deliberately a narrow function rather than a public SELECT policy on
-- inspections. Anonymous callers can look up exactly one report by its token
-- and receive only the fields below. There is no public read access to the
-- inspections table, no listing, and no search.
--
-- Not returned: inspector identity or email, any auth/profile id, the
-- inspection id, instrument id, rule set id, or any test data.

CREATE OR REPLACE FUNCTION public.verify_report(p_token UUID)
RETURNS TABLE (
  report_reference TEXT,
  report_status TEXT,
  overall_result TEXT,
  inspection_type TEXT,
  inspection_date TIMESTAMPTZ,
  finalized_at TIMESTAMPTZ,
  instrument_manufacturer TEXT,
  instrument_model TEXT,
  instrument_serial TEXT,
  accuracy_class TEXT,
  rule_standard TEXT,
  rule_version TEXT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    -- Public reference derived from the token, not from any internal id.
    'NAWI/' || to_char(i.inspection_date, 'YYYYMM') || '/' ||
      upper(substring(replace(i.verification_token::text, '-', '') from 1 for 8)) AS report_reference,
    i.report_status,
    i.overall_result,
    i.inspection_type,
    i.inspection_date,
    i.finalized_at,
    ins.manufacturer,
    ins.model,
    ins.serial_number,
    ins.accuracy_class,
    rs.standard,
    COALESCE(i.rule_version, rs.version)
  FROM public.inspections i
  JOIN public.instruments ins ON ins.id = i.instrument_id
  LEFT JOIN public.rule_sets rs ON rs.id = i.rule_set_id
  WHERE i.verification_token = p_token
    -- Only finalized reports are publicly verifiable. A draft token returns
    -- nothing, so a draft's contents are never exposed.
    AND i.report_status = 'FINAL';
$$;

REVOKE ALL ON FUNCTION public.verify_report(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.verify_report(UUID) TO anon, authenticated;


-- -----------------------------------------------------------------------------
-- SECTION 6 - Does a token exist at all (for a precise "not yet finalized")
-- -----------------------------------------------------------------------------
-- Returns only a status string, never any report content, so the verification
-- page can distinguish "unknown token" from "exists but still a draft" without
-- leaking anything about the draft.

CREATE OR REPLACE FUNCTION public.verification_token_state(p_token UUID)
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT report_status FROM public.inspections WHERE verification_token = p_token),
    'NOT_FOUND'
  );
$$;

REVOKE ALL ON FUNCTION public.verification_token_state(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.verification_token_state(UUID) TO anon, authenticated;
