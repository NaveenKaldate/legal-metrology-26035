'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Instrument, Profile, RuleSet, InspectionType, InspectionDataSource, TestResult } from '@/types/database';
import { InspectionTestInput } from '@/lib/validations/inspection';
import { LoadedRuleSet, fetchLoadedRuleSet } from '@/lib/compliance/rule-engine';
import { generateInspectionPlan } from '@/lib/compliance/test-plan-engine';
import { EngineInput, InspectionPlan } from '@/lib/compliance/types';
import {
  calculateT01,
  calculateT02,
  calculateT03,
  calculateT04,
  calculateT05,
  calculateT06,
} from '@/lib/compliance/calculation-engine';

interface InspectionFormProps {
  instrument: Instrument;
  ruleSets: RuleSet[];
  inspector: Profile | null;
  inspectorEmail: string;
}

export default function InspectionForm({
  instrument,
  ruleSets,
  inspector,
  inspectorEmail,
}: InspectionFormProps) {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState<number>(1);

  // Selected Rule Set & Stage
  const [selectedRuleSetId, setSelectedRuleSetId] = useState<string>(
    ruleSets[0]?.id || ''
  );
  const [controlStage, setControlStage] = useState<InspectionType>('INITIAL');
  const [dataSource, setDataSource] = useState<InspectionDataSource>('SIMULATED');
  const [inspectionDate, setInspectionDate] = useState<string>(
    new Date().toISOString().slice(0, 16)
  );

  // Tare configuration toggle
  const [hasTare, setHasTare] = useState<boolean>(true);

  // Loaded Rule Set Data
  const [loadedRuleSet, setLoadedRuleSet] = useState<LoadedRuleSet | null>(null);
  const [loadingRules, setLoadingRules] = useState<boolean>(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState<boolean>(false);

  // T01 Checklist State
  const [t01Checklist, setT01Checklist] = useState<Record<string, boolean>>({
    class_and_inscriptions: true,
    max_min_capacity_markings: true,
    scale_intervals_e_d: true,
    model_approval_serial_plate: true,
    sealing_and_control_marks: true,
    housing_and_leveling_bubble: true,
  });
  const [t01Remarks, setT01Remarks] = useState<string>('All metrological markings and sealing marks verified intact.');

  // T02 Zero-Setting State
  const [t02Method, setT02Method] = useState<'DIRECT' | 'CHANGEOVER'>('CHANGEOVER');
  const [zeroConfig, setZeroConfig] = useState<'NON_AUTOMATIC' | 'SEMI_AUTOMATIC' | 'AUTOMATIC' | 'ZERO_TRACKING'>('NON_AUTOMATIC');
  const t02ZeroLoad = 0;
  const [t02Indication, setT02Indication] = useState<number>(0);
  const [t02DeltaL, setT02DeltaL] = useState<number>(0.5 * (instrument.verification_interval_e || 1));
  const [t02Remarks, setT02Remarks] = useState<string>('Zero setting error evaluated.');

  // T03 Errors of Indication State
  const [t03Method, setT03Method] = useState<'DIRECT' | 'CHANGEOVER_POINT'>('CHANGEOVER_POINT');
  const [t03Load, setT03Load] = useState<number>(
    instrument.max_capacity ? Number((instrument.max_capacity / 2).toFixed(3)) : 10
  );
  const [t03Observed, setT03Observed] = useState<number>(
    instrument.max_capacity ? Number((instrument.max_capacity / 2).toFixed(3)) : 10
  );
  const [t03DeltaL, setT03DeltaL] = useState<number>(
    0.5 * (instrument.verification_interval_e || 1)
  );
  const [t03Remarks, setT03Remarks] = useState<string>('Errors of indication evaluated across load range.');

  // T04 Repeatability State
  const [t04Load, setT04Load] = useState<number>(
    instrument.max_capacity ? Number((instrument.max_capacity * 0.8).toFixed(3)) : 10
  );
  const [t04Readings, setT04Readings] = useState<number[]>([
    instrument.max_capacity ? Number((instrument.max_capacity * 0.8).toFixed(3)) : 10,
    instrument.max_capacity ? Number((instrument.max_capacity * 0.8).toFixed(3)) : 10,
    instrument.max_capacity ? Number((instrument.max_capacity * 0.8).toFixed(3)) : 10,
  ]);
  const [t04Remarks, setT04Remarks] = useState<string>('Repeatability test executed across 3 consecutive weighings.');

  // T05 Eccentric Loading State
  const [t05Load, setT05Load] = useState<number>(
    instrument.max_capacity ? Number((instrument.max_capacity / 3).toFixed(3)) : 5
  );
  const [t05Positions, setT05Positions] = useState<Record<string, number>>({
    'Position 1 (Center)': instrument.max_capacity ? Number((instrument.max_capacity / 3).toFixed(3)) : 5,
    'Position 2 (Front-Left)': instrument.max_capacity ? Number((instrument.max_capacity / 3).toFixed(3)) : 5,
    'Position 3 (Front-Right)': instrument.max_capacity ? Number((instrument.max_capacity / 3).toFixed(3)) : 5,
    'Position 4 (Back-Right)': instrument.max_capacity ? Number((instrument.max_capacity / 3).toFixed(3)) : 5,
    'Position 5 (Back-Left)': instrument.max_capacity ? Number((instrument.max_capacity / 3).toFixed(3)) : 5,
  });
  const [t05Remarks, setT05Remarks] = useState<string>('Eccentric load applied at 5 load receptor positions.');

  // T06 Tare Accuracy State
  const [t06TareLoad, setT06TareLoad] = useState<number>(2.0);
  const [t06GrossLoad, setT06GrossLoad] = useState<number>(10.0);
  const [t06NetObserved, setT06NetObserved] = useState<number>(8.0);
  const [t06Remarks, setT06Remarks] = useState<string>('Tare balancing accuracy and net indication evaluated.');

  // Construct Engine Input profile
  const engineInput: EngineInput = useMemo(
    () => ({
      instrument_type: instrument.instrument_type,
      accuracy_class: instrument.accuracy_class || 'Class III',
      max_capacity: instrument.max_capacity || 15,
      min_capacity: instrument.min_capacity || 0.1,
      verification_interval_e: instrument.verification_interval_e || 1,
      actual_interval_d: instrument.actual_interval_d || 1,
      unit: instrument.unit || 'kg',
      has_tare: hasTare,
      zero_configuration: zeroConfig,
    }),
    [instrument, hasTare, zeroConfig]
  );

  // Async rule set loader inside useEffect without synchronous setState
  useEffect(() => {
    let isSubscribed = true;

    async function loadRules() {
      if (!selectedRuleSetId) return;
      setLoadingRules(true);
      setServerError(null);
      try {
        const supabase = createClient();
        const loaded = await fetchLoadedRuleSet(supabase, selectedRuleSetId);
        if (isSubscribed) {
          setLoadedRuleSet(loaded);
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Failed to load rule set';
        if (isSubscribed) {
          setServerError(msg);
        }
      } finally {
        if (isSubscribed) {
          setLoadingRules(false);
        }
      }
    }

    loadRules();

    return () => {
      isSubscribed = false;
    };
  }, [selectedRuleSetId]);

  // Generate Test Plan
  const testPlan: InspectionPlan | null = useMemo(() => {
    if (!loadedRuleSet) return null;
    return generateInspectionPlan(loadedRuleSet, controlStage, engineInput);
  }, [loadedRuleSet, controlStage, engineInput]);

  // Calculate Test Results Deterministically
  const calculatedResults = useMemo(() => {
    if (!loadedRuleSet) return {};

    const mpeRules = loadedRuleSet.mpeRules;

    const resT01 = calculateT01(t01Checklist, t01Remarks);
    const resT02 = calculateT02(
      t02Method,
      t02ZeroLoad,
      t02Indication,
      t02DeltaL,
      engineInput.verification_interval_e,
      zeroConfig,
      t02Remarks
    );
    const resT03 = calculateT03(
      t03Method,
      t03Load,
      t03Observed,
      t03DeltaL,
      selectedRuleSetId,
      engineInput,
      mpeRules,
      controlStage,
      t03Remarks
    );
    const resT04 = calculateT04(
      t04Load,
      t04Readings,
      selectedRuleSetId,
      engineInput,
      mpeRules,
      controlStage,
      t04Remarks
    );
    const resT05 = calculateT05(
      t05Load,
      t05Positions,
      selectedRuleSetId,
      engineInput,
      mpeRules,
      controlStage,
      t05Remarks
    );
    const resT06 = hasTare
      ? calculateT06(
          t06TareLoad,
          t06GrossLoad,
          t06NetObserved,
          selectedRuleSetId,
          engineInput,
          mpeRules,
          controlStage,
          t06Remarks
        )
      : {
          testCode: 'T06',
          result: 'NOT_APPLICABLE' as TestResult,
          calculatedError: null,
          absoluteError: null,
          mpeValue: null,
          mpeRuleId: null,
          method: 'TARE_NET_EVALUATION',
          auditDetails: { method: 'TARE_NET_EVALUATION', test_code: 'T06', reason: 'Tare not equipped' },
          remarks: 'Tare test not applicable for this instrument.',
        };

    return {
      T01: resT01,
      T02: resT02,
      T03: resT03,
      T04: resT04,
      T05: resT05,
      T06: resT06,
    };
  }, [
    loadedRuleSet,
    controlStage,
    engineInput,
    t01Checklist,
    t01Remarks,
    t02Method,
    t02ZeroLoad,
    t02Indication,
    t02DeltaL,
    t02Remarks,
    t03Method,
    t03Load,
    t03Observed,
    t03DeltaL,
    t03Remarks,
    t04Load,
    t04Readings,
    t04Remarks,
    t05Load,
    t05Positions,
    t05Remarks,
    hasTare,
    t06TareLoad,
    t06GrossLoad,
    t06NetObserved,
    t06Remarks,
    zeroConfig,
    selectedRuleSetId,
  ]);

  // Overall Calculated Preliminary Result
  const overallCalculatedResult = useMemo(() => {
    const results = Object.values(calculatedResults);
    if (results.length === 0) return 'PENDING';
    const hasFail = results.some((r) => r.result === 'FAIL');
    if (hasFail) return 'FAIL';
    const allPassOrNa = results.every(
      (r) => r.result === 'PASS' || r.result === 'NOT_APPLICABLE'
    );
    if (allPassOrNa) return 'PASS';
    return 'PENDING';
  }, [calculatedResults]);

  const handleSaveInspection = async () => {
    setServerError(null);
    if (!loadedRuleSet || !testPlan) {
      setServerError('Rule set details must be loaded before saving.');
      return;
    }

    setSubmitting(true);

    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setServerError('You must be logged in to record inspections.');
        setSubmitting(false);
        return;
      }

      // 1. Insert into public.inspections
      const { data: inspectionData, error: inspectionError } = await (
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        supabase.from('inspections') as any
      )
        .insert({
          instrument_id: instrument.id,
          inspector_id: user.id,
          rule_set_id: selectedRuleSetId,
          inspection_type: controlStage,
          inspection_date: new Date(inspectionDate).toISOString(),
          rule_version: loadedRuleSet.ruleSet.version,
          data_source: dataSource,
          overall_result: overallCalculatedResult,
        })
        .select('id')
        .single();

      if (inspectionError || !inspectionData) {
        setServerError(inspectionError?.message || 'Failed to save inspection header.');
        setSubmitting(false);
        return;
      }

      const inspectionId = inspectionData.id;

      // 2. Prepare tests to insert into public.inspection_tests
      const testsToInsert: InspectionTestInput[] = testPlan.testItems.map((item, idx) => {
        const testCode = item.testDefinition.test_code;
        const calcRes = calculatedResults[testCode as keyof typeof calculatedResults];

        let refVal: number | null = null;
        let obsVal: number | null = null;
        let loadVal: number | null = null;

        if (testCode === 'T02') {
          refVal = t02ZeroLoad;
          obsVal = t02Indication;
          loadVal = t02ZeroLoad;
        } else if (testCode === 'T03') {
          refVal = t03Load;
          obsVal = t03Observed;
          loadVal = t03Load;
        } else if (testCode === 'T04') {
          refVal = t04Load;
          obsVal = t04Readings[0] ?? null;
          loadVal = t04Load;
        } else if (testCode === 'T05') {
          refVal = t05Load;
          obsVal = t05Positions['Position 1 (Center)'] ?? null;
          loadVal = t05Load;
        } else if (testCode === 'T06') {
          refVal = Number((t06GrossLoad - t06TareLoad).toFixed(6));
          obsVal = t06NetObserved;
          loadVal = t06GrossLoad;
        }

        return {
          test_definition_id: item.testDefinition.id,
          test_type: item.testDefinition.test_code,
          test_sequence: idx + 1,
          test_status: 'COMPLETED',
          test_load: loadVal,
          reference_value: refVal,
          observed_value: obsVal,
          calculated_error: calcRes?.calculatedError ?? null,
          absolute_error: calcRes?.absoluteError ?? null,
          error: calcRes?.calculatedError ?? null, // Backward compatibility
          mpe: calcRes?.mpeValue ?? null, // Backward compatibility
          mpe_rule_id: calcRes?.mpeRuleId ?? null,
          calculation_method: calcRes?.method ?? 'DETERMINISTIC',
          calculation_details: calcRes?.auditDetails ?? null,
          result: calcRes?.result || 'NOT_APPLICABLE',
          remarks: calcRes?.remarks || item.testDefinition.name,
        };
      });

      const { error: testsError } = await (
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        supabase.from('inspection_tests') as any
      ).insert(
        testsToInsert.map((t) => ({
          inspection_id: inspectionId,
          ...t,
        }))
      );

      if (testsError) {
        setServerError(`Inspection header saved, but test items failed: ${testsError.message}`);
        setSubmitting(false);
        return;
      }

      router.push(`/dashboard/inspections/${inspectionId}?success=created`);
      router.refresh();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'An unexpected error occurred';
      setServerError(msg);
      setSubmitting(false);
    }
  };

  const activeRuleSetObj = ruleSets.find((r) => r.id === selectedRuleSetId);

  return (
    <div className="space-y-6">
      {serverError && (
        <div className="p-4 text-sm text-red-700 bg-red-100 dark:bg-red-950/50 dark:text-red-300 rounded-lg border border-red-200 dark:border-red-900">
          {serverError}
        </div>
      )}

      {/* Wizard Progress Tabs (6 Steps) */}
      <div className="bg-white dark:bg-zinc-900 p-4 rounded-xl shadow-sm border border-zinc-200 dark:border-zinc-800">
        <div className="flex flex-wrap items-center justify-between gap-2">
          {[
            { step: 1, label: 'Rule Set Selection' },
            { step: 2, label: 'Instrument Summary' },
            { step: 3, label: 'Applicable Test Plan' },
            { step: 4, label: 'Execute Core Tests' },
            { step: 5, label: 'Review Audit Results' },
            { step: 6, label: 'Finalize Inspection' },
          ].map((s) => {
            const active = currentStep === s.step;
            const completed = currentStep > s.step;
            return (
              <button
                key={s.step}
                type="button"
                onClick={() => setCurrentStep(s.step)}
                className={`flex items-center gap-2 px-3 py-2 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                  active
                    ? 'bg-blue-600 text-white'
                    : completed
                    ? 'bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300'
                    : 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400'
                }`}
              >
                <span
                  className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                    active
                      ? 'bg-white text-blue-600'
                      : completed
                      ? 'bg-blue-600 text-white'
                      : 'bg-zinc-300 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-300'
                  }`}
                >
                  {completed ? '✓' : s.step}
                </span>
                <span>{s.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* STEP 1: Rule Set Selection & Inspection Setup */}
      {currentStep === 1 && (
        <div className="bg-white dark:bg-zinc-900 p-6 rounded-xl shadow-sm border border-zinc-200 dark:border-zinc-800 space-y-6">
          <div className="border-b border-zinc-100 dark:border-zinc-800 pb-4">
            <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
              <span>📜</span> Step 1: Select Inspection Rule Framework
            </h3>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
              Choose the governing legal/metrological rule standard, control stage, and environment.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-1 md:col-span-2">
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Governing Rule Framework <span className="text-red-500">*</span>
              </label>
              <select
                value={selectedRuleSetId}
                onChange={(e) => setSelectedRuleSetId(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-zinc-900 dark:text-zinc-100 bg-white dark:bg-zinc-800 border-zinc-300 dark:border-zinc-700 text-sm font-semibold"
              >
                {ruleSets.map((rs) => (
                  <option key={rs.id} value={rs.id}>
                    {rs.standard} ({rs.version}) — {rs.jurisdiction} ({rs.description})
                  </option>
                ))}
              </select>
            </div>

            {activeRuleSetObj && (
              <div className="md:col-span-2 p-4 bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900/60 rounded-xl text-xs text-blue-900 dark:text-blue-200 space-y-1">
                <span className="font-bold block">
                  Active Framework: {activeRuleSetObj.standard} (v{activeRuleSetObj.version})
                </span>
                <p>
                  Jurisdiction: <strong>{activeRuleSetObj.jurisdiction}</strong> | Status:{' '}
                  <strong>{activeRuleSetObj.status}</strong>
                </p>
                <p className="text-blue-700 dark:text-blue-300 mt-1">
                  {activeRuleSetObj.description}
                </p>
              </div>
            )}

            <div className="space-y-1">
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Control Stage / Inspection Type <span className="text-red-500">*</span>
              </label>
              <select
                value={controlStage}
                onChange={(e) => setControlStage(e.target.value as InspectionType)}
                className="w-full px-3 py-2 border rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-zinc-900 dark:text-zinc-100 bg-white dark:bg-zinc-800 border-zinc-300 dark:border-zinc-700 text-sm"
              >
                <option value="INITIAL">INITIAL (Initial Verification)</option>
                <option value="IN_SERVICE">IN_SERVICE (In-Service Inspection / Reverification)</option>
                <option value="TYPE_EVALUATION">TYPE_EVALUATION (Pattern Approval / Type Evaluation)</option>
              </select>
              <span className="text-[11px] text-zinc-500 block">
                Note: In-Service inspection applies double MPE tolerance under Clause 3.5.2 / Table 1.
              </span>
            </div>

            <div className="space-y-1">
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Data Source Environment
              </label>
              <select
                value={dataSource}
                onChange={(e) => setDataSource(e.target.value as InspectionDataSource)}
                className="w-full px-3 py-2 border rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-zinc-900 dark:text-zinc-100 bg-white dark:bg-zinc-800 border-zinc-300 dark:border-zinc-700 text-sm"
              >
                <option value="SIMULATED">SIMULATED (Demo / Software Verification)</option>
                <option value="FIELD">FIELD (Actual Field Calibration)</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Inspection Date &amp; Time
              </label>
              <input
                type="datetime-local"
                value={inspectionDate}
                onChange={(e) => setInspectionDate(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-zinc-900 dark:text-zinc-100 bg-white dark:bg-zinc-800 border-zinc-300 dark:border-zinc-700 text-sm"
              />
            </div>

            <div className="space-y-1">
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Assigned Inspector (Authenticated User)
              </label>
              <input
                type="text"
                disabled
                value={`${inspector?.full_name || 'Inspector'} (${inspectorEmail})`}
                className="w-full px-3 py-2 border rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border-zinc-300 dark:border-zinc-700 text-sm cursor-not-allowed"
              />
            </div>
          </div>

          <div className="flex justify-end pt-4">
            <button
              type="button"
              disabled={loadingRules}
              onClick={() => setCurrentStep(2)}
              className="px-5 py-2.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors cursor-pointer disabled:opacity-50"
            >
              {loadingRules ? 'Loading Rules...' : 'Continue to Instrument Summary →'}
            </button>
          </div>
        </div>
      )}

      {/* STEP 2: Instrument Summary */}
      {currentStep === 2 && (
        <div className="bg-white dark:bg-zinc-900 p-6 rounded-xl shadow-sm border border-zinc-200 dark:border-zinc-800 space-y-6">
          <div className="border-b border-zinc-100 dark:border-zinc-800 pb-4">
            <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
              <span>⚖️</span> Step 2: Instrument Parameters &amp; Configurations
            </h3>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
              Verify metrological characteristics that feed into test applicability and MPE calculations.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            <div className="p-3.5 bg-zinc-50 dark:bg-zinc-800/40 rounded-xl space-y-1">
              <span className="text-xs text-zinc-500 dark:text-zinc-400 block font-medium uppercase">
                Instrument Type
              </span>
              <span className="font-semibold text-zinc-900 dark:text-zinc-100">
                {instrument.instrument_type === 'ELECTRONIC_WEIGHING'
                  ? 'Electronic Weighing Instrument'
                  : 'Platform Weighing Scale'}
              </span>
            </div>

            <div className="p-3.5 bg-zinc-50 dark:bg-zinc-800/40 rounded-xl space-y-1">
              <span className="text-xs text-zinc-500 dark:text-zinc-400 block font-medium uppercase">
                Manufacturer &amp; Model
              </span>
              <span className="font-semibold text-zinc-900 dark:text-zinc-100">
                {instrument.manufacturer} ({instrument.model})
              </span>
            </div>

            <div className="p-3.5 bg-zinc-50 dark:bg-zinc-800/40 rounded-xl space-y-1">
              <span className="text-xs text-zinc-500 dark:text-zinc-400 block font-medium uppercase">
                Serial Number
              </span>
              <span className="font-mono text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                {instrument.serial_number}
              </span>
            </div>

            <div className="p-3.5 bg-zinc-50 dark:bg-zinc-800/40 rounded-xl space-y-1">
              <span className="text-xs text-zinc-500 dark:text-zinc-400 block font-medium uppercase">
                Accuracy Class
              </span>
              <span className="font-semibold text-zinc-900 dark:text-zinc-100">
                {instrument.accuracy_class || 'Class III'}
              </span>
            </div>

            <div className="p-3.5 bg-zinc-50 dark:bg-zinc-800/40 rounded-xl space-y-1">
              <span className="text-xs text-zinc-500 dark:text-zinc-400 block font-medium uppercase">
                Max / Min Capacity
              </span>
              <span className="font-semibold text-zinc-900 dark:text-zinc-100">
                Max: {instrument.max_capacity} {instrument.unit} | Min:{' '}
                {instrument.min_capacity} {instrument.unit}
              </span>
            </div>

            <div className="p-3.5 bg-zinc-50 dark:bg-zinc-800/40 rounded-xl space-y-1">
              <span className="text-xs text-zinc-500 dark:text-zinc-400 block font-medium uppercase">
                Intervals (e / d)
              </span>
              <span className="font-semibold text-zinc-900 dark:text-zinc-100">
                e = {instrument.verification_interval_e} {instrument.unit} | d ={' '}
                {instrument.actual_interval_d} {instrument.unit}
              </span>
            </div>
          </div>

          {/* Tare Capability Toggle */}
          <div className="p-4 bg-zinc-50 dark:bg-zinc-800/60 rounded-xl flex items-center justify-between">
            <div>
              <span className="font-semibold text-sm text-zinc-900 dark:text-zinc-100 block">
                Tare Device Capability (T06 Applicability)
              </span>
              <span className="text-xs text-zinc-500 dark:text-zinc-400">
                Indicate if this instrument has a subtractive/additive tare device equipped.
              </span>
            </div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={hasTare}
                onChange={(e) => setHasTare(e.target.checked)}
                className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
              />
              <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Tare Device Present
              </span>
            </label>
          </div>

          <div className="flex items-center justify-between pt-4">
            <button
              type="button"
              onClick={() => setCurrentStep(1)}
              className="px-4 py-2 text-sm font-medium text-zinc-700 dark:text-zinc-300 bg-zinc-100 dark:bg-zinc-800 rounded-lg hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
            >
              ← Back
            </button>
            <button
              type="button"
              onClick={() => setCurrentStep(3)}
              className="px-5 py-2.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors cursor-pointer"
            >
              Generate Test Plan →
            </button>
          </div>
        </div>
      )}

      {/* STEP 3: DB-Driven Applicable Test Plan */}
      {currentStep === 3 && (
        <div className="bg-white dark:bg-zinc-900 p-6 rounded-xl shadow-sm border border-zinc-200 dark:border-zinc-800 space-y-6">
          <div className="border-b border-zinc-100 dark:border-zinc-800 pb-4">
            <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
              <span>📋</span> Step 3: DB-Driven Applicable Test Plan
            </h3>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
              Evaluated based on active rule set ({loadedRuleSet?.ruleSet.standard}) and instrument specifications.
            </p>
          </div>

          {testPlan ? (
            <div className="space-y-4">
              <div className="divide-y divide-zinc-200 dark:divide-zinc-800 border rounded-xl overflow-hidden text-xs">
                {testPlan.testItems.map((item) => (
                  <div
                    key={item.testDefinition.id}
                    className="p-4 bg-zinc-50/50 dark:bg-zinc-800/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-blue-600 dark:text-blue-400">
                          {item.testDefinition.test_code}
                        </span>
                        <span className="font-semibold text-zinc-900 dark:text-zinc-100">
                          {item.testDefinition.name}
                        </span>
                        <span className="px-2 py-0.5 rounded bg-zinc-200 dark:bg-zinc-700 text-[10px] font-mono">
                          Clause {item.testDefinition.clause}
                        </span>
                      </div>
                      <p className="text-zinc-500 dark:text-zinc-400 mt-1">
                        {item.testDefinition.description}
                      </p>
                      <span className="text-[11px] text-zinc-600 dark:text-zinc-400 block mt-1">
                        Reason: {item.reason}
                      </span>
                    </div>

                    <div>
                      <span
                        className={`px-3 py-1 font-bold rounded-full text-xs ${
                          item.applicability === 'REQUIRED'
                            ? 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300'
                            : item.applicability === 'CONDITIONAL'
                            ? 'bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300'
                            : item.applicability === 'OPTIONAL'
                            ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                            : 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400'
                        }`}
                      >
                        {item.applicability}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="p-8 text-center text-zinc-500 text-sm">
              Loading test plan items...
            </div>
          )}

          <div className="flex items-center justify-between pt-4">
            <button
              type="button"
              onClick={() => setCurrentStep(2)}
              className="px-4 py-2 text-sm font-medium text-zinc-700 dark:text-zinc-300 bg-zinc-100 dark:bg-zinc-800 rounded-lg hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
            >
              ← Back
            </button>
            <button
              type="button"
              onClick={() => setCurrentStep(4)}
              className="px-5 py-2.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors cursor-pointer"
            >
              Proceed to Execute Core Tests →
            </button>
          </div>
        </div>
      )}

      {/* STEP 4: Execute Core Tests (T01 - T06) */}
      {currentStep === 4 && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-zinc-900 p-6 rounded-xl shadow-sm border border-zinc-200 dark:border-zinc-800">
            <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
              Step 4: Execute Core OIML Tests &amp; Observations
            </h3>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
              Enter observations for T01 Visual, T02 Zero, T03 Indication, T04 Repeatability, T05 Eccentricity, and T06 Tare.
            </p>
          </div>

          {/* T01: Visual & Administrative Checklist */}
          <div className="bg-white dark:bg-zinc-900 p-6 rounded-xl shadow-sm border border-zinc-200 dark:border-zinc-800 space-y-4">
            <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-3">
              <div>
                <span className="font-mono text-xs font-bold text-blue-600">T01</span>
                <h4 className="font-bold text-sm text-zinc-900 dark:text-zinc-100">
                  Visual &amp; Administrative Examination (Clause 8.3.2)
                </h4>
              </div>
              <span
                className={`px-2.5 py-0.5 text-xs font-bold rounded-full ${
                  calculatedResults.T01?.result === 'PASS'
                    ? 'bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300'
                    : 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300'
                }`}
              >
                {calculatedResults.T01?.result || 'PENDING'}
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
              {[
                { key: 'class_and_inscriptions', label: 'Accuracy Class & Legal Inscriptions Present' },
                { key: 'max_min_capacity_markings', label: 'Max & Min Capacity Markings Stamped' },
                { key: 'scale_intervals_e_d', label: 'Verification Scale Interval (e) & (d) Clear' },
                { key: 'model_approval_serial_plate', label: 'Model Approval Number & Serial Plate Intact' },
                { key: 'sealing_and_control_marks', label: 'Verification Sealing & Control Marks Intact' },
                { key: 'housing_and_leveling_bubble', label: 'Device Housing & Leveling Bubble Level' },
              ].map((item) => (
                <label
                  key={item.key}
                  className="p-3 bg-zinc-50 dark:bg-zinc-800/40 rounded-lg flex items-center gap-3 cursor-pointer hover:bg-zinc-100 transition-colors"
                >
                  <input
                    type="checkbox"
                    checked={t01Checklist[item.key] ?? false}
                    onChange={(e) =>
                      setT01Checklist((prev) => ({ ...prev, [item.key]: e.target.checked }))
                    }
                    className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                  />
                  <span className="font-medium text-zinc-800 dark:text-zinc-200">
                    {item.label}
                  </span>
                </label>
              ))}
            </div>

            <div className="space-y-1 pt-2">
              <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400">
                Remarks
              </label>
              <input
                type="text"
                value={t01Remarks}
                onChange={(e) => setT01Remarks(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg text-xs text-zinc-900 dark:text-zinc-100 bg-white dark:bg-zinc-800 border-zinc-300 dark:border-zinc-700"
              />
            </div>
          </div>

          {/* T02: Zero-setting Accuracy Check */}
          <div className="bg-white dark:bg-zinc-900 p-6 rounded-xl shadow-sm border border-zinc-200 dark:border-zinc-800 space-y-4">
            <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-3">
              <div>
                <span className="font-mono text-xs font-bold text-blue-600">T02</span>
                <h4 className="font-bold text-sm text-zinc-900 dark:text-zinc-100">
                  Zero-setting Accuracy Check (Clause 4.5.2; A.4.2.3)
                </h4>
              </div>
              <span
                className={`px-2.5 py-0.5 text-xs font-bold rounded-full ${
                  calculatedResults.T02?.result === 'PASS'
                    ? 'bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300'
                    : 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300'
                }`}
              >
                {calculatedResults.T02?.result || 'PENDING'}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 text-xs">
              <div className="space-y-1">
                <label className="block font-medium text-zinc-600 dark:text-zinc-400">
                  Zero Setting Device Mode
                </label>
                <select
                  value={zeroConfig}
                  onChange={(e) =>
                    setZeroConfig(
                      e.target.value as 'NON_AUTOMATIC' | 'SEMI_AUTOMATIC' | 'AUTOMATIC' | 'ZERO_TRACKING'
                    )
                  }
                  className="w-full px-3 py-2 border rounded-lg text-xs text-zinc-900 dark:text-zinc-100 bg-white dark:bg-zinc-800 border-zinc-300 dark:border-zinc-700 font-semibold"
                >
                  <option value="NON_AUTOMATIC">Non-automatic Zero Setting</option>
                  <option value="SEMI_AUTOMATIC">Semi-automatic Zero Setting</option>
                  <option value="AUTOMATIC">Automatic Zero Setting (Requires DB Procedure)</option>
                  <option value="ZERO_TRACKING">Zero Tracking (Requires DB Procedure)</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="block font-medium text-zinc-600 dark:text-zinc-400">
                  Zero Evaluation Method
                </label>
                <select
                  value={t02Method}
                  onChange={(e) => setT02Method(e.target.value as 'DIRECT' | 'CHANGEOVER')}
                  className="w-full px-3 py-2 border rounded-lg text-xs text-zinc-900 dark:text-zinc-100 bg-white dark:bg-zinc-800 border-zinc-300 dark:border-zinc-700 font-semibold"
                >
                  <option value="CHANGEOVER">Changeover Point Method (OIML A.4.2.3)</option>
                  <option value="DIRECT">Direct Observation</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="block font-medium text-zinc-600 dark:text-zinc-400">
                  Indication at Zero (I_0)
                </label>
                <input
                  type="number"
                  step="any"
                  value={t02Indication}
                  onChange={(e) => setT02Indication(Number(e.target.value))}
                  className="w-full px-3 py-2 border rounded-lg text-xs text-zinc-900 dark:text-zinc-100 bg-white dark:bg-zinc-800 border-zinc-300 dark:border-zinc-700"
                />
              </div>

              {t02Method === 'CHANGEOVER' && (
                <div className="space-y-1">
                  <label className="block font-medium text-zinc-600 dark:text-zinc-400">
                    Changeover Load (ΔL)
                  </label>
                  <input
                    type="number"
                    step="any"
                    value={t02DeltaL}
                    onChange={(e) => setT02DeltaL(Number(e.target.value))}
                    className="w-full px-3 py-2 border rounded-lg text-xs text-zinc-900 dark:text-zinc-100 bg-white dark:bg-zinc-800 border-zinc-300 dark:border-zinc-700"
                  />
                </div>
              )}

              <div className="space-y-1">
                <label className="block font-medium text-zinc-600 dark:text-zinc-400">
                  Calculated Zero Error (E_0)
                </label>
                <div className="px-3 py-2 border rounded-lg bg-zinc-50 dark:bg-zinc-800 font-mono text-xs font-bold text-zinc-900 dark:text-zinc-100">
                  {calculatedResults.T02?.calculatedError !== null
                    ? `${calculatedResults.T02?.calculatedError} ${engineInput.unit} (Limit: +/- ${(
                        0.25 * engineInput.verification_interval_e
                      ).toFixed(3)})`
                    : 'N/A'}
                </div>
              </div>
            </div>

            <div className="space-y-1 pt-1">
              <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400">
                Remarks
              </label>
              <input
                type="text"
                value={t02Remarks}
                onChange={(e) => setT02Remarks(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg text-xs text-zinc-900 dark:text-zinc-100 bg-white dark:bg-zinc-800 border-zinc-300 dark:border-zinc-700"
              />
            </div>
          </div>

          {/* T03: Errors of Indication Test */}
          <div className="bg-white dark:bg-zinc-900 p-6 rounded-xl shadow-sm border border-zinc-200 dark:border-zinc-800 space-y-4">
            <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-3">
              <div>
                <span className="font-mono text-xs font-bold text-blue-600">T03</span>
                <h4 className="font-bold text-sm text-zinc-900 dark:text-zinc-100">
                  Errors of Indication Test (Clause 3.5.1; A.4.4-A.4.6)
                </h4>
              </div>
              <span
                className={`px-2.5 py-0.5 text-xs font-bold rounded-full ${
                  calculatedResults.T03?.result === 'PASS'
                    ? 'bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300'
                    : 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300'
                }`}
              >
                {calculatedResults.T03?.result || 'PENDING'}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 text-xs">
              <div className="space-y-1">
                <label className="block font-medium text-zinc-600 dark:text-zinc-400">
                  Evaluation Method
                </label>
                <select
                  value={t03Method}
                  onChange={(e) =>
                    setT03Method(e.target.value as 'DIRECT' | 'CHANGEOVER_POINT')
                  }
                  className="w-full px-3 py-2 border rounded-lg text-xs text-zinc-900 dark:text-zinc-100 bg-white dark:bg-zinc-800 border-zinc-300 dark:border-zinc-700 font-semibold"
                >
                  <option value="CHANGEOVER_POINT">Changeover Point Method (OIML A.4.4.3)</option>
                  <option value="DIRECT">Direct Observation</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="block font-medium text-zinc-600 dark:text-zinc-400">
                  Test Load (L) ({engineInput.unit})
                </label>
                <input
                  type="number"
                  step="any"
                  value={t03Load}
                  onChange={(e) => setT03Load(Number(e.target.value))}
                  className="w-full px-3 py-2 border rounded-lg text-xs text-zinc-900 dark:text-zinc-100 bg-white dark:bg-zinc-800 border-zinc-300 dark:border-zinc-700 font-semibold"
                />
              </div>

              <div className="space-y-1">
                <label className="block font-medium text-zinc-600 dark:text-zinc-400">
                  Observed Indication (I) ({engineInput.unit})
                </label>
                <input
                  type="number"
                  step="any"
                  value={t03Observed}
                  onChange={(e) => setT03Observed(Number(e.target.value))}
                  className="w-full px-3 py-2 border rounded-lg text-xs text-zinc-900 dark:text-zinc-100 bg-white dark:bg-zinc-800 border-zinc-300 dark:border-zinc-700 font-semibold"
                />
              </div>

              {t03Method === 'CHANGEOVER_POINT' && (
                <div className="space-y-1">
                  <label className="block font-medium text-zinc-600 dark:text-zinc-400">
                    Additional Load (ΔL) ({engineInput.unit})
                  </label>
                  <input
                    type="number"
                    step="any"
                    value={t03DeltaL}
                    onChange={(e) => setT03DeltaL(Number(e.target.value))}
                    className="w-full px-3 py-2 border rounded-lg text-xs text-zinc-900 dark:text-zinc-100 bg-white dark:bg-zinc-800 border-zinc-300 dark:border-zinc-700"
                  />
                </div>
              )}
            </div>

            {/* Calculated Details Card */}
            <div className="p-3.5 bg-zinc-50 dark:bg-zinc-800/50 rounded-xl grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <div>
                <span className="text-zinc-500 block font-medium">Calculated Error (E):</span>
                <span className="font-mono font-bold text-zinc-900 dark:text-zinc-100">
                  {calculatedResults.T03?.calculatedError !== null
                    ? `${calculatedResults.T03?.calculatedError} ${engineInput.unit}`
                    : 'N/A'}
                </span>
              </div>

              <div>
                <span className="text-zinc-500 block font-medium">Database MPE Limit:</span>
                <span className="font-mono font-bold text-zinc-900 dark:text-zinc-100">
                  {calculatedResults.T03?.mpeValue !== null
                    ? `+/- ${calculatedResults.T03?.mpeValue} ${engineInput.unit}`
                    : 'N/A'}
                </span>
              </div>

              <div>
                <span className="text-zinc-500 block font-medium">Rule MPE Clause:</span>
                <span className="font-mono text-[11px] text-zinc-700 dark:text-zinc-300">
                  {calculatedResults.T03?.auditDetails?.mpe_clause || 'N/A'}
                </span>
              </div>
            </div>

            <div className="space-y-1">
              <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400">
                Remarks
              </label>
              <input
                type="text"
                value={t03Remarks}
                onChange={(e) => setT03Remarks(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg text-xs text-zinc-900 dark:text-zinc-100 bg-white dark:bg-zinc-800 border-zinc-300 dark:border-zinc-700"
              />
            </div>
          </div>

          {/* T04: Repeatability Test */}
          <div className="bg-white dark:bg-zinc-900 p-6 rounded-xl shadow-sm border border-zinc-200 dark:border-zinc-800 space-y-4">
            <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-3">
              <div>
                <span className="font-mono text-xs font-bold text-blue-600">T04</span>
                <h4 className="font-bold text-sm text-zinc-900 dark:text-zinc-100">
                  Repeatability Test (Clause 3.6.1; A.4.10)
                </h4>
              </div>
              <span
                className={`px-2.5 py-0.5 text-xs font-bold rounded-full ${
                  calculatedResults.T04?.result === 'PASS'
                    ? 'bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300'
                    : 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300'
                }`}
              >
                {calculatedResults.T04?.result || 'PENDING'}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 text-xs">
              <div className="space-y-1">
                <label className="block font-medium text-zinc-600 dark:text-zinc-400">
                  Repeatability Test Load ({engineInput.unit})
                </label>
                <input
                  type="number"
                  step="any"
                  value={t04Load}
                  onChange={(e) => setT04Load(Number(e.target.value))}
                  className="w-full px-3 py-2 border rounded-lg text-xs text-zinc-900 dark:text-zinc-100 bg-white dark:bg-zinc-800 border-zinc-300 dark:border-zinc-700 font-semibold"
                />
              </div>

              {t04Readings.map((reading, idx) => (
                <div key={idx} className="space-y-1">
                  <label className="block font-medium text-zinc-600 dark:text-zinc-400">
                    Reading {idx + 1} ({engineInput.unit})
                  </label>
                  <input
                    type="number"
                    step="any"
                    value={reading}
                    onChange={(e) => {
                      const updated = [...t04Readings];
                      updated[idx] = Number(e.target.value);
                      setT04Readings(updated);
                    }}
                    className="w-full px-3 py-2 border rounded-lg text-xs text-zinc-900 dark:text-zinc-100 bg-white dark:bg-zinc-800 border-zinc-300 dark:border-zinc-700"
                  />
                </div>
              ))}
            </div>

            <div className="flex items-center justify-between text-xs pt-1">
              <span className="font-mono text-zinc-700 dark:text-zinc-300">
                Calculated Range (Max - Min):{' '}
                <strong>
                  {calculatedResults.T04?.calculatedError !== null
                    ? `${calculatedResults.T04?.calculatedError} ${engineInput.unit}`
                    : 'N/A'}
                </strong>{' '}
                | DB MPE Limit:{' '}
                <strong>
                  {calculatedResults.T04?.mpeValue !== null
                    ? `${calculatedResults.T04?.mpeValue} ${engineInput.unit}`
                    : 'N/A'}
                </strong>
              </span>

              <button
                type="button"
                onClick={() => setT04Readings((prev) => [...prev, t04Load])}
                className="text-xs text-blue-600 font-medium hover:underline cursor-pointer"
              >
                + Add Reading
              </button>
            </div>

            <div className="space-y-1">
              <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400">
                Remarks
              </label>
              <input
                type="text"
                value={t04Remarks}
                onChange={(e) => setT04Remarks(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg text-xs text-zinc-900 dark:text-zinc-100 bg-white dark:bg-zinc-800 border-zinc-300 dark:border-zinc-700"
              />
            </div>
          </div>

          {/* T05: Eccentric Loading Test */}
          <div className="bg-white dark:bg-zinc-900 p-6 rounded-xl shadow-sm border border-zinc-200 dark:border-zinc-800 space-y-4">
            <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-3">
              <div>
                <span className="font-mono text-xs font-bold text-blue-600">T05</span>
                <h4 className="font-bold text-sm text-zinc-900 dark:text-zinc-100">
                  Eccentric Loading Test (Clause 3.6.2; A.4.7)
                </h4>
              </div>
              <span
                className={`px-2.5 py-0.5 text-xs font-bold rounded-full ${
                  calculatedResults.T05?.result === 'PASS'
                    ? 'bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300'
                    : 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300'
                }`}
              >
                {calculatedResults.T05?.result || 'PENDING'}
              </span>
            </div>

            <div className="space-y-1 max-w-xs">
              <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400">
                Eccentric Test Load ({engineInput.unit})
              </label>
              <input
                type="number"
                step="any"
                value={t05Load}
                onChange={(e) => setT05Load(Number(e.target.value))}
                className="w-full px-3 py-2 border rounded-lg text-xs text-zinc-900 dark:text-zinc-100 bg-white dark:bg-zinc-800 border-zinc-300 dark:border-zinc-700 font-semibold"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 text-xs">
              {Object.entries(t05Positions).map(([posKey, val]) => (
                <div key={posKey} className="space-y-1 p-2.5 bg-zinc-50 dark:bg-zinc-800/40 rounded-lg">
                  <label className="block font-medium text-zinc-700 dark:text-zinc-300">
                    {posKey}
                  </label>
                  <input
                    type="number"
                    step="any"
                    value={val}
                    onChange={(e) => {
                      const updated = { ...t05Positions, [posKey]: Number(e.target.value) };
                      setT05Positions(updated);
                    }}
                    className="w-full px-3 py-1.5 border rounded text-xs text-zinc-900 dark:text-zinc-100 bg-white dark:bg-zinc-800 border-zinc-300 dark:border-zinc-700 font-mono"
                  />
                </div>
              ))}
            </div>

            <div className="text-xs text-zinc-600 dark:text-zinc-400 font-mono">
              Max Absolute Eccentricity Error:{' '}
              <strong>
                {calculatedResults.T05?.absoluteError !== null
                  ? `${calculatedResults.T05?.absoluteError} ${engineInput.unit}`
                  : 'N/A'}
              </strong>{' '}
              | DB MPE Limit:{' '}
              <strong>
                {calculatedResults.T05?.mpeValue !== null
                  ? `+/- ${calculatedResults.T05?.mpeValue} ${engineInput.unit}`
                  : 'N/A'}
              </strong>
            </div>

            <div className="space-y-1">
              <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400">
                Remarks
              </label>
              <input
                type="text"
                value={t05Remarks}
                onChange={(e) => setT05Remarks(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg text-xs text-zinc-900 dark:text-zinc-100 bg-white dark:bg-zinc-800 border-zinc-300 dark:border-zinc-700"
              />
            </div>
          </div>

          {/* T06: Tare Accuracy Test (Conditional) */}
          {hasTare && (
            <div className="bg-white dark:bg-zinc-900 p-6 rounded-xl shadow-sm border border-zinc-200 dark:border-zinc-800 space-y-4">
              <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-3">
                <div>
                  <span className="font-mono text-xs font-bold text-blue-600">T06</span>
                  <h4 className="font-bold text-sm text-zinc-900 dark:text-zinc-100">
                    Tare Accuracy Test (Clause 4.6.3; A.4.6.2)
                  </h4>
                </div>
                <span
                  className={`px-2.5 py-0.5 text-xs font-bold rounded-full ${
                    calculatedResults.T06?.result === 'PASS'
                      ? 'bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300'
                      : 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300'
                  }`}
                >
                  {calculatedResults.T06?.result || 'PENDING'}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
                <div className="space-y-1">
                  <label className="block font-medium text-zinc-600 dark:text-zinc-400">
                    Tare Load ({engineInput.unit})
                  </label>
                  <input
                    type="number"
                    step="any"
                    value={t06TareLoad}
                    onChange={(e) => setT06TareLoad(Number(e.target.value))}
                    className="w-full px-3 py-2 border rounded-lg text-xs text-zinc-900 dark:text-zinc-100 bg-white dark:bg-zinc-800 border-zinc-300 dark:border-zinc-700"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block font-medium text-zinc-600 dark:text-zinc-400">
                    Gross Load ({engineInput.unit})
                  </label>
                  <input
                    type="number"
                    step="any"
                    value={t06GrossLoad}
                    onChange={(e) => setT06GrossLoad(Number(e.target.value))}
                    className="w-full px-3 py-2 border rounded-lg text-xs text-zinc-900 dark:text-zinc-100 bg-white dark:bg-zinc-800 border-zinc-300 dark:border-zinc-700"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block font-medium text-zinc-600 dark:text-zinc-400">
                    Net Indication Observed ({engineInput.unit})
                  </label>
                  <input
                    type="number"
                    step="any"
                    value={t06NetObserved}
                    onChange={(e) => setT06NetObserved(Number(e.target.value))}
                    className="w-full px-3 py-2 border rounded-lg text-xs text-zinc-900 dark:text-zinc-100 bg-white dark:bg-zinc-800 border-zinc-300 dark:border-zinc-700 font-semibold"
                  />
                </div>
              </div>

              <div className="text-xs text-zinc-600 dark:text-zinc-400 font-mono">
                Calculated Net Error:{' '}
                <strong>
                  {calculatedResults.T06?.calculatedError !== null
                    ? `${calculatedResults.T06?.calculatedError} ${engineInput.unit}`
                    : 'N/A'}
                </strong>{' '}
                | DB MPE Limit:{' '}
                <strong>
                  {calculatedResults.T06?.mpeValue !== null
                    ? `+/- ${calculatedResults.T06?.mpeValue} ${engineInput.unit}`
                    : 'N/A'}
                </strong>
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400">
                  Remarks
                </label>
                <input
                  type="text"
                  value={t06Remarks}
                  onChange={(e) => setT06Remarks(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg text-xs text-zinc-900 dark:text-zinc-100 bg-white dark:bg-zinc-800 border-zinc-300 dark:border-zinc-700"
                />
              </div>
            </div>
          )}

          <div className="flex items-center justify-between pt-4">
            <button
              type="button"
              onClick={() => setCurrentStep(3)}
              className="px-4 py-2 text-sm font-medium text-zinc-700 dark:text-zinc-300 bg-zinc-100 dark:bg-zinc-800 rounded-lg hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
            >
              ← Back
            </button>
            <button
              type="button"
              onClick={() => setCurrentStep(5)}
              className="px-5 py-2.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors cursor-pointer"
            >
              Review Audit Results →
            </button>
          </div>
        </div>
      )}

      {/* STEP 5: Review Calculated Audit Results */}
      {currentStep === 5 && (
        <div className="bg-white dark:bg-zinc-900 p-6 rounded-xl shadow-sm border border-zinc-200 dark:border-zinc-800 space-y-6">
          <div className="border-b border-zinc-100 dark:border-zinc-800 pb-4">
            <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
              <span>🔍</span> Step 5: Review Calculated Audit Results
            </h3>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
              Verify deterministic test outputs, MPE clause citations, and JSONB audit details.
            </p>
          </div>

          {/* Legal Notice */}
          <div className="p-4 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60 rounded-xl text-amber-900 dark:text-amber-200 text-xs space-y-1">
            <span className="font-bold block">⚠️ Core OIML R-76 Test Framework Evaluation</span>
            <p>
              This inspection is generated using the deterministic OIML R-76 / Indian Legal Metrology compliance engine.
            </p>
          </div>

          {/* Overall Calculated Result Banner */}
          <div className="p-4 bg-zinc-50 dark:bg-zinc-800/60 rounded-xl flex items-center justify-between">
            <div>
              <span className="text-xs text-zinc-500 block uppercase font-medium">
                Overall Calculated Preliminary Status
              </span>
              <span className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
                Rule Standard: {activeRuleSetObj?.standard} ({activeRuleSetObj?.version})
              </span>
            </div>

            <span
              className={`px-4 py-1.5 text-sm font-black rounded-full ${
                overallCalculatedResult === 'PASS'
                  ? 'bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300'
                  : overallCalculatedResult === 'FAIL'
                  ? 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300'
                  : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
              }`}
            >
              {overallCalculatedResult}
            </span>
          </div>

          {/* Test Audit Summary Table */}
          <div className="divide-y divide-zinc-200 dark:divide-zinc-800 border rounded-xl overflow-hidden text-xs">
            {Object.entries(calculatedResults).map(([code, res]) => (
              <div key={code} className="p-4 bg-zinc-50/50 dark:bg-zinc-800/30 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-blue-600 dark:text-blue-400">
                      {code}
                    </span>
                    <span className="font-semibold text-zinc-900 dark:text-zinc-100">
                      {res.method}
                    </span>
                  </div>

                  <span
                    className={`px-2.5 py-0.5 font-bold rounded-full text-xs ${
                      res.result === 'PASS'
                        ? 'bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300'
                        : res.result === 'FAIL'
                        ? 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300'
                        : 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400'
                    }`}
                  >
                    {res.result}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[11px] text-zinc-600 dark:text-zinc-400">
                  <div>
                    Error:{' '}
                    <strong>
                      {res.calculatedError !== null ? `${res.calculatedError} ${engineInput.unit}` : 'N/A'}
                    </strong>
                  </div>
                  <div>
                    MPE Limit:{' '}
                    <strong>
                      {res.mpeValue !== null ? `+/- ${res.mpeValue} ${engineInput.unit}` : 'N/A'}
                    </strong>
                  </div>
                  <div>
                    Clause:{' '}
                    <strong className="font-mono">
                      {res.auditDetails?.mpe_clause || 'N/A'}
                    </strong>
                  </div>
                </div>

                <p className="text-[11px] text-zinc-500 italic">{res.remarks}</p>
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between pt-4">
            <button
              type="button"
              onClick={() => setCurrentStep(4)}
              className="px-4 py-2 text-sm font-medium text-zinc-700 dark:text-zinc-300 bg-zinc-100 dark:bg-zinc-800 rounded-lg hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
            >
              ← Back to Tests
            </button>
            <button
              type="button"
              onClick={() => setCurrentStep(6)}
              className="px-5 py-2.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors cursor-pointer"
            >
              Continue to Finalize →
            </button>
          </div>
        </div>
      )}

      {/* STEP 6: Finalize & Save */}
      {currentStep === 6 && (
        <div className="bg-white dark:bg-zinc-900 p-6 rounded-xl shadow-sm border border-zinc-200 dark:border-zinc-800 space-y-6">
          <div className="border-b border-zinc-100 dark:border-zinc-800 pb-4">
            <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
              <span>💾</span> Step 6: Finalize &amp; Persist Inspection Record
            </h3>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
              Store inspection header with rule_set_id and auditable calculation_details JSONB in database.
            </p>
          </div>

          <div className="p-4 bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900/60 rounded-xl text-xs text-blue-900 dark:text-blue-200 space-y-2">
            <span className="font-bold block">Historical Audit Record Ready</span>
            <p>
              Saving this record will associate it with rule set version{' '}
              <strong>{activeRuleSetObj?.version}</strong> ({activeRuleSetObj?.standard}). If future rule amendments occur, this historical record will remain preserved and immutable.
            </p>
          </div>

          <div className="flex items-center justify-between pt-4">
            <button
              type="button"
              onClick={() => setCurrentStep(5)}
              className="px-4 py-2 text-sm font-medium text-zinc-700 dark:text-zinc-300 bg-zinc-100 dark:bg-zinc-800 rounded-lg hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
            >
              ← Back to Audit Review
            </button>
            <button
              type="button"
              disabled={submitting}
              onClick={handleSaveInspection}
              className="px-6 py-2.5 text-sm font-bold text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors cursor-pointer"
            >
              {submitting ? 'Saving Inspection Record...' : 'Finalize & Save Inspection Record'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
