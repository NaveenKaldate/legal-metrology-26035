import test from 'node:test';
import assert from 'node:assert/strict';
import { MpeRule } from '@/types/database';
import { EngineInput } from '../types';
import { getApplicableMPE } from '../mpe-engine';
import {
  calculateT01,
  calculateT02,
  calculateT03,
  calculateT03MultiPoint,
  calculateT04,
  calculateT05,
  calculateT06,
  calculateOverallResult,
} from '../calculation-engine';
import { D, withinLimit, loadInE, isDisplayable } from '../decimal';

/**
 * Engine tests for SIH 26035.
 *
 * Demo instrument (demonstration data only, not a real-world claim):
 *   Class III, Max 30 kg, Min 0.2 kg, e = 0.01 kg, d = 0.001 kg
 *
 * Class III MPE bands (from the seeded rule data):
 *   INITIAL     0 <= m <= 500e -> 0.5e | 500e < m <= 2000e -> 1.0e | 2000e < m <= 10000e -> 1.5e
 *   IN_SERVICE  same bands at 1.0e / 2.0e / 3.0e
 */

const RS = 'rs-oiml-r76-2006';

function mpeRow(
  stage: 'INITIAL' | 'IN_SERVICE',
  lower: number,
  upper: number | null,
  multiplier: number,
  id: string
): MpeRule {
  return {
    id,
    rule_set_id: RS,
    accuracy_class: 'Class III',
    control_stage: stage,
    lower_load_e: lower,
    upper_load_e: upper,
    mpe_multiplier: multiplier,
    mpe_unit: 'e',
    clause: `Class III ${stage} ${lower}-${upper ?? 'open'}e`,
    created_at: new Date().toISOString(),
  };
}

const MPE_RULES: MpeRule[] = [
  mpeRow('INITIAL', 0, 500, 0.5, 'i-1'),
  mpeRow('INITIAL', 500, 2000, 1.0, 'i-2'),
  mpeRow('INITIAL', 2000, 10000, 1.5, 'i-3'),
  mpeRow('IN_SERVICE', 0, 500, 1.0, 's-1'),
  mpeRow('IN_SERVICE', 500, 2000, 2.0, 's-2'),
  mpeRow('IN_SERVICE', 2000, 10000, 3.0, 's-3'),
];

const CLASS_III: EngineInput = {
  instrument_type: 'ELECTRONIC_WEIGHING',
  accuracy_class: 'Class III',
  max_capacity: 30,
  min_capacity: 0.2,
  verification_interval_e: 0.01,
  actual_interval_d: 0.001,
  unit: 'kg',
  has_tare: true,
  zero_configuration: 'NON_AUTOMATIC',
};

// ===========================================================================
// Exact decimal arithmetic
// ===========================================================================

test('decimal: error exactly equal to MPE is treated as PASS (<=)', () => {
  // These fail with raw JS floats: 0.04 - 0.03 === 0.010000000000000002
  for (const [load, observed] of [[0.03, 0.04], [0.09, 0.1], [0.12, 0.13]] as const) {
    const err = D(observed).minus(D(load)).abs();
    assert.equal(err.toString(), '0.01', `|${observed} - ${load}| should be exactly 0.01`);
    assert.ok(withinLimit(err, D(0.01)), 'error equal to the MPE must be within the limit');
  }
});

test('decimal: load/e is exact (5.01 / 0.01 is 501, not 500.99999999999994)', () => {
  assert.equal(loadInE(5.01, 0.01).toString(), '501');
  assert.equal(loadInE(5, 0.01).toString(), '500');
  assert.equal(loadInE(20, 0.01).toString(), '2000');
});

// ===========================================================================
// MPE band boundaries - the determinism fix
// ===========================================================================

test('MPE: exactly 500e resolves to the lower band (0.5e) and only that band', () => {
  const res = getApplicableMPE(RS, 'Class III', 'INITIAL', 5, 0.01, MPE_RULES);
  assert.equal(res.status, 'SUCCESS');
  assert.equal(res.mpeInE, 0.5);
  assert.equal(res.mpeValue, 0.005);
  assert.equal(res.mpeRuleId, 'i-1');
});

test('MPE: 500e verdict does not depend on rule row order', () => {
  const forward = getApplicableMPE(RS, 'Class III', 'INITIAL', 5, 0.01, MPE_RULES);
  const reversed = getApplicableMPE(RS, 'Class III', 'INITIAL', 5, 0.01, [...MPE_RULES].reverse());
  const shuffled = getApplicableMPE(RS, 'Class III', 'INITIAL', 5, 0.01, [
    MPE_RULES[2], MPE_RULES[0], MPE_RULES[1], MPE_RULES[4], MPE_RULES[3], MPE_RULES[5],
  ]);
  assert.equal(forward.mpeRuleId, 'i-1');
  assert.equal(reversed.mpeRuleId, 'i-1', 'reversed row order must give the same rule');
  assert.equal(shuffled.mpeRuleId, 'i-1', 'shuffled row order must give the same rule');
});

test('MPE: 501e crosses into the 1.0e band (no overlap at the edge)', () => {
  const res = getApplicableMPE(RS, 'Class III', 'INITIAL', 5.01, 0.01, MPE_RULES);
  assert.equal(res.mpeInE, 1.0);
  assert.equal(res.mpeValue, 0.01);
  assert.equal(res.mpeRuleId, 'i-2');
});

test('MPE: exactly 2000e resolves to the 1.0e band, 2001e to the 1.5e band', () => {
  assert.equal(getApplicableMPE(RS, 'Class III', 'INITIAL', 20, 0.01, MPE_RULES).mpeInE, 1.0);
  assert.equal(getApplicableMPE(RS, 'Class III', 'INITIAL', 20.01, 0.01, MPE_RULES).mpeInE, 1.5);
});

test('MPE: zero load resolves to the first band (inclusive lower bound at 0)', () => {
  const res = getApplicableMPE(RS, 'Class III', 'INITIAL', 0, 0.01, MPE_RULES);
  assert.equal(res.status, 'SUCCESS');
  assert.equal(res.mpeInE, 0.5);
});

test('MPE: IN_SERVICE stage selects the doubled band', () => {
  const res = getApplicableMPE(RS, 'Class III', 'IN_SERVICE', 5, 0.01, MPE_RULES);
  assert.equal(res.mpeInE, 1.0);
  assert.equal(res.mpeValue, 0.01);
});

test('MPE: duplicated/overlapping rules are reported, never silently resolved', () => {
  const withDuplicate = [...MPE_RULES, mpeRow('INITIAL', 0, 500, 1.5, 'dupe')];
  const res = getApplicableMPE(RS, 'Class III', 'INITIAL', 5, 0.01, withDuplicate);
  assert.equal(res.status, 'PENDING');
  assert.equal(res.reasonCode, 'AMBIGUOUS_RULES');
  assert.match(res.reason!, /Ambiguous MPE configuration/);
});

test('MPE: load above the highest band reports a clear reason', () => {
  const res = getApplicableMPE(RS, 'Class III', 'INITIAL', 200, 0.01, MPE_RULES);
  assert.equal(res.status, 'PENDING');
  assert.equal(res.reasonCode, 'NO_APPLICABLE_RULE');
});

test('MPE: missing inputs produce specific reason codes', () => {
  assert.equal(getApplicableMPE(null, 'Class III', 'INITIAL', 5, 0.01, MPE_RULES).reasonCode, 'MISSING_RULE_SET');
  assert.equal(getApplicableMPE(RS, null, 'INITIAL', 5, 0.01, MPE_RULES).reasonCode, 'MISSING_ACCURACY_CLASS');
  assert.equal(getApplicableMPE(RS, 'Class III', 'INITIAL', 5, 0, MPE_RULES).reasonCode, 'INVALID_E');
  assert.equal(getApplicableMPE(RS, 'Class III', 'INITIAL', 5, null, MPE_RULES).reasonCode, 'INVALID_E');
  assert.equal(getApplicableMPE(RS, 'Class III', 'INITIAL', null, 0.01, MPE_RULES).reasonCode, 'MISSING_TEST_LOAD');
  assert.equal(getApplicableMPE(RS, 'Class III', 'TYPE_EVALUATION', 5, 0.01, MPE_RULES).reasonCode, 'NO_RULES_FOR_STAGE');
});

// ===========================================================================
// DEMO TEST CASES
// ===========================================================================

test('DEMO T03 PASS: 5 kg / 5.004 kg -> error 0.004, MPE 0.005 -> PASS', () => {
  const res = calculateT03('DIRECT', 5, 5.004, null, RS, CLASS_III, MPE_RULES, 'INITIAL');
  assert.equal(res.result, 'PASS');
  assert.equal(res.calculatedError, 0.004, 'error must be exactly 0.004');
  assert.equal(res.absoluteError, 0.004);
  assert.equal(res.mpeValue, 0.005);
});

test('DEMO T03 FAIL: 5 kg / 5.007 kg -> error 0.007 > MPE 0.005 -> FAIL', () => {
  const res = calculateT03('DIRECT', 5, 5.007, null, RS, CLASS_III, MPE_RULES, 'INITIAL');
  assert.equal(res.result, 'FAIL');
  assert.equal(res.calculatedError, 0.007, 'error must be exactly 0.007');
  assert.equal(res.mpeValue, 0.005);
});

test('DEMO T03 band: 5.01 kg (501e) must use MPE 1.0e = 0.01', () => {
  const res = calculateT03('DIRECT', 5.01, 5.014, null, RS, CLASS_III, MPE_RULES, 'INITIAL');
  assert.equal(res.mpeValue, 0.01);
  assert.equal(res.result, 'PASS');
});

test('DEMO T03 IN-SERVICE: 5 kg / 5.007 kg -> MPE doubles to 0.01 -> PASS', () => {
  const res = calculateT03('DIRECT', 5, 5.007, null, RS, CLASS_III, MPE_RULES, 'IN_SERVICE');
  assert.equal(res.result, 'PASS');
  assert.equal(res.mpeValue, 0.01);
});

test('DEMO T04: 15 kg, readings 15.002/15.004/15.003 -> range 0.002 <= 0.01 -> PASS', () => {
  const res = calculateT04(15, [15.002, 15.004, 15.003], RS, CLASS_III, MPE_RULES, 'INITIAL');
  assert.equal(res.result, 'PASS');
  assert.equal(res.calculatedError, 0.002, 'range must be exactly 0.002');
  assert.equal(res.mpeValue, 0.01);
});

test('DEMO T05: 10 kg at 5 positions, max error 0.004 <= 0.01 -> PASS', () => {
  const res = calculateT05(
    10,
    {
      'Position 1 (Center)': 10.003,
      'Position 2 (Front-Left)': 10.004,
      'Position 3 (Front-Right)': 10.002,
      'Position 4 (Back-Right)': 10.003,
      'Position 5 (Back-Left)': 10.003,
    },
    RS,
    CLASS_III,
    MPE_RULES,
    'INITIAL'
  );
  assert.equal(res.result, 'PASS');
  assert.equal(res.absoluteError, 0.004, 'largest error must be exactly 0.004');
  assert.equal(res.mpeValue, 0.01);
});

// ===========================================================================
// Verdicts at the limit
// ===========================================================================

test('T03: error exactly equal to the MPE is a PASS', () => {
  const res = calculateT03('DIRECT', 5, 5.005, null, RS, CLASS_III, MPE_RULES, 'INITIAL');
  assert.equal(res.calculatedError, 0.005);
  assert.equal(res.result, 'PASS', 'error == MPE must pass');
});

test('T03: negative error of the same magnitude behaves identically', () => {
  const res = calculateT03('DIRECT', 5, 4.995, null, RS, CLASS_III, MPE_RULES, 'INITIAL');
  assert.equal(res.calculatedError, -0.005);
  assert.equal(res.absoluteError, 0.005);
  assert.equal(res.result, 'PASS');
});

test('T04: range exactly equal to the MPE is a PASS', () => {
  const res = calculateT04(15, [15.0, 15.01], RS, CLASS_III, MPE_RULES, 'INITIAL');
  assert.equal(res.calculatedError, 0.01);
  assert.equal(res.result, 'PASS');
});

// ===========================================================================
// Changeover point method (R-76): P = I + 0.5e - delta_L, E = P - L
// ===========================================================================

test('T03 changeover: P = I + 0.5e - delta_L and E = P - L', () => {
  // I = 5.00, e = 0.01, delta_L = 0.004 -> P = 5 + 0.005 - 0.004 = 5.001; E = +0.001
  const res = calculateT03('CHANGEOVER_POINT', 5, 5.0, 0.004, RS, CLASS_III, MPE_RULES, 'INITIAL');
  assert.equal(res.auditDetails.calculated_indication, 5.001);
  assert.equal(res.calculatedError, 0.001);
  assert.equal(res.result, 'PASS');
});

// ===========================================================================
// Validation / missing input handling
// ===========================================================================

test('T03: missing observed value is PENDING with an actionable message', () => {
  const res = calculateT03('DIRECT', 5, null, null, RS, CLASS_III, MPE_RULES, 'INITIAL');
  assert.equal(res.result, 'PENDING');
  assert.equal(res.reasonCode, 'MISSING_OBSERVED_VALUE');
  assert.match(res.reason!, /Observed indication is missing/);
});

test('T03: load above Max is rejected before any verdict', () => {
  const res = calculateT03('DIRECT', 500, 500.001, null, RS, CLASS_III, MPE_RULES, 'INITIAL');
  assert.equal(res.result, 'PENDING');
  assert.equal(res.reasonCode, 'LOAD_OUT_OF_RANGE');
  assert.match(res.reason!, /exceeds the instrument maximum capacity/);
});

test('T03: load below Min is rejected', () => {
  const res = calculateT03('DIRECT', 0.05, 0.051, null, RS, CLASS_III, MPE_RULES, 'INITIAL');
  assert.equal(res.result, 'PENDING');
  assert.equal(res.reasonCode, 'LOAD_OUT_OF_RANGE');
});

test('T04: fewer than 2 readings is PENDING', () => {
  const res = calculateT04(15, [15.002], RS, CLASS_III, MPE_RULES, 'INITIAL');
  assert.equal(res.result, 'PENDING');
  assert.equal(res.reasonCode, 'INSUFFICIENT_READINGS');
});

test('T02: invalid e is PENDING, not a silent pass', () => {
  const res = calculateT02('DIRECT', 0, 0, null, 0, 'NON_AUTOMATIC');
  assert.equal(res.result, 'PENDING');
  assert.equal(res.reasonCode, 'INVALID_E');
});

test('T02: zero-tracking configuration is PENDING, never assumed to pass', () => {
  const res = calculateT02('DIRECT', 0, 0, null, 0.01, 'ZERO_TRACKING');
  assert.equal(res.result, 'PENDING');
  assert.equal(res.reasonCode, 'PROCEDURE_NOT_CONFIGURED');
});

test('T02: zero error within 0.25e passes, beyond it fails', () => {
  const pass = calculateT02('DIRECT', 0, 0.002, null, 0.01, 'NON_AUTOMATIC');
  assert.equal(pass.result, 'PASS');
  const atLimit = calculateT02('DIRECT', 0, 0.0025, null, 0.01, 'NON_AUTOMATIC');
  assert.equal(atLimit.result, 'PASS', '0.25e exactly must pass');
  const fail = calculateT02('DIRECT', 0, 0.003, null, 0.01, 'NON_AUTOMATIC');
  assert.equal(fail.result, 'FAIL');
});

// ===========================================================================
// T01 / T06 applicability
// ===========================================================================

test('T01: all items checked -> PASS; any item unchecked -> FAIL', () => {
  const ok = calculateT01({ a: true, b: true });
  assert.equal(ok.result, 'PASS');
  const bad = calculateT01({ a: true, b: false });
  assert.equal(bad.result, 'FAIL');
  assert.deepEqual(bad.auditDetails.failed_items, ['b']);
});

test('T01: empty checklist is PENDING, not PASS', () => {
  assert.equal(calculateT01({}).result, 'PENDING');
});

test('T06: instrument without a tare device is NOT_APPLICABLE', () => {
  const res = calculateT06(2, 10, 8, RS, { ...CLASS_III, has_tare: false }, MPE_RULES, 'INITIAL');
  assert.equal(res.result, 'NOT_APPLICABLE');
});

test('T06: net error is evaluated against the MPE at the net load', () => {
  // gross 10, tare 2 -> expected net 8 (800e -> 1.0e band -> MPE 0.01)
  const res = calculateT06(2, 10, 8.004, RS, CLASS_III, MPE_RULES, 'INITIAL');
  assert.equal(res.result, 'PASS');
  assert.equal(res.calculatedError, 0.004);
  assert.equal(res.mpeValue, 0.01);
});

// ===========================================================================
// T03 multi-point
// ===========================================================================

test('T03 multi-point: all points within MPE -> PASS', () => {
  const res = calculateT03MultiPoint(
    'DIRECT',
    [
      { load: 0.2, observed: 0.2, label: 'Min' },
      { load: 5, observed: 5.004, label: '500e band edge' },
      { load: 15, observed: 15.006, label: 'Half Max' },
      { load: 30, observed: 30.01, label: 'Max' },
    ],
    RS,
    CLASS_III,
    MPE_RULES,
    'INITIAL'
  );
  assert.equal(res.result, 'PASS');
  assert.equal(res.auditDetails.point_count, 4);
});

test('T03 multi-point: one failing point fails the whole test', () => {
  const res = calculateT03MultiPoint(
    'DIRECT',
    [
      { load: 5, observed: 5.004, label: 'Point A' },
      { load: 5, observed: 5.007, label: 'Point B' },
    ],
    RS,
    CLASS_III,
    MPE_RULES,
    'INITIAL'
  );
  assert.equal(res.result, 'FAIL');
  assert.deepEqual(res.auditDetails.failed_points, ['Point B']);
});

test('T03 multi-point: different bands apply per point', () => {
  const res = calculateT03MultiPoint(
    'DIRECT',
    [
      { load: 5, observed: 5.0, label: '500e' },
      { load: 5.01, observed: 5.01, label: '501e' },
    ],
    RS,
    CLASS_III,
    MPE_RULES,
    'INITIAL'
  );
  const points = res.auditDetails.points as Array<{ mpe_in_e: number }>;
  assert.equal(points[0].mpe_in_e, 0.5);
  assert.equal(points[1].mpe_in_e, 1.0);
});

test('T03 multi-point: a pending point makes the test PENDING, not PASS', () => {
  const res = calculateT03MultiPoint(
    'DIRECT',
    [
      { load: 5, observed: 5.004, label: 'Good' },
      { load: 5, observed: null, label: 'Incomplete' },
    ],
    RS,
    CLASS_III,
    MPE_RULES,
    'INITIAL'
  );
  assert.equal(res.result, 'PENDING');
});

// ===========================================================================
// Overall result
// ===========================================================================

test('overall: any FAIL -> FAIL, even with a PENDING present', () => {
  assert.equal(
    calculateOverallResult([
      { testCode: 'T01', applicability: 'REQUIRED', result: 'PASS' },
      { testCode: 'T03', applicability: 'REQUIRED', result: 'FAIL' },
      { testCode: 'T04', applicability: 'REQUIRED', result: 'PENDING' },
    ]),
    'FAIL'
  );
});

test('overall: PENDING beats PASS', () => {
  assert.equal(
    calculateOverallResult([
      { testCode: 'T01', applicability: 'REQUIRED', result: 'PASS' },
      { testCode: 'T04', applicability: 'REQUIRED', result: 'PENDING' },
    ]),
    'PENDING'
  );
});

test('overall: all PASS with a NOT_APPLICABLE test -> PASS', () => {
  assert.equal(
    calculateOverallResult([
      { testCode: 'T01', applicability: 'REQUIRED', result: 'PASS' },
      { testCode: 'T06', applicability: 'NOT_APPLICABLE', result: 'NOT_APPLICABLE' },
    ]),
    'PASS'
  );
});

test('overall: everything NOT_APPLICABLE -> PENDING (nothing demonstrated)', () => {
  assert.equal(
    calculateOverallResult([
      { testCode: 'T06', applicability: 'NOT_APPLICABLE', result: 'NOT_APPLICABLE' },
    ]),
    'PENDING'
  );
});

test('overall: no tests at all -> PENDING', () => {
  assert.equal(calculateOverallResult([]), 'PENDING');
});

// ===========================================================================
// Display step (d): can the indicator actually show this reading?
// Arithmetic only - asserts no regulatory requirement.
// ===========================================================================
test('displayable: with d = 0.01 an indicator cannot show 5.004', () => {
  assert.equal(isDisplayable(5.004, 0.01), false);
  assert.equal(isDisplayable(15.008, 0.01), false);
  assert.equal(isDisplayable(15.012, 0.01), false);
  assert.equal(isDisplayable(5.0, 0.01), true);
  assert.equal(isDisplayable(5.01, 0.01), true);
});

test('displayable: with d = 0.001 those same readings are fine', () => {
  for (const v of [5.004, 5.007, 5.005, 15.008, 15.012, 15.002, 10.003]) {
    assert.equal(isDisplayable(v, 0.001), true, `${v} should be displayable at d=0.001`);
  }
});

test('displayable: unknown or zero d never warns', () => {
  assert.equal(isDisplayable(5.004, null), true);
  assert.equal(isDisplayable(5.004, 0), true);
});

test('displayable: exact decimal, no float drift', () => {
  // 0.1 + 0.2 style drift would break a naive % check
  assert.equal(isDisplayable(0.3, 0.1), true);
  assert.equal(isDisplayable(29.99, 0.01), true);
});
