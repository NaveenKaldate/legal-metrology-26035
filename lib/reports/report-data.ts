import { createClient } from '@/lib/supabase/server';
import { ReportData, ReportTestResult } from './report-types';

export async function getInspectionReportData(inspectionId: string): Promise<ReportData | null> {
  const supabase = await createClient();

  // Fetch the core inspection and strictly joined standard foreign key relations
  const { data: rawInspection, error: inspectionError } = await supabase
    .from('inspections')
    .select(`
      *,
      rule_set:rule_sets(*),
      instrument:instruments(*),
      inspector:profiles(*)
    `)
    .eq('id', inspectionId)
    .maybeSingle();

  if (inspectionError || !rawInspection) {
    console.error('Report fetch failed (Inspection):', inspectionError);
    return null;
  }

  // Fetch the tests with their specific test definitions and MPE rules
  const { data: rawTests, error: testsError } = await supabase
    .from('inspection_tests')
    .select(`
      *,
      test_definition:test_definitions(*),
      mpe_rule:mpe_rules(*)
    `)
    .eq('inspection_id', inspectionId)
    .order('test_sequence', { ascending: true });

  if (testsError) {
    console.error('Report fetch failed (Tests):', testsError);
    return null;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const inspection = rawInspection as any;

  // We explicitly check that the relational data exists.
  // Because rule_sets is historical and joined via rule_set_id, we guarantee
  // we are using the EXACT rules used at the time of inspection.
  if (!inspection.instrument || !inspection.inspector || !inspection.rule_set) {
    console.error('Report fetch missing critical relational data.');
    return null;
  }

  const reportData: ReportData = {
    inspection: inspection,
    instrument: inspection.instrument,
    inspector: inspection.inspector,
    rule_set: inspection.rule_set,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    tests: (rawTests || []) as any as ReportTestResult[],
  };

  return reportData;
}
