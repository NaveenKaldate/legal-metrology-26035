import { InspectionType } from '@/types/database';
import { EngineInput, InspectionPlan, TestPlanItem } from './types';
import { LoadedRuleSet } from './rule-engine';
import { evaluateTestApplicability } from './applicability-engine';

export function generateInspectionPlan(
  loadedRuleSet: LoadedRuleSet,
  controlStage: InspectionType,
  instrument: EngineInput
): InspectionPlan {
  const testItems: TestPlanItem[] = loadedRuleSet.testDefinitions.map((testDef) => {
    return evaluateTestApplicability(testDef, loadedRuleSet.applicabilityRules, instrument);
  });

  return {
    ruleSet: loadedRuleSet.ruleSet,
    controlStage,
    instrument,
    testItems,
  };
}

