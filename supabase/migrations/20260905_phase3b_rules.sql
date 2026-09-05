-- SIH 2026 Problem Statement 26035 - Migration 20260905: Phase 3B Configurable Rule Engine
-- Run this script in your Supabase SQL Editor if upgrading an existing Phase 1/3A database.

-- 1. RULE_SETS Table
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

-- 2. TEST_DEFINITIONS Table
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

-- 3. TEST_APPLICABILITY_RULES Table
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

-- 4. MPE_RULES Table
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

-- 5. CALCULATION_RULES Table
CREATE TABLE IF NOT EXISTS public.calculation_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_set_id UUID NOT NULL REFERENCES public.rule_sets(id) ON DELETE CASCADE,
  test_definition_id UUID REFERENCES public.test_definitions(id) ON DELETE CASCADE,
  calculation_code TEXT NOT NULL,
  formula TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 6. ALTER EXISTING TABLES
ALTER TABLE public.inspections ADD COLUMN IF NOT EXISTS rule_set_id UUID REFERENCES public.rule_sets(id);

ALTER TABLE public.inspection_tests ADD COLUMN IF NOT EXISTS test_definition_id UUID REFERENCES public.test_definitions(id);
ALTER TABLE public.inspection_tests ADD COLUMN IF NOT EXISTS test_sequence INT DEFAULT 1;
ALTER TABLE public.inspection_tests ADD COLUMN IF NOT EXISTS test_status TEXT DEFAULT 'PENDING';
ALTER TABLE public.inspection_tests ADD COLUMN IF NOT EXISTS calculated_error NUMERIC;
ALTER TABLE public.inspection_tests ADD COLUMN IF NOT EXISTS absolute_error NUMERIC;
ALTER TABLE public.inspection_tests ADD COLUMN IF NOT EXISTS mpe_rule_id UUID REFERENCES public.mpe_rules(id);
ALTER TABLE public.inspection_tests ADD COLUMN IF NOT EXISTS calculation_method TEXT;
ALTER TABLE public.inspection_tests ADD COLUMN IF NOT EXISTS calculation_details JSONB;

-- RLS POLICIES FOR RULE TABLES
ALTER TABLE public.rule_sets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.test_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.test_applicability_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mpe_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.calculation_rules ENABLE ROW LEVEL SECURITY;

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

-- SEED INITIAL RULE SETS
INSERT INTO public.rule_sets (id, standard, version, jurisdiction, status, description)
VALUES 
  ('11111111-1111-1111-1111-111111111111', 'Legal Metrology General Rules', '2011', 'INDIA', 'ACTIVE', 'Indian Legal Metrology (General) Rules 2011 for Non-Automatic Weighing Instruments'),
  ('22222222-2222-2222-2222-222222222222', 'OIML R-76', '2006', 'INTERNATIONAL', 'ACTIVE', 'OIML R-76:2006 Non-Automatic Weighing Instruments International Standard')
ON CONFLICT (standard, version, jurisdiction) DO UPDATE SET description = EXCLUDED.description;

-- SEED TEST DEFINITIONS FOR INDIAN RULES (2011)
INSERT INTO public.test_definitions (id, rule_set_id, test_code, name, description, clause, category, sequence)
VALUES
  ('a1111111-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'T01', 'Visual & Administrative Examination', 'Examine metrological markings, model approval details, serial numbers, Class, Min, Max, e, d, software/modules, and sealing marks.', '8.3.2', 'ADMINISTRATIVE', 1),
  ('a1111111-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', 'T02', 'Zero-setting Accuracy Check', 'Evaluate zero-setting accuracy according to non-automatic, semi-automatic, or zero-tracking configuration.', '4.5.2; A.4.2.3', 'METROLOGICAL', 2),
  ('a1111111-0000-0000-0000-000000000003', '11111111-1111-1111-1111-111111111111', 'T03', 'Errors of Indication Test', 'Determine indication error across load range using direct observation or changeover-point method.', '3.5.1; A.4.4-A.4.6', 'METROLOGICAL', 3),
  ('a1111111-0000-0000-0000-000000000004', '11111111-1111-1111-1111-111111111111', 'T04', 'Repeatability Test', 'Determine repeatability from repeated weighings at identical load (Max - Min <= MPE).', '3.6.1; A.4.10', 'METROLOGICAL', 4),
  ('a1111111-0000-0000-0000-000000000005', '11111111-1111-1111-1111-111111111111', 'T05', 'Eccentric Loading Test', 'Evaluate instrument performance for loads applied at off-center receptor positions.', '3.6.2; A.4.7', 'METROLOGICAL', 5),
  ('a1111111-0000-0000-0000-000000000006', '11111111-1111-1111-1111-111111111111', 'T06', 'Tare Accuracy Test', 'Evaluate tare operation and net indication accuracy where a tare device is present.', '4.6.3; A.4.6.2', 'METROLOGICAL', 6)
ON CONFLICT (rule_set_id, test_code) DO NOTHING;

-- SEED TEST DEFINITIONS FOR OIML R-76 (2006)
INSERT INTO public.test_definitions (id, rule_set_id, test_code, name, description, clause, category, sequence)
VALUES
  ('b2222222-0000-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222', 'T01', 'Visual & Administrative Examination', 'Examine metrological markings, inscriptions, Class, Min, Max, e, d, and control marks.', '8.3.2', 'ADMINISTRATIVE', 1),
  ('b2222222-0000-0000-0000-000000000002', '22222222-2222-2222-2222-222222222222', 'T02', 'Zero-setting Accuracy Check', 'Evaluate zero-setting error (E_0 = I_0 + 0.5e - delta_L - L_0).', '4.5.2; A.4.2.3', 'METROLOGICAL', 2),
  ('b2222222-0000-0000-0000-000000000003', '22222222-2222-2222-2222-222222222222', 'T03', 'Errors of Indication Test', 'Determine indication error using changeover-point method (P = I + 0.5e - delta_L, E = P - L).', '3.5.1; A.4.4-A.4.6', 'METROLOGICAL', 3),
  ('b2222222-0000-0000-0000-000000000004', '22222222-2222-2222-2222-222222222222', 'T04', 'Repeatability Test', 'Determine repeatability error from repeated weighings (Max - Min <= |MPE|).', '3.6.1; A.4.10', 'METROLOGICAL', 4),
  ('b2222222-0000-0000-0000-000000000005', '22222222-2222-2222-2222-222222222222', 'T05', 'Eccentric Loading Test', 'Evaluate off-center load performance at 1/3 Max (or 1/4 Max for >4 supports).', '3.6.2; A.4.7', 'METROLOGICAL', 5),
  ('b2222222-0000-0000-0000-000000000006', '22222222-2222-2222-2222-222222222222', 'T06', 'Tare Accuracy Test', 'Evaluate tare balancing accuracy and net indication.', '4.6.3; A.4.6.2', 'METROLOGICAL', 6)
ON CONFLICT (rule_set_id, test_code) DO NOTHING;

-- SEED MPE RULES FOR INDIAN LEGAL METROLOGY (2011)
INSERT INTO public.mpe_rules (rule_set_id, accuracy_class, control_stage, lower_load_e, upper_load_e, mpe_multiplier, mpe_unit, clause)
VALUES
  ('11111111-1111-1111-1111-111111111111', 'Class I', 'INITIAL', 0, 50000, 0.5, 'e', 'Table 1, Rule 3.5.1'),
  ('11111111-1111-1111-1111-111111111111', 'Class I', 'INITIAL', 50000, 200000, 1.0, 'e', 'Table 1, Rule 3.5.1'),
  ('11111111-1111-1111-1111-111111111111', 'Class I', 'INITIAL', 200000, NULL, 1.5, 'e', 'Table 1, Rule 3.5.1'),
  ('11111111-1111-1111-1111-111111111111', 'Class II', 'INITIAL', 0, 5000, 0.5, 'e', 'Table 1, Rule 3.5.1'),
  ('11111111-1111-1111-1111-111111111111', 'Class II', 'INITIAL', 5000, 20000, 1.0, 'e', 'Table 1, Rule 3.5.1'),
  ('11111111-1111-1111-1111-111111111111', 'Class II', 'INITIAL', 20000, 100000, 1.5, 'e', 'Table 1, Rule 3.5.1'),
  ('11111111-1111-1111-1111-111111111111', 'Class III', 'INITIAL', 0, 500, 0.5, 'e', 'Table 1, Rule 3.5.1'),
  ('11111111-1111-1111-1111-111111111111', 'Class III', 'INITIAL', 500, 2000, 1.0, 'e', 'Table 1, Rule 3.5.1'),
  ('11111111-1111-1111-1111-111111111111', 'Class III', 'INITIAL', 2000, 10000, 1.5, 'e', 'Table 1, Rule 3.5.1'),
  ('11111111-1111-1111-1111-111111111111', 'Class IIII', 'INITIAL', 0, 50, 0.5, 'e', 'Table 1, Rule 3.5.1'),
  ('11111111-1111-1111-1111-111111111111', 'Class IIII', 'INITIAL', 50, 200, 1.0, 'e', 'Table 1, Rule 3.5.1'),
  ('11111111-1111-1111-1111-111111111111', 'Class IIII', 'INITIAL', 200, 1000, 1.5, 'e', 'Table 1, Rule 3.5.1'),

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

-- SEED OIML R-76:2006 MPE MATRIX
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

