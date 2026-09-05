'use client';

import Link from 'next/link';
import { Instrument } from '@/types/database';

export interface InspectionHistoryItem {
  id: string;
  inspection_type: string;
  inspection_date: string;
  data_source: string;
  overall_result: string;
  created_at: string;
  inspector?: {
    full_name: string | null;
  } | null;
}

interface InstrumentDetailProps {
  instrument: Instrument;
  inspections?: InspectionHistoryItem[];
  successMessage?: string | null;
}

export default function InstrumentDetail({
  instrument,
  inspections = [],
  successMessage,
}: InstrumentDetailProps) {
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'ACTIVE':
        return (
          <span className="px-3 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300">
            ACTIVE
          </span>
        );
      case 'INACTIVE':
        return (
          <span className="px-3 py-1 text-xs font-semibold rounded-full bg-zinc-100 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-300">
            INACTIVE
          </span>
        );
      case 'UNDER_INSPECTION':
        return (
          <span className="px-3 py-1 text-xs font-semibold rounded-full bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300">
            UNDER INSPECTION
          </span>
        );
      default:
        return null;
    }
  };

  const getResultBadge = (result: string) => {
    switch (result) {
      case 'PASS':
        return (
          <span className="px-2.5 py-0.5 text-xs font-semibold rounded-full bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300">
            PASS
          </span>
        );
      case 'FAIL':
        return (
          <span className="px-2.5 py-0.5 text-xs font-semibold rounded-full bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300">
            FAIL
          </span>
        );
      case 'PENDING':
      default:
        return (
          <span className="px-2.5 py-0.5 text-xs font-semibold rounded-full bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300">
            PENDING
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Success Notification */}
      {successMessage && (
        <div className="p-4 text-sm text-green-800 bg-green-100 dark:bg-green-950/50 dark:text-green-300 rounded-lg border border-green-200 dark:border-green-900 flex items-center justify-between">
          <span>{successMessage}</span>
        </div>
      )}

      {/* Action Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link
            href="/dashboard/instruments"
            className="text-sm text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200 transition-colors"
          >
            ← Back to Instruments
          </Link>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href={`/dashboard/inspections/new?instrumentId=${instrument.id}`}
            className="px-4 py-2 text-sm font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors cursor-pointer"
          >
            📋 Start Inspection
          </Link>

          <Link
            href={`/dashboard/instruments/${instrument.id}/edit`}
            className="px-4 py-2 text-sm font-medium text-zinc-700 dark:text-zinc-300 bg-white dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-700 transition-colors cursor-pointer"
          >
            Edit Instrument
          </Link>
        </div>
      </div>

      {/* Main Details Card */}
      <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-sm border border-zinc-200 dark:border-zinc-800 overflow-hidden">
        {/* Title Header */}
        <div className="p-6 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-800/30 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <span className="text-2xl">
                {instrument.instrument_type === 'ELECTRONIC_WEIGHING'
                  ? '⚖️'
                  : '🏋️'}
              </span>
              <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">
                {instrument.manufacturer} {instrument.model}
              </h2>
            </div>
            <p className="text-xs font-mono text-zinc-500 dark:text-zinc-400 mt-1">
              Serial Number: {instrument.serial_number}
            </p>
          </div>

          <div>{getStatusBadge(instrument.status)}</div>
        </div>

        {/* Details Grid */}
        <div className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <div className="p-4 bg-zinc-50 dark:bg-zinc-800/40 rounded-xl space-y-1">
            <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400 block uppercase tracking-wider">
              Instrument Type
            </span>
            <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              {instrument.instrument_type === 'ELECTRONIC_WEIGHING'
                ? 'Electronic Weighing Instrument'
                : 'Platform Weighing Scale'}
            </span>
          </div>

          <div className="p-4 bg-zinc-50 dark:bg-zinc-800/40 rounded-xl space-y-1">
            <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400 block uppercase tracking-wider">
              Accuracy Class
            </span>
            <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              {instrument.accuracy_class || 'N/A'}
            </span>
          </div>

          <div className="p-4 bg-zinc-50 dark:bg-zinc-800/40 rounded-xl space-y-1">
            <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400 block uppercase tracking-wider">
              Unit of Measurement
            </span>
            <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              {instrument.unit}
            </span>
          </div>

          <div className="p-4 bg-zinc-50 dark:bg-zinc-800/40 rounded-xl space-y-1">
            <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400 block uppercase tracking-wider">
              Max Capacity (Max)
            </span>
            <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              {instrument.max_capacity ?? 'N/A'} {instrument.unit}
            </span>
          </div>

          <div className="p-4 bg-zinc-50 dark:bg-zinc-800/40 rounded-xl space-y-1">
            <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400 block uppercase tracking-wider">
              Min Capacity (Min)
            </span>
            <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              {instrument.min_capacity ?? 'N/A'} {instrument.unit}
            </span>
          </div>

          <div className="p-4 bg-zinc-50 dark:bg-zinc-800/40 rounded-xl space-y-1">
            <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400 block uppercase tracking-wider">
              Verification Scale Interval (e)
            </span>
            <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              {instrument.verification_interval_e ?? 'N/A'} {instrument.unit}
            </span>
          </div>

          <div className="p-4 bg-zinc-50 dark:bg-zinc-800/40 rounded-xl space-y-1">
            <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400 block uppercase tracking-wider">
              Actual Scale Interval (d)
            </span>
            <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              {instrument.actual_interval_d ?? 'N/A'} {instrument.unit}
            </span>
          </div>

          <div className="p-4 bg-zinc-50 dark:bg-zinc-800/40 rounded-xl space-y-1">
            <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400 block uppercase tracking-wider">
              Instrument ID (UUID)
            </span>
            <span className="text-xs font-mono text-zinc-900 dark:text-zinc-100 break-all">
              {instrument.id}
            </span>
          </div>

          <div className="p-4 bg-zinc-50 dark:bg-zinc-800/40 rounded-xl space-y-1">
            <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400 block uppercase tracking-wider">
              Registration Date
            </span>
            <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              {new Date(instrument.created_at).toLocaleString()}
            </span>
          </div>
        </div>
      </div>

      {/* Inspection History Section */}
      <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-sm border border-zinc-200 dark:border-zinc-800 p-6 space-y-4">
        <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-3">
          <div>
            <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
              Inspection History
            </h3>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
              Previous inspection workflows executed for this instrument.
            </p>
          </div>

          <Link
            href={`/dashboard/inspections/new?instrumentId=${instrument.id}`}
            className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline"
          >
            + Start New Inspection
          </Link>
        </div>

        {inspections.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-zinc-50 dark:bg-zinc-800/50 border-b border-zinc-200 dark:border-zinc-800 font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                  <th className="px-4 py-2.5">Inspection ID</th>
                  <th className="px-4 py-2.5">Type</th>
                  <th className="px-4 py-2.5">Inspection Date</th>
                  <th className="px-4 py-2.5">Inspector</th>
                  <th className="px-4 py-2.5">Data Source</th>
                  <th className="px-4 py-2.5">Overall Result</th>
                  <th className="px-4 py-2.5 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                {inspections.map((insp) => (
                  <tr key={insp.id} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-800/30">
                    <td className="px-4 py-3 font-mono font-semibold">
                      {insp.id.slice(0, 8)}...
                    </td>
                    <td className="px-4 py-3 font-medium">{insp.inspection_type}</td>
                    <td className="px-4 py-3 text-zinc-500 dark:text-zinc-400">
                      {new Date(insp.inspection_date).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3">{insp.inspector?.full_name || 'Inspector'}</td>
                    <td className="px-4 py-3">
                      <span className="font-mono px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-[10px]">
                        {insp.data_source}
                      </span>
                    </td>
                    <td className="px-4 py-3">{getResultBadge(insp.overall_result)}</td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/dashboard/inspections/${insp.id}`}
                        className="font-semibold text-blue-600 hover:text-blue-500 dark:text-blue-400 hover:underline"
                      >
                        View Record →
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-8 text-center bg-zinc-50 dark:bg-zinc-800/30 rounded-xl space-y-2">
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              No previous inspection history found for this instrument.
            </p>
            <Link
              href={`/dashboard/inspections/new?instrumentId=${instrument.id}`}
              className="inline-block text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline"
            >
              Click here to launch the first inspection
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
