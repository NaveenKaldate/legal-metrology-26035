// NOTE: the row shapes below are `type` aliases, not `interface`s, on purpose.
// The Supabase client requires each table's Row/Insert/Update to satisfy
// `Record<string, unknown>`. An interface has no implicit index signature and
// therefore does NOT satisfy it, which silently collapsed `Schema` to `never`
// and made every query fall back to `any`. Type aliases do get an implicit
// index signature, which restores end-to-end typing. Do not convert these back.

export type UserRole = 'ADMIN' | 'INSPECTOR';

export type InstrumentType = 'ELECTRONIC_WEIGHING' | 'PLATFORM_WEIGHING';

export type InstrumentStatus = 'ACTIVE' | 'INACTIVE' | 'UNDER_INSPECTION';

export type InspectionType = 'TYPE_EVALUATION' | 'INITIAL' | 'IN_SERVICE';

export type InspectionDataSource = 'SIMULATED' | 'FIELD';

export type InspectionOverallResult = 'PASS' | 'FAIL' | 'PENDING';

/**
 * Report lifecycle, separate from the compliance verdict.
 * overall_result answers "did the instrument comply".
 * report_status answers "has this report been issued".
 * A FAIL report is still issued, so these must never be merged.
 */
export type ReportStatus = 'DRAFT' | 'FINAL';

export type ReportAuditAction =
  | 'CREATED'
  | 'UPDATED'
  | 'FINALIZED'
  | 'FINALIZATION_REJECTED';

export type TestResult = 'PASS' | 'FAIL' | 'NOT_APPLICABLE' | 'PENDING';

export type RuleSetStatus = 'ACTIVE' | 'INACTIVE' | 'DRAFT' | 'ARCHIVED';

export type ApplicabilityType = 'REQUIRED' | 'OPTIONAL' | 'NOT_APPLICABLE' | 'CONDITIONAL';

export type Profile = {
  id: string;
  full_name: string | null;
  role: UserRole;
  created_at: string;
};

export type Instrument = {
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
};

export type RuleSet = {
  id: string;
  standard: string;
  version: string;
  jurisdiction: string;
  effective_from?: string | null;
  effective_to?: string | null;
  status: RuleSetStatus;
  description: string | null;
  created_at: string;
};

export type TestDefinition = {
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
};

export type TestApplicabilityRule = {
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
};

export type MpeRule = {
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
};

export type CalculationRule = {
  id: string;
  rule_set_id: string;
  test_definition_id?: string | null;
  calculation_code: string;
  formula: string;
  description?: string | null;
  created_at: string;
};

export type Inspection = {
  id: string;
  instrument_id: string;
  inspector_id: string;
  inspection_type: InspectionType;
  inspection_date: string;
  rule_version: string | null;
  rule_set_id: string | null;
  data_source: InspectionDataSource;
  overall_result: InspectionOverallResult;
  report_status: ReportStatus;
  finalized_at: string | null;
  finalized_by: string | null;
  verification_token: string | null;
  created_at: string;
};

export type ReportAuditEntry = {
  id: string;
  inspection_id: string;
  action: ReportAuditAction;
  performed_by: string | null;
  performed_at: string;
  metadata: Record<string, unknown> | null;
};

export type InspectionTest = {
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
};

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
        Insert: { id?: string; instrument_id: string; inspector_id: string; inspection_type: InspectionType; inspection_date?: string; rule_version?: string | null; rule_set_id?: string | null; data_source: InspectionDataSource; overall_result?: InspectionOverallResult; report_status?: ReportStatus; created_at?: string };
        Update: { id?: string; instrument_id?: string; inspector_id?: string; inspection_type?: InspectionType; inspection_date?: string; rule_version?: string | null; rule_set_id?: string | null; data_source?: InspectionDataSource; overall_result?: InspectionOverallResult; created_at?: string };
        Relationships: [];
      };
      report_audit_log: {
        Row: ReportAuditEntry;
        Insert: { id?: string; inspection_id: string; action: ReportAuditAction; performed_by?: string | null; performed_at?: string; metadata?: Record<string, unknown> | null };
        // Append-only: enforced in the database by RLS (no update/delete policy)
        // and the report_audit_log_no_update trigger. Typed as an empty object
        // rather than `never` because the Supabase client's schema constraint
        // requires an object shape here.
        Update: Record<string, never>;
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
    Functions: {
      /** Atomic DRAFT -> FINAL transition. Authorization and completeness are
       *  re-checked inside the database; see migration 20260911_phase8. */
      finalize_inspection: {
        Args: { p_inspection_id: string };
        Returns: {
          inspection_id: string;
          report_status: ReportStatus;
          finalized_at: string;
          verification_token: string;
        }[];
      };
      /** Public lookup by verification token. Returns only safe fields, and
       *  only for FINAL reports. */
      verify_report: {
        Args: { p_token: string };
        Returns: {
          report_reference: string;
          report_status: string;
          overall_result: string;
          inspection_type: string;
          inspection_date: string;
          finalized_at: string | null;
          instrument_manufacturer: string | null;
          instrument_model: string | null;
          instrument_serial: string | null;
          accuracy_class: string | null;
          rule_standard: string | null;
          rule_version: string | null;
        }[];
      };
      /** 'DRAFT' | 'FINAL' | 'NOT_FOUND' - status only, no report content. */
      verification_token_state: {
        Args: { p_token: string };
        Returns: string;
      };
    };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
};
