-- SIH 2026 Problem Statement 26035 - Phase 1 & Phase 3B PostgreSQL Database Schema
-- Run this script in your Supabase SQL Editor to create tables, triggers, rule sets, and RLS policies.

-- 1. Create PROFILES Table
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  role TEXT NOT NULL DEFAULT 'INSPECTOR' CHECK (role IN ('ADMIN', 'INSPECTOR')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Create INSTRUMENTS Table
CREATE TABLE IF NOT EXISTS public.instruments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  instrument_type TEXT NOT NULL CHECK (instrument_type IN ('ELECTRONIC_WEIGHING', 'PLATFORM_WEIGHING')),
  manufacturer TEXT,
  model TEXT,
  serial_number TEXT UNIQUE,
  accuracy_class TEXT,
  max_capacity NUMERIC,
  min_capacity NUMERIC,
  verification_interval_e NUMERIC,
  actual_interval_d NUMERIC,
  unit TEXT,
  status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE', 'UNDER_INSPECTION')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. PHASE 3B: RULE ENGINE TABLES

-- 3A. RULE_SETS Table
CREATE TABLE IF NOT EXISTS public.rule_sets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  standard TEXT NOT NULL,
  version TEXT NOT NULL,
  jurisdiction TEXT NOT NULL,
  effective_from DATE DEFAULT CURRENT_DATE,
  effective_to DATE,
  status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE', 'DRAFT', 'ARCHIVED')),
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT rule_sets_unique_std_ver_juris UNIQUE (standard, version, jurisdiction)
);

-- 3B. TEST_DEFINITIONS Table
CREATE TABLE IF NOT EXISTS public.test_definitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_set_id UUID NOT NULL REFERENCES public.rule_sets(id) ON DELETE CASCADE,
  test_code TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  clause TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'METROLOGICAL',
  sequence INT NOT NULL DEFAULT 1,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT test_def_unique_ruleset_code UNIQUE (rule_set_id, test_code)
);

-- 3C. TEST_APPLICABILITY_RULES Table
CREATE TABLE IF NOT EXISTS public.test_applicability_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  test_definition_id UUID NOT NULL REFERENCES public.test_definitions(id) ON DELETE CASCADE,
  instrument_type TEXT,
  accuracy_class TEXT,
  is_electronic BOOLEAN,
  indication_type TEXT,
  has_tare BOOLEAN,
  is_mobile BOOLEAN,
  load_receptor_type TEXT,
  applicability TEXT NOT NULL CHECK (applicability IN ('REQUIRED', 'OPTIONAL', 'NOT_APPLICABLE', 'CONDITIONAL')),
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3D. MPE_RULES Table
CREATE TABLE IF NOT EXISTS public.mpe_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_set_id UUID NOT NULL REFERENCES public.rule_sets(id) ON DELETE CASCADE,
  accuracy_class TEXT NOT NULL CHECK (accuracy_class IN ('Class I', 'Class II', 'Class III', 'Class IIII')),
  control_stage TEXT NOT NULL DEFAULT 'INITIAL' CHECK (control_stage IN ('TYPE_EVALUATION', 'INITIAL', 'IN_SERVICE')),
  lower_load_e NUMERIC NOT NULL,
  upper_load_e NUMERIC,
  mpe_multiplier NUMERIC NOT NULL,
  mpe_unit TEXT NOT NULL DEFAULT 'e',
  clause TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3E. CALCULATION_RULES Table
CREATE TABLE IF NOT EXISTS public.calculation_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_set_id UUID NOT NULL REFERENCES public.rule_sets(id) ON DELETE CASCADE,
  test_definition_id UUID REFERENCES public.test_definitions(id) ON DELETE CASCADE,
  calculation_code TEXT NOT NULL,
  formula TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. Create INSPECTIONS Table
CREATE TABLE IF NOT EXISTS public.inspections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  instrument_id UUID NOT NULL REFERENCES public.instruments(id) ON DELETE CASCADE,
  inspector_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  inspection_type TEXT NOT NULL,
  inspection_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  rule_version TEXT,
  rule_set_id UUID REFERENCES public.rule_sets(id),
  data_source TEXT NOT NULL CHECK (data_source IN ('SIMULATED', 'FIELD')),
  overall_result TEXT NOT NULL DEFAULT 'PENDING' CHECK (overall_result IN ('PASS', 'FAIL', 'PENDING')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. Create INSPECTION_TESTS Table
CREATE TABLE IF NOT EXISTS public.inspection_tests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inspection_id UUID NOT NULL REFERENCES public.inspections(id) ON DELETE CASCADE,
  test_definition_id UUID REFERENCES public.test_definitions(id),
  test_type TEXT NOT NULL,
  test_sequence INT DEFAULT 1,
  test_status TEXT DEFAULT 'PENDING',
  test_load NUMERIC,
  reference_value NUMERIC,
  observed_value NUMERIC,
  calculated_error NUMERIC,
  absolute_error NUMERIC,
  error NUMERIC, -- Backward compatibility
  mpe NUMERIC,   -- Backward compatibility
  mpe_rule_id UUID REFERENCES public.mpe_rules(id),
  calculation_method TEXT,
  calculation_details JSONB,
  result TEXT NOT NULL CHECK (result IN ('PASS', 'FAIL', 'NOT_APPLICABLE')),
  remarks TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- INDEXES for Performance
CREATE INDEX IF NOT EXISTS idx_inspections_instrument ON public.inspections(instrument_id);
CREATE INDEX IF NOT EXISTS idx_inspections_inspector ON public.inspections(inspector_id);
CREATE INDEX IF NOT EXISTS idx_inspections_ruleset ON public.inspections(rule_set_id);
CREATE INDEX IF NOT EXISTS idx_inspection_tests_inspection ON public.inspection_tests(inspection_id);
CREATE INDEX IF NOT EXISTS idx_test_defs_ruleset ON public.test_definitions(rule_set_id);
CREATE INDEX IF NOT EXISTS idx_mpe_rules_lookup ON public.mpe_rules(rule_set_id, accuracy_class, control_stage);

-- 6. AUTOMATIC USER PROFILE CREATION TRIGGER
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    'INSPECTOR'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 7. ROW LEVEL SECURITY (RLS)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.instruments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rule_sets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.test_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.test_applicability_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mpe_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.calculation_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inspections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inspection_tests ENABLE ROW LEVEL SECURITY;

-- RLS POLICIES FOR PROFILES
DROP POLICY IF EXISTS "Authenticated users can view profiles" ON public.profiles;
CREATE POLICY "Authenticated users can view profiles" ON public.profiles FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
CREATE POLICY "Users can update their own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);

-- RLS POLICIES FOR INSTRUMENTS
DROP POLICY IF EXISTS "Authenticated users can view instruments" ON public.instruments;
CREATE POLICY "Authenticated users can view instruments" ON public.instruments FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Authenticated users can insert instruments" ON public.instruments;
CREATE POLICY "Authenticated users can insert instruments" ON public.instruments FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated users can update instruments" ON public.instruments;
CREATE POLICY "Authenticated users can update instruments" ON public.instruments FOR UPDATE TO authenticated USING (true);

-- RLS POLICIES FOR RULE TABLES
DROP POLICY IF EXISTS "Authenticated users can view rule sets" ON public.rule_sets;
CREATE POLICY "Authenticated users can view rule sets" ON public.rule_sets FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Authenticated users can view test definitions" ON public.test_definitions;
CREATE POLICY "Authenticated users can view test definitions" ON public.test_definitions FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Authenticated users can view test applicability rules" ON public.test_applicability_rules;
CREATE POLICY "Authenticated users can view test applicability rules" ON public.test_applicability_rules FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Authenticated users can view mpe rules" ON public.mpe_rules;
CREATE POLICY "Authenticated users can view mpe rules" ON public.mpe_rules FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Authenticated users can view calculation rules" ON public.calculation_rules;
CREATE POLICY "Authenticated users can view calculation rules" ON public.calculation_rules FOR SELECT TO authenticated USING (true);

-- RLS POLICIES FOR INSPECTIONS
DROP POLICY IF EXISTS "Authenticated users can view inspections" ON public.inspections;
CREATE POLICY "Authenticated users can view inspections" ON public.inspections FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Inspectors can insert their own inspections" ON public.inspections;
CREATE POLICY "Inspectors can insert their own inspections" ON public.inspections FOR INSERT TO authenticated WITH CHECK (inspector_id = auth.uid());

DROP POLICY IF EXISTS "Inspectors can update their own inspections" ON public.inspections;
CREATE POLICY "Inspectors can update their own inspections" ON public.inspections FOR UPDATE TO authenticated USING (inspector_id = auth.uid());

-- RLS POLICIES FOR INSPECTION_TESTS
DROP POLICY IF EXISTS "Authenticated users can view inspection_tests" ON public.inspection_tests;
CREATE POLICY "Authenticated users can view inspection_tests" ON public.inspection_tests FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Inspectors can insert tests for their inspections" ON public.inspection_tests;
CREATE POLICY "Inspectors can insert tests for their inspections" ON public.inspection_tests FOR INSERT TO authenticated WITH CHECK (
  EXISTS (SELECT 1 FROM public.inspections WHERE id = inspection_id AND inspector_id = auth.uid())
);

DROP POLICY IF EXISTS "Inspectors can update tests for their inspections" ON public.inspection_tests;
CREATE POLICY "Inspectors can update tests for their inspections" ON public.inspection_tests FOR UPDATE TO authenticated USING (
  EXISTS (SELECT 1 FROM public.inspections WHERE id = inspection_id AND inspector_id = auth.uid())
);

-- ==================================================
-- SEED INITIAL RULE SETS & MPE MATRICES
-- ==================================================

-- 1. SEED RULE SETS
INSERT INTO public.rule_sets (id, standard, version, jurisdiction, status, description)
VALUES 
  ('11111111-1111-1111-1111-111111111111', 'Legal Metrology General Rules', '2011', 'INDIA', 'ACTIVE', 'Indian Legal Metrology (General) Rules 2011 for Non-Automatic Weighing Instruments'),
  ('22222222-2222-2222-2222-222222222222', 'OIML R-76', '2006', 'INTERNATIONAL', 'ACTIVE', 'OIML R-76:2006 Non-Automatic Weighing Instruments International Standard')
ON CONFLICT (standard, version, jurisdiction) DO UPDATE SET description = EXCLUDED.description;

-- 2. SEED CORE TEST DEFINITIONS (T01 - T06) FOR INDIAN RULES (2011)
INSERT INTO public.test_definitions (id, rule_set_id, test_code, name, description, clause, category, sequence)
VALUES
  ('a1111111-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'T01', 'Visual & Administrative Examination', 'Examine metrological markings, model approval details, serial numbers, Class, Min, Max, e, d, software/modules, and sealing marks.', '8.3.2', 'ADMINISTRATIVE', 1),
  ('a1111111-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', 'T02', 'Zero-setting Accuracy Check', 'Evaluate zero-setting accuracy according to non-automatic, semi-automatic, or zero-tracking configuration.', '4.5.2; A.4.2.3', 'METROLOGICAL', 2),
  ('a1111111-0000-0000-0000-000000000003', '11111111-1111-1111-1111-111111111111', 'T03', 'Errors of Indication Test', 'Determine indication error across load range using direct observation or changeover-point method.', '3.5.1; A.4.4-A.4.6', 'METROLOGICAL', 3),
  ('a1111111-0000-0000-0000-000000000004', '11111111-1111-1111-1111-111111111111', 'T04', 'Repeatability Test', 'Determine repeatability from repeated weighings at identical load (Max - Min <= MPE).', '3.6.1; A.4.10', 'METROLOGICAL', 4),
  ('a1111111-0000-0000-0000-000000000005', '11111111-1111-1111-1111-111111111111', 'T05', 'Eccentric Loading Test', 'Evaluate instrument performance for loads applied at off-center receptor positions.', '3.6.2; A.4.7', 'METROLOGICAL', 5),
  ('a1111111-0000-0000-0000-000000000006', '11111111-1111-1111-1111-111111111111', 'T06', 'Tare Accuracy Test', 'Evaluate tare operation and net indication accuracy where a tare device is present.', '4.6.3; A.4.6.2', 'METROLOGICAL', 6)
ON CONFLICT (rule_set_id, test_code) DO NOTHING;

-- 2B. SEED CORE TEST DEFINITIONS (T01 - T06) FOR OIML R-76 (2006)
INSERT INTO public.test_definitions (id, rule_set_id, test_code, name, description, clause, category, sequence)
VALUES
  ('b2222222-0000-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222', 'T01', 'Visual & Administrative Examination', 'Examine metrological markings, inscriptions, Class, Min, Max, e, d, and control marks.', '8.3.2', 'ADMINISTRATIVE', 1),
  ('b2222222-0000-0000-0000-000000000002', '22222222-2222-2222-2222-222222222222', 'T02', 'Zero-setting Accuracy Check', 'Evaluate zero-setting error (E_0 = I_0 + 0.5e - delta_L - L_0).', '4.5.2; A.4.2.3', 'METROLOGICAL', 2),
  ('b2222222-0000-0000-0000-000000000003', '22222222-2222-2222-2222-222222222222', 'T03', 'Errors of Indication Test', 'Determine indication error using changeover-point method (P = I + 0.5e - delta_L, E = P - L).', '3.5.1; A.4.4-A.4.6', 'METROLOGICAL', 3),
  ('b2222222-0000-0000-0000-000000000004', '22222222-2222-2222-2222-222222222222', 'T04', 'Repeatability Test', 'Determine repeatability error from repeated weighings (Max - Min <= |MPE|).', '3.6.1; A.4.10', 'METROLOGICAL', 4),
  ('b2222222-0000-0000-0000-000000000005', '22222222-2222-2222-2222-222222222222', 'T05', 'Eccentric Loading Test', 'Evaluate off-center load performance at 1/3 Max (or 1/4 Max for >4 supports).', '3.6.2; A.4.7', 'METROLOGICAL', 5),
  ('b2222222-0000-0000-0000-000000000006', '22222222-2222-2222-2222-222222222222', 'T06', 'Tare Accuracy Test', 'Evaluate tare balancing accuracy and net indication.', '4.6.3; A.4.6.2', 'METROLOGICAL', 6)
ON CONFLICT (rule_set_id, test_code) DO NOTHING;

-- 3. SEED TEST APPLICABILITY RULES
INSERT INTO public.test_applicability_rules (test_definition_id, applicability, reason, has_tare)
VALUES
  ('a1111111-0000-0000-0000-000000000001', 'REQUIRED', 'Mandatory visual and administrative examination for all weighing instruments', NULL),
  ('a1111111-0000-0000-0000-000000000002', 'REQUIRED', 'Mandatory zero-setting accuracy check', NULL),
  ('a1111111-0000-0000-0000-000000000003', 'REQUIRED', 'Mandatory error of indication test across load range', NULL),
  ('a1111111-0000-0000-0000-000000000004', 'REQUIRED', 'Mandatory repeatability test', NULL),
  ('a1111111-0000-0000-0000-000000000005', 'REQUIRED', 'Mandatory eccentric loading test', NULL),
  ('a1111111-0000-0000-0000-000000000006', 'CONDITIONAL', 'Tare accuracy test applies only if instrument is equipped with a tare device', true),
  ('b2222222-0000-0000-0000-000000000001', 'REQUIRED', 'Mandatory visual examination under OIML R-76', NULL),
  ('b2222222-0000-0000-0000-000000000002', 'REQUIRED', 'Mandatory zero-setting check under OIML R-76', NULL),
  ('b2222222-0000-0000-0000-000000000003', 'REQUIRED', 'Mandatory indication error test under OIML R-76', NULL),
  ('b2222222-0000-0000-0000-000000000004', 'REQUIRED', 'Mandatory repeatability test under OIML R-76', NULL),
  ('b2222222-0000-0000-0000-000000000005', 'REQUIRED', 'Mandatory eccentricity test under OIML R-76', NULL),
  ('b2222222-0000-0000-0000-000000000006', 'CONDITIONAL', 'Tare test applies only when tare device exists', true);

-- 4. SEED INDIAN LEGAL METROLOGY MPE MATRIX (2011)
-- Initial Verification / Type Evaluation Stage (Control Stage: INITIAL & TYPE_EVALUATION)
-- Class I: 0-50,000e (0.5e), >50,000-200,000e (1.0e), >200,000e (1.5e)
-- Class II: 0-5,000e (0.5e), >5,000-20,000e (1.0e), >20,000-100,000e (1.5e)
-- Class III: 0-500e (0.5e), >500-2,000e (1.0e), >2,000-10,000e (1.5e)
-- Class IV: 0-50e (0.5e), >50-200e (1.0e), >200-1,000e (1.5e)

INSERT INTO public.mpe_rules (rule_set_id, accuracy_class, control_stage, lower_load_e, upper_load_e, mpe_multiplier, mpe_unit, clause)
VALUES
  -- Class I Initial
  ('11111111-1111-1111-1111-111111111111', 'Class I', 'INITIAL', 0, 50000, 0.5, 'e', 'Table 1, Rule 3.5.1'),
  ('11111111-1111-1111-1111-111111111111', 'Class I', 'INITIAL', 50000, 200000, 1.0, 'e', 'Table 1, Rule 3.5.1'),
  ('11111111-1111-1111-1111-111111111111', 'Class I', 'INITIAL', 200000, NULL, 1.5, 'e', 'Table 1, Rule 3.5.1'),
  -- Class II Initial
  ('11111111-1111-1111-1111-111111111111', 'Class II', 'INITIAL', 0, 5000, 0.5, 'e', 'Table 1, Rule 3.5.1'),
  ('11111111-1111-1111-1111-111111111111', 'Class II', 'INITIAL', 5000, 20000, 1.0, 'e', 'Table 1, Rule 3.5.1'),
  ('11111111-1111-1111-1111-111111111111', 'Class II', 'INITIAL', 20000, 100000, 1.5, 'e', 'Table 1, Rule 3.5.1'),
  -- Class III Initial
  ('11111111-1111-1111-1111-111111111111', 'Class III', 'INITIAL', 0, 500, 0.5, 'e', 'Table 1, Rule 3.5.1'),
  ('11111111-1111-1111-1111-111111111111', 'Class III', 'INITIAL', 500, 2000, 1.0, 'e', 'Table 1, Rule 3.5.1'),
  ('11111111-1111-1111-1111-111111111111', 'Class III', 'INITIAL', 2000, 10000, 1.5, 'e', 'Table 1, Rule 3.5.1'),
  -- Class IIII Initial
  ('11111111-1111-1111-1111-111111111111', 'Class IIII', 'INITIAL', 0, 50, 0.5, 'e', 'Table 1, Rule 3.5.1'),
  ('11111111-1111-1111-1111-111111111111', 'Class IIII', 'INITIAL', 50, 200, 1.0, 'e', 'Table 1, Rule 3.5.1'),
  ('11111111-1111-1111-1111-111111111111', 'Class IIII', 'INITIAL', 200, 1000, 1.5, 'e', 'Table 1, Rule 3.5.1'),

  -- In-Service / Reverification Stage (Double MPE for In-Service)
  ('11111111-1111-1111-1111-111111111111', 'Class I', 'IN_SERVICE', 0, 50000, 1.0, 'e', 'Table 1 (In-Service), Rule 3.5.1'),
  ('11111111-1111-1111-1111-111111111111', 'Class I', 'IN_SERVICE', 50000, 200000, 2.0, 'e', 'Table 1 (In-Service), Rule 3.5.1'),
  ('11111111-1111-1111-1111-111111111111', 'Class I', 'IN_SERVICE', 200000, NULL, 3.0, 'e', 'Table 1 (In-Service), Rule 3.5.1'),
  ('11111111-1111-1111-1111-111111111111', 'Class II', 'IN_SERVICE', 0, 5000, 1.0, 'e', 'Table 1 (In-Service), Rule 3.5.1'),
  ('11111111-1111-1111-1111-111111111111', 'Class II', 'IN_SERVICE', 5000, 20000, 2.0, 'e', 'Table 1 (In-Service), Rule 3.5.1'),
  ('11111111-1111-1111-1111-111111111111', 'Class II', 'IN_SERVICE', 20000, 100000, 3.0, 'e', 'Table 1 (In-Service), Rule 3.5.1'),
  ('11111111-1111-1111-1111-111111111111', 'Class III', 'IN_SERVICE', 0, 500, 1.0, 'e', 'Table 1 (In-Service), Rule 3.5.1'),
  ('11111111-1111-1111-1111-111111111111', 'Class III', 'IN_SERVICE', 500, 2000, 2.0, 'e', 'Table 1 (In-Service), Rule 3.5.1'),
  ('11111111-1111-1111-1111-111111111111', 'Class III', 'IN_SERVICE', 2000, 10000, 3.0, 'e', 'Table 1 (In-Service), Rule 3.5.1'),
  ('11111111-1111-1111-1111-111111111111', 'Class IIII', 'IN_SERVICE', 0, 50, 1.0, 'e', 'Table 1 (In-Service), Rule 3.5.1'),
  ('11111111-1111-1111-1111-111111111111', 'Class IIII', 'IN_SERVICE', 50, 200, 2.0, 'e', 'Table 1 (In-Service), Rule 3.5.1'),
  ('11111111-1111-1111-1111-111111111111', 'Class IIII', 'IN_SERVICE', 200, 1000, 3.0, 'e', 'Table 1 (In-Service), Rule 3.5.1');

-- 4B. SEED OIML R-76:2006 MPE MATRIX
INSERT INTO public.mpe_rules (rule_set_id, accuracy_class, control_stage, lower_load_e, upper_load_e, mpe_multiplier, mpe_unit, clause)
VALUES
  ('22222222-2222-2222-2222-222222222222', 'Class I', 'INITIAL', 0, 50000, 0.5, 'e', 'OIML R-76:2006 Table 6'),
  ('22222222-2222-2222-2222-222222222222', 'Class I', 'INITIAL', 50000, 200000, 1.0, 'e', 'OIML R-76:2006 Table 6'),
  ('22222222-2222-2222-2222-222222222222', 'Class I', 'INITIAL', 200000, NULL, 1.5, 'e', 'OIML R-76:2006 Table 6'),
  ('22222222-2222-2222-2222-222222222222', 'Class II', 'INITIAL', 0, 5000, 0.5, 'e', 'OIML R-76:2006 Table 6'),
  ('22222222-2222-2222-2222-222222222222', 'Class II', 'INITIAL', 5000, 20000, 1.0, 'e', 'OIML R-76:2006 Table 6'),
  ('22222222-2222-2222-2222-222222222222', 'Class II', 'INITIAL', 20000, 100000, 1.5, 'e', 'OIML R-76:2006 Table 6'),
  ('22222222-2222-2222-2222-222222222222', 'Class III', 'INITIAL', 0, 500, 0.5, 'e', 'OIML R-76:2006 Table 6'),
  ('22222222-2222-2222-2222-222222222222', 'Class III', 'INITIAL', 500, 2000, 1.0, 'e', 'OIML R-76:2006 Table 6'),
  ('22222222-2222-2222-2222-222222222222', 'Class III', 'INITIAL', 2000, 10000, 1.5, 'e', 'OIML R-76:2006 Table 6'),
  ('22222222-2222-2222-2222-222222222222', 'Class IIII', 'INITIAL', 0, 50, 0.5, 'e', 'OIML R-76:2006 Table 6'),
  ('22222222-2222-2222-2222-222222222222', 'Class IIII', 'INITIAL', 50, 200, 1.0, 'e', 'OIML R-76:2006 Table 6'),
  ('22222222-2222-2222-2222-222222222222', 'Class IIII', 'INITIAL', 200, 1000, 1.5, 'e', 'OIML R-76:2006 Table 6'),

  ('22222222-2222-2222-2222-222222222222', 'Class I', 'IN_SERVICE', 0, 50000, 1.0, 'e', 'OIML R-76:2006 Clause 3.5.2'),
  ('22222222-2222-2222-2222-222222222222', 'Class I', 'IN_SERVICE', 50000, 200000, 2.0, 'e', 'OIML R-76:2006 Clause 3.5.2'),
  ('22222222-2222-2222-2222-222222222222', 'Class I', 'IN_SERVICE', 200000, NULL, 3.0, 'e', 'OIML R-76:2006 Clause 3.5.2'),
  ('22222222-2222-2222-2222-222222222222', 'Class II', 'IN_SERVICE', 0, 5000, 1.0, 'e', 'OIML R-76:2006 Clause 3.5.2'),
  ('22222222-2222-2222-2222-222222222222', 'Class II', 'IN_SERVICE', 5000, 20000, 2.0, 'e', 'OIML R-76:2006 Clause 3.5.2'),
  ('22222222-2222-2222-2222-222222222222', 'Class II', 'IN_SERVICE', 20000, 100000, 3.0, 'e', 'OIML R-76:2006 Clause 3.5.2'),
  ('22222222-2222-2222-2222-222222222222', 'Class III', 'IN_SERVICE', 0, 500, 1.0, 'e', 'OIML R-76:2006 Clause 3.5.2'),
  ('22222222-2222-2222-2222-222222222222', 'Class III', 'IN_SERVICE', 500, 2000, 2.0, 'e', 'OIML R-76:2006 Clause 3.5.2'),
  ('22222222-2222-2222-2222-222222222222', 'Class III', 'IN_SERVICE', 2000, 10000, 3.0, 'e', 'OIML R-76:2006 Clause 3.5.2'),
  ('22222222-2222-2222-2222-222222222222', 'Class IIII', 'IN_SERVICE', 0, 50, 1.0, 'e', 'OIML R-76:2006 Clause 3.5.2'),
  ('22222222-2222-2222-2222-222222222222', 'Class IIII', 'IN_SERVICE', 50, 200, 2.0, 'e', 'OIML R-76:2006 Clause 3.5.2'),
  ('22222222-2222-2222-2222-222222222222', 'Class IIII', 'IN_SERVICE', 200, 1000, 3.0, 'e', 'OIML R-76:2006 Clause 3.5.2');
