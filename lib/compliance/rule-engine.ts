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
    .eq('status', 'ACTIVE')
    .order('standard', { ascending: true });

  if (error) {
    throw new Error(`Failed to fetch rule sets: ${error.message}`);
  }

  return (data || []) as RuleSet[];
}

export async function fetchLoadedRuleSet(
  supabase: SupabaseClient,
  ruleSetId: string
): Promise<LoadedRuleSet> {
  // 1. Fetch RuleSet
  const { data: ruleSet, error: ruleSetErr } = await supabase
    .from('rule_sets')
    .select('*')
    .eq('id', ruleSetId)
    .single();

  if (ruleSetErr || !ruleSet) {
    throw new Error(`Rule set not found: ${ruleSetErr?.message || ruleSetId}`);
  }

  // 2. Fetch Test Definitions
  const { data: testDefs } = await supabase
    .from('test_definitions')
    .select('*')
    .eq('rule_set_id', ruleSetId)
    .eq('is_active', true)
    .order('sequence', { ascending: true });

  const testDefinitions = (testDefs || []) as TestDefinition[];
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
  const { data: mpeData } = await supabase
    .from('mpe_rules')
    .select('*')
    .eq('rule_set_id', ruleSetId);
  const mpeRules = (mpeData || []) as MpeRule[];

  // 5. Fetch Calculation Rules
  const { data: calcData } = await supabase
    .from('calculation_rules')
    .select('*')
    .eq('rule_set_id', ruleSetId);
  const calculationRules = (calcData || []) as CalculationRule[];

  return {
    ruleSet: ruleSet as RuleSet,
    testDefinitions,
    applicabilityRules,
    mpeRules,
    calculationRules,
  };
}

