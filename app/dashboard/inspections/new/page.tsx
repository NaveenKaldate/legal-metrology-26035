import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import DashboardHeader from '@/components/dashboard/header';
import InspectionForm from '@/components/inspections/inspection-form';
import { Profile, Instrument, RuleSet } from '@/types/database';
import { fetchActiveRuleSets } from '@/lib/compliance/rule-engine';

export const metadata = {
  title: 'New Inspection - Legal Metrology Platform',
  description: 'Launch an OIML R-76 & Legal Metrology inspection workflow for a weighing instrument',
};

interface NewInspectionPageProps {
  searchParams: Promise<{ instrumentId?: string }>;
}

export default async function NewInspectionPage({
  searchParams,
}: NewInspectionPageProps) {
  const supabase = await createClient();
  const { instrumentId } = await searchParams;

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

  if (!instrumentId) {
    return (
      <div className="min-h-screen flex flex-col bg-zinc-50 dark:bg-black">
        <DashboardHeader userEmail={user.email || ''} profile={profile} />
        <main className="flex-1 max-w-4xl w-full mx-auto p-6 space-y-6">
          <div className="bg-white dark:bg-zinc-900 p-8 rounded-xl shadow-sm border border-zinc-200 dark:border-zinc-800 text-center space-y-4">
            <div className="text-4xl">⚠️</div>
            <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">
              No Instrument Selected
            </h2>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 max-w-md mx-auto">
              Please select an instrument from the instruments registry to start an inspection.
            </p>
            <div className="pt-2">
              <Link
                href="/dashboard/instruments"
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors inline-block"
              >
                Go to Instruments Registry
              </Link>
            </div>
          </div>
        </main>
      </div>
    );
  }

  // Fetch Target Instrument by ID
  const { data: rawInstrument, error } = await supabase
    .from('instruments')
    .select('*')
    .eq('id', instrumentId)
    .maybeSingle();

  if (error || !rawInstrument) {
    return (
      <div className="min-h-screen flex flex-col bg-zinc-50 dark:bg-black">
        <DashboardHeader userEmail={user.email || ''} profile={profile} />
        <main className="flex-1 max-w-4xl w-full mx-auto p-6 space-y-6">
          <div className="bg-white dark:bg-zinc-900 p-8 rounded-xl shadow-sm border border-zinc-200 dark:border-zinc-800 text-center space-y-4">
            <div className="text-4xl">❌</div>
            <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">
              Instrument Not Found
            </h2>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 max-w-md mx-auto">
              The specified instrument (ID: {instrumentId}) could not be found.
            </p>
            <div className="pt-2">
              <Link
                href="/dashboard/instruments"
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors inline-block"
              >
                Return to Instruments List
              </Link>
            </div>
          </div>
        </main>
      </div>
    );
  }

  const instrument = rawInstrument as Instrument;

  // Fetch Active Rule Sets from Supabase
  let ruleSets: RuleSet[] = [];
  try {
    const { data: dbRuleSets, error } = await supabase.from('rule_sets').select('*');
    console.log('[DEBUG] ALL RULE SETS IN DB:', dbRuleSets);
    console.log('[DEBUG] DB ERROR:', error);
    ruleSets = await fetchActiveRuleSets(supabase);
  } catch (err) {
    console.error('Error fetching rule sets:', err);
  }

  // Fallback Rule Sets if DB table not yet seeded
  if (ruleSets.length === 0) {
    console.log('--- FALLING BACK TO STATIC RULE SETS ---');
    ruleSets = [
      {
        id: '11111111-1111-1111-1111-111111111111',
        standard: 'Legal Metrology General Rules',
        version: '2011',
        jurisdiction: 'INDIA',
        status: 'ACTIVE',
        description: 'Indian Legal Metrology (General) Rules 2011 for NAWI',
        created_at: new Date().toISOString(),
      },
      {
        id: '22222222-2222-2222-2222-222222222222',
        standard: 'OIML R-76',
        version: '2006',
        jurisdiction: 'INTERNATIONAL',
        status: 'ACTIVE',
        description: 'OIML R-76:2006 Non-Automatic Weighing Instruments International Standard',
        created_at: new Date().toISOString(),
      },
    ];
  }

  return (
    <div className="min-h-screen flex flex-col bg-zinc-50 dark:bg-black">
      <DashboardHeader userEmail={user.email || ''} profile={profile} />

      <main className="flex-1 max-w-5xl w-full mx-auto p-6 space-y-6">
        <div>
          <Link
            href={`/dashboard/instruments/${instrument.id}`}
            className="text-sm text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200 transition-colors inline-block mb-3"
          >
            ← Back to Instrument #{instrument.serial_number}
          </Link>
          <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
            OIML R-76 Inspection Workflow
          </h2>
          <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-1">
            Execute versioned inspection rule tests for {instrument.manufacturer} {instrument.model}.
          </p>
        </div>

        <InspectionForm
          instrument={instrument}
          ruleSets={ruleSets}
          inspector={profile}
          inspectorEmail={user.email || ''}
        />
      </main>
    </div>
  );
}
