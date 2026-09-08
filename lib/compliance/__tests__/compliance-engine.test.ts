import assert from 'assert';
import { EngineInput } from '../types';
import { MpeRule } from '@/types/database';
import {
  calculateT03,
  calculateT04,
  calculateT06,
  calculateOverallResult,
} from '../calculation-engine';
import { getApplicableMPE } from '../mpe-engine';

console.log('====================================================');
console.log('RUNNING CORE OIML R-76 COMPLIANCE ENGINE UNIT TESTS');
console.log('====================================================\n');

// Mock MPE Rules (Class III OIML R-76 Table 1)
const mockMpeRules: MpeRule[] = [
  {
    id: 'mpe-1',
    rule_set_id: 'rs-oiml-r76-2006',
    accuracy_class: 'Class III',
    control_stage: 'INITIAL',
    lower_load_e: 0,
    upper_load_e: 500,
    mpe_multiplier: 0.5,
    mpe_unit: 'e',
    clause: 'OIML R-76-1 Table 1 (0 <= m <= 500e)',
    created_at: new Date().toISOString(),
  },
  {
    id: 'mpe-2',
    rule_set_id: 'rs-oiml-r76-2006',
    accuracy_class: 'Class III',
    control_stage: 'INITIAL',
    lower_load_e: 500,
    upper_load_e: 2000,
    mpe_multiplier: 1.0,
    mpe_unit: 'e',
    clause: 'OIML R-76-1 Table 1 (500e < m <= 2000e)',
    created_at: new Date().toISOString(),
  },
  {
    id: 'mpe-3',
    rule_set_id: 'rs-oiml-r76-2006',
    accuracy_class: 'Class III',
    control_stage: 'INITIAL',
    lower_load_e: 2000,
    upper_load_e: 10000,
    mpe_multiplier: 1.5,
    mpe_unit: 'e',
    clause: 'OIML R-76-1 Table 1 (2000e < m <= 10000e)',
    created_at: new Date().toISOString(),
  },
];

const mockInstrumentClassIII: EngineInput = {
  instrument_type: 'ELECTRONIC_WEIGHING',
  accuracy_class: 'Class III',
  max_capacity: 15,
  min_capacity: 0.1,
  verification_interval_e: 0.01, // e = 0.01 kg
  actual_interval_d: 0.01,
  unit: 'kg',
  has_tare: true,
  zero_configuration: 'NON_AUTOMATIC',
};

let passedCount = 0;
let totalCount = 0;

function runTest(name: string, fn: () => void) {
  totalCount++;
  try {
    fn();
    passedCount++;
    console.log(`✅ TEST ${totalCount}: ${name} - PASSED`);
  } catch (err: unknown) {
    console.error(`❌ TEST ${totalCount}: ${name} - FAILED`);
    console.error(err);
    process.exitCode = 1;
  }
}

// TEST 1: Class III, e=0.01kg, load=5kg (500e), MPE=0.5e (0.005kg), Error=0.004kg -> PASS
runTest('Class III 5kg load, error 0.004kg within MPE (0.005kg) -> PASS', () => {
  const result = calculateT03(
    'DIRECT',
    5.0, // load 5kg (500e)
    5.004, // observed 5.004kg (error = +0.004kg)
    null,
    'rs-oiml-r76-2006',
    mockInstrumentClassIII,
    mockMpeRules,
    'INITIAL'
  );

  assert.strictEqual(result.result, 'PASS');
  assert(Math.abs((result.calculatedError ?? 0) - 0.004) < 1e-6, `Expected error 0.004, got ${result.calculatedError}`);
  assert.strictEqual(result.mpeValue, 0.005);
});

// TEST 2: Class III, e=0.01kg, load=5kg, Error=0.006kg exceeds MPE (0.005kg) -> FAIL
runTest('Class III 5kg load, error 0.006kg exceeds MPE (0.005kg) -> FAIL', () => {
  const result = calculateT03(
    'DIRECT',
    5.0, // load 5kg
    5.006, // observed 5.006kg (error = +0.006kg)
    null,
    'rs-oiml-r76-2006',
    mockInstrumentClassIII,
    mockMpeRules,
    'INITIAL'
  );

  assert.strictEqual(result.result, 'FAIL');
  assert(Math.abs((result.calculatedError ?? 0) - 0.006) < 1e-6, `Expected error 0.006, got ${result.calculatedError}`);
  assert.strictEqual(result.mpeValue, 0.005);
});

// TEST 3: Repeatability readings [10.00, 10.02, 10.01] -> Range 0.02kg
runTest('Repeatability test calculation with readings [10.00, 10.02, 10.01]', () => {
  const result = calculateT04(
    10.0,
    [10.00, 10.02, 10.01],
    'rs-oiml-r76-2006',
    mockInstrumentClassIII,
    mockMpeRules,
    'INITIAL'
  );

  assert(Math.abs((result.calculatedError ?? 0) - 0.02) < 1e-6, `Expected error 0.02, got ${result.calculatedError}`);
  assert(Math.abs((result.absoluteError ?? 0) - 0.02) < 1e-6, `Expected absolute error 0.02, got ${result.absoluteError}`);
  // Load 10kg = 1000e -> MPE is 1.0e = 0.01kg. Error 0.02kg > 0.01kg -> FAIL
  assert.strictEqual(result.mpeValue, 0.01);
  assert.strictEqual(result.result, 'FAIL');
});

// TEST 4: Invalid/missing e -> PENDING / INVALID INPUT
runTest('Missing verification interval e -> PENDING status', () => {
  const invalidInstrument = { ...mockInstrumentClassIII, verification_interval_e: 0 };
  const mpeEval = getApplicableMPE(
    'rs-oiml-r76-2006',
    'Class III',
    'INITIAL',
    5.0,
    invalidInstrument.verification_interval_e,
    mockMpeRules
  );

  assert.strictEqual(mpeEval.status, 'PENDING');
  assert.strictEqual(mpeEval.reason, 'Verification interval e is missing or invalid.');
});

// TEST 5: Instrument without tare device -> T06 NOT_APPLICABLE
runTest('Instrument without tare device -> T06 NOT_APPLICABLE', () => {
  const noTareInstrument = { ...mockInstrumentClassIII, has_tare: false };
  const result = calculateT06(
    2.0,
    10.0,
    8.0,
    'rs-oiml-r76-2006',
    noTareInstrument,
    mockMpeRules,
    'INITIAL'
  );

  assert.strictEqual(result.result, 'NOT_APPLICABLE');
  assert.strictEqual(result.mpeValue, null);
});

// TEST 6: Overall Result: Required test fails -> overall FAIL
runTest('Overall result calculation: any required test FAIL -> FAIL', () => {
  const tests = [
    { testCode: 'T01', applicability: 'REQUIRED', result: 'PASS' as const },
    { testCode: 'T02', applicability: 'REQUIRED', result: 'PASS' as const },
    { testCode: 'T03', applicability: 'REQUIRED', result: 'FAIL' as const },
    { testCode: 'T04', applicability: 'REQUIRED', result: 'PASS' as const },
    { testCode: 'T06', applicability: 'NOT_APPLICABLE', result: 'NOT_APPLICABLE' as const },
  ];

  const overall = calculateOverallResult(tests);
  assert.strictEqual(overall, 'FAIL');
});

// TEST 7: Overall Result: Required test incomplete -> overall PENDING
runTest('Overall result calculation: required test PENDING -> PENDING', () => {
  const tests = [
    { testCode: 'T01', applicability: 'REQUIRED', result: 'PASS' as const },
    { testCode: 'T02', applicability: 'REQUIRED', result: 'PENDING' as const },
    { testCode: 'T03', applicability: 'REQUIRED', result: 'PASS' as const },
  ];

  const overall = calculateOverallResult(tests);
  assert.strictEqual(overall, 'PENDING');
});

// TEST 8: Overall Result: All required tests pass -> overall PASS
runTest('Overall result calculation: all required tests PASS -> PASS', () => {
  const tests = [
    { testCode: 'T01', applicability: 'REQUIRED', result: 'PASS' as const },
    { testCode: 'T02', applicability: 'REQUIRED', result: 'PASS' as const },
    { testCode: 'T03', applicability: 'REQUIRED', result: 'PASS' as const },
    { testCode: 'T04', applicability: 'REQUIRED', result: 'PASS' as const },
    { testCode: 'T05', applicability: 'REQUIRED', result: 'PASS' as const },
    { testCode: 'T06', applicability: 'NOT_APPLICABLE', result: 'NOT_APPLICABLE' as const },
  ];

  const overall = calculateOverallResult(tests);
  assert.strictEqual(overall, 'PASS');
});

// TEST 9: Empty ruleSetId -> clear error "No rule set selected."
runTest('fetchLoadedRuleSet with empty ruleSetId -> clear error message', async () => {
  const dummySupabase = {
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }) }) }),
  };
  try {
    const { fetchLoadedRuleSet } = await import('../rule-engine');
    await fetchLoadedRuleSet(dummySupabase, '');
    assert.fail('Should have thrown an error');
  } catch (err: unknown) {
    assert(err instanceof Error);
    assert.strictEqual(
      err.message,
      'No rule set selected. Please return to Step 1 and select an active rule set.'
    );
  }
});

// TEST 10: Non-existent ruleSetId -> "Selected rule set could not be found." NOT "Cannot coerce"
runTest('fetchLoadedRuleSet with non-existent UUID -> "Selected rule set could not be found."', async () => {
  const dummySupabase = {
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({ data: null, error: null }),
          in: () => async () => ({ data: [], error: null }),
        }),
      }),
    }),
  };
  try {
    const { fetchLoadedRuleSet } = await import('../rule-engine');
    await fetchLoadedRuleSet(dummySupabase, '99999999-9999-9999-9999-999999999999');
    assert.fail('Should have thrown an error');
  } catch (err: unknown) {
    assert(err instanceof Error);
    assert.strictEqual(err.message, 'Selected rule set could not be found.');
  }
});

// TEST 11: Valid OIML R-76 rule set ID -> loads OIML R-76 standard & 6 test definitions
runTest('fetchLoadedRuleSet with OIML R-76 ID -> loads standard OIML R-76', async () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mockQuery: any = {
    maybeSingle: async () => ({ data: null, error: null }),
    eq: () => mockQuery,
    order: async () => ({ data: [], error: null }),
    in: () => async () => ({ data: [], error: null }),
  };
  const dummySupabase = {
    from: () => ({
      select: () => mockQuery,
    }),
  };
  const { fetchLoadedRuleSet } = await import('../rule-engine');
  const loaded = await fetchLoadedRuleSet(dummySupabase, '22222222-2222-2222-2222-222222222222');
  assert.strictEqual(loaded.ruleSet.standard, 'OIML R-76');
  assert.strictEqual(loaded.ruleSet.version, '2006');
  assert.strictEqual(loaded.testDefinitions.length, 6);
  assert.strictEqual(loaded.mpeRules.length, 6);
});

console.log(`\n====================================================`);
console.log(`SUMMARY: ${passedCount} / ${totalCount} TESTS PASSED`);
console.log(`====================================================`);
