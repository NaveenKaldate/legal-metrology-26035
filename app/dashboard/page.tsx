import { redirect } from 'next/navigation';

import { createClient } from '@/lib/supabase/server';

import DashboardHeader from '@/components/dashboard/header';

import StatCards from '@/components/dashboard/stat-cards';

import RecentInspections, {
  RecentInspectionRow,
} from '@/components/dashboard/recent-inspections';

import { Profile } from '@/types/database';

export const metadata = {
  title: 'Dashboard - Legal Metrology Platform',
  description: 'Inspector compliance & instrument management dashboard',
};

export default async function DashboardPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  // ---------------------------------------------------------
  // Fetch user profile
  // ---------------------------------------------------------
  const { data: rawProfile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .maybeSingle();

  const profile = rawProfile as Profile | null;

  // ---------------------------------------------------------
  // Fetch total instrument count
  // ---------------------------------------------------------
  const { count: instrumentsCount } = await supabase
    .from('instruments')
    .select('*', {
      count: 'exact',
      head: true,
    });

  // ---------------------------------------------------------
  // Instrument type distribution
  // ---------------------------------------------------------
  const { data: instrumentRows } = await supabase
    .from('instruments')
    .select('instrument_type');

  const typeDistribution = ((instrumentRows || []) as Array<{
    instrument_type: string;
  }>).reduce<Record<string, number>>((acc, row) => {
    acc[row.instrument_type] = (acc[row.instrument_type] || 0) + 1;
    return acc;
  }, {});

  // ---------------------------------------------------------
  // Inspection statistics.
  // Counts come from `inspections.overall_result` (the OVERALL inspection
  // result) - never from `inspection_tests.result`, which is per test.
  // Counted with head-only queries so the whole table is not transferred.
  // ---------------------------------------------------------
  const countByResult = async (result: 'PASS' | 'FAIL' | 'PENDING') => {
    const { count } = await supabase
      .from('inspections')
      .select('*', { count: 'exact', head: true })
      .eq('overall_result', result);
    return count ?? 0;
  };

  const [
    { count: totalInspections, error: inspectionsError },
    passedCount,
    failedCount,
    pendingCount,
  ] = await Promise.all([
    supabase.from('inspections').select('*', { count: 'exact', head: true }),
    countByResult('PASS'),
    countByResult('FAIL'),
    countByResult('PENDING'),
  ]);

  const inspectionsCount = totalInspections ?? 0;

  // ---------------------------------------------------------
  // Five most recent inspections
  // ---------------------------------------------------------
  const { data: rawRecent } = await supabase
    .from('inspections')
    .select(
      `id, inspection_date, inspection_type, overall_result,
       instrument:instruments(manufacturer, model, serial_number)`
    )
    .order('inspection_date', { ascending: false })
    .limit(5);

  const recentInspections = (rawRecent || []) as unknown as RecentInspectionRow[];

  // ---------------------------------------------------------
  // Dashboard
  // ---------------------------------------------------------
  return (
    <div className="min-h-screen flex flex-col bg-zinc-50 dark:bg-black">

      <DashboardHeader
        userEmail={user.email || ''}
        profile={profile}
      />

      <main className="flex-1 max-w-7xl w-full mx-auto p-6 space-y-8">

        {/* Dashboard Heading */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
              Welcome, {profile?.full_name || 'Inspector'}
            </h2>

            <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-1">
              System overview and weighing scale inspection metrics
            </p>
          </div>
        </div>

        {/* Dashboard Statistics */}
        <StatCards
          instrumentsCount={instrumentsCount ?? 0}
          inspectionsCount={inspectionsCount}
          passedCount={passedCount}
          failedCount={failedCount}
          pendingCount={pendingCount}
        />

        {/* Inspection Query Error */}
        {inspectionsError && (
          <div className="p-4 text-sm text-red-700 bg-red-100 dark:bg-red-950/50 dark:text-red-300 rounded-lg border border-red-200 dark:border-red-900">
            Failed to load inspection statistics:{' '}
            {inspectionsError.message}
          </div>
        )}

        {/* Recent activity & instrument mix */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <RecentInspections rows={recentInspections} />
          </div>

          <section className="bg-white dark:bg-zinc-900 rounded-xl shadow-sm border border-zinc-200 dark:border-zinc-800 p-6">
            <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-100 mb-4">
              Instrument types
            </h3>
            {Object.keys(typeDistribution).length === 0 ? (
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                No instruments registered yet.
              </p>
            ) : (
              <ul className="space-y-4">
                {Object.entries(typeDistribution).map(([type, count]) => {
                  const total = instrumentsCount || 1;
                  const percent = Math.round((count / total) * 100);
                  return (
                    <li key={type}>
                      <div className="flex items-baseline justify-between text-sm mb-1.5">
                        <span className="text-zinc-700 dark:text-zinc-300">
                          {type.replace(/_/g, ' ')}
                        </span>
                        <span className="font-semibold text-zinc-900 dark:text-zinc-100">
                          {count}
                        </span>
                      </div>
                      <div
                        className="h-2 w-full bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden"
                        role="img"
                        aria-label={`${type.replace(/_/g, ' ')}: ${count} of ${instrumentsCount} instruments (${percent}%)`}
                      >
                        <div
                          className="h-full bg-blue-500 rounded-full"
                          style={{ width: `${percent}%` }}
                        />
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </div>

        {/* Profile Details Card */}
        <div className="bg-white dark:bg-zinc-900 p-6 rounded-xl shadow-sm border border-zinc-200 dark:border-zinc-800 space-y-4">

          <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
            Account Profile Information
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">

            {/* User ID */}
            <div className="p-3 bg-zinc-50 dark:bg-zinc-800/50 rounded-lg">
              <span className="text-xs text-zinc-500 dark:text-zinc-400 block font-medium">
                User ID (UUID)
              </span>

              <span className="font-mono text-zinc-900 dark:text-zinc-100 text-xs sm:text-sm break-all">
                {user.id}
              </span>
            </div>

            {/* Full Name */}
            <div className="p-3 bg-zinc-50 dark:bg-zinc-800/50 rounded-lg">
              <span className="text-xs text-zinc-500 dark:text-zinc-400 block font-medium">
                Full Name
              </span>

              <span className="text-zinc-900 dark:text-zinc-100 font-medium">
                {profile?.full_name || 'Not provided'}
              </span>
            </div>

            {/* Email */}
            <div className="p-3 bg-zinc-50 dark:bg-zinc-800/50 rounded-lg">
              <span className="text-xs text-zinc-500 dark:text-zinc-400 block font-medium">
                Email Address
              </span>

              <span className="text-zinc-900 dark:text-zinc-100">
                {user.email}
              </span>
            </div>

            {/* Role */}
            <div className="p-3 bg-zinc-50 dark:bg-zinc-800/50 rounded-lg">
              <span className="text-xs text-zinc-500 dark:text-zinc-400 block font-medium">
                Assigned Role
              </span>

              <span className="text-zinc-900 dark:text-zinc-100 font-semibold">
                {profile?.role || 'INSPECTOR'}
              </span>
            </div>

          </div>
        </div>

      </main>
    </div>
  );
}