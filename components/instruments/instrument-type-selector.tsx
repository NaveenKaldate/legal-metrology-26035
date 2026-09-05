'use client';

import { InstrumentType } from '@/types/database';

interface InstrumentTypeSelectorProps {
  value: InstrumentType;
  onChange: (type: InstrumentType) => void;
  disabled?: boolean;
}

export default function InstrumentTypeSelector({
  value,
  onChange,
  disabled = false,
}: InstrumentTypeSelectorProps) {
  const options: {
    type: InstrumentType;
    title: string;
    description: string;
    icon: string;
  }[] = [
    {
      type: 'ELECTRONIC_WEIGHING',
      title: 'Electronic Weighing Instrument',
      description:
        'Standard precision electronic counter, bench scale, or laboratory balance.',
      icon: '⚖️',
    },
    {
      type: 'PLATFORM_WEIGHING',
      title: 'Platform Weighing Scale',
      description:
        'Heavy-duty floor scale, platform weighing system, or industrial weighbridge.',
      icon: '🏋️',
    },
  ];

  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
        Instrument Profile Type <span className="text-red-500">*</span>
      </label>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {options.map((option) => {
          const selected = value === option.type;
          return (
            <button
              key={option.type}
              type="button"
              disabled={disabled}
              onClick={() => onChange(option.type)}
              className={`p-4 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between space-y-3 ${
                selected
                  ? 'border-blue-600 bg-blue-50/50 dark:bg-blue-950/30 dark:border-blue-500 ring-2 ring-blue-500/20'
                  : 'border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:border-zinc-300 dark:hover:border-zinc-700'
              } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              <div className="flex items-start justify-between w-full">
                <span className="text-2xl">{option.icon}</span>
                <div
                  className={`w-5 h-5 rounded-full border flex items-center justify-center ${
                    selected
                      ? 'border-blue-600 bg-blue-600 dark:border-blue-500 dark:bg-blue-500'
                      : 'border-zinc-300 dark:border-zinc-700'
                  }`}
                >
                  {selected && (
                    <span className="w-2 h-2 rounded-full bg-white" />
                  )}
                </div>
              </div>
              <div>
                <h4 className="font-semibold text-sm text-zinc-900 dark:text-zinc-100">
                  {option.title}
                </h4>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                  {option.description}
                </p>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

