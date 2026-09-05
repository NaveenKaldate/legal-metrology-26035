import { Instrument, InspectionType, TestResult } from '@/types/database';
import { EngineInput, ComplianceResult } from './types';
import { LoadedRuleSet } from './rule-engine';
import { generateInspectionPlan } from './test-plan-engine';
import {
  calculateT01,
  calculateT02,
  calculateT03,
  calculateT04,
  calculateT05,
  calculateT06,
  calculateOverallResult,
} from './calculation-engine';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SupabaseClient = any;

/**
 * Maps a database Instrument record and optional UI overrides into an EngineInput profile.
 */
export function mapInstrumentToEngineInput(
  instrument: Instrument,
  overrides?: Partial<EngineInput>
): EngineInput {
  return {
    instrument_type: instrument.instrument_type,
    accuracy_class: instrument.accuracy_class || 'Class III',
    max_capacity: instrument.max_capacity || 15,
    min_capacity: instrument.min_capacity || 0.1,
    verification_interval_e: instrument.verification_interval_e || 1,
    actual_interval_d: instrument.actual_interval_d || 1,
    unit: instrument.unit || 'kg',
    is_electronic: instrument.instrument_type === 'ELECTRONIC_WEIGHING',
    has_tare: overrides?.has_tare ?? true,
    zero_configuration: overrides?.zero_configuration || 'NON_AUTOMATIC',
    ...overrides,
  };
}

export interface InspectionExecutionInput {
  loadedRuleSet: LoadedRuleSet;
  controlStage: InspectionType;
  instrument: EngineInput;
  t01?: { checklist: Record<string, boolean>; remarks?: string };
  t02?: {
    method: 'DIRECT' | 'CHANGEOVER';
    zeroLoad: number | null;
    indication: number | null;
    deltaL: number | null;
    zeroConfig?: 'NON_AUTOMATIC' | 'SEMI_AUTOMATIC' | 'AUTOMATIC' | 'ZERO_TRACKING';
    remarks?: string;
  };
  t03?: {
    method: 'DIRECT' | 'CHANGEOVER_POINT';
    load: number | null;
    observed: number | null;
    deltaL: number | null;
    remarks?: string;
  };
  t04?: {
    load: number | null;
    readings: number[];
    remarks?: string;
  };
  t05?: {
    load: number | null;
    positions: Record<string, number>;
    remarks?: string;
  };
  t06?: {
    tareLoad: number | null;
    grossLoad: number | null;
    netObserved: number | null;
    remarks?: string;
  };
}

export interface InspectionExecutionResult {
  inspectionPlan: ReturnType<typeof generateInspectionPlan>;
  results: Record<string, ComplianceResult>;
  overallResult: 'PASS' | 'FAIL' | 'PENDING';
}

/**
 * Orchestrates test plan generation, individual test calculation, and overall result determination.
 */
export function evaluateInspectionCompliance(
  input: InspectionExecutionInput
): InspectionExecutionResult {
  const { loadedRuleSet, controlStage, instrument } = input;
  const plan = generateInspectionPlan(loadedRuleSet, controlStage, instrument);

  const results: Record<string, ComplianceResult> = {};

  for (const item of plan.testItems) {
    const testDef = item.testDefinition;
    const testCode = testDef.test_code;
    const ruleSetId = loadedRuleSet.ruleSet.id;
    const ruleVersion = loadedRuleSet.ruleSet.version;

    if (!item.isExecutable || item.applicability === 'NOT_APPLICABLE') {
      results[testCode] = {
        testCode,
        testDefinitionId: testDef.id,
        applicability: item.applicability,
        status: 'NOT_APPLICABLE',
        calculatedError: null,
        absoluteError: null,
        mpe: null,
        mpeRuleId: null,
        reason: item.reason,
        ruleSetId,
        ruleVersion,
        auditDetails: {
          method: 'APPLICABILITY_CHECK',
          test_code: testCode,
          reason: item.reason,
        },
        remarks: `Test ${testCode} not applicable: ${item.reason}`,
      };
      continue;
    }

    if (testCode === 'T01') {
      const data = input.t01 || { checklist: {} };
      const calc = calculateT01(data.checklist, data.remarks);
      results[testCode] = {
        testCode,
        testDefinitionId: testDef.id,
        applicability: item.applicability,
        status: calc.result,
        calculatedError: calc.calculatedError,
        absoluteError: calc.absoluteError,
        mpe: calc.mpeValue,
        mpeRuleId: calc.mpeRuleId,
        reason: calc.reason,
        ruleSetId,
        ruleVersion,
        auditDetails: calc.auditDetails,
        remarks: calc.remarks,
      };
    } else if (testCode === 'T02') {
      const data = input.t02 || {
        method: 'CHANGEOVER',
        zeroLoad: 0,
        indication: 0,
        deltaL: 0,
        zeroConfig: instrument.zero_configuration || 'NON_AUTOMATIC',
      };
      const calc = calculateT02(
        data.method,
        data.zeroLoad,
        data.indication,
        data.deltaL,
        instrument.verification_interval_e,
        data.zeroConfig || instrument.zero_configuration || 'NON_AUTOMATIC',
        data.remarks
      );
      results[testCode] = {
        testCode,
        testDefinitionId: testDef.id,
        applicability: item.applicability,
        status: calc.result,
        calculatedError: calc.calculatedError,
        absoluteError: calc.absoluteError,
        mpe: calc.mpeValue,
        mpeRuleId: calc.mpeRuleId,
        reason: calc.reason,
        ruleSetId,
        ruleVersion,
        auditDetails: calc.auditDetails,
        remarks: calc.remarks,
      };
    } else if (testCode === 'T03') {
      const data = input.t03 || {
        method: 'CHANGEOVER_POINT',
        load: null,
        observed: null,
        deltaL: null,
      };
      const calc = calculateT03(
        data.method,
        data.load,
        data.observed,
        data.deltaL,
        ruleSetId,
        instrument,
        loadedRuleSet.mpeRules,
        controlStage,
        data.remarks
      );
      results[testCode] = {
        testCode,
        testDefinitionId: testDef.id,
        applicability: item.applicability,
        status: calc.result,
        calculatedError: calc.calculatedError,
        absoluteError: calc.absoluteError,
        mpe: calc.mpeValue,
        mpeRuleId: calc.mpeRuleId,
        reason: calc.reason,
        ruleSetId,
        ruleVersion,
        auditDetails: calc.auditDetails,
        remarks: calc.remarks,
      };
    } else if (testCode === 'T04') {
      const data = input.t04 || { load: null, readings: [] };
      const calc = calculateT04(
        data.load,
        data.readings,
        ruleSetId,
        instrument,
        loadedRuleSet.mpeRules,
        controlStage,
        data.remarks
      );
      results[testCode] = {
        testCode,
        testDefinitionId: testDef.id,
        applicability: item.applicability,
        status: calc.result,
        calculatedError: calc.calculatedError,
        absoluteError: calc.absoluteError,
        mpe: calc.mpeValue,
        mpeRuleId: calc.mpeRuleId,
        reason: calc.reason,
        ruleSetId,
        ruleVersion,
        auditDetails: calc.auditDetails,
        remarks: calc.remarks,
      };
    } else if (testCode === 'T05') {
      const data = input.t05 || { load: null, positions: {} };
      const calc = calculateT05(
        data.load,
        data.positions,
        ruleSetId,
        instrument,
        loadedRuleSet.mpeRules,
        controlStage,
        data.remarks
      );
      results[testCode] = {
        testCode,
        testDefinitionId: testDef.id,
        applicability: item.applicability,
        status: calc.result,
        calculatedError: calc.calculatedError,
        absoluteError: calc.absoluteError,
        mpe: calc.mpeValue,
        mpeRuleId: calc.mpeRuleId,
        reason: calc.reason,
        ruleSetId,
        ruleVersion,
        auditDetails: calc.auditDetails,
        remarks: calc.remarks,
      };
    } else if (testCode === 'T06') {
      const data = input.t06 || { tareLoad: null, grossLoad: null, netObserved: null };
      const calc = calculateT06(
        data.tareLoad,
        data.grossLoad,
        data.netObserved,
        ruleSetId,
        instrument,
        loadedRuleSet.mpeRules,
        controlStage,
        data.remarks
      );
      results[testCode] = {
        testCode,
        testDefinitionId: testDef.id,
        applicability: item.applicability,
        status: calc.result,
        calculatedError: calc.calculatedError,
        absoluteError: calc.absoluteError,
        mpe: calc.mpeValue,
        mpeRuleId: calc.mpeRuleId,
        reason: calc.reason,
        ruleSetId,
        ruleVersion,
        auditDetails: calc.auditDetails,
        remarks: calc.remarks,
      };
    }
  }

  const overallResult = calculateOverallResult(
    Object.values(results).map((r) => ({
      testCode: r.testCode,
      applicability: r.applicability,
      result: r.status,
    }))
  );

  return {
    inspectionPlan: plan,
    results,
    overallResult,
  };
}

/**
 * Persists evaluated inspection header and test records into Supabase database.
 */
export async function saveInspectionRecord(
  supabase: SupabaseClient,
  inspectionId: string,
  ruleSetId: string,
  ruleVersion: string,
  results: ComplianceResult[],
  overallResult: 'PASS' | 'FAIL' | 'PENDING'
): Promise<void> {
  // Update inspection header
  const { error: headerErr } = await supabase
    .from('inspections')
    .update({
      rule_set_id: ruleSetId,
      rule_version: ruleVersion,
      overall_result: overallResult,
    })
    .eq('id', inspectionId);

  if (headerErr) {
    throw new Error(`Failed to update inspection header: ${headerErr.message}`);
  }

  // Insert/upsert inspection test items
  const testItemsToInsert = results.map((res, idx) => ({
    inspection_id: inspectionId,
    test_definition_id: res.testDefinitionId,
    test_type: res.testCode,
    test_sequence: idx + 1,
    test_status: 'COMPLETED',
    calculated_error: res.calculatedError,
    absolute_error: res.absoluteError,
    error: res.calculatedError,
    mpe: res.mpe,
    mpe_rule_id: res.mpeRuleId,
    calculation_method: res.auditDetails?.method || 'DETERMINISTIC',
    calculation_details: res.auditDetails,
    result: res.status as TestResult,
    remarks: res.remarks,
  }));

  const { error: testsErr } = await supabase.from('inspection_tests').insert(testItemsToInsert);

  if (testsErr) {
    throw new Error(`Failed to insert inspection tests: ${testsErr.message}`);
  }
}
