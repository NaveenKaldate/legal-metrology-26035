import { MpeRule, InspectionType, TestResult } from '@/types/database';
import { EngineInput, TestCalculationResult, AuditDetails } from './types';
import { getApplicableMPE } from './mpe-engine';

/**
 * Phase 4 Core OIML R-76 & Indian Legal Metrology Compliance Engine
 * Rule-driven, deterministic, unrounded calculations for T01 - T06.
 */

// T01: Visual & Administrative Examination (Clause 8.3.2)
export function calculateT01(
  checklist: Record<string, boolean>,
  remarks?: string
): TestCalculationResult {
  const keys = Object.keys(checklist);
  if (keys.length === 0) {
    return {
      testCode: 'T01',
      result: 'PENDING',
      calculatedError: null,
      absoluteError: null,
      mpeValue: null,
      mpeRuleId: null,
      method: 'CHECKLIST_EVALUATION',
      auditDetails: { method: 'CHECKLIST_EVALUATION', test_code: 'T01', checklist },
      remarks: remarks || 'Visual checklist pending completion.',
      reason: 'Visual & Administrative checklist has not been completed.',
    };
  }

  const allPassed = Object.values(checklist).every((val) => val === true);
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
      inputs: { checklist },
      outputs: { all_passed: allPassed },
      formula: 'All mandatory administrative items == TRUE',
      reason: allPassed
        ? 'All mandatory inscriptions, markings, and approval details verified.'
        : 'One or more administrative/visual inspection items failed.',
    },
    remarks: remarks || (allPassed ? 'Visual & Administrative examination passed.' : 'Defects found during visual examination.'),
  };
}

// T02: Zero-setting Accuracy Calculation (Clause 4.5.2; A.4.2.3)
export function calculateT02(
  method: 'DIRECT' | 'CHANGEOVER',
  zeroLoad: number | null,
  indication: number | null,
  deltaL: number | null,
  e: number | null | undefined,
  zeroConfig: 'NON_AUTOMATIC' | 'SEMI_AUTOMATIC' | 'AUTOMATIC' | 'ZERO_TRACKING' = 'NON_AUTOMATIC',
  remarks?: string
): TestCalculationResult {
  if (e === null || e === undefined || e <= 0 || isNaN(e)) {
    return {
      testCode: 'T02',
      result: 'PENDING',
      calculatedError: null,
      absoluteError: null,
      mpeValue: null,
      mpeRuleId: null,
      method,
      auditDetails: { method, test_code: 'T02', indication, delta_l: deltaL, zero_config: zeroConfig },
      remarks: remarks || 'Verification interval e is missing or invalid.',
      reason: 'Verification interval e is missing or invalid.',
    };
  }

  // Check if zero configuration is supported by database procedure
  if (zeroConfig === 'AUTOMATIC' || zeroConfig === 'ZERO_TRACKING') {
    return {
      testCode: 'T02',
      result: 'PENDING',
      calculatedError: null,
      absoluteError: null,
      mpeValue: null,
      mpeRuleId: null,
      method: `${zeroConfig}_PROCEDURE`,
      auditDetails: { method: zeroConfig, test_code: 'T02', zero_config: zeroConfig },
      remarks: remarks || 'Procedure pending database rule configuration.',
      reason: 'Applicable zero-setting procedure is not configured for this instrument/rule combination.',
    };
  }

  if (indication === null || indication === undefined || isNaN(indication)) {
    return {
      testCode: 'T02',
      result: 'PENDING',
      calculatedError: null,
      absoluteError: null,
      mpeValue: 0.25 * e,
      mpeRuleId: null,
      method,
      auditDetails: { method, test_code: 'T02', indication, delta_l: deltaL, verification_interval_e: e },
      remarks: remarks || 'Zero indication required.',
      reason: 'Zero indication observation is missing.',
    };
  }

  let error = 0;
  let calculatedIndication = indication;

  if (method === 'CHANGEOVER' && deltaL !== null && deltaL !== undefined && !isNaN(deltaL)) {
    // P_0 = I_0 + 0.5e - delta_L
    // E_0 = P_0 - L_0 (where L_0 = 0)
    calculatedIndication = indication + 0.5 * e - deltaL;
    error = calculatedIndication;
  } else {
    error = indication - (zeroLoad || 0);
  }

  const absError = Math.abs(error);
  const allowedZeroMpe = 0.25 * e; // Clause 4.5.2: Zero setting MPE is +/- 0.25e
  const pass = absError <= allowedZeroMpe;

  const auditDetails: AuditDetails = {
    method,
    test_code: 'T02',
    load: zeroLoad || 0,
    observed: indication,
    delta_l: deltaL,
    verification_interval_e: e,
    zero_config: zeroConfig,
    calculated_indication: calculatedIndication,
    calculated_error: error,
    absolute_error: absError,
    mpe_value: allowedZeroMpe,
    mpe_clause: 'Clause 4.5.2 (Zero-setting error <= +/- 0.25e)',
    inputs: { method, zero_load: zeroLoad || 0, indication, delta_l: deltaL, e, zero_config: zeroConfig },
    outputs: { P_0: calculatedIndication, E_0: error, absError, allowedZeroMpe },
    formula: method === 'CHANGEOVER' ? 'P_0 = I_0 + 0.5e - delta_L; E_0 = P_0 - L_0' : 'E_0 = I_0 - L_0',
  };

  return {
    testCode: 'T02',
    result: pass ? 'PASS' : 'FAIL',
    calculatedError: error,
    absoluteError: absError,
    mpeValue: allowedZeroMpe,
    mpeRuleId: null,
    method,
    auditDetails,
    remarks: remarks || (pass ? `Zero error (${error} e) within +/- 0.25e limit.` : `Zero error exceeds +/- 0.25e limit.`),
  };
}

// T03: Errors of Indication Calculation (Clause 3.5.1; A.4.4-A.4.6)
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
  if (load === null || load === undefined || isNaN(load) || observed === null || observed === undefined || isNaN(observed)) {
    return {
      testCode: 'T03',
      result: 'PENDING',
      calculatedError: null,
      absoluteError: null,
      mpeValue: null,
      mpeRuleId: null,
      method,
      auditDetails: { method, test_code: 'T03', load, observed },
      remarks: remarks || 'Test load and observed indication required.',
      reason: 'Required test load or observed indication is missing.',
    };
  }

  const e = instrument.verification_interval_e;

  // DB MPE Lookup via getApplicableMPE
  const mpeEval = getApplicableMPE(
    ruleSetId,
    instrument.accuracy_class,
    controlStage,
    load,
    e,
    mpeRules
  );

  if (mpeEval.status === 'PENDING' || mpeEval.mpeValue === null) {
    return {
      testCode: 'T03',
      result: 'PENDING',
      calculatedError: null,
      absoluteError: null,
      mpeValue: null,
      mpeRuleId: null,
      method,
      auditDetails: { method, test_code: 'T03', load, observed, reason: mpeEval.reason },
      remarks: remarks || (mpeEval.reason || 'Applicable MPE rule not found.'),
      reason: mpeEval.reason || 'Applicable MPE rule not found.',
    };
  }

  let calculatedIndication = observed;
  let error = 0;

  if (method === 'CHANGEOVER_POINT' && deltaL !== null && deltaL !== undefined && !isNaN(deltaL)) {
    // OIML A.4.4.3 Changeover point method:
    // P = I + 0.5e - delta_L
    // E = P - L
    calculatedIndication = observed + 0.5 * e - deltaL;
    error = calculatedIndication - load;
  } else {
    error = observed - load;
  }

  const absError = Math.abs(error);
  // Compare unrounded absolute error against DB MPE value
  const pass = absError <= mpeEval.mpeValue;
  const result: TestResult = pass ? 'PASS' : 'FAIL';

  const auditDetails: AuditDetails = {
    method,
    test_code: 'T03',
    load,
    observed,
    delta_l: deltaL,
    verification_interval_e: e,
    load_in_e: Math.abs(load) / e,
    calculated_indication: calculatedIndication,
    calculated_error: error,
    absolute_error: absError,
    mpe_value: mpeEval.mpeValue,
    mpe_in_e: mpeEval.mpeInE,
    mpe_clause: mpeEval.clause,
    inputs: { method, load, observed, delta_l: deltaL, e, control_stage: controlStage },
    outputs: { P: calculatedIndication, E: error, absoluteError: absError, MPE: mpeEval.mpeValue },
    formula: method === 'CHANGEOVER_POINT' ? 'P = I + 0.5e - delta_L; E = P - L' : 'E = Observed - Reference',
  };

  return {
    testCode: 'T03',
    result,
    calculatedError: error,
    absoluteError: absError,
    mpeValue: mpeEval.mpeValue,
    mpeRuleId: mpeEval.mpeRuleId,
    method,
    auditDetails,
    remarks:
      remarks ||
      (result === 'PASS'
        ? `Indication error (${error.toFixed(4)} ${instrument.unit}) within MPE (+/- ${mpeEval.mpeValue.toFixed(4)} ${instrument.unit}).`
        : `Indication error (${error.toFixed(4)} ${instrument.unit}) exceeds MPE (+/- ${mpeEval.mpeValue.toFixed(4)} ${instrument.unit}).`),
  };
}

// T04: Repeatability Calculation (Clause 3.6.1; A.4.10)
export function calculateT04(
  load: number | null,
  readings: number[],
  ruleSetId: string | null,
  instrument: EngineInput,
  mpeRules: MpeRule[],
  controlStage: InspectionType,
  remarks?: string
): TestCalculationResult {
  if (!readings || readings.length < 2 || load === null || load === undefined || isNaN(load)) {
    return {
      testCode: 'T04',
      result: 'PENDING',
      calculatedError: null,
      absoluteError: null,
      mpeValue: null,
      mpeRuleId: null,
      method: 'REPEATABILITY_SERIES',
      auditDetails: { method: 'REPEATABILITY_SERIES', test_code: 'T04', load, readings },
      remarks: remarks || 'At least 2 repeated readings required.',
      reason: 'At least 2 repeated observation readings are required.',
    };
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

  if (mpeEval.status === 'PENDING' || mpeEval.mpeValue === null) {
    return {
      testCode: 'T04',
      result: 'PENDING',
      calculatedError: null,
      absoluteError: null,
      mpeValue: null,
      mpeRuleId: null,
      method: 'REPEATABILITY_SERIES',
      auditDetails: { method: 'REPEATABILITY_SERIES', test_code: 'T04', load, readings, reason: mpeEval.reason },
      remarks: remarks || (mpeEval.reason || 'Applicable MPE rule not found.'),
      reason: mpeEval.reason || 'Applicable MPE rule not found.',
    };
  }

  const maxReading = Math.max(...readings);
  const minReading = Math.min(...readings);
  const repeatabilityError = maxReading - minReading;

  const pass = repeatabilityError <= mpeEval.mpeValue;
  const result: TestResult = pass ? 'PASS' : 'FAIL';

  const auditDetails: AuditDetails = {
    method: 'REPEATABILITY_SERIES',
    test_code: 'T04',
    load,
    readings,
    max_reading: maxReading,
    min_reading: minReading,
    calculated_error: repeatabilityError,
    absolute_error: repeatabilityError,
    mpe_value: mpeEval.mpeValue,
    mpe_clause: mpeEval.clause,
    inputs: { load, readings, e, control_stage: controlStage },
    outputs: { maxReading, minReading, repeatabilityError, MPE: mpeEval.mpeValue },
    formula: 'RepeatabilityError = Max(readings) - Min(readings)',
  };

  return {
    testCode: 'T04',
    result,
    calculatedError: repeatabilityError,
    absoluteError: repeatabilityError,
    mpeValue: mpeEval.mpeValue,
    mpeRuleId: mpeEval.mpeRuleId,
    method: 'REPEATABILITY_SERIES',
    auditDetails,
    remarks:
      remarks ||
      (result === 'PASS'
        ? `Repeatability error (${repeatabilityError.toFixed(4)} ${instrument.unit}) within MPE (+/- ${mpeEval.mpeValue.toFixed(4)} ${instrument.unit}).`
        : `Repeatability error (${repeatabilityError.toFixed(4)} ${instrument.unit}) exceeds MPE limit.`),
  };
}

// T05: Eccentric Loading Calculation (Clause 3.6.2; A.4.7)
export function calculateT05(
  load: number | null,
  positions: Record<string, number>,
  ruleSetId: string | null,
  instrument: EngineInput,
  mpeRules: MpeRule[],
  controlStage: InspectionType,
  remarks?: string
): TestCalculationResult {
  const posEntries = Object.entries(positions);
  if (posEntries.length === 0 || load === null || load === undefined || isNaN(load)) {
    return {
      testCode: 'T05',
      result: 'PENDING',
      calculatedError: null,
      absoluteError: null,
      mpeValue: null,
      mpeRuleId: null,
      method: 'ECCENTRIC_POSITIONS',
      auditDetails: { method: 'ECCENTRIC_POSITIONS', test_code: 'T05', load, positions },
      remarks: remarks || 'Receptor position observations required.',
      reason: 'Receptor position observations are missing.',
    };
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

  if (mpeEval.status === 'PENDING' || mpeEval.mpeValue === null) {
    return {
      testCode: 'T05',
      result: 'PENDING',
      calculatedError: null,
      absoluteError: null,
      mpeValue: null,
      mpeRuleId: null,
      method: 'ECCENTRIC_POSITIONS',
      auditDetails: { method: 'ECCENTRIC_POSITIONS', test_code: 'T05', load, positions, reason: mpeEval.reason },
      remarks: remarks || (mpeEval.reason || 'Applicable MPE rule not found.'),
      reason: mpeEval.reason || 'Applicable MPE rule not found.',
    };
  }

  let maxAbsError = 0;
  let maxErrorRaw = 0;
  let allPass = true;

  const positionErrors: Record<string, number> = {};

  for (const [posKey, observedVal] of posEntries) {
    const err = observedVal - load;
    const absErr = Math.abs(err);
    positionErrors[posKey] = err;

    if (absErr > maxAbsError) {
      maxAbsError = absErr;
      maxErrorRaw = err;
    }

    if (absErr > mpeEval.mpeValue) {
      allPass = false;
    }
  }

  const result: TestResult = allPass ? 'PASS' : 'FAIL';

  const auditDetails: AuditDetails = {
    method: 'ECCENTRIC_POSITIONS',
    test_code: 'T05',
    load,
    eccentric_positions: positions,
    position_errors: positionErrors,
    max_absolute_error: maxAbsError,
    mpe_value: mpeEval.mpeValue,
    mpe_clause: mpeEval.clause,
    inputs: { load, positions, e, control_stage: controlStage },
    outputs: { positionErrors, maxAbsError, MPE: mpeEval.mpeValue },
    formula: 'Error_pos = Observed_pos - Load; All |Error_pos| <= MPE',
  };

  return {
    testCode: 'T05',
    result,
    calculatedError: maxErrorRaw,
    absoluteError: maxAbsError,
    mpeValue: mpeEval.mpeValue,
    mpeRuleId: mpeEval.mpeRuleId,
    method: 'ECCENTRIC_POSITIONS',
    auditDetails,
    remarks:
      remarks ||
      (result === 'PASS'
        ? `Maximum eccentricity error (${maxAbsError.toFixed(4)} ${instrument.unit}) within MPE (+/- ${mpeEval.mpeValue.toFixed(4)} ${instrument.unit}).`
        : `Eccentricity error (${maxAbsError.toFixed(4)} ${instrument.unit}) exceeds MPE limit.`),
  };
}

// T06: Tare Accuracy Calculation (Clause 4.6.3; A.4.6.2)
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
      auditDetails: { method: 'TARE_NET_EVALUATION', test_code: 'T06', reason: 'Instrument has no tare device.' },
      remarks: remarks || 'Tare accuracy test not applicable for this instrument.',
      reason: 'Instrument is not equipped with a tare device.',
    };
  }

  if (
    tareLoad === null ||
    tareLoad === undefined ||
    isNaN(tareLoad) ||
    grossLoad === null ||
    grossLoad === undefined ||
    isNaN(grossLoad) ||
    netObserved === null ||
    netObserved === undefined ||
    isNaN(netObserved)
  ) {
    return {
      testCode: 'T06',
      result: 'PENDING',
      calculatedError: null,
      absoluteError: null,
      mpeValue: null,
      mpeRuleId: null,
      method: 'TARE_NET_EVALUATION',
      auditDetails: { method: 'TARE_NET_EVALUATION', test_code: 'T06', tareLoad, grossLoad, netObserved },
      remarks: remarks || 'Tare load, gross load, and net observed indication required.',
      reason: 'Tare load, gross load, or net indication is missing.',
    };
  }

  const expectedNet = grossLoad - tareLoad;
  const error = netObserved - expectedNet;
  const absError = Math.abs(error);

  const e = instrument.verification_interval_e;
  const mpeEval = getApplicableMPE(
    ruleSetId,
    instrument.accuracy_class,
    controlStage,
    expectedNet,
    e,
    mpeRules
  );

  if (mpeEval.status === 'PENDING' || mpeEval.mpeValue === null) {
    return {
      testCode: 'T06',
      result: 'PENDING',
      calculatedError: null,
      absoluteError: null,
      mpeValue: null,
      mpeRuleId: null,
      method: 'TARE_NET_EVALUATION',
      auditDetails: { method: 'TARE_NET_EVALUATION', test_code: 'T06', tareLoad, grossLoad, netObserved, reason: mpeEval.reason },
      remarks: remarks || (mpeEval.reason || 'Applicable MPE rule not found.'),
      reason: mpeEval.reason || 'Applicable MPE rule not found.',
    };
  }

  const pass = absError <= mpeEval.mpeValue;
  const result: TestResult = pass ? 'PASS' : 'FAIL';

  const auditDetails: AuditDetails = {
    method: 'TARE_NET_EVALUATION',
    test_code: 'T06',
    tare_load: tareLoad,
    gross_load: grossLoad,
    expected_net: expectedNet,
    net_observed: netObserved,
    calculated_error: error,
    absolute_error: absError,
    mpe_value: mpeEval.mpeValue,
    mpe_clause: mpeEval.clause,
    inputs: { tareLoad, grossLoad, netObserved, e, control_stage: controlStage },
    outputs: { expectedNet, error, absError, MPE: mpeEval.mpeValue },
    formula: 'ExpectedNet = GrossLoad - TareLoad; Error = NetObserved - ExpectedNet',
  };

  return {
    testCode: 'T06',
    result,
    calculatedError: error,
    absoluteError: absError,
    mpeValue: mpeEval.mpeValue,
    mpeRuleId: mpeEval.mpeRuleId,
    method: 'TARE_NET_EVALUATION',
    auditDetails,
    remarks:
      remarks ||
      (result === 'PASS'
        ? `Tare net indication error (${error.toFixed(4)} ${instrument.unit}) within MPE (+/- ${mpeEval.mpeValue.toFixed(4)} ${instrument.unit}).`
        : `Tare net indication error (${error.toFixed(4)} ${instrument.unit}) exceeds MPE.`),
  };
}

/**
 * Deterministic Overall Inspection Result Calculation
 * Rules:
 * - If any REQUIRED test = FAIL -> overall FAIL
 * - Else if any REQUIRED test = PENDING -> overall PENDING
 * - Else if all REQUIRED tests = PASS -> overall PASS
 * - NOT_APPLICABLE tests do not cause failure.
 */
export function calculateOverallResult(
  results: { testCode: string; applicability?: string; result: TestResult }[]
): 'PASS' | 'FAIL' | 'PENDING' {
  if (!results || results.length === 0) return 'PENDING';

  // Filter required/applicable tests
  const activeTests = results.filter(
    (r) => r.applicability !== 'NOT_APPLICABLE' && r.result !== 'NOT_APPLICABLE'
  );

  if (activeTests.length === 0) return 'PENDING';

  const hasFail = activeTests.some((r) => r.result === 'FAIL');
  if (hasFail) return 'FAIL';

  const hasPending = activeTests.some((r) => r.result === 'PENDING');
  if (hasPending) return 'PENDING';

  const allPass = activeTests.every((r) => r.result === 'PASS');
  if (allPass) return 'PASS';

  return 'PENDING';
}
