import { redirect, notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import DashboardHeader from '@/components/dashboard/header';
import InspectionDetail, { InspectionDetailRecord } from '@/components/inspections/inspection-detail';
import { Profile, InspectionTest } from '@/types/database';

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
      inspector:profiles(full_name)
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
        />
      </main>
    </div>
  );
}
