import {
  RuleSet,
  TestDefinition,
  MpeRule,
  ApplicabilityType,
  InspectionType,
  TestResult,
} from '@/types/database';
import type { Decimal } from './decimal';

/**
 * Machine-readable reason a calculation could not produce a verdict.
 * The UI maps these to actionable messages; the text in `reason` is the
 * human-facing fallback.
 */
export type PendingReasonCode =
  | 'MISSING_RULE_SET'
  | 'MISSING_ACCURACY_CLASS'
  | 'INVALID_E'
  | 'MISSING_TEST_LOAD'
  | 'MISSING_OBSERVED_VALUE'
  | 'NO_RULES_FOR_STAGE'
  | 'NO_APPLICABLE_RULE'
  | 'AMBIGUOUS_RULES'
  | 'LOAD_OUT_OF_RANGE'
  | 'INSUFFICIENT_READINGS'
  | 'CHECKLIST_INCOMPLETE'
  | 'PROCEDURE_NOT_CONFIGURED';

export interface EngineInput {
  instrument_type: 'ELECTRONIC_WEIGHING' | 'PLATFORM_WEIGHING';
  accuracy_class: string; // e.g. 'Class I', 'Class II', 'Class III', 'Class IIII'
  max_capacity: number;
  min_capacity: number;
  verification_interval_e: number;
  actual_interval_d: number;
  unit: string;
  is_electronic?: boolean;
  indication_type?: string;
  has_tare?: boolean;
  is_mobile?: boolean;
  load_receptor_type?: string;
  support_count?: number;
  zero_configuration?: 'NON_AUTOMATIC' | 'SEMI_AUTOMATIC' | 'AUTOMATIC' | 'ZERO_TRACKING';
}

export interface MpeEvaluationResult {
  mpeRule: MpeRule | null;
  mpeValue: number | null; // physical unit value (e.g. in kg/g)
  /** Exact MPE for compliance comparisons. Never compare using mpeValue. */
  mpeValueDecimal?: Decimal | null;
  mpeInE: number | null; // e.g. 0.5, 1.0, 1.5, 2.0, 3.0
  mpeRuleId: string | null;
  clause: string | null;
  stage: InspectionType;
  status: 'SUCCESS' | 'PENDING';
  reason?: string;
  reasonCode?: PendingReasonCode;
  /** Test load expressed in verification intervals, for audit display. */
  loadInE?: number | null;
}

export interface AuditDetails {
  method: string;
  test_code: string;
  load?: number | null;
  observed?: number | null;
  reference?: number | null;
  verification_interval_e?: number | null;
  load_in_e?: number | null;
  delta_l?: number | null;
  calculated_indication?: number | null;
  calculated_error?: number | null;
  absolute_error?: number | null;
  mpe_value?: number | null;
  mpe_in_e?: number | null;
  mpe_clause?: string | null;
  readings?: number[];
  eccentric_positions?: Record<string, number>;
  checklist?: Record<string, boolean>;
  reason?: string;
  inputs?: Record<string, unknown>;
  outputs?: Record<string, unknown>;
  formula?: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;
}

export interface ComplianceResult {
  testCode: string;
  testDefinitionId: string;
  applicability: ApplicabilityType;
  status: TestResult;
  calculation?: {
    method?: string;
    inputs?: Record<string, unknown>;
    outputs?: Record<string, unknown>;
    formula?: string;
  };
  calculatedError: number | null;
  absoluteError: number | null;
  mpe: number | null;
  mpeRuleId: string | null;
  reason?: string;
  reasonCode?: PendingReasonCode;
  ruleSetId: string;
  ruleVersion: string;
  auditDetails: AuditDetails;
  remarks: string;
}

export interface TestCalculationResult {
  testCode: string;
  result: TestResult;
  calculatedError: number | null;
  absoluteError: number | null;
  mpeValue: number | null;
  mpeRuleId: string | null;
  method: string;
  auditDetails: AuditDetails;
  remarks: string;
  reason?: string;
  reasonCode?: PendingReasonCode;
}

export interface TestPlanItem {
  testDefinition: TestDefinition;
  applicability: ApplicabilityType;
  reason: string;
  isExecutable: boolean;
}

export interface InspectionPlan {
  ruleSet: RuleSet;
  controlStage: InspectionType;
  instrument: EngineInput;
  testItems: TestPlanItem[];
}
