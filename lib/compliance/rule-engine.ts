import { RuleSet, TestDefinition, TestApplicabilityRule, MpeRule, CalculationRule } from '@/types/database';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SupabaseClient = any;

export interface LoadedRuleSet {
  ruleSet: RuleSet;
  testDefinitions: TestDefinition[];
  applicabilityRules: TestApplicabilityRule[];
  mpeRules: MpeRule[];
  calculationRules: CalculationRule[];
}

export async function fetchActiveRuleSets(supabase: SupabaseClient): Promise<RuleSet[]> {
  const { data, error } = await supabase
    .from('rule_sets')
    .select('*')
    .order('standard', { ascending: true });

  if (error) {
    console.warn(`Database query for rule_sets failed: ${error.message}`);
    return getStaticDefaultRuleSets();
  }

  const ruleSets = (data || []) as RuleSet[];
  if (ruleSets.length === 0) {
    return getStaticDefaultRuleSets();
  }

  return ruleSets;
}

export async function fetchLoadedRuleSet(
  supabase: SupabaseClient,
  ruleSetId: string
): Promise<LoadedRuleSet> {
  // Task 3: Defensive Validation
  if (!ruleSetId || ruleSetId.trim() === '') {
    throw new Error('No rule set selected. Please return to Step 1 and select an active rule set.');
  }

  // Task 4: Query using maybeSingle() instead of .single()
  const { data: ruleSet, error: ruleSetErr } = await supabase
    .from('rule_sets')
    .select('*')
    .eq('id', ruleSetId)
    .maybeSingle();

  if (ruleSetErr) {
    throw new Error(`Unable to load rule set from database: ${ruleSetErr.message}`);
  }

  let finalRuleSet = ruleSet as RuleSet | null;

  // Fallback for static default IDs if database table has not been populated
  if (!finalRuleSet) {
    const staticRuleSets = getStaticDefaultRuleSets();
    const found = staticRuleSets.find((r) => r.id === ruleSetId);
    if (found) {
      finalRuleSet = found;
    } else {
      throw new Error('Selected rule set could not be found.');
    }
  }

  // 2. Fetch Test Definitions
  const { data: testDefs, error: testDefsErr } = await supabase
    .from('test_definitions')
    .select('*')
    .eq('rule_set_id', ruleSetId)
    .eq('is_active', true)
    .order('sequence', { ascending: true });

  if (testDefsErr) {
    throw new Error(`Unable to load test definitions from database: ${testDefsErr.message}`);
  }

  let testDefinitions = (testDefs || []) as TestDefinition[];
  if (testDefinitions.length === 0 && isStaticFallbackId(ruleSetId)) {
    testDefinitions = getStaticTestDefinitions(ruleSetId);
  }

  const testDefIds = testDefinitions.map((t) => t.id);

  // 3. Fetch Test Applicability Rules
  let applicabilityRules: TestApplicabilityRule[] = [];
  if (testDefIds.length > 0) {
    const { data: appRules } = await supabase
      .from('test_applicability_rules')
      .select('*')
      .in('test_definition_id', testDefIds);
    applicabilityRules = (appRules || []) as TestApplicabilityRule[];
  }

  // 4. Fetch MPE Rules
  const { data: mpeData, error: mpeErr } = await supabase
    .from('mpe_rules')
    .select('*')
    .eq('rule_set_id', ruleSetId);

  if (mpeErr) {
    throw new Error(`Unable to load MPE rules from database: ${mpeErr.message}`);
  }

  let mpeRules = (mpeData || []) as MpeRule[];
  if (mpeRules.length === 0 && isStaticFallbackId(ruleSetId)) {
    mpeRules = getStaticMpeRules(ruleSetId);
  }

  // 5. Fetch Calculation Rules
  const { data: calcData } = await supabase
    .from('calculation_rules')
    .select('*')
    .eq('rule_set_id', ruleSetId);
  const calculationRules = (calcData || []) as CalculationRule[];

  return {
    ruleSet: finalRuleSet,
    testDefinitions,
    applicabilityRules,
    mpeRules,
    calculationRules,
  };
}

/**
 * Returns static fallback Rule Sets when public.rule_sets table is empty in DB.
 */
export function getStaticDefaultRuleSets(): RuleSet[] {
  return [
    {
      id: '22222222-2222-2222-2222-222222222222',
      standard: 'OIML R-76',
      version: '2006',
      jurisdiction: 'INTERNATIONAL',
      status: 'ACTIVE',
      description: 'OIML R-76:2006 Non-Automatic Weighing Instruments International Standard',
      created_at: new Date().toISOString(),
    },
    {
      id: '11111111-1111-1111-1111-111111111111',
      standard: 'Legal Metrology General Rules',
      version: '2011',
      jurisdiction: 'INDIA',
      status: 'ACTIVE',
      description: 'Indian Legal Metrology (General) Rules 2011 for Non-Automatic Weighing Instruments',
      created_at: new Date().toISOString(),
    },
  ];
}

function isStaticFallbackId(id: string): boolean {
  return (
    id === '22222222-2222-2222-2222-222222222222' ||
    id === '11111111-1111-1111-1111-111111111111'
  );
}

function getStaticTestDefinitions(ruleSetId: string): TestDefinition[] {
  const prefix = ruleSetId === '22222222-2222-2222-2222-222222222222' ? 'b2222222' : 'a1111111';
  const isOiml = ruleSetId === '22222222-2222-2222-2222-222222222222';

  return [
    {
      id: `${prefix}-0000-0000-0000-000000000001`,
      rule_set_id: ruleSetId,
      test_code: 'T01',
      name: 'Visual & Administrative Examination',
      description: isOiml
        ? 'Examine metrological markings, inscriptions, Class, Min, Max, e, d, and control marks.'
        : 'Examine metrological markings, model approval details, serial numbers, Class, Min, Max, e, d, software/modules, and sealing marks.',
      clause: '8.3.2',
      category: 'ADMINISTRATIVE',
      sequence: 1,
      is_active: true,
      created_at: new Date().toISOString(),
    },
    {
      id: `${prefix}-0000-0000-0000-000000000002`,
      rule_set_id: ruleSetId,
      test_code: 'T02',
      name: 'Zero-setting Accuracy Check',
      description: isOiml
        ? 'Evaluate zero-setting error (E_0 = I_0 + 0.5e - delta_L - L_0).'
        : 'Evaluate zero-setting accuracy according to non-automatic, semi-automatic, or zero-tracking configuration.',
      clause: '4.5.2; A.4.2.3',
      category: 'METROLOGICAL',
      sequence: 2,
      is_active: true,
      created_at: new Date().toISOString(),
    },
    {
      id: `${prefix}-0000-0000-0000-000000000003`,
      rule_set_id: ruleSetId,
      test_code: 'T03',
      name: 'Errors of Indication Test',
      description: isOiml
        ? 'Determine indication error using changeover-point method (P = I + 0.5e - delta_L, E = P - L).'
        : 'Determine indication error across load range using direct observation or changeover-point method.',
      clause: '3.5.1; A.4.4-A.4.6',
      category: 'METROLOGICAL',
      sequence: 3,
      is_active: true,
      created_at: new Date().toISOString(),
    },
    {
      id: `${prefix}-0000-0000-0000-000000000004`,
      rule_set_id: ruleSetId,
      test_code: 'T04',
      name: 'Repeatability Test',
      description: isOiml
        ? 'Determine repeatability error from repeated weighings (Max - Min <= |MPE|).'
        : 'Determine repeatability from repeated weighings at identical load (Max - Min <= MPE).',
      clause: '3.6.1; A.4.10',
      category: 'METROLOGICAL',
      sequence: 4,
      is_active: true,
      created_at: new Date().toISOString(),
    },
    {
      id: `${prefix}-0000-0000-0000-000000000005`,
      rule_set_id: ruleSetId,
      test_code: 'T05',
      name: 'Eccentric Loading Test',
      description: isOiml
        ? 'Evaluate off-center load performance at 1/3 Max (or 1/4 Max for >4 supports).'
        : 'Evaluate instrument performance for loads applied at off-center receptor positions.',
      clause: '3.6.2; A.4.7',
      category: 'METROLOGICAL',
      sequence: 5,
      is_active: true,
      created_at: new Date().toISOString(),
    },
    {
      id: `${prefix}-0000-0000-0000-000000000006`,
      rule_set_id: ruleSetId,
      test_code: 'T06',
      name: 'Tare Accuracy Test',
      description: isOiml
        ? 'Evaluate tare balancing accuracy and net indication.'
        : 'Evaluate tare operation and net indication accuracy where a tare device is present.',
      clause: '4.6.3; A.4.6.2',
      category: 'METROLOGICAL',
      sequence: 6,
      is_active: true,
      created_at: new Date().toISOString(),
    },
  ];
}

function getStaticMpeRules(ruleSetId: string): MpeRule[] {
  const clausePrefix = ruleSetId === '22222222-2222-2222-2222-222222222222' ? 'OIML R-76:2006' : 'Table 1, Rule 3.5.1';

  return [
    {
      id: `mpe-1-${ruleSetId}`,
      rule_set_id: ruleSetId,
      accuracy_class: 'Class III',
      control_stage: 'INITIAL',
      lower_load_e: 0,
      upper_load_e: 500,
      mpe_multiplier: 0.5,
      mpe_unit: 'e',
      clause: `${clausePrefix} (0 <= m <= 500e)`,
      created_at: new Date().toISOString(),
    },
    {
      id: `mpe-2-${ruleSetId}`,
      rule_set_id: ruleSetId,
      accuracy_class: 'Class III',
      control_stage: 'INITIAL',
      lower_load_e: 500,
      upper_load_e: 2000,
      mpe_multiplier: 1.0,
      mpe_unit: 'e',
      clause: `${clausePrefix} (500e < m <= 2000e)`,
      created_at: new Date().toISOString(),
    },
    {
      id: `mpe-3-${ruleSetId}`,
      rule_set_id: ruleSetId,
      accuracy_class: 'Class III',
      control_stage: 'INITIAL',
      lower_load_e: 2000,
      upper_load_e: 10000,
      mpe_multiplier: 1.5,
      mpe_unit: 'e',
      clause: `${clausePrefix} (2000e < m <= 10000e)`,
      created_at: new Date().toISOString(),
    },
    {
      id: `mpe-4-${ruleSetId}`,
      rule_set_id: ruleSetId,
      accuracy_class: 'Class III',
      control_stage: 'IN_SERVICE',
      lower_load_e: 0,
      upper_load_e: 500,
      mpe_multiplier: 1.0,
      mpe_unit: 'e',
      clause: `${clausePrefix} In-Service (0 <= m <= 500e)`,
      created_at: new Date().toISOString(),
    },
    {
      id: `mpe-5-${ruleSetId}`,
      rule_set_id: ruleSetId,
      accuracy_class: 'Class III',
      control_stage: 'IN_SERVICE',
      lower_load_e: 500,
      upper_load_e: 2000,
      mpe_multiplier: 2.0,
      mpe_unit: 'e',
      clause: `${clausePrefix} In-Service (500e < m <= 2000e)`,
      created_at: new Date().toISOString(),
    },
    {
      id: `mpe-6-${ruleSetId}`,
      rule_set_id: ruleSetId,
      accuracy_class: 'Class III',
      control_stage: 'IN_SERVICE',
      lower_load_e: 2000,
      upper_load_e: 10000,
      mpe_multiplier: 3.0,
      mpe_unit: 'e',
      clause: `${clausePrefix} In-Service (2000e < m <= 10000e)`,
      created_at: new Date().toISOString(),
    },
  ];
}
