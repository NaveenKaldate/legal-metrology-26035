import { InspectionOverallResult, ReportStatus, TestResult } from '@/types/database';

/**
 * Report finalization readiness.
 *
 * IMPORTANT: this module is a UI PRE-CHECK ONLY. It exists so the inspector
 * sees why a report cannot be finalized before clicking, and so the button can
 * be disabled with an explanation.
 *
 * It is NOT the security boundary. The authority is the database:
 * `finalize_inspection()` re-checks every rule below inside one transaction,
 * and the immutability triggers protect finalized rows regardless of what any
 * client sends. If this file and the database ever disagree, the database wins.
 *
 * This file contains no compliance logic. It reads results the engine already
 * produced; it never computes or reinterprets a verdict, and it never converts
 * PENDING into PASS or FAIL.
 */

export type FinalizationBlockCode =
  | 'ALREADY_FINAL'
  | 'NOT_AUTHORIZED'
  | 'NO_TESTS'
  | 'UNRESOLVED_TESTS'
  | 'TESTS_IN_PROGRESS'
  | 'RESULT_PENDING'
  | 'NO_RULE_SET';

export interface FinalizationBlocker {
  code: FinalizationBlockCode;
  message: string;
}

export interface FinalizationCandidate {
  reportStatus: ReportStatus;
  overallResult: InspectionOverallResult;
  ruleSetId: string | null;
  inspectorId: string;
  tests: { testType: string; result: TestResult; testStatus?: string | null }[];
}

/**
 * A test counts as resolved only when it holds a decided outcome.
 * NOT_APPLICABLE IS resolved - the engine excludes it from the overall result -
 * so it must never block finalization.
 */
const RESOLVED_TEST_RESULTS: readonly string[] = ['PASS', 'FAIL', 'NOT_APPLICABLE'];

/** Verdicts a report may be issued with. PENDING is not one of them. */
const DECIDED_OVERALL_RESULTS: readonly string[] = ['PASS', 'FAIL'];

/**
 * test_status values that unambiguously mean the inspector has not finished.
 *
 * 'PENDING' is deliberately absent: migration 20260905 added test_status with
 * DEFAULT 'PENDING', backfilling every pre-existing row, so a completed legacy
 * test can carry test_status 'PENDING' with result 'PASS'. `result` is the
 * authoritative signal and is checked separately.
 */
const IN_PROGRESS_TEST_STATUSES: readonly string[] = ['IN_PROGRESS'];

export interface FinalizationViewer {
  userId: string;
  role: 'ADMIN' | 'INSPECTOR';
}

export interface FinalizationReadiness {
  canFinalize: boolean;
  blockers: FinalizationBlocker[];
}

/**
 * Mirrors the checks in the finalize_inspection() database function, in the
 * same order, so the message the inspector sees matches what the database
 * would say.
 */
export function evaluateFinalizationReadiness(
  inspection: FinalizationCandidate,
  viewer: FinalizationViewer
): FinalizationReadiness {
  const blockers: FinalizationBlocker[] = [];

  if (inspection.reportStatus === 'FINAL') {
    blockers.push({
      code: 'ALREADY_FINAL',
      message: 'This report has already been finalized.',
    });
    // Nothing else is meaningful once it is final.
    return { canFinalize: false, blockers };
  }

  if (viewer.userId !== inspection.inspectorId && viewer.role !== 'ADMIN') {
    blockers.push({
      code: 'NOT_AUTHORIZED',
      message: 'Only the inspector who recorded this inspection, or an administrator, can finalize it.',
    });
  }

  if (!inspection.ruleSetId) {
    blockers.push({
      code: 'NO_RULE_SET',
      message: 'This inspection has no rule set recorded, so its results cannot be attributed to a rule version.',
    });
  }

  if (inspection.tests.length === 0) {
    blockers.push({
      code: 'NO_TESTS',
      message: 'This inspection has no recorded tests.',
    });
  }

  const unresolved = inspection.tests.filter(
    (t) => !t.result || !RESOLVED_TEST_RESULTS.includes(t.result)
  );
  if (unresolved.length > 0) {
    blockers.push({
      code: 'UNRESOLVED_TESTS',
      message: `${unresolved.length} test${
        unresolved.length === 1 ? '' : 's'
      } (${unresolved.map((t) => t.testType).join(', ')}) ${
        unresolved.length === 1 ? 'has' : 'have'
      } not produced a result. Complete every applicable test before finalizing.`,
    });
  }

  const stillWorking = inspection.tests.filter(
    (t) => t.testStatus != null && IN_PROGRESS_TEST_STATUSES.includes(t.testStatus)
  );
  if (stillWorking.length > 0) {
    blockers.push({
      code: 'TESTS_IN_PROGRESS',
      message: `${stillWorking.length} test${
        stillWorking.length === 1 ? ' is' : 's are'
      } still marked in progress (${stillWorking
        .map((t) => t.testType)
        .join(', ')}). Finish them before finalizing.`,
    });
  }

  if (
    !inspection.overallResult ||
    !DECIDED_OVERALL_RESULTS.includes(inspection.overallResult)
  ) {
    blockers.push({
      code: 'RESULT_PENDING',
      message:
        'The overall result must be PASS or FAIL before this report can be finalized.',
    });
  }

  return { canFinalize: blockers.length === 0, blockers };
}

/**
 * Public verification URL for a finalized report.
 *
 * The base URL comes from NEXT_PUBLIC_APP_URL so the QR code never encodes
 * localhost in a deployed build. Falls back to a relative path rather than
 * guessing a host, which keeps a misconfigured deployment obvious instead of
 * silently producing unscannable codes.
 */
export function buildVerificationUrl(token: string, baseUrl?: string | null): string {
  const base = (baseUrl ?? process.env.NEXT_PUBLIC_APP_URL ?? '').replace(/\/+$/, '');
  return base ? `${base}/verify/${token}` : `/verify/${token}`;
}

/**
 * Short human-readable reference derived from the verification token.
 * Derived from the token - never from the inspection id or the inspector - so
 * it reveals nothing internal.
 */
export function buildReportReference(token: string, inspectionDate: string): string {
  const date = new Date(inspectionDate);
  const yyyymm = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}`;
  const short = token.replace(/-/g, '').slice(0, 8).toUpperCase();
  return `NAWI/${yyyymm}/${short}`;
}
