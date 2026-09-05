import { redirect, notFound } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import DashboardHeader from '@/components/dashboard/header';
import InstrumentForm from '@/components/instruments/instrument-form';
import { Profile, Instrument } from '@/types/database';

export const metadata = {
  title: 'Edit Instrument - Legal Metrology Platform',
  description: 'Edit instrument specifications',
};

interface EditInstrumentPageProps {
  params: Promise<{ id: string }>;
}

export default async function EditInstrumentPage({
  params,
}: EditInstrumentPageProps) {
  const supabase = await createClient();
  const { id } = await params;

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

  return (
    <div className="min-h-screen flex flex-col bg-zinc-50 dark:bg-black">
      <DashboardHeader userEmail={user.email || ''} profile={profile} />

      <main className="flex-1 max-w-4xl w-full mx-auto p-6 space-y-6">
        <div>
          <Link
            href={`/dashboard/instruments/${instrument.id}`}
            className="text-sm text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200 transition-colors inline-block mb-3"
          >
            ← Back to Instrument Details
          </Link>
          <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
            Edit Instrument #{instrument.serial_number}
          </h2>
          <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-1">
            Update instrument parameters and operational status.
          </p>
        </div>

        <InstrumentForm mode="edit" initialData={instrument} />
      </main>
    </div>
  );
}

