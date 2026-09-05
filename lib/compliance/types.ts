import {
  RuleSet,
  TestDefinition,
  MpeRule,
  ApplicabilityType,
  InspectionType,
  TestResult,
} from '@/types/database';

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
}

export interface MpeEvaluationResult {
  mpeRule: MpeRule | null;
  mpeValue: number | null; // physical unit value (e.g. in kg/g)
  mpeInE: number | null; // e.g. 0.5, 1.0, 1.5, 2.0, 3.0
  clause: string | null;
  stage: InspectionType;
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;
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

