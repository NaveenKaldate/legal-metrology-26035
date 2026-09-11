import { redirect, notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import DashboardHeader from '@/components/dashboard/header';
import InspectionDetail, { InspectionDetailRecord } from '@/components/inspections/inspection-detail';
import { Profile, InspectionTest, ReportAuditEntry, TestResult } from '@/types/database';
import FinalizeReport from '@/components/inspections/finalize-report';
import { evaluateFinalizationReadiness } from '@/lib/reports/finalization';

export const metadata = {
  title: 'Inspection Details - Legal Metrology Platform',
  description: 'View OIML R-76 test details, MPE clauses, and auditable calculation logs',
};

interface InspectionDetailPageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ success?: string }>;
}

export default async function InspectionDetailPage({
  params,
  searchParams,
}: InspectionDetailPageProps) {
  const supabase = await createClient();
  const { id } = await params;
  const resolvedSearchParams = await searchParams;

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  // Fetch Profile
  const { data: rawProfile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .maybeSingle();

  const profile = rawProfile as Profile | null;

  // Fetch Inspection Record with Instrument, Rule Set & Inspector
  const { data: rawInspection, error } = await supabase
    .from('inspections')
    .select(`
      *,
      rule_set:rule_sets(*),
      instrument:instruments(*),
      inspector:profiles!inspections_inspector_id_fkey(full_name)
    `)
    .eq('id', id)
    .maybeSingle();

  if (error || !rawInspection) {
    notFound();
  }

  // Fetch Inspection Tests with joined Test Definitions & MPE rules
  const { data: rawTests } = await supabase
    .from('inspection_tests')
    .select(`
      *,
      test_definition:test_definitions(name, clause, category),
      mpe_rule:mpe_rules(clause, mpe_multiplier)
    `)
    .eq('inspection_id', id)
    .order('test_sequence', { ascending: true });

  const tests = (rawTests || []) as unknown as InspectionDetailRecord['tests'];

  const inspection: InspectionDetailRecord = {
    ...(rawInspection as unknown as InspectionDetailRecord),
    tests: tests as (InspectionTest & {
      test_definition?: { name: string; clause: string; category: string } | null;
      mpe_rule?: { clause: string | null; mpe_multiplier: number } | null;
    })[],
  };

  // Audit trail for this report (append-only; readable by authenticated users).
  const { data: rawAudit } = await supabase
    .from('report_audit_log')
    .select('*')
    .eq('inspection_id', id)
    .order('performed_at', { ascending: false });

  const auditEntries = (rawAudit || []) as ReportAuditEntry[];

  // UI pre-check only. The database re-checks all of this inside
  // finalize_inspection() and is the actual authority.
  const readiness = evaluateFinalizationReadiness(
    {
      reportStatus: inspection.report_status === 'FINAL' ? 'FINAL' : 'DRAFT',
      overallResult: inspection.overall_result as 'PASS' | 'FAIL' | 'PENDING',
      ruleSetId: inspection.rule_set_id,
      inspectorId: inspection.inspector_id,
      tests: (inspection.tests || []).map((t) => ({
        testType: t.test_type,
        result: t.result as TestResult,
        testStatus: t.test_status ?? null,
      })),
    },
    { userId: user.id, role: profile?.role === 'ADMIN' ? 'ADMIN' : 'INSPECTOR' }
  );

  let successToast: string | null = null;
  if (resolvedSearchParams.success === 'created') {
    successToast = 'OIML R-76 inspection record saved successfully!';
  }

  return (
    <div className="min-h-screen flex flex-col bg-zinc-50 dark:bg-black">
      <DashboardHeader userEmail={user.email || ''} profile={profile} />

      <main className="flex-1 max-w-5xl w-full mx-auto p-6 space-y-6">
        <InspectionDetail
          inspection={inspection}
          successMessage={successToast}
          auditEntries={auditEntries}
          finalizeSlot={
            inspection.report_status !== 'FINAL' ? (
              <FinalizeReport
                inspectionId={inspection.id}
                canFinalize={readiness.canFinalize}
                blockers={readiness.blockers}
              />
            ) : null
          }
        />
      </main>
    </div>
  );
}
