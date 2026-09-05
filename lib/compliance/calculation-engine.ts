import { MpeRule, InspectionType, TestResult } from '@/types/database';
import { EngineInput, TestCalculationResult, AuditDetails } from './types';
import { evaluateMpe } from './mpe-engine';

/**
 * Deterministic Compliance Calculation Engine for OIML R-76 & Indian Legal Metrology Rules
 */

// T01: Visual & Administrative Checklist Calculation
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
    };
  }

  const allPassed = Object.values(checklist).every((val) => val === true);

  return {
    testCode: 'T01',
    result: allPassed ? 'PASS' : 'FAIL',
    calculatedError: null,
    absoluteError: null,
    mpeValue: null,
    mpeRuleId: null,
    method: 'CHECKLIST_EVALUATION',
    auditDetails: {
      method: 'CHECKLIST_EVALUATION',
      test_code: 'T01',
      checklist,
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
  e: number,
  remarks?: string
): TestCalculationResult {
  if (indication === null || indication === undefined) {
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
    };
  }

  let error = 0;
  let calculatedIndication = indication;

  if (method === 'CHANGEOVER' && deltaL !== null && deltaL !== undefined) {
    // P_0 = I_0 + 0.5e - delta_L
    // E_0 = P_0 - L_0 (where L_0 = 0)
    calculatedIndication = Number((indication + 0.5 * e - deltaL).toFixed(6));
    error = calculatedIndication;
  } else {
    error = Number((indication - (zeroLoad || 0)).toFixed(6));
  }

  const absError = Math.abs(error);
  const allowedZeroMpe = Number((0.25 * e).toFixed(6)); // Clause 4.5.2: Zero setting MPE is +/- 0.25e
  const pass = absError <= allowedZeroMpe;

  const auditDetails: AuditDetails = {
    method,
    test_code: 'T02',
    load: zeroLoad || 0,
    observed: indication,
    delta_l: deltaL,
    verification_interval_e: e,
    calculated_indication: calculatedIndication,
    calculated_error: error,
    absolute_error: absError,
    mpe_value: allowedZeroMpe,
    mpe_clause: 'Clause 4.5.2 (Zero-setting error <= +/- 0.25e)',
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
    remarks: remarks || (pass ? `Zero error (${error} ${e}e) within +/- 0.25e limit.` : `Zero error exceeds +/- 0.25e limit.`),
  };
}

// T03: Errors of Indication Calculation (Clause 3.5.1; A.4.4-A.4.6)
export function calculateT03(
  method: 'DIRECT' | 'CHANGEOVER_POINT',
  load: number | null,
  observed: number | null,
  deltaL: number | null,
  instrument: EngineInput,
  mpeRules: MpeRule[],
  controlStage: InspectionType,
  remarks?: string
): TestCalculationResult {
  if (load === null || load === undefined || observed === null || observed === undefined) {
    return {
      testCode: 'T03',
      result: 'PENDING',
      calculatedError: null,
      absoluteError: null,
      mpeValue: null,
      mpeRuleId: null,
      method,
      auditDetails: { method, test_code: 'T03', load, observed },
      remarks: remarks || 'Load and observed indication required.',
    };
  }

  const e = instrument.verification_interval_e;
  let calculatedIndication = observed;
  let error = 0;

  if (method === 'CHANGEOVER_POINT' && deltaL !== null && deltaL !== undefined) {
    // OIML A.4.4.3 Changeover point method:
    // P = I + 0.5e - delta_L
    // E = P - L
    calculatedIndication = Number((observed + 0.5 * e - deltaL).toFixed(6));
    error = Number((calculatedIndication - load).toFixed(6));
  } else {
    error = Number((observed - load).toFixed(6));
  }

  const absError = Math.abs(error);

  // DB MPE Lookup
  const mpeEval = evaluateMpe(mpeRules, instrument.accuracy_class, controlStage, load, e);

  let result: TestResult = 'PENDING';
  if (mpeEval.mpeValue !== null) {
    result = absError <= mpeEval.mpeValue ? 'PASS' : 'FAIL';
  }

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
  };

  return {
    testCode: 'T03',
    result,
    calculatedError: error,
    absoluteError: absError,
    mpeValue: mpeEval.mpeValue,
    mpeRuleId: mpeEval.mpeRule?.id || null,
    method,
    auditDetails,
    remarks:
      remarks ||
      (result === 'PASS'
        ? `Indication error (${error} ${instrument.unit}) within MPE (+/- ${mpeEval.mpeValue} ${instrument.unit}).`
        : `Indication error (${error} ${instrument.unit}) exceeds MPE (+/- ${mpeEval.mpeValue} ${instrument.unit}).`),
  };
}

// T04: Repeatability Calculation (Clause 3.6.1; A.4.10)
export function calculateT04(
  load: number | null,
  readings: number[],
  instrument: EngineInput,
  mpeRules: MpeRule[],
  controlStage: InspectionType,
  remarks?: string
): TestCalculationResult {
  if (!readings || readings.length < 2 || load === null || load === undefined) {
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
    };
  }

  const maxReading = Math.max(...readings);
  const minReading = Math.min(...readings);
  const repeatabilityError = Number((maxReading - minReading).toFixed(6));

  const e = instrument.verification_interval_e;
  const mpeEval = evaluateMpe(mpeRules, instrument.accuracy_class, controlStage, load, e);

  let result: TestResult = 'PENDING';
  if (mpeEval.mpeValue !== null) {
    result = repeatabilityError <= mpeEval.mpeValue ? 'PASS' : 'FAIL';
  }

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
  };

  return {
    testCode: 'T04',
    result,
    calculatedError: repeatabilityError,
    absoluteError: repeatabilityError,
    mpeValue: mpeEval.mpeValue,
    mpeRuleId: mpeEval.mpeRule?.id || null,
    method: 'REPEATABILITY_SERIES',
    auditDetails,
    remarks:
      remarks ||
      (result === 'PASS'
        ? `Repeatability error (${repeatabilityError} ${instrument.unit}) within MPE (+/- ${mpeEval.mpeValue} ${instrument.unit}).`
        : `Repeatability error (${repeatabilityError} ${instrument.unit}) exceeds MPE limit.`),
  };
}

// T05: Eccentric Loading Calculation (Clause 3.6.2; A.4.7)
export function calculateT05(
  load: number | null,
  positions: Record<string, number>,
  instrument: EngineInput,
  mpeRules: MpeRule[],
  controlStage: InspectionType,
  remarks?: string
): TestCalculationResult {
  const posEntries = Object.entries(positions);
  if (posEntries.length === 0 || load === null || load === undefined) {
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
    };
  }

  const e = instrument.verification_interval_e;
  const mpeEval = evaluateMpe(mpeRules, instrument.accuracy_class, controlStage, load, e);

  let maxAbsError = 0;
  let maxErrorRaw = 0;
  let allPass = true;

  const positionErrors: Record<string, number> = {};

  for (const [posKey, observedVal] of posEntries) {
    const err = Number((observedVal - load).toFixed(6));
    const absErr = Math.abs(err);
    positionErrors[posKey] = err;

    if (absErr > maxAbsError) {
      maxAbsError = absErr;
      maxErrorRaw = err;
    }

    if (mpeEval.mpeValue !== null && absErr > mpeEval.mpeValue) {
      allPass = false;
    }
  }

  let result: TestResult = 'PENDING';
  if (mpeEval.mpeValue !== null) {
    result = allPass ? 'PASS' : 'FAIL';
  }

  const auditDetails: AuditDetails = {
    method: 'ECCENTRIC_POSITIONS',
    test_code: 'T05',
    load,
    eccentric_positions: positions,
    position_errors: positionErrors,
    max_absolute_error: maxAbsError,
    mpe_value: mpeEval.mpeValue,
    mpe_clause: mpeEval.clause,
  };

  return {
    testCode: 'T05',
    result,
    calculatedError: maxErrorRaw,
    absoluteError: maxAbsError,
    mpeValue: mpeEval.mpeValue,
    mpeRuleId: mpeEval.mpeRule?.id || null,
    method: 'ECCENTRIC_POSITIONS',
    auditDetails,
    remarks:
      remarks ||
      (result === 'PASS'
        ? `Maximum eccentricity error (${maxAbsError} ${instrument.unit}) within MPE (+/- ${mpeEval.mpeValue} ${instrument.unit}).`
        : `Eccentricity error (${maxAbsError} ${instrument.unit}) exceeds MPE limit.`),
  };
}

// T06: Tare Accuracy Calculation (Clause 4.6.3; A.4.6.2)
export function calculateT06(
  tareLoad: number | null,
  grossLoad: number | null,
  netObserved: number | null,
  instrument: EngineInput,
  mpeRules: MpeRule[],
  controlStage: InspectionType,
  remarks?: string
): TestCalculationResult {
  if (tareLoad === null || grossLoad === null || netObserved === null) {
    return {
      testCode: 'T06',
      result: 'PENDING',
      calculatedError: null,
      absoluteError: null,
      mpeValue: null,
      mpeRuleId: null,
      method: 'TARE_NET_EVALUATION',
      auditDetails: { method: 'TARE_NET_EVALUATION', test_code: 'T06', tareLoad, grossLoad, netObserved },
      remarks: remarks || 'Tare load and net indication required.',
    };
  }

  const expectedNet = Number((grossLoad - tareLoad).toFixed(6));
  const error = Number((netObserved - expectedNet).toFixed(6));
  const absError = Math.abs(error);

  const e = instrument.verification_interval_e;
  const mpeEval = evaluateMpe(mpeRules, instrument.accuracy_class, controlStage, expectedNet, e);

  let result: TestResult = 'PENDING';
  if (mpeEval.mpeValue !== null) {
    result = absError <= mpeEval.mpeValue ? 'PASS' : 'FAIL';
  }

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
  };

  return {
    testCode: 'T06',
    result,
    calculatedError: error,
    absoluteError: absError,
    mpeValue: mpeEval.mpeValue,
    mpeRuleId: mpeEval.mpeRule?.id || null,
    method: 'TARE_NET_EVALUATION',
    auditDetails,
    remarks:
      remarks ||
      (result === 'PASS'
        ? `Tare net indication error (${error} ${instrument.unit}) within MPE (+/- ${mpeEval.mpeValue} ${instrument.unit}).`
        : `Tare net indication error (${error} ${instrument.unit}) exceeds MPE.`),
  };
}

