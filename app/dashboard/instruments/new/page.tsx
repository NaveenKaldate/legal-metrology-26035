import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import DashboardHeader from '@/components/dashboard/header';
import InstrumentForm from '@/components/instruments/instrument-form';
import { Profile } from '@/types/database';

export const metadata = {
  title: 'Register Instrument - Legal Metrology Platform',
  description: 'Register a new electronic weighing instrument or platform scale',
};

export default async function NewInstrumentPage() {
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

  return (
    <div className="min-h-screen flex flex-col bg-zinc-50 dark:bg-black">
      <DashboardHeader userEmail={user.email || ''} profile={profile} />

      <main className="flex-1 max-w-4xl w-full mx-auto p-6 space-y-6">
        <div>
          <Link
            href="/dashboard/instruments"
            className="text-sm text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200 transition-colors inline-block mb-3"
          >
            ← Back to Instruments
          </Link>
          <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
            Register New Instrument
          </h2>
          <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-1">
            Fill in the instrument specification details to add it to the inspection registry.
          </p>
        </div>

        <InstrumentForm mode="create" />
      </main>
    </div>
  );
}

