import { 
  Inspection, 
  Instrument, 
  Profile, 
  RuleSet, 
  InspectionTest, 
  TestDefinition, 
  MpeRule 
} from '@/types/database';

export interface ReportTestResult extends InspectionTest {
  test_definition: TestDefinition | null;
  mpe_rule: MpeRule | null;
}

export interface ReportData {
  inspection: Inspection;
  instrument: Instrument;
  inspector: Profile;
  rule_set: RuleSet;
  tests: ReportTestResult[];
}

