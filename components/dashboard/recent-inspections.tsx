import Link from 'next/link';

export interface RecentInspectionRow {
  id: string;
  inspection_date: string;
  inspection_type: string;
  overall_result: string;
  instrument?: {
    manufacturer: string | null;
    model: string | null;
    serial_number: string | null;
  } | null;
}

function ResultBadge({ result }: { result: string }) {
  const styles: Record<string, string> = {
    PASS: 'bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300',
    FAIL: 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300',
    PENDING: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300',
  };
  return (
    <span
      className={`px-2 py-0.5 text-[11px] font-semibold rounded-full whitespace-nowrap ${
        styles[result] || styles.PENDING
      }`}
    >
      {result}
    </span>
  );
}

export default function RecentInspections({ rows }: { rows: RecentInspectionRow[] }) {
  return (
    <section className="bg-white dark:bg-zinc-900 rounded-xl shadow-sm border border-zinc-200 dark:border-zinc-800">
      <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-100 dark:border-zinc-800">
        <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
          Recent inspections
        </h3>
        <Link
          href="/dashboard/inspections"
          className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline"
        >
          View all →
        </Link>
      </div>

      {rows.length === 0 ? (
        <div className="px-6 py-10 text-center space-y-3">
          <div aria-hidden="true" className="text-3xl">
            📋
          </div>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            No inspections recorded yet.
          </p>
          <Link
            href="/dashboard/instruments"
            className="inline-block px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
          >
            Start an inspection
          </Link>
        </div>
      ) : (
        <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
          {rows.map((row) => (
            <li key={row.id}>
              <Link
                href={`/dashboard/inspections/${row.id}`}
                className="flex items-center justify-between gap-4 px-6 py-3 hover:bg-zinc-50 dark:hover:bg-zinc-800/40 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-500"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100 truncate">
                    {row.instrument?.manufacturer || 'Unknown'} {row.instrument?.model || ''}
                  </p>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 truncate">
                    <span className="font-mono">{row.instrument?.serial_number || 'No serial'}</span>
                    {' · '}
                    {row.inspection_type.replace(/_/g, ' ')}
                    {' · '}
                    {new Date(row.inspection_date).toLocaleDateString()}
                  </p>
                </div>
                <ResultBadge result={row.overall_result} />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
