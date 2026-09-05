import { TestDefinition, TestApplicabilityRule, ApplicabilityType } from '@/types/database';
import { EngineInput, TestPlanItem } from './types';

export function evaluateTestApplicability(
  testDef: TestDefinition,
  rules: TestApplicabilityRule[],
  instrument: EngineInput
): TestPlanItem {
  // Find matching applicability rules for this test definition
  const matchingRules = rules.filter((r) => r.test_definition_id === testDef.id);

  let finalApplicability: ApplicabilityType = 'REQUIRED';
  let reason = `Standard test under ${testDef.clause}`;

  // Evaluate T06 Tare Accuracy specific condition
  if (testDef.test_code === 'T06') {
    if (instrument.has_tare === false) {
      return {
        testDefinition: testDef,
        applicability: 'NOT_APPLICABLE',
        reason: 'Instrument is not equipped with a tare device.',
        isExecutable: false,
      };
    } else {
      return {
        testDefinition: testDef,
        applicability: 'REQUIRED',
        reason: 'Instrument is equipped with a tare device (Clause 4.6.3; A.4.6.2).',
        isExecutable: true,
      };
    }
  }

  // Check matching rules from database
  if (matchingRules.length > 0) {
    const specificRule = matchingRules.find(
      (r) =>
        (r.instrument_type === null || r.instrument_type === instrument.instrument_type) &&
        (r.accuracy_class === null || r.accuracy_class === instrument.accuracy_class)
    );

    if (specificRule) {
      finalApplicability = specificRule.applicability;
      if (specificRule.reason) reason = specificRule.reason;
    }
  }

  const isExecutable = finalApplicability === 'REQUIRED' || finalApplicability === 'OPTIONAL';

  return {
    testDefinition: testDef,
    applicability: finalApplicability,
    reason,
    isExecutable,
  };
}

