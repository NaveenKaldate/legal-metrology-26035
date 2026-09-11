import {
  RuleSet,
  TestDefinition,
  TestApplicabilityRule,
  MpeRule,
  CalculationRule,
} from "@/types/database";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SupabaseClient = any;

export interface LoadedRuleSet {
  ruleSet: RuleSet;
  testDefinitions: TestDefinition[];
  applicabilityRules: TestApplicabilityRule[];
  mpeRules: MpeRule[];
  calculationRules: CalculationRule[];
}

export async function fetchActiveRuleSets(
  supabase: SupabaseClient,
): Promise<RuleSet[]> {
  const { data, error } = await supabase
    .from("rule_sets")
    .select(
      `
      id,
      standard,
      version,
      jurisdiction,
      status,
      effective_from,
      effective_to,
      description,
      created_at
    `,
    )
    .order("standard", { ascending: true });

  if (error) {
    console.error('[rule-engine] Failed to load rule sets:', error.message);
    return [];
  }

  return (data || []) as RuleSet[];
}

export async function fetchLoadedRuleSet(
  supabase: SupabaseClient,
  ruleSetId: string,
): Promise<LoadedRuleSet> {
  // Task 3: Defensive Validation
  if (!ruleSetId || ruleSetId.trim() === "") {
    throw new Error(
      "No rule set selected. Please return to Step 1 and select an active rule set.",
    );
  }

  // Task 4: Query using maybeSingle() instead of .single()
  const { data: ruleSet, error: ruleSetErr } = await supabase
    .from("rule_sets")
    .select("*")
    .eq("id", ruleSetId)
    .maybeSingle();

  if (ruleSetErr) {
    throw new Error(
      `Unable to load rule set from database: ${ruleSetErr.message}`,
    );
  }

  const finalRuleSet = ruleSet as RuleSet | null;

  if (!finalRuleSet) {
    throw new Error("Selected rule set could not be found.");
  }

  // 2. Fetch Test Definitions
  const { data: testDefs, error: testDefsErr } = await supabase
    .from("test_definitions")
    .select("*")
    .eq("rule_set_id", ruleSetId)
    .eq("is_active", true)
    .order("sequence", { ascending: true });

  if (testDefsErr) {
    throw new Error(
      `Unable to load test definitions from database: ${testDefsErr.message}`,
    );
  }

  const testDefinitions = (testDefs || []) as TestDefinition[];

  const testDefIds = testDefinitions.map((t) => t.id);

  // 3. Fetch Test Applicability Rules
  let applicabilityRules: TestApplicabilityRule[] = [];
  if (testDefIds.length > 0) {
    const { data: appRules } = await supabase
      .from("test_applicability_rules")
      .select("*")
      .in("test_definition_id", testDefIds);
    applicabilityRules = (appRules || []) as TestApplicabilityRule[];
  }

  // 4. Fetch MPE Rules
  // Ordered so the engine receives a stable, reproducible rule sequence.
  const { data: mpeData, error: mpeErr } = await supabase
    .from("mpe_rules")
    .select("*")
    .eq("rule_set_id", ruleSetId)
    .order("accuracy_class", { ascending: true })
    .order("control_stage", { ascending: true })
    .order("lower_load_e", { ascending: true });

  if (mpeErr) {
    throw new Error(
      `Unable to load MPE rules from database: ${mpeErr.message}`,
    );
  }

  const mpeRules = (mpeData || []) as MpeRule[];

  // 5. Fetch Calculation Rules
  const { data: calcData } = await supabase
    .from("calculation_rules")
    .select("*")
    .eq("rule_set_id", ruleSetId);
  const calculationRules = (calcData || []) as CalculationRule[];

  return {
    ruleSet: finalRuleSet,
    testDefinitions,
    applicabilityRules,
    mpeRules,
    calculationRules,
  };
}
