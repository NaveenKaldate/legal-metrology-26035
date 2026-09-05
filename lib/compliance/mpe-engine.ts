import { MpeRule, InspectionType } from '@/types/database';
import { MpeEvaluationResult } from './types';

/**
 * Deterministic MPE Engine
 * Queries DB-driven MPE rule matrix for given accuracy class, control stage, and load (in e).
 */
export function evaluateMpe(
  mpeRules: MpeRule[],
  accuracyClass: string,
  controlStage: InspectionType,
  load: number | null,
  verificationIntervalE: number | null
): MpeEvaluationResult {
  if (
    load === null ||
    load === undefined ||
    verificationIntervalE === null ||
    verificationIntervalE === undefined ||
    verificationIntervalE <= 0
  ) {
    return {
      mpeRule: null,
      mpeValue: null,
      mpeInE: null,
      clause: null,
      stage: controlStage,
    };
  }

  const loadInE = Math.abs(load) / verificationIntervalE;

  // Filter matching rules by accuracy class and control stage
  const matchingRule = mpeRules.find((rule) => {
    if (rule.accuracy_class !== accuracyClass) return false;
    if (rule.control_stage !== controlStage) return false;
    const lowerMatch = loadInE >= rule.lower_load_e;
    const upperMatch =
      rule.upper_load_e === null || rule.upper_load_e === undefined
        ? true
        : loadInE <= rule.upper_load_e;
    return lowerMatch && upperMatch;
  });

  if (!matchingRule) {
    return {
      mpeRule: null,
      mpeValue: null,
      mpeInE: null,
      clause: null,
      stage: controlStage,
    };
  }

  const mpeValue = Number((matchingRule.mpe_multiplier * verificationIntervalE).toFixed(6));

  return {
    mpeRule: matchingRule,
    mpeValue,
    mpeInE: matchingRule.mpe_multiplier,
    clause: matchingRule.clause || null,
    stage: controlStage,
  };
}

