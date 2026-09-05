'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { Instrument, InstrumentType, InstrumentStatus } from '@/types/database';

interface InstrumentListProps {
  initialInstruments: Instrument[];
  successMessage?: string | null;
}

export default function InstrumentList({
  initialInstruments,
  successMessage,
}: InstrumentListProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedType, setSelectedType] = useState<string>('ALL');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');

  const filteredInstruments = useMemo(() => {
    return initialInstruments.filter((instrument) => {
      // Type Filter
      if (selectedType !== 'ALL' && instrument.instrument_type !== selectedType) {
        return false;
      }

      // Status Filter
      if (selectedStatus !== 'ALL' && instrument.status !== selectedStatus) {
        return false;
      }

      // Search Query
      if (searchQuery.trim() !== '') {
        const query = searchQuery.toLowerCase().trim();
        const manufacturer = (instrument.manufacturer || '').toLowerCase();
        const model = (instrument.model || '').toLowerCase();
        const serialNumber = (instrument.serial_number || '').toLowerCase();
        const typeStr = instrument.instrument_type.toLowerCase();

        return (
          manufacturer.includes(query) ||
          model.includes(query) ||
          serialNumber.includes(query) ||
          typeStr.includes(query)
        );
      }

      return true;
    });
  }, [initialInstruments, searchQuery, selectedType, selectedStatus]);

  const getStatusBadge = (status: InstrumentStatus) => {
    switch (status) {
      case 'ACTIVE':
        return (
          <span className="px-2.5 py-0.5 text-xs font-semibold rounded-full bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300">
            ACTIVE
          </span>
        );
      case 'INACTIVE':
        return (
          <span className="px-2.5 py-0.5 text-xs font-semibold rounded-full bg-zinc-100 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-300">
            INACTIVE
          </span>
        );
      case 'UNDER_INSPECTION':
        return (
          <span className="px-2.5 py-0.5 text-xs font-semibold rounded-full bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300">
            UNDER INSPECTION
          </span>
        );
      default:
        return null;
    }
  };

  const getTypeLabel = (type: InstrumentType) => {
    return type === 'ELECTRONIC_WEIGHING'
      ? 'Electronic Weighing'
      : 'Platform Scale';
  };

  return (
    <div className="space-y-6">
      {/* Toast Notification Banner */}
      {successMessage && (
        <div className="p-4 text-sm text-green-800 bg-green-100 dark:bg-green-950/50 dark:text-green-300 rounded-lg border border-green-200 dark:border-green-900 flex items-center justify-between">
          <span>{successMessage}</span>
        </div>
      )}

      {/* Header Actions & Filters */}
      <div className="bg-white dark:bg-zinc-900 p-4 rounded-xl shadow-sm border border-zinc-200 dark:border-zinc-800 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
        {/* Search Input */}
        <div className="relative flex-1">
          <input
            type="text"
            placeholder="Search manufacturer, model, or serial number..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-sm border rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-zinc-900 dark:text-zinc-100 bg-white dark:bg-zinc-800 border-zinc-300 dark:border-zinc-700"
          />
          <span className="absolute left-3 top-2.5 text-zinc-400 text-sm">
            🔍
          </span>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3">
          <select
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value)}
            className="px-3 py-2 text-sm border rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-zinc-900 dark:text-zinc-100 bg-white dark:bg-zinc-800 border-zinc-300 dark:border-zinc-700"
          >
            <option value="ALL">All Types</option>
            <option value="ELECTRONIC_WEIGHING">Electronic Weighing</option>
            <option value="PLATFORM_WEIGHING">Platform Scale</option>
          </select>

          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="px-3 py-2 text-sm border rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-zinc-900 dark:text-zinc-100 bg-white dark:bg-zinc-800 border-zinc-300 dark:border-zinc-700"
          >
            <option value="ALL">All Statuses</option>
            <option value="ACTIVE">Active</option>
            <option value="INACTIVE">Inactive</option>
            <option value="UNDER_INSPECTION">Under Inspection</option>
          </select>

          <Link
            href="/dashboard/instruments/new"
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors whitespace-nowrap"
          >
            + Register Instrument
          </Link>
        </div>
      </div>

      {/* Instruments Table */}
      {filteredInstruments.length > 0 ? (
        <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-sm border border-zinc-200 dark:border-zinc-800 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-zinc-50 dark:bg-zinc-800/50 border-b border-zinc-200 dark:border-zinc-800 text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                  <th className="px-6 py-3">Type</th>
                  <th className="px-6 py-3">Manufacturer &amp; Model</th>
                  <th className="px-6 py-3">Serial Number</th>
                  <th className="px-6 py-3">Accuracy Class</th>
                  <th className="px-6 py-3">Max / Min Capacity</th>
                  <th className="px-6 py-3">Status</th>
                  <th className="px-6 py-3">Created Date</th>
                  <th className="px-6 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800 text-sm text-zinc-900 dark:text-zinc-100">
                {filteredInstruments.map((instrument) => (
                  <tr
                    key={instrument.id}
                    className="hover:bg-zinc-50/50 dark:hover:bg-zinc-800/30 transition-colors"
                  >
                    <td className="px-6 py-4 font-medium whitespace-nowrap">
                      <span className="inline-flex items-center gap-1.5">
                        <span className="text-xs">
                          {instrument.instrument_type === 'ELECTRONIC_WEIGHING'
                            ? '⚖️'
                            : '🏋️'}
                        </span>
                        {getTypeLabel(instrument.instrument_type)}
                      </span>
                    </td>

                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="font-semibold">
                        {instrument.manufacturer || 'N/A'}
                      </div>
                      <div className="text-xs text-zinc-500 dark:text-zinc-400">
                        {instrument.model || 'N/A'}
                      </div>
                    </td>

                    <td className="px-6 py-4 font-mono text-xs font-medium whitespace-nowrap">
                      {instrument.serial_number || 'N/A'}
                    </td>

                    <td className="px-6 py-4 whitespace-nowrap text-xs">
                      {instrument.accuracy_class || 'N/A'}
                    </td>

                    <td className="px-6 py-4 whitespace-nowrap text-xs">
                      <div>
                        Max: {instrument.max_capacity ?? 'N/A'} {instrument.unit}
                      </div>
                      <div className="text-zinc-500 dark:text-zinc-400">
                        Min: {instrument.min_capacity ?? 'N/A'} {instrument.unit}
                      </div>
                    </td>

                    <td className="px-6 py-4 whitespace-nowrap">
                      {getStatusBadge(instrument.status)}
                    </td>

                    <td className="px-6 py-4 text-xs text-zinc-500 dark:text-zinc-400 whitespace-nowrap">
                      {new Date(instrument.created_at).toLocaleDateString()}
                    </td>

                    <td className="px-6 py-4 text-right whitespace-nowrap">
                      <Link
                        href={`/dashboard/instruments/${instrument.id}`}
                        className="text-xs font-semibold text-blue-600 hover:text-blue-500 dark:text-blue-400 hover:underline"
                      >
                        View Details →
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* Empty State */
        <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-sm border border-zinc-200 dark:border-zinc-800 p-12 text-center space-y-4">
          <div className="text-4xl">⚖️</div>
          <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
            No instruments found
          </h3>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 max-w-md mx-auto">
            {searchQuery || selectedType !== 'ALL' || selectedStatus !== 'ALL'
              ? 'No registered instruments match your search filters. Try clearing filters or searching for a different keyword.'
              : 'There are currently no weighing instruments registered in the system. Register your first instrument to begin inspection workflows.'}
          </p>
          <div className="pt-2">
            {searchQuery || selectedType !== 'ALL' || selectedStatus !== 'ALL' ? (
              <button
                onClick={() => {
                  setSearchQuery('');
                  setSelectedType('ALL');
                  setSelectedStatus('ALL');
                }}
                className="px-4 py-2 text-sm font-medium text-zinc-700 dark:text-zinc-300 bg-zinc-100 dark:bg-zinc-800 rounded-lg hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
              >
                Clear Filters
              </button>
            ) : (
              <Link
                href="/dashboard/instruments/new"
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors inline-block"
              >
                Register First Instrument
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

