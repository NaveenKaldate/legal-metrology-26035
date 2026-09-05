import { MpeRule, InspectionType } from '@/types/database';
import { MpeEvaluationResult } from './types';

/**
 * Database-Driven MPE Engine
 * Performs exact load-range lookup in terms of e for given accuracy class, control stage, and test load.
 */
export function getApplicableMPE(
  ruleSetId: string | null | undefined,
  accuracyClass: string | null | undefined,
  controlStage: InspectionType | null | undefined,
  testLoad: number | null | undefined,
  verificationIntervalE: number | null | undefined,
  mpeRules: MpeRule[]
): MpeEvaluationResult {
  if (!ruleSetId) {
    return {
      mpeRule: null,
      mpeValue: null,
      mpeInE: null,
      mpeRuleId: null,
      clause: null,
      stage: controlStage || 'INITIAL',
      status: 'PENDING',
      reason: 'Rule set is missing.',
    };
  }

  if (!accuracyClass) {
    return {
      mpeRule: null,
      mpeValue: null,
      mpeInE: null,
      mpeRuleId: null,
      clause: null,
      stage: controlStage || 'INITIAL',
      status: 'PENDING',
      reason: 'Accuracy class is missing.',
    };
  }

  if (
    verificationIntervalE === null ||
    verificationIntervalE === undefined ||
    verificationIntervalE <= 0 ||
    isNaN(verificationIntervalE)
  ) {
    return {
      mpeRule: null,
      mpeValue: null,
      mpeInE: null,
      mpeRuleId: null,
      clause: null,
      stage: controlStage || 'INITIAL',
      status: 'PENDING',
      reason: 'Verification interval e is missing or invalid.',
    };
  }

  if (testLoad === null || testLoad === undefined || isNaN(testLoad)) {
    return {
      mpeRule: null,
      mpeValue: null,
      mpeInE: null,
      mpeRuleId: null,
      clause: null,
      stage: controlStage || 'INITIAL',
      status: 'PENDING',
      reason: 'Test load is missing.',
    };
  }

  const stage = controlStage || 'INITIAL';
  const numberOfIntervals = Math.abs(testLoad) / verificationIntervalE;

  // Query mpe_rules matrix matching rule_set_id, accuracy_class, and control_stage
  const matchingRule = mpeRules.find((rule) => {
    if (rule.rule_set_id !== ruleSetId) return false;
    if (rule.accuracy_class !== accuracyClass) return false;
    if (rule.control_stage !== stage) return false;

    const lowerMatch = numberOfIntervals >= rule.lower_load_e;
    const upperMatch =
      rule.upper_load_e === null || rule.upper_load_e === undefined
        ? true
        : numberOfIntervals <= rule.upper_load_e;

    return lowerMatch && upperMatch;
  });

  if (!matchingRule) {
    return {
      mpeRule: null,
      mpeValue: null,
      mpeInE: null,
      mpeRuleId: null,
      clause: null,
      stage,
      status: 'PENDING',
      reason: `Applicable MPE rule not found for Class ${accuracyClass} at ${numberOfIntervals}e (${stage}).`,
    };
  }

  // Exact unrounded MPE calculation
  const mpeValue = matchingRule.mpe_multiplier * verificationIntervalE;

  return {
    mpeRule: matchingRule,
    mpeValue,
    mpeInE: matchingRule.mpe_multiplier,
    mpeRuleId: matchingRule.id,
    clause: matchingRule.clause || null,
    stage,
    status: 'SUCCESS',
  };
}

/**
 * Backward-compatible helper wrapping getApplicableMPE
 */
export function evaluateMpe(
  mpeRules: MpeRule[],
  accuracyClass: string,
  controlStage: InspectionType,
  load: number | null,
  verificationIntervalE: number | null
): MpeEvaluationResult {
  const ruleSetId = mpeRules[0]?.rule_set_id || null;
  return getApplicableMPE(
    ruleSetId,
    accuracyClass,
    controlStage,
    load,
    verificationIntervalE,
    mpeRules
  );
}
