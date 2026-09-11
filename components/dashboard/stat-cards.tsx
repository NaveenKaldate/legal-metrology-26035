import Link from 'next/link';

interface StatCardsProps {
  instrumentsCount?: number;
  inspectionsCount?: number;
  passedCount?: number;
  failedCount?: number;
  pendingCount?: number;
}

export default function StatCards({
  instrumentsCount = 0,
  inspectionsCount = 0,
  passedCount = 0,
  failedCount = 0,
  pendingCount = 0,
}: StatCardsProps) {
  const stats = [
    {
      name: 'Instruments',
      value: instrumentsCount,
      description: 'Registered weighing instruments',
      border: 'border-l-blue-500',
      text: 'text-blue-600 dark:text-blue-400',
      href: '/dashboard/instruments',
    },
    {
      name: 'Inspections',
      value: inspectionsCount,
      description: 'All recorded inspections',
      border: 'border-l-indigo-500',
      text: 'text-indigo-600 dark:text-indigo-400',
      href: '/dashboard/inspections',
    },
    {
      name: 'Passed',
      value: passedCount,
      description: 'Within maximum permissible error',
      border: 'border-l-green-500',
      text: 'text-green-600 dark:text-green-400',
      href: '/dashboard/inspections',
    },
    {
      name: 'Failed',
      value: failedCount,
      description: 'Exceeded permissible error',
      border: 'border-l-red-500',
      text: 'text-red-600 dark:text-red-400',
      href: '/dashboard/inspections',
    },
    {
      name: 'Pending',
      value: pendingCount,
      description: 'Awaiting completion',
      border: 'border-l-amber-500',
      text: 'text-amber-600 dark:text-amber-400',
      href: '/dashboard/inspections',
    },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
      {stats.map((stat) => (
        <Link
          key={stat.name}
          href={stat.href}
          className={`p-5 bg-white dark:bg-zinc-900 rounded-xl shadow-sm border-l-4 border-y border-r border-zinc-200 dark:border-zinc-800 ${stat.border} transition-shadow hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500`}
        >
          <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">
            {stat.name}
          </p>
          <p className={`text-3xl font-extrabold mt-1.5 ${stat.text}`}>{stat.value}</p>
          <p className="text-[11px] text-zinc-400 dark:text-zinc-500 mt-1 leading-snug">
            {stat.description}
          </p>
        </Link>
      ))}
    </div>
  );
}
