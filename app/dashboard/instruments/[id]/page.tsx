import { redirect, notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import DashboardHeader from '@/components/dashboard/header';
import InstrumentDetail, { InspectionHistoryItem } from '@/components/instruments/instrument-detail';
import { Profile, Instrument } from '@/types/database';

export const metadata = {
  title: 'Instrument Details - Legal Metrology Platform',
  description: 'View details for a weighing instrument',
};

interface InstrumentDetailPageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ success?: string }>;
}

export default async function InstrumentDetailPage({
  params,
  searchParams,
}: InstrumentDetailPageProps) {
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

  // Fetch Instrument by ID
  const { data: rawInstrument, error } = await supabase
    .from('instruments')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (error || !rawInstrument) {
    notFound();
  }

  const instrument = rawInstrument as Instrument;

  // Fetch Inspection History for this instrument
  const { data: rawInspections } = await supabase
    .from('inspections')
    .select(`
      id,
      inspection_type,
      inspection_date,
      data_source,
      overall_result,
      created_at,
      inspector:profiles(full_name)
    `)
    .eq('instrument_id', id)
    .order('created_at', { ascending: false });

  const inspections = (rawInspections || []) as unknown as InspectionHistoryItem[];

  let successToast: string | null = null;
  if (resolvedSearchParams.success === 'updated') {
    successToast = 'Instrument details updated successfully!';
  }

  return (
    <div className="min-h-screen flex flex-col bg-zinc-50 dark:bg-black">
      <DashboardHeader userEmail={user.email || ''} profile={profile} />

      <main className="flex-1 max-w-5xl w-full mx-auto p-6 space-y-6">
        <InstrumentDetail
          instrument={instrument}
          inspections={inspections}
          successMessage={successToast}
        />
      </main>
    </div>
  );
}
