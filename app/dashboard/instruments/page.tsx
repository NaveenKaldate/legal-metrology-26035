import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import DashboardHeader from '@/components/dashboard/header';
import InstrumentList from '@/components/instruments/instrument-list';
import { Profile, Instrument } from '@/types/database';

export const metadata = {
  title: 'Instruments - Legal Metrology Platform',
  description: 'Manage weighing instruments and scales',
};

interface InstrumentsPageProps {
  searchParams: Promise<{ success?: string }>;
}

export default async function InstrumentsPage({
  searchParams,
}: InstrumentsPageProps) {
  const supabase = await createClient();
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

  // Fetch Instruments
  const { data: rawInstruments, error } = await supabase
    .from('instruments')
    .select('*')
    .order('created_at', { ascending: false });

  const instruments = (rawInstruments || []) as Instrument[];

  let successToast: string | null = null;
  if (resolvedSearchParams.success === 'registered') {
    successToast = 'Instrument registered successfully!';
  } else if (resolvedSearchParams.success === 'updated') {
    successToast = 'Instrument updated successfully!';
  }

  return (
    <div className="min-h-screen flex flex-col bg-zinc-50 dark:bg-black">
      <DashboardHeader userEmail={user.email || ''} profile={profile} />

      <main className="flex-1 max-w-7xl w-full mx-auto p-6 space-y-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
              Weighing Instruments
            </h2>
            <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-1">
              Registered electronic weighing instruments and platform scales
            </p>
          </div>
        </div>

        {error && (
          <div className="p-4 text-sm text-red-700 bg-red-100 dark:bg-red-950/50 dark:text-red-300 rounded-lg border border-red-200 dark:border-red-900">
            Failed to load instruments: {error.message}
          </div>
        )}

        <InstrumentList
          initialInstruments={instruments}
          successMessage={successToast}
        />
      </main>
    </div>
  );
}

