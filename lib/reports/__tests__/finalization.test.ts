import test from 'node:test';
import assert from 'node:assert/strict';
import {
  evaluateFinalizationReadiness,
  buildVerificationUrl,
  buildReportReference,
  FinalizationCandidate,
} from '../finalization';

/**
 * Phase 8 - report integrity, application layer.
 *
 * SCOPE NOTE: these cover the UI pre-check and the URL/reference helpers.
 * The rules that actually ENFORCE integrity - immutability of a finalized
 * report, append-only audit, atomic finalization, public verification scope -
 * live in PostgreSQL triggers, RLS policies and SECURITY DEFINER functions,
 * and cannot be exercised without a live database. They are verified by
 * supabase/verify_phase8.sql and the manual demo plan instead. No test here
 * pretends to cover them.
 */

const INSPECTOR = { userId: 'user-1', role: 'INSPECTOR' as const };
const OTHER_INSPECTOR = { userId: 'user-2', role: 'INSPECTOR' as const };
const ADMIN = { userId: 'user-9', role: 'ADMIN' as const };

function candidate(overrides: Partial<FinalizationCandidate> = {}): FinalizationCandidate {
  return {
    reportStatus: 'DRAFT',
    overallResult: 'PASS',
    ruleSetId: 'rule-set-1',
    inspectorId: 'user-1',
    tests: [
      { testType: 'T01', result: 'PASS' },
      { testType: 'T03', result: 'PASS' },
      { testType: 'T06', result: 'NOT_APPLICABLE' },
    ],
    ...overrides,
  };
}

test('a complete DRAFT owned by the inspector can be finalized', () => {
  const r = evaluateFinalizationReadiness(candidate(), INSPECTOR);
  assert.equal(r.canFinalize, true);
  assert.deepEqual(r.blockers, []);
});

test('a FAIL result can still be finalized - a failed report is still issued', () => {
  const r = evaluateFinalizationReadiness(
    candidate({ overallResult: 'FAIL', tests: [{ testType: 'T03', result: 'FAIL' }] }),
    INSPECTOR
  );
  assert.equal(r.canFinalize, true);
});

test('an already FINAL report is rejected', () => {
  const r = evaluateFinalizationReadiness(candidate({ reportStatus: 'FINAL' }), INSPECTOR);
  assert.equal(r.canFinalize, false);
  assert.equal(r.blockers[0].code, 'ALREADY_FINAL');
  assert.equal(r.blockers.length, 1, 'no other blocker is meaningful once final');
});

test('a PENDING overall result blocks finalization', () => {
  const r = evaluateFinalizationReadiness(candidate({ overallResult: 'PENDING' }), INSPECTOR);
  assert.equal(r.canFinalize, false);
  const blocker = r.blockers.find((b) => b.code === 'RESULT_PENDING');
  assert.ok(blocker);
  assert.match(blocker.message, /must be PASS or FAIL/);
});

// ===========================================================================
// Integrity review fixes: explicit verdict, and unresolved/incomplete tests
// ===========================================================================

test('only PASS or FAIL may be issued - anything else blocks', () => {
  for (const verdict of ['PASS', 'FAIL'] as const) {
    assert.equal(
      evaluateFinalizationReadiness(
        candidate({ overallResult: verdict, tests: [{ testType: 'T03', result: verdict }] }),
        INSPECTOR
      ).canFinalize,
      true,
      `${verdict} must be issuable`
    );
  }

  // A missing or unexpected verdict must never be issued, even though the
  // column is NOT NULL - the whitelist is the point.
  for (const bad of [undefined, null, '', 'PENDING', 'UNKNOWN']) {
    const r = evaluateFinalizationReadiness(
      candidate({ overallResult: bad as never }),
      INSPECTOR
    );
    assert.equal(r.canFinalize, false, `verdict ${String(bad)} must block`);
    assert.ok(r.blockers.some((b) => b.code === 'RESULT_PENDING'));
  }
});

test('a test with a missing or unexpected result counts as unresolved', () => {
  for (const bad of [undefined, null, '', 'UNKNOWN']) {
    const r = evaluateFinalizationReadiness(
      candidate({ tests: [{ testType: 'T03', result: bad as never }] }),
      INSPECTOR
    );
    assert.equal(r.canFinalize, false, `result ${String(bad)} must block`);
    assert.ok(r.blockers.some((b) => b.code === 'UNRESOLVED_TESTS'));
  }
});

test('NOT_APPLICABLE is resolved and must never block finalization', () => {
  const r = evaluateFinalizationReadiness(
    candidate({
      tests: [
        { testType: 'T03', result: 'PASS' },
        { testType: 'T06', result: 'NOT_APPLICABLE' },
      ],
    }),
    INSPECTOR
  );
  assert.equal(r.canFinalize, true);
  assert.deepEqual(r.blockers, []);
});

test('a test marked IN_PROGRESS blocks finalization', () => {
  const r = evaluateFinalizationReadiness(
    candidate({
      tests: [
        { testType: 'T01', result: 'PASS', testStatus: 'COMPLETED' },
        { testType: 'T03', result: 'PASS', testStatus: 'IN_PROGRESS' },
      ],
    }),
    INSPECTOR
  );
  assert.equal(r.canFinalize, false);
  const blocker = r.blockers.find((b) => b.code === 'TESTS_IN_PROGRESS');
  assert.ok(blocker);
  assert.match(blocker.message, /T03/);
});

test('legacy test_status PENDING or NULL does not block when result is decided', () => {
  // migration 20260905 added test_status with DEFAULT 'PENDING', backfilling
  // existing rows, so a completed legacy test can carry that value.
  for (const legacy of ['PENDING', null, undefined]) {
    const r = evaluateFinalizationReadiness(
      candidate({
        tests: [{ testType: 'T03', result: 'PASS', testStatus: legacy as never }],
      }),
      INSPECTOR
    );
    assert.equal(
      r.canFinalize,
      true,
      `legacy test_status ${String(legacy)} must not reject a decided test`
    );
  }
});

test('test_status COMPLETED with a PENDING result is still blocked', () => {
  // result is authoritative; a workflow flag cannot override it.
  const r = evaluateFinalizationReadiness(
    candidate({
      overallResult: 'PENDING',
      tests: [{ testType: 'T03', result: 'PENDING', testStatus: 'COMPLETED' }],
    }),
    INSPECTOR
  );
  assert.equal(r.canFinalize, false);
  assert.ok(r.blockers.some((b) => b.code === 'UNRESOLVED_TESTS'));
});

test('unresolved tests block finalization and are named', () => {
  const r = evaluateFinalizationReadiness(
    candidate({
      overallResult: 'PENDING',
      tests: [
        { testType: 'T01', result: 'PASS' },
        { testType: 'T03', result: 'PENDING' },
        { testType: 'T04', result: 'PENDING' },
      ],
    }),
    INSPECTOR
  );
  assert.equal(r.canFinalize, false);
  const blocker = r.blockers.find((b) => b.code === 'UNRESOLVED_TESTS');
  assert.ok(blocker);
  assert.match(blocker.message, /T03, T04/);
});

test('PENDING is never reinterpreted as PASS or FAIL', () => {
  const input = candidate({
    overallResult: 'PENDING',
    tests: [{ testType: 'T03', result: 'PENDING' }],
  });
  const snapshot = JSON.stringify(input);
  evaluateFinalizationReadiness(input, INSPECTOR);
  assert.equal(JSON.stringify(input), snapshot, 'input must not be mutated');
});

test('an inspection with no tests cannot be finalized', () => {
  const r = evaluateFinalizationReadiness(candidate({ tests: [] }), INSPECTOR);
  assert.equal(r.canFinalize, false);
  assert.ok(r.blockers.some((b) => b.code === 'NO_TESTS'));
});

test('an inspection with no rule set cannot be finalized', () => {
  const r = evaluateFinalizationReadiness(candidate({ ruleSetId: null }), INSPECTOR);
  assert.equal(r.canFinalize, false);
  assert.ok(r.blockers.some((b) => b.code === 'NO_RULE_SET'));
});

test('an inspector cannot finalize a report recorded by someone else', () => {
  const r = evaluateFinalizationReadiness(candidate(), OTHER_INSPECTOR);
  assert.equal(r.canFinalize, false);
  assert.ok(r.blockers.some((b) => b.code === 'NOT_AUTHORIZED'));
});

test('an ADMIN may finalize a report they did not record', () => {
  const r = evaluateFinalizationReadiness(candidate(), ADMIN);
  assert.equal(r.canFinalize, true);
});

test('an ADMIN still cannot re-finalize an already FINAL report', () => {
  const r = evaluateFinalizationReadiness(candidate({ reportStatus: 'FINAL' }), ADMIN);
  assert.equal(r.canFinalize, false);
  assert.equal(r.blockers[0].code, 'ALREADY_FINAL');
});

test('every blocker is reported at once, not one at a time', () => {
  const r = evaluateFinalizationReadiness(
    candidate({
      overallResult: 'PENDING',
      ruleSetId: null,
      tests: [{ testType: 'T03', result: 'PENDING' }],
    }),
    OTHER_INSPECTOR
  );
  const codes = r.blockers.map((b) => b.code).sort();
  assert.deepEqual(codes, [
    'NOT_AUTHORIZED',
    'NO_RULE_SET',
    'RESULT_PENDING',
    'UNRESOLVED_TESTS',
  ]);
});

// ===========================================================================
// Verification URL and reference
// ===========================================================================

test('verification URL uses the configured public base URL', () => {
  const url = buildVerificationUrl('abc-123', 'https://nawi.example.gov.in');
  assert.equal(url, 'https://nawi.example.gov.in/verify/abc-123');
});

test('verification URL tolerates a trailing slash on the base', () => {
  assert.equal(
    buildVerificationUrl('abc-123', 'https://nawi.example.gov.in/'),
    'https://nawi.example.gov.in/verify/abc-123'
  );
});

test('verification URL falls back to a relative path, never a guessed host', () => {
  const url = buildVerificationUrl('abc-123', '');
  assert.equal(url, '/verify/abc-123');
  assert.ok(!url.includes('localhost'), 'must never hard-code localhost');
});

test('report reference derives from the token, exposing nothing internal', () => {
  const token = '3f2a1b4c-5d6e-7f80-9a1b-2c3d4e5f6a7b';
  const ref = buildReportReference(token, '2026-09-11T10:00:00Z');
  assert.match(ref, /^NAWI\/\d{6}\/3F2A1B4C$/);
  assert.ok(!ref.includes('-'), 'no raw uuid segments');
});

test('report reference is stable for the same token', () => {
  const token = '3f2a1b4c-5d6e-7f80-9a1b-2c3d4e5f6a7b';
  assert.equal(
    buildReportReference(token, '2026-09-11T10:00:00Z'),
    buildReportReference(token, '2026-09-11T10:00:00Z')
  );
});
