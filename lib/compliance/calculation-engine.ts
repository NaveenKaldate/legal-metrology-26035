import { MpeRule, InspectionType, TestResult } from '@/types/database';
import {
  EngineInput,
  TestCalculationResult,
  AuditDetails,
  PendingReasonCode,
} from './types';
import { getApplicableMPE } from './mpe-engine';
import {
  D,
  isNumeric,
  toNumber,
  withinLimit,
  loadInE,
  formatDecimal,
  Decimal,
} from './decimal';

/**
 * Core OIML R-76 / Legal Metrology compliance engine for T01 - T06.
 *
 * DETERMINISM CONTRACT
 * --------------------
 * 1. Every PASS/FAIL decision comes from database rules (MPE tables), never
 *    from constants in this file, except where a value is a METHOD constant
 *    rather than a tolerance (see ZERO_SETTING_LIMIT_IN_E and the 0.5e
 *    changeover term, both documented below).
 * 2. All mass/error arithmetic uses exact decimals. Raw JS float subtraction
 *    flips verdicts when the error lands exactly on the MPE.
 * 3. A calculation that cannot be completed returns PENDING with a machine
 *    readable reasonCode and a message the inspector can act on. It never
 *    guesses and never silently passes.
 */

/**
 * Zero-setting limit, expressed in e.
 *
 * NEEDS VERIFICATION: 0.25e reflects the commonly cited R-76 requirement that
 * zero setting must not alter the result by more than +/- 0.25e, but the exact
 * clause has not been verified against the source text, and unlike the MPE
 * tables this value is not yet database-driven. It is isolated here (rather
 * than inlined in the maths) so it can be moved into `calculation_rules`
 * without touching the formula.
 */
export const ZERO_SETTING_LIMIT_IN_E = 0.25;

/**
 * Changeover-point term. P = I + 0.5e - delta_L is the R-76 method for
 * obtaining the indication before rounding; 0.5 is part of the method
 * definition, not a tolerance, so it is a legitimate constant.
 */
const CHANGEOVER_HALF = 0.5;

function pending(
  testCode: string,
  method: string,
  reason: string,
  reasonCode: PendingReasonCode,
  auditDetails: Partial<AuditDetails> = {},
  remarks?: string
): TestCalculationResult {
  return {
    testCode,
    result: 'PENDING',
    calculatedError: null,
    absoluteError: null,
    mpeValue: null,
    mpeRuleId: null,
    method,
    auditDetails: { method, test_code: testCode, reason, ...auditDetails },
    remarks: remarks || reason,
    reason,
    reasonCode,
  };
}

/**
 * Shared guard: is the applied load inside the instrument's Min..Max range?
 * Returns null when acceptable, otherwise a human-readable problem.
 */
function checkLoadRange(load: Decimal, instrument: EngineInput): string | null {
  const unit = instrument.unit || '';
  if (isNumeric(instrument.max_capacity) && load.gt(D(instrument.max_capacity))) {
    return `Test load ${formatDecimal(load)} ${unit} exceeds the instrument maximum capacity (Max = ${formatDecimal(
      instrument.max_capacity
    )} ${unit}).`;
  }
  if (
    isNumeric(instrument.min_capacity) &&
    load.gt(0) &&
    load.lt(D(instrument.min_capacity))
  ) {
    return `Test load ${formatDecimal(load)} ${unit} is below the instrument minimum capacity (Min = ${formatDecimal(
      instrument.min_capacity
    )} ${unit}).`;
  }
  return null;
}

// ---------------------------------------------------------------------------
// T01: Visual & Administrative Examination
// ---------------------------------------------------------------------------
export function calculateT01(
  checklist: Record<string, boolean>,
  remarks?: string
): TestCalculationResult {
  const keys = Object.keys(checklist || {});
  if (keys.length === 0) {
    return pending(
      'T01',
      'CHECKLIST_EVALUATION',
      'Visual & administrative checklist has not been completed.',
      'CHECKLIST_INCOMPLETE',
      { checklist },
      remarks
    );
  }

  const failedItems = keys.filter((key) => checklist[key] !== true);
  const allPassed = failedItems.length === 0;
  const result: TestResult = allPassed ? 'PASS' : 'FAIL';

  return {
    testCode: 'T01',
    result,
    calculatedError: null,
    absoluteError: null,
    mpeValue: null,
    mpeRuleId: null,
    method: 'CHECKLIST_EVALUATION',
    auditDetails: {
      method: 'CHECKLIST_EVALUATION',
      test_code: 'T01',
      checklist,
      failed_items: failedItems,
      inputs: { checklist },
      outputs: { all_passed: allPassed, failed_items: failedItems },
      formula: 'All mandatory administrative items == TRUE',
      reason: allPassed
        ? 'All mandatory inscriptions, markings and approval details verified.'
        : `Failed items: ${failedItems.join(', ')}`,
    },
    remarks:
      remarks ||
      (allPassed
        ? 'Visual & administrative examination passed.'
        : `Defects found during visual examination (${failedItems.length} item(s) failed).`),
  };
}

// ---------------------------------------------------------------------------
// T02: Zero-setting Accuracy
// ---------------------------------------------------------------------------
export function calculateT02(
  method: 'DIRECT' | 'CHANGEOVER',
  zeroLoad: number | null,
  indication: number | null,
  deltaL: number | null,
  e: number | null | undefined,
  zeroConfig: 'NON_AUTOMATIC' | 'SEMI_AUTOMATIC' | 'AUTOMATIC' | 'ZERO_TRACKING' = 'NON_AUTOMATIC',
  remarks?: string
): TestCalculationResult {
  if (!isNumeric(e) || D(e).lte(0)) {
    return pending(
      'T02',
      method,
      'Verification interval e is missing or invalid. Edit the instrument and set e to a value greater than zero.',
      'INVALID_E',
      { indication, delta_l: deltaL, zero_config: zeroConfig },
      remarks
    );
  }

  if (zeroConfig === 'AUTOMATIC' || zeroConfig === 'ZERO_TRACKING') {
    return pending(
      'T02',
      `${zeroConfig}_PROCEDURE`,
      `The zero-setting procedure for a ${zeroConfig
        .replace('_', ' ')
        .toLowerCase()} device is not yet configured in the rule set. Select a non-automatic or semi-automatic configuration, or ask an administrator to configure this procedure.`,
      'PROCEDURE_NOT_CONFIGURED',
      { zero_config: zeroConfig },
      remarks
    );
  }

  if (!isNumeric(indication)) {
    return pending(
      'T02',
      method,
      'Zero indication reading is missing. Enter the observed indication at zero load.',
      'MISSING_OBSERVED_VALUE',
      { indication, delta_l: deltaL, verification_interval_e: e },
      remarks
    );
  }

  // delta_L is a MEASURED quantity - the additional load added until the
  // indication changes. Falling back to a direct reading here would record a
  // direct result while claiming the changeover method was used.
  if (method === 'CHANGEOVER' && !isNumeric(deltaL)) {
    return pending(
      'T02',
      method,
      'Additional load ΔL is required for the changeover-point method. Enter the extra load added until the indication changed, or switch this test to the direct method.',
      'MISSING_DELTA_L',
      { indication, delta_l: deltaL, verification_interval_e: e },
      remarks
    );
  }

  const eD = D(e);
  const indicationD = D(indication);
  const referenceZero = isNumeric(zeroLoad) ? D(zeroLoad) : D(0);

  let calculatedIndication: Decimal;
  let error: Decimal;

  if (method === 'CHANGEOVER') {
    // P_0 = I_0 + 0.5e - delta_L ; E_0 = P_0 - L_0
    calculatedIndication = indicationD.plus(eD.times(CHANGEOVER_HALF)).minus(D(deltaL));
    error = calculatedIndication.minus(referenceZero);
  } else {
    calculatedIndication = indicationD;
    error = indicationD.minus(referenceZero);
  }

  const absError = error.abs();
  const allowedZeroMpe = eD.times(ZERO_SETTING_LIMIT_IN_E);
  const pass = withinLimit(absError, allowedZeroMpe);
  const unit = 'e';

  const auditDetails: AuditDetails = {
    method,
    test_code: 'T02',
    load: toNumber(referenceZero),
    observed: indication,
    delta_l: deltaL,
    verification_interval_e: e,
    zero_config: zeroConfig,
    calculated_indication: toNumber(calculatedIndication),
    calculated_error: toNumber(error),
    absolute_error: toNumber(absError),
    mpe_value: toNumber(allowedZeroMpe),
    mpe_in_e: ZERO_SETTING_LIMIT_IN_E,
    mpe_clause: `Zero-setting error <= +/- ${ZERO_SETTING_LIMIT_IN_E}e (NEEDS VERIFICATION against R-76 source text)`,
    inputs: {
      method,
      zero_load: toNumber(referenceZero),
      indication,
      delta_l: deltaL,
      e,
      zero_config: zeroConfig,
    },
    outputs: {
      P_0: toNumber(calculatedIndication),
      E_0: toNumber(error),
      absError: toNumber(absError),
      allowedZeroMpe: toNumber(allowedZeroMpe),
    },
    formula:
      method === 'CHANGEOVER'
        ? 'P_0 = I_0 + 0.5e - delta_L; E_0 = P_0 - L_0'
        : 'E_0 = I_0 - L_0',
  };

  // Error expressed in multiples of e, for a correctly-worded remark.
  const errorInE = absError.div(eD);

  return {
    testCode: 'T02',
    result: pass ? 'PASS' : 'FAIL',
    calculatedError: toNumber(error),
    absoluteError: toNumber(absError),
    mpeValue: toNumber(allowedZeroMpe),
    mpeRuleId: null,
    method,
    auditDetails,
    remarks:
      remarks ||
      (pass
        ? `Zero error ${formatDecimal(errorInE, 3)}${unit} is within the +/- ${ZERO_SETTING_LIMIT_IN_E}${unit} limit.`
        : `Zero error ${formatDecimal(errorInE, 3)}${unit} exceeds the +/- ${ZERO_SETTING_LIMIT_IN_E}${unit} limit.`),
  };
}

// ---------------------------------------------------------------------------
// T03: Errors of Indication (single load point)
// ---------------------------------------------------------------------------
export function calculateT03(
  method: 'DIRECT' | 'CHANGEOVER_POINT',
  load: number | null,
  observed: number | null,
  deltaL: number | null,
  ruleSetId: string | null,
  instrument: EngineInput,
  mpeRules: MpeRule[],
  controlStage: InspectionType,
  remarks?: string
): TestCalculationResult {
  if (!isNumeric(load)) {
    return pending(
      'T03',
      method,
      'Test load is missing. Enter the applied test load.',
      'MISSING_TEST_LOAD',
      { load, observed },
      remarks
    );
  }

  if (!isNumeric(observed)) {
    return pending(
      'T03',
      method,
      'Observed indication is missing. Enter the value shown on the instrument.',
      'MISSING_OBSERVED_VALUE',
      { load, observed },
      remarks
    );
  }

  // delta_L is a MEASURED quantity - the additional load added until the
  // indication steps to the next interval. Silently falling back to a direct
  // reading would store a direct result under the changeover method's name.
  if (method === 'CHANGEOVER_POINT' && !isNumeric(deltaL)) {
    return pending(
      'T03',
      method,
      'Additional load ΔL is required for the changeover-point method. Enter the extra load added until the indication changed, or switch this test to the direct method.',
      'MISSING_DELTA_L',
      { load, observed, delta_l: deltaL },
      remarks
    );
  }

  const loadD = D(load);
  const rangeProblem = checkLoadRange(loadD, instrument);
  if (rangeProblem) {
    return pending('T03', method, rangeProblem, 'LOAD_OUT_OF_RANGE', { load, observed }, remarks);
  }

  const e = instrument.verification_interval_e;

  const mpeEval = getApplicableMPE(
    ruleSetId,
    instrument.accuracy_class,
    controlStage,
    load,
    e,
    mpeRules
  );

  if (mpeEval.status === 'PENDING' || !mpeEval.mpeValueDecimal) {
    return pending(
      'T03',
      method,
      mpeEval.reason || 'Applicable MPE rule not found.',
      mpeEval.reasonCode || 'NO_APPLICABLE_RULE',
      { load, observed },
      remarks
    );
  }

  const eD = D(e);
  const observedD = D(observed);

  let calculatedIndication: Decimal;
  let error: Decimal;

  if (method === 'CHANGEOVER_POINT') {
    // R-76 changeover point method, error before rounding:
    // P = I + 0.5e - delta_L ; E = P - L
    calculatedIndication = observedD.plus(eD.times(CHANGEOVER_HALF)).minus(D(deltaL));
    error = calculatedIndication.minus(loadD);
  } else {
    calculatedIndication = observedD;
    error = observedD.minus(loadD);
  }

  const absError = error.abs();
  const mpe = mpeEval.mpeValueDecimal;
  const result: TestResult = withinLimit(absError, mpe) ? 'PASS' : 'FAIL';
  const unit = instrument.unit || '';

  const auditDetails: AuditDetails = {
    method,
    test_code: 'T03',
    load,
    observed,
    delta_l: deltaL,
    verification_interval_e: e,
    load_in_e: toNumber(loadInE(loadD, eD)),
    calculated_indication: toNumber(calculatedIndication),
    calculated_error: toNumber(error),
    absolute_error: toNumber(absError),
    mpe_value: toNumber(mpe),
    mpe_in_e: mpeEval.mpeInE,
    mpe_clause: mpeEval.clause,
    control_stage: controlStage,
    inputs: { method, load, observed, delta_l: deltaL, e, control_stage: controlStage },
    outputs: {
      P: toNumber(calculatedIndication),
      E: toNumber(error),
      absoluteError: toNumber(absError),
      MPE: toNumber(mpe),
    },
    formula:
      method === 'CHANGEOVER_POINT'
        ? 'P = I + 0.5e - delta_L; E = P - L'
        : 'E = Observed - Reference',
  };

  return {
    testCode: 'T03',
    result,
    calculatedError: toNumber(error),
    absoluteError: toNumber(absError),
    mpeValue: toNumber(mpe),
    mpeRuleId: mpeEval.mpeRuleId,
    method,
    auditDetails,
    remarks:
      remarks ||
      (result === 'PASS'
        ? `Indication error ${formatDecimal(error)} ${unit} is within MPE (+/- ${formatDecimal(mpe)} ${unit}).`
        : `Indication error ${formatDecimal(error)} ${unit} exceeds MPE (+/- ${formatDecimal(mpe)} ${unit}).`),
  };
}

// ---------------------------------------------------------------------------
// T03 multi-point: evaluates several load points as one test.
// The individual point calculation is unchanged; this only aggregates.
// ---------------------------------------------------------------------------
export interface IndicationPoint {
  load: number | null;
  observed: number | null;
  deltaL?: number | null;
  /** Optional label, e.g. "Min", "Max", "Band change 500e", "Unloading". */
  label?: string;
  /** 'UP' while loading, 'DOWN' while unloading. */
  direction?: 'UP' | 'DOWN';
}

export function calculateT03MultiPoint(
  method: 'DIRECT' | 'CHANGEOVER_POINT',
  points: IndicationPoint[],
  ruleSetId: string | null,
  instrument: EngineInput,
  mpeRules: MpeRule[],
  controlStage: InspectionType,
  remarks?: string
): TestCalculationResult {
  if (!points || points.length === 0) {
    return pending(
      'T03',
      method,
      'At least one load point is required for the errors of indication test.',
      'MISSING_TEST_LOAD',
      { points: [] },
      remarks
    );
  }

  const evaluated = points.map((point) =>
    calculateT03(
      method,
      point.load,
      point.observed,
      point.deltaL ?? null,
      ruleSetId,
      instrument,
      mpeRules,
      controlStage,
      // Suppress per-point remark text; the aggregate builds its own.
      undefined
    )
  ).map((res, index) => ({
    ...res,
    label: points[index].label || `Point ${index + 1}`,
    direction: points[index].direction || 'UP',
  }));

  const pointDetails = evaluated.map((res) => ({
    label: res.label,
    direction: res.direction,
    load: res.auditDetails.load ?? null,
    observed: res.auditDetails.observed ?? null,
    load_in_e: res.auditDetails.load_in_e ?? null,
    calculated_error: res.calculatedError,
    absolute_error: res.absoluteError,
    mpe_value: res.mpeValue,
    mpe_in_e: res.auditDetails.mpe_in_e ?? null,
    mpe_clause: res.auditDetails.mpe_clause ?? null,
    result: res.result,
    reason: res.reason ?? null,
  }));

  const unit = instrument.unit || '';
  const firstPending = evaluated.find((r) => r.result === 'PENDING');
  const failures = evaluated.filter((r) => r.result === 'FAIL');

  // Worst point by absolute error, for the summary columns.
  let worst = evaluated[0];
  for (const candidate of evaluated) {
    const a = isNumeric(candidate.absoluteError) ? D(candidate.absoluteError) : null;
    const b = isNumeric(worst.absoluteError) ? D(worst.absoluteError) : null;
    if (a && (!b || a.gt(b))) worst = candidate;
  }

  const auditDetails: AuditDetails = {
    method,
    test_code: 'T03',
    points: pointDetails,
    point_count: evaluated.length,
    failed_points: failures.map((f) => f.label),
    control_stage: controlStage,
    verification_interval_e: instrument.verification_interval_e,
    load: worst?.auditDetails.load ?? null,
    observed: worst?.auditDetails.observed ?? null,
    calculated_error: worst?.calculatedError ?? null,
    absolute_error: worst?.absoluteError ?? null,
    mpe_value: worst?.mpeValue ?? null,
    mpe_clause: worst?.auditDetails.mpe_clause ?? null,
    inputs: { method, points, control_stage: controlStage },
    outputs: { points: pointDetails },
    formula:
      method === 'CHANGEOVER_POINT'
        ? 'For each point: P = I + 0.5e - delta_L; E = P - L; |E| <= MPE(L)'
        : 'For each point: E = Observed - Load; |E| <= MPE(L)',
  };

  if (failures.length > 0) {
    return {
      testCode: 'T03',
      result: 'FAIL',
      calculatedError: worst?.calculatedError ?? null,
      absoluteError: worst?.absoluteError ?? null,
      mpeValue: worst?.mpeValue ?? null,
      mpeRuleId: worst?.mpeRuleId ?? null,
      method,
      auditDetails,
      remarks:
        remarks ||
        `${failures.length} of ${evaluated.length} load point(s) exceed MPE (worst: ${formatDecimal(
          worst?.calculatedError
        )} ${unit} at ${worst?.label}).`,
    };
  }

  if (firstPending) {
    return {
      testCode: 'T03',
      result: 'PENDING',
      calculatedError: null,
      absoluteError: null,
      mpeValue: null,
      mpeRuleId: null,
      method,
      auditDetails,
      remarks: remarks || `${firstPending.label}: ${firstPending.reason}`,
      reason: `${firstPending.label}: ${firstPending.reason}`,
      reasonCode: firstPending.reasonCode,
    };
  }

  return {
    testCode: 'T03',
    result: 'PASS',
    calculatedError: worst?.calculatedError ?? null,
    absoluteError: worst?.absoluteError ?? null,
    mpeValue: worst?.mpeValue ?? null,
    mpeRuleId: worst?.mpeRuleId ?? null,
    method,
    auditDetails,
    remarks:
      remarks ||
      `All ${evaluated.length} load point(s) within MPE (largest error ${formatDecimal(
        worst?.calculatedError
      )} ${unit} at ${worst?.label}).`,
  };
}

// ---------------------------------------------------------------------------
// T04: Repeatability
// ---------------------------------------------------------------------------
export function calculateT04(
  load: number | null,
  readings: number[],
  ruleSetId: string | null,
  instrument: EngineInput,
  mpeRules: MpeRule[],
  controlStage: InspectionType,
  remarks?: string
): TestCalculationResult {
  if (!isNumeric(load)) {
    return pending(
      'T04',
      'REPEATABILITY_SERIES',
      'Test load is missing. Enter the load applied for the repeatability series.',
      'MISSING_TEST_LOAD',
      { load, readings },
      remarks
    );
  }

  const valid = (readings || []).filter((r) => isNumeric(r));
  if (valid.length < 2) {
    return pending(
      'T04',
      'REPEATABILITY_SERIES',
      // NEEDS VERIFICATION: R-76 may require a specific minimum number of
      // weighings (and more than one load) depending on accuracy class.
      'At least 2 repeated readings are required for the repeatability test. Enter the observed indications for each weighing.',
      'INSUFFICIENT_READINGS',
      { load, readings },
      remarks
    );
  }

  const loadD = D(load);
  const rangeProblem = checkLoadRange(loadD, instrument);
  if (rangeProblem) {
    return pending(
      'T04',
      'REPEATABILITY_SERIES',
      rangeProblem,
      'LOAD_OUT_OF_RANGE',
      { load, readings },
      remarks
    );
  }

  const e = instrument.verification_interval_e;
  const mpeEval = getApplicableMPE(
    ruleSetId,
    instrument.accuracy_class,
    controlStage,
    load,
    e,
    mpeRules
  );

  if (mpeEval.status === 'PENDING' || !mpeEval.mpeValueDecimal) {
    return pending(
      'T04',
      'REPEATABILITY_SERIES',
      mpeEval.reason || 'Applicable MPE rule not found.',
      mpeEval.reasonCode || 'NO_APPLICABLE_RULE',
      { load, readings },
      remarks
    );
  }

  const decimals = valid.map((r) => D(r));
  let maxReading = decimals[0];
  let minReading = decimals[0];
  for (const value of decimals) {
    if (value.gt(maxReading)) maxReading = value;
    if (value.lt(minReading)) minReading = value;
  }

  // Exact: 15.004 - 15.002 is 0.002, not 0.0019999999999988916
  const repeatabilityError = maxReading.minus(minReading);
  const mpe = mpeEval.mpeValueDecimal;
  const result: TestResult = withinLimit(repeatabilityError, mpe) ? 'PASS' : 'FAIL';
  const unit = instrument.unit || '';

  const auditDetails: AuditDetails = {
    method: 'REPEATABILITY_SERIES',
    test_code: 'T04',
    load,
    readings: valid,
    reading_count: valid.length,
    max_reading: toNumber(maxReading),
    min_reading: toNumber(minReading),
    load_in_e: toNumber(loadInE(loadD, D(e))),
    calculated_error: toNumber(repeatabilityError),
    absolute_error: toNumber(repeatabilityError),
    mpe_value: toNumber(mpe),
    mpe_in_e: mpeEval.mpeInE,
    mpe_clause: mpeEval.clause,
    control_stage: controlStage,
    inputs: { load, readings: valid, e, control_stage: controlStage },
    outputs: {
      maxReading: toNumber(maxReading),
      minReading: toNumber(minReading),
      repeatabilityError: toNumber(repeatabilityError),
      MPE: toNumber(mpe),
    },
    formula: 'RepeatabilityError = Max(readings) - Min(readings)',
  };

  return {
    testCode: 'T04',
    result,
    calculatedError: toNumber(repeatabilityError),
    absoluteError: toNumber(repeatabilityError),
    mpeValue: toNumber(mpe),
    mpeRuleId: mpeEval.mpeRuleId,
    method: 'REPEATABILITY_SERIES',
    auditDetails,
    remarks:
      remarks ||
      (result === 'PASS'
        ? `Repeatability range ${formatDecimal(repeatabilityError)} ${unit} is within MPE (${formatDecimal(mpe)} ${unit}).`
        : `Repeatability range ${formatDecimal(repeatabilityError)} ${unit} exceeds MPE (${formatDecimal(mpe)} ${unit}).`),
  };
}

// ---------------------------------------------------------------------------
// T05: Eccentric Loading
// ---------------------------------------------------------------------------
export function calculateT05(
  load: number | null,
  positions: Record<string, number>,
  ruleSetId: string | null,
  instrument: EngineInput,
  mpeRules: MpeRule[],
  controlStage: InspectionType,
  remarks?: string
): TestCalculationResult {
  const posEntries = Object.entries(positions || {}).filter(([, v]) => isNumeric(v));

  if (!isNumeric(load)) {
    return pending(
      'T05',
      'ECCENTRIC_POSITIONS',
      'Test load is missing. Enter the load applied at each receptor position.',
      'MISSING_TEST_LOAD',
      { load, positions },
      remarks
    );
  }

  if (posEntries.length === 0) {
    return pending(
      'T05',
      'ECCENTRIC_POSITIONS',
      'No position readings entered. Enter the observed indication for each load receptor position.',
      'MISSING_OBSERVED_VALUE',
      { load, positions },
      remarks
    );
  }

  const loadD = D(load);
  const rangeProblem = checkLoadRange(loadD, instrument);
  if (rangeProblem) {
    return pending(
      'T05',
      'ECCENTRIC_POSITIONS',
      rangeProblem,
      'LOAD_OUT_OF_RANGE',
      { load, positions },
      remarks
    );
  }

  const e = instrument.verification_interval_e;
  const mpeEval = getApplicableMPE(
    ruleSetId,
    instrument.accuracy_class,
    controlStage,
    load,
    e,
    mpeRules
  );

  if (mpeEval.status === 'PENDING' || !mpeEval.mpeValueDecimal) {
    return pending(
      'T05',
      'ECCENTRIC_POSITIONS',
      mpeEval.reason || 'Applicable MPE rule not found.',
      mpeEval.reasonCode || 'NO_APPLICABLE_RULE',
      { load, positions },
      remarks
    );
  }

  const mpe = mpeEval.mpeValueDecimal;

  let maxAbsError = D(0);
  let maxErrorRaw = D(0);
  let allPass = true;
  const positionErrors: Record<string, number> = {};
  const failedPositions: string[] = [];
  let worstPosition = posEntries[0]?.[0] ?? '';

  for (const [posKey, observedVal] of posEntries) {
    const err = D(observedVal).minus(loadD);
    const absErr = err.abs();
    positionErrors[posKey] = toNumber(err) as number;

    if (absErr.gt(maxAbsError)) {
      maxAbsError = absErr;
      maxErrorRaw = err;
      worstPosition = posKey;
    }

    if (!withinLimit(absErr, mpe)) {
      allPass = false;
      failedPositions.push(posKey);
    }
  }

  const result: TestResult = allPass ? 'PASS' : 'FAIL';
  const unit = instrument.unit || '';

  const auditDetails: AuditDetails = {
    method: 'ECCENTRIC_POSITIONS',
    test_code: 'T05',
    load,
    eccentric_positions: Object.fromEntries(posEntries) as Record<string, number>,
    position_errors: positionErrors,
    position_count: posEntries.length,
    failed_positions: failedPositions,
    worst_position: worstPosition,
    load_in_e: toNumber(loadInE(loadD, D(e))),
    calculated_error: toNumber(maxErrorRaw),
    absolute_error: toNumber(maxAbsError),
    max_absolute_error: toNumber(maxAbsError),
    mpe_value: toNumber(mpe),
    mpe_in_e: mpeEval.mpeInE,
    mpe_clause: mpeEval.clause,
    control_stage: controlStage,
    inputs: { load, positions, e, control_stage: controlStage },
    outputs: {
      positionErrors,
      maxAbsError: toNumber(maxAbsError),
      MPE: toNumber(mpe),
    },
    formula: 'Error_pos = Observed_pos - Load; all |Error_pos| <= MPE',
  };

  return {
    testCode: 'T05',
    result,
    calculatedError: toNumber(maxErrorRaw),
    absoluteError: toNumber(maxAbsError),
    mpeValue: toNumber(mpe),
    mpeRuleId: mpeEval.mpeRuleId,
    method: 'ECCENTRIC_POSITIONS',
    auditDetails,
    remarks:
      remarks ||
      (result === 'PASS'
        ? `Largest eccentricity error ${formatDecimal(maxAbsError)} ${unit} (at ${worstPosition}) is within MPE (+/- ${formatDecimal(mpe)} ${unit}).`
        : `Eccentricity error exceeds MPE at: ${failedPositions.join(', ')} (largest ${formatDecimal(maxAbsError)} ${unit}).`),
  };
}

// ---------------------------------------------------------------------------
// T06: Tare Accuracy
// ---------------------------------------------------------------------------
export function calculateT06(
  tareLoad: number | null,
  grossLoad: number | null,
  netObserved: number | null,
  ruleSetId: string | null,
  instrument: EngineInput,
  mpeRules: MpeRule[],
  controlStage: InspectionType,
  remarks?: string
): TestCalculationResult {
  if (instrument.has_tare === false) {
    return {
      testCode: 'T06',
      result: 'NOT_APPLICABLE',
      calculatedError: null,
      absoluteError: null,
      mpeValue: null,
      mpeRuleId: null,
      method: 'TARE_NET_EVALUATION',
      auditDetails: {
        method: 'TARE_NET_EVALUATION',
        test_code: 'T06',
        reason: 'Instrument has no tare device.',
      },
      remarks: remarks || 'Tare accuracy test not applicable for this instrument.',
      reason: 'Instrument is not equipped with a tare device.',
    };
  }

  if (!isNumeric(tareLoad) || !isNumeric(grossLoad) || !isNumeric(netObserved)) {
    const missing: string[] = [];
    if (!isNumeric(tareLoad)) missing.push('tare load');
    if (!isNumeric(grossLoad)) missing.push('gross load');
    if (!isNumeric(netObserved)) missing.push('net indication');
    return pending(
      'T06',
      'TARE_NET_EVALUATION',
      `Missing ${missing.join(', ')}. Enter all three values for the tare test.`,
      missing.includes('net indication') ? 'MISSING_OBSERVED_VALUE' : 'MISSING_TEST_LOAD',
      { tareLoad, grossLoad, netObserved },
      remarks
    );
  }

  const grossD = D(grossLoad);
  const tareD = D(tareLoad);
  const expectedNet = grossD.minus(tareD);

  const rangeProblem = checkLoadRange(grossD, instrument);
  if (rangeProblem) {
    return pending(
      'T06',
      'TARE_NET_EVALUATION',
      rangeProblem,
      'LOAD_OUT_OF_RANGE',
      { tareLoad, grossLoad, netObserved },
      remarks
    );
  }

  const error = D(netObserved).minus(expectedNet);
  const absError = error.abs();

  const e = instrument.verification_interval_e;
  // NEEDS VERIFICATION: the MPE is looked up at the NET value. Whether R-76
  // requires the net or the gross value as the basis for a tared weighing has
  // not been confirmed against the source text.
  const mpeEval = getApplicableMPE(
    ruleSetId,
    instrument.accuracy_class,
    controlStage,
    toNumber(expectedNet),
    e,
    mpeRules
  );

  if (mpeEval.status === 'PENDING' || !mpeEval.mpeValueDecimal) {
    return pending(
      'T06',
      'TARE_NET_EVALUATION',
      mpeEval.reason || 'Applicable MPE rule not found.',
      mpeEval.reasonCode || 'NO_APPLICABLE_RULE',
      { tareLoad, grossLoad, netObserved },
      remarks
    );
  }

  const mpe = mpeEval.mpeValueDecimal;
  const result: TestResult = withinLimit(absError, mpe) ? 'PASS' : 'FAIL';
  const unit = instrument.unit || '';

  const auditDetails: AuditDetails = {
    method: 'TARE_NET_EVALUATION',
    test_code: 'T06',
    tare_load: tareLoad,
    gross_load: grossLoad,
    expected_net: toNumber(expectedNet),
    net_observed: netObserved,
    load: toNumber(expectedNet),
    observed: netObserved,
    load_in_e: toNumber(loadInE(expectedNet, D(e))),
    calculated_error: toNumber(error),
    absolute_error: toNumber(absError),
    mpe_value: toNumber(mpe),
    mpe_in_e: mpeEval.mpeInE,
    mpe_clause: mpeEval.clause,
    control_stage: controlStage,
    mpe_basis: 'NET (NEEDS VERIFICATION against R-76)',
    inputs: { tareLoad, grossLoad, netObserved, e, control_stage: controlStage },
    outputs: {
      expectedNet: toNumber(expectedNet),
      error: toNumber(error),
      absError: toNumber(absError),
      MPE: toNumber(mpe),
    },
    formula: 'ExpectedNet = GrossLoad - TareLoad; Error = NetObserved - ExpectedNet',
  };

  return {
    testCode: 'T06',
    result,
    calculatedError: toNumber(error),
    absoluteError: toNumber(absError),
    mpeValue: toNumber(mpe),
    mpeRuleId: mpeEval.mpeRuleId,
    method: 'TARE_NET_EVALUATION',
    auditDetails,
    remarks:
      remarks ||
      (result === 'PASS'
        ? `Net indication error ${formatDecimal(error)} ${unit} is within MPE (+/- ${formatDecimal(mpe)} ${unit}).`
        : `Net indication error ${formatDecimal(error)} ${unit} exceeds MPE (+/- ${formatDecimal(mpe)} ${unit}).`),
  };
}

// ---------------------------------------------------------------------------
// Overall inspection result
// ---------------------------------------------------------------------------
/**
 * Deterministic overall result. SINGLE SOURCE OF TRUTH - the UI must call this
 * rather than re-implementing it.
 *
 * - any applicable test FAIL      -> FAIL
 * - else any applicable PENDING   -> PENDING
 * - else all applicable PASS      -> PASS
 * - NOT_APPLICABLE never causes a failure
 * - nothing applicable at all     -> PENDING (nothing has been demonstrated)
 */
export function calculateOverallResult(
  results: { testCode: string; applicability?: string; result: TestResult }[]
): 'PASS' | 'FAIL' | 'PENDING' {
  if (!results || results.length === 0) return 'PENDING';

  const activeTests = results.filter(
    (r) => r.applicability !== 'NOT_APPLICABLE' && r.result !== 'NOT_APPLICABLE'
  );

  if (activeTests.length === 0) return 'PENDING';

  if (activeTests.some((r) => r.result === 'FAIL')) return 'FAIL';
  if (activeTests.some((r) => r.result === 'PENDING')) return 'PENDING';
  if (activeTests.every((r) => r.result === 'PASS')) return 'PASS';

  return 'PENDING';
}
