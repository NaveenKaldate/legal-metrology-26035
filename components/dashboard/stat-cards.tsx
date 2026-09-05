interface StatCardsProps {
  instrumentsCount?: number;
  inspectionsCount?: number;
  passedCount?: number;
  failedCount?: number;
}

export default function StatCards({
  instrumentsCount = 0,
  inspectionsCount = 0,
  passedCount = 0,
  failedCount = 0,
}: StatCardsProps) {
  const stats = [
    {
      name: 'Instruments',
      value: instrumentsCount,
      description: 'Registered weighing scales',
      color: 'border-blue-500 text-blue-600 dark:text-blue-400',
    },
    {
      name: 'Inspections',
      value: inspectionsCount,
      description: 'Total completed & pending',
      color: 'border-indigo-500 text-indigo-600 dark:text-indigo-400',
    },
    {
      name: 'Passed',
      value: passedCount,
      description: 'Compliant inspections',
      color: 'border-green-500 text-green-600 dark:text-green-400',
    },
    {
      name: 'Failed',
      value: failedCount,
      description: 'Non-compliant inspections',
      color: 'border-red-500 text-red-600 dark:text-red-400',
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
      {stats.map((stat) => (
        <div
          key={stat.name}
          className={`p-6 bg-white dark:bg-zinc-900 rounded-xl shadow-sm border-l-4 border-y border-r border-zinc-200 dark:border-zinc-800 ${stat.color.split(' ')[0]}`}
        >
          <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
            {stat.name}
          </p>
          <p className={`text-3xl font-extrabold mt-2 ${stat.color.split(' ').slice(1).join(' ')}`}>
            {stat.value}
          </p>
          <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-1">
            {stat.description}
          </p>
        </div>
      ))}
    </div>
  );
}

