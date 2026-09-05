'use client';

import { useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { Profile } from '@/types/database';

interface DashboardHeaderProps {
  userEmail: string;
  profile: Profile | null;
}

export default function DashboardHeader({
  userEmail,
  profile,
}: DashboardHeaderProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [loggingOut, setLoggingOut] = useState(false);

  const handleLogout = async () => {
    setLoggingOut(true);
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  };

  const fullName = profile?.full_name || 'Inspector User';
  const role = profile?.role || 'INSPECTOR';

  const isDashboardActive = pathname === '/dashboard';
  const isInstrumentsActive = pathname.startsWith('/dashboard/instruments');
  const isInspectionsActive = pathname.startsWith('/dashboard/inspections');

  return (
    <header className="bg-white dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 px-6 py-4">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex flex-col sm:flex-row sm:items-center gap-6">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">
                Legal Metrology Portal
              </h1>
              <span
                className={`px-2.5 py-0.5 text-xs font-semibold rounded-full ${
                  role === 'ADMIN'
                    ? 'bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300'
                    : 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300'
                }`}
              >
                {role}
              </span>
            </div>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
              Weighing Instrument Inspection &amp; Compliance
            </p>
          </div>

          {/* Navigation Bar */}
          <nav className="flex items-center gap-2 border-l border-zinc-200 dark:border-zinc-800 pl-0 sm:pl-6">
            <Link
              href="/dashboard"
              className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                isDashboardActive
                  ? 'bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300 font-semibold'
                  : 'text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800'
              }`}
            >
              Dashboard
            </Link>

            <Link
              href="/dashboard/instruments"
              className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                isInstrumentsActive
                  ? 'bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300 font-semibold'
                  : 'text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800'
              }`}
            >
              Instruments
            </Link>

            <Link
              href="/dashboard/inspections"
              className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                isInspectionsActive
                  ? 'bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300 font-semibold'
                  : 'text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800'
              }`}
            >
              Inspections
            </Link>
          </nav>
        </div>

        <div className="flex items-center gap-6">
          <div className="text-right">
            <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              {fullName}
            </p>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              {userEmail}
            </p>
          </div>

          <button
            onClick={handleLogout}
            disabled={loggingOut}
            className="px-4 py-2 text-sm font-medium text-zinc-700 hover:text-zinc-900 dark:text-zinc-300 dark:hover:text-white bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
          >
            {loggingOut ? 'Logging out...' : 'Logout'}
          </button>
        </div>
      </div>
    </header>
  );
}
