import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import DashboardHeader from '@/components/dashboard/header';
import InspectionList, { InspectionWithDetails } from '@/components/inspections/inspection-list';
import { Profile } from '@/types/database';

export const metadata = {
  title: 'Inspections - Legal Metrology Platform',
  description: 'View OIML R-76 inspection history and versioned compliance evaluation results',
};

export default async function InspectionsPage() {
  const supabase = await createClient();

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

  // Fetch Inspections joined with instrument, rule_set, and inspector profile
  const { data: rawInspections, error } = await supabase
    .from('inspections')
    .select(`
      *,
      rule_set:rule_sets(*),
      instrument:instruments(instrument_type, manufacturer, model, serial_number),
      inspector:profiles!inspections_inspector_id_fkey(full_name)
    `)
    .order('created_at', { ascending: false });

  const inspections = (rawInspections || []) as unknown as InspectionWithDetails[];

  return (
    <div className="min-h-screen flex flex-col bg-zinc-50 dark:bg-black">
      <DashboardHeader userEmail={user.email || ''} profile={profile} />

      <main className="flex-1 max-w-7xl w-full mx-auto p-6 space-y-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
              OIML R-76 Inspection Records &amp; History
            </h2>
            <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-1">
              Deterministic compliance evaluation for electronic weighing instruments &amp; platform scales
            </p>
          </div>
        </div>

        {error && (
          <div className="p-4 text-sm text-red-700 bg-red-100 dark:bg-red-950/50 dark:text-red-300 rounded-lg border border-red-200 dark:border-red-900">
            Failed to load inspection history: {error.message}
          </div>
        )}

        <InspectionList initialInspections={inspections} />
      </main>
    </div>
  );
}
