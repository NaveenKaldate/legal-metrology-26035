import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import DashboardHeader from '@/components/dashboard/header';
import StatCards from '@/components/dashboard/stat-cards';
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

  // Fetch the corresponding user profile from public.profiles
  const { data: rawProfile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .maybeSingle();

  const profile = rawProfile as Profile | null;

  // Fetch actual instrument count from public.instruments
  const { count: instrumentsCount } = await supabase
    .from('instruments')
    .select('*', { count: 'exact', head: true });

  return (
    <div className="min-h-screen flex flex-col bg-zinc-50 dark:bg-black">
      <DashboardHeader userEmail={user.email || ''} profile={profile} />

      <main className="flex-1 max-w-7xl w-full mx-auto p-6 space-y-8">
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

        {/* Live Instrument Stat Cards */}
        <StatCards
          instrumentsCount={instrumentsCount ?? 0}
          inspectionsCount={0}
          passedCount={0}
          failedCount={0}
        />

        {/* Profile Details Card */}
        <div className="bg-white dark:bg-zinc-900 p-6 rounded-xl shadow-sm border border-zinc-200 dark:border-zinc-800 space-y-4">
          <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
            Account Profile Information
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div className="p-3 bg-zinc-50 dark:bg-zinc-800/50 rounded-lg">
              <span className="text-xs text-zinc-500 dark:text-zinc-400 block font-medium">
                User ID (UUID)
              </span>
              <span className="font-mono text-zinc-900 dark:text-zinc-100 text-xs sm:text-sm break-all">
                {user.id}
              </span>
            </div>

            <div className="p-3 bg-zinc-50 dark:bg-zinc-800/50 rounded-lg">
              <span className="text-xs text-zinc-500 dark:text-zinc-400 block font-medium">
                Full Name
              </span>
              <span className="text-zinc-900 dark:text-zinc-100 font-medium">
                {profile?.full_name || 'Not provided'}
              </span>
            </div>

            <div className="p-3 bg-zinc-50 dark:bg-zinc-800/50 rounded-lg">
              <span className="text-xs text-zinc-500 dark:text-zinc-400 block font-medium">
                Email Address
              </span>
              <span className="text-zinc-900 dark:text-zinc-100">
                {user.email}
              </span>
            </div>

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
