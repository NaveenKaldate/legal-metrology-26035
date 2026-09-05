export type UserRole = 'ADMIN' | 'INSPECTOR';

export type InstrumentType = 'ELECTRONIC_WEIGHING' | 'PLATFORM_WEIGHING';

export type InstrumentStatus = 'ACTIVE' | 'INACTIVE' | 'UNDER_INSPECTION';

export type InspectionType = 'TYPE_EVALUATION' | 'INITIAL' | 'IN_SERVICE';

export type InspectionDataSource = 'SIMULATED' | 'FIELD';

export type InspectionOverallResult = 'PASS' | 'FAIL' | 'PENDING';

export type TestResult = 'PASS' | 'FAIL' | 'NOT_APPLICABLE' | 'PENDING';

export type RuleSetStatus = 'ACTIVE' | 'INACTIVE' | 'DRAFT' | 'ARCHIVED';

export type ApplicabilityType = 'REQUIRED' | 'OPTIONAL' | 'NOT_APPLICABLE' | 'CONDITIONAL';

export interface Profile {
  id: string;
  full_name: string | null;
  role: UserRole;
  created_at: string;
}

export interface Instrument {
  id: string;
  instrument_type: InstrumentType;
  manufacturer: string | null;
  model: string | null;
  serial_number: string | null;
  accuracy_class: string | null;
  max_capacity: number | null;
  min_capacity: number | null;
  verification_interval_e: number | null;
  actual_interval_d: number | null;
  unit: string | null;
  status: InstrumentStatus;
  created_at: string;
}

export interface RuleSet {
  id: string;
  standard: string;
  version: string;
  jurisdiction: string;
  effective_from?: string | null;
  effective_to?: string | null;
  status: RuleSetStatus;
  description: string | null;
  created_at: string;
}

export interface TestDefinition {
  id: string;
  rule_set_id: string;
  test_code: string;
  name: string;
  description: string | null;
  clause: string;
  category: string;
  sequence: number;
  is_active: boolean;
  created_at: string;
}

export interface TestApplicabilityRule {
  id: string;
  test_definition_id: string;
  instrument_type?: string | null;
  accuracy_class?: string | null;
  is_electronic?: boolean | null;
  indication_type?: string | null;
  has_tare?: boolean | null;
  is_mobile?: boolean | null;
  load_receptor_type?: string | null;
  applicability: ApplicabilityType;
  reason?: string | null;
  created_at: string;
}

export interface MpeRule {
  id: string;
  rule_set_id: string;
  accuracy_class: string;
  control_stage: InspectionType;
  lower_load_e: number;
  upper_load_e?: number | null;
  mpe_multiplier: number;
  mpe_unit: string;
  clause?: string | null;
  created_at: string;
}

export interface CalculationRule {
  id: string;
  rule_set_id: string;
  test_definition_id?: string | null;
  calculation_code: string;
  formula: string;
  description?: string | null;
  created_at: string;
}

export interface Inspection {
  id: string;
  instrument_id: string;
  inspector_id: string;
  inspection_type: InspectionType;
  inspection_date: string;
  rule_version: string | null;
  rule_set_id: string | null;
  data_source: InspectionDataSource;
  overall_result: InspectionOverallResult;
  created_at: string;
}

export interface InspectionTest {
  id: string;
  inspection_id: string;
  test_definition_id?: string | null;
  test_type: string;
  test_sequence?: number;
  test_status?: string;
  test_load: number | null;
  reference_value: number | null;
  observed_value: number | null;
  calculated_error?: number | null;
  absolute_error?: number | null;
  error: number | null;
  mpe: number | null;
  mpe_rule_id?: string | null;
  calculation_method?: string | null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  calculation_details?: Record<string, any> | null;
  result: TestResult;
  remarks: string | null;
  created_at: string;
}

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: Profile;
        Insert: { id: string; full_name?: string | null; role?: UserRole; created_at?: string };
        Update: { id?: string; full_name?: string | null; role?: UserRole; created_at?: string };
        Relationships: [];
      };
      instruments: {
        Row: Instrument;
        Insert: { id?: string; instrument_type: InstrumentType; manufacturer?: string | null; model?: string | null; serial_number?: string | null; accuracy_class?: string | null; max_capacity?: number | null; min_capacity?: number | null; verification_interval_e?: number | null; actual_interval_d?: number | null; unit?: string | null; status?: InstrumentStatus; created_at?: string };
        Update: { id?: string; instrument_type?: InstrumentType; manufacturer?: string | null; model?: string | null; serial_number?: string | null; accuracy_class?: string | null; max_capacity?: number | null; min_capacity?: number | null; verification_interval_e?: number | null; actual_interval_d?: number | null; unit?: string | null; status?: InstrumentStatus; created_at?: string };
        Relationships: [];
      };
      rule_sets: {
        Row: RuleSet;
        Insert: { id?: string; standard: string; version: string; jurisdiction: string; effective_from?: string | null; effective_to?: string | null; status?: RuleSetStatus; description?: string | null; created_at?: string };
        Update: { id?: string; standard?: string; version?: string; jurisdiction?: string; effective_from?: string | null; effective_to?: string | null; status?: RuleSetStatus; description?: string | null; created_at?: string };
        Relationships: [];
      };
      test_definitions: {
        Row: TestDefinition;
        Insert: { id?: string; rule_set_id: string; test_code: string; name: string; description?: string | null; clause: string; category?: string; sequence?: number; is_active?: boolean; created_at?: string };
        Update: { id?: string; rule_set_id?: string; test_code?: string; name?: string; description?: string | null; clause?: string; category?: string; sequence?: number; is_active?: boolean; created_at?: string };
        Relationships: [];
      };
      test_applicability_rules: {
        Row: TestApplicabilityRule;
        Insert: { id?: string; test_definition_id: string; instrument_type?: string | null; accuracy_class?: string | null; is_electronic?: boolean | null; indication_type?: string | null; has_tare?: boolean | null; is_mobile?: boolean | null; load_receptor_type?: string | null; applicability: ApplicabilityType; reason?: string | null; created_at?: string };
        Update: { id?: string; test_definition_id?: string; instrument_type?: string | null; accuracy_class?: string | null; is_electronic?: boolean | null; indication_type?: string | null; has_tare?: boolean | null; is_mobile?: boolean | null; load_receptor_type?: string | null; applicability?: ApplicabilityType; reason?: string | null; created_at?: string };
        Relationships: [];
      };
      mpe_rules: {
        Row: MpeRule;
        Insert: { id?: string; rule_set_id: string; accuracy_class: string; control_stage?: InspectionType; lower_load_e: number; upper_load_e?: number | null; mpe_multiplier: number; mpe_unit?: string; clause?: string | null; created_at?: string };
        Update: { id?: string; rule_set_id?: string; accuracy_class?: string; control_stage?: InspectionType; lower_load_e?: number; upper_load_e?: number | null; mpe_multiplier?: number; mpe_unit?: string; clause?: string | null; created_at?: string };
        Relationships: [];
      };
      calculation_rules: {
        Row: CalculationRule;
        Insert: { id?: string; rule_set_id: string; test_definition_id?: string | null; calculation_code: string; formula: string; description?: string | null; created_at?: string };
        Update: { id?: string; rule_set_id?: string; test_definition_id?: string | null; calculation_code?: string; formula?: string; description?: string | null; created_at?: string };
        Relationships: [];
      };
      inspections: {
        Row: Inspection;
        Insert: { id?: string; instrument_id: string; inspector_id: string; inspection_type: InspectionType; inspection_date?: string; rule_version?: string | null; rule_set_id?: string | null; data_source: InspectionDataSource; overall_result?: InspectionOverallResult; created_at?: string };
        Update: { id?: string; instrument_id?: string; inspector_id?: string; inspection_type?: InspectionType; inspection_date?: string; rule_version?: string | null; rule_set_id?: string | null; data_source?: InspectionDataSource; overall_result?: InspectionOverallResult; created_at?: string };
        Relationships: [];
      };
      inspection_tests: {
        Row: InspectionTest;
        Insert: { id?: string; inspection_id: string; test_definition_id?: string | null; test_type: string; test_sequence?: number; test_status?: string; test_load?: number | null; reference_value?: number | null; observed_value?: number | null; calculated_error?: number | null; absolute_error?: number | null; error?: number | null; mpe?: number | null; mpe_rule_id?: string | null; calculation_method?: string | null; calculation_details?: Record<string, unknown> | null; result: TestResult; remarks?: string | null; created_at?: string };
        Update: { id?: string; inspection_id?: string; test_definition_id?: string | null; test_type?: string; test_sequence?: number; test_status?: string; test_load?: number | null; reference_value?: number | null; observed_value?: number | null; calculated_error?: number | null; absolute_error?: number | null; error?: number | null; mpe?: number | null; mpe_rule_id?: string | null; calculation_method?: string | null; calculation_details?: Record<string, unknown> | null; result?: TestResult; remarks?: string | null; created_at?: string };
        Relationships: [];
      };
    };
    Views: { [_ in never]: never };
    Functions: { [_ in never]: never };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
};
