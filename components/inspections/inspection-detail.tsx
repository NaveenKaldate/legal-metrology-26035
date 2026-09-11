'use client';

import { useState } from 'react';
import Link from 'next/link';
import { InspectionTest, ReportAuditEntry, ReportStatus, RuleSet } from '@/types/database';

export interface InspectionDetailRecord {
  id: string;
  instrument_id: string;
  inspector_id: string;
  inspection_type: string;
  inspection_date: string;
  rule_version: string | null;
  rule_set_id: string | null;
  data_source: string;
  overall_result: string;
  report_status: ReportStatus;
  finalized_at: string | null;
  finalized_by: string | null;
  verification_token: string | null;
  created_at: string;
  rule_set?: RuleSet | null;
  instrument?: {
    id: string;
    instrument_type: string;
    manufacturer: string | null;
    model: string | null;
    serial_number: string | null;
    accuracy_class: string | null;
    max_capacity: number | null;
    min_capacity: number | null;
    unit: string | null;
    verification_interval_e: number | null;
    actual_interval_d: number | null;
  } | null;
  inspector?: {
    full_name: string | null;
  } | null;
  tests?: (InspectionTest & {
    test_definition?: {
      name: string;
      clause: string;
      category: string;
    } | null;
    mpe_rule?: {
      clause: string | null;
      mpe_multiplier: number;
    } | null;
  })[];
}

interface InspectionDetailProps {
  inspection: InspectionDetailRecord;
  successMessage?: string | null;
  auditEntries?: ReportAuditEntry[];
  /** Rendered only while the report is a DRAFT. */
  finalizeSlot?: React.ReactNode;
}

export default function InspectionDetail({
  inspection,
  successMessage,
  auditEntries = [],
  finalizeSlot,
}: InspectionDetailProps) {
  const isFinal = inspection.report_status === 'FINAL';
  const [expandedJson, setExpandedJson] = useState<Record<string, boolean>>({});

  const toggleJson = (id: string) => {
    setExpandedJson((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const getResultBadge = (result: string) => {
    switch (result) {
      case 'PASS':
        return (
          <span className="px-3 py-1 text-xs font-bold rounded-full bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300">
            PASS
          </span>
        );
      case 'FAIL':
        return (
          <span className="px-3 py-1 text-xs font-bold rounded-full bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300">
            FAIL
          </span>
        );
      case 'PENDING':
      default:
        return (
          <span className="px-3 py-1 text-xs font-bold rounded-full bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300">
            PENDING
          </span>
        );
    }
  };

  const unit = inspection.instrument?.unit || 'units';

  return (
    <div className="space-y-6">
      {/* Success Toast */}
      {successMessage && (
        <div className="p-4 text-sm text-green-800 bg-green-100 dark:bg-green-950/50 dark:text-green-300 rounded-lg border border-green-200 dark:border-green-900 flex items-center justify-between">
          <span>{successMessage}</span>
        </div>
      )}

      {/* Report lifecycle status */}
      <div
        className={`p-5 rounded-xl border-2 ${
          isFinal
            ? 'bg-green-50 dark:bg-green-950/30 border-green-400 dark:border-green-800'
            : 'bg-zinc-50 dark:bg-zinc-900 border-zinc-300 dark:border-zinc-700'
        }`}
      >
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <span className="text-[11px] font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400 block">
              Report status
            </span>
            <span
              className={`text-xl font-black uppercase tracking-wide ${
                isFinal
                  ? 'text-green-800 dark:text-green-300'
                  : 'text-zinc-700 dark:text-zinc-300'
              }`}
            >
              {inspection.report_status}
            </span>
            <p className="text-xs text-zinc-600 dark:text-zinc-400 mt-1 max-w-xl">
              {isFinal
                ? 'This report has been issued. The inspection and its test results can no longer be edited or deleted, and it can be verified independently.'
                : 'This report is still a draft. It can be edited, and it cannot be verified independently until it is finalized.'}
            </p>
          </div>

          {isFinal && (
            <dl className="text-xs space-y-1 text-right">
              {inspection.finalized_at && (
                <div>
                  <dt className="inline text-zinc-500 dark:text-zinc-400">Finalized at: </dt>
                  <dd className="inline font-medium text-zinc-900 dark:text-zinc-100">
                    {new Date(inspection.finalized_at).toLocaleString()}
                  </dd>
                </div>
              )}
              {inspection.inspector?.full_name && (
                <div>
                  <dt className="inline text-zinc-500 dark:text-zinc-400">Finalized by: </dt>
                  <dd className="inline font-medium text-zinc-900 dark:text-zinc-100">
                    {inspection.inspector.full_name}
                  </dd>
                </div>
              )}
            </dl>
          )}
        </div>

        {finalizeSlot && <div className="mt-4">{finalizeSlot}</div>}
      </div>

      {/* Navigation Header */}
      <div className="flex items-center justify-between">
        <Link
          href="/dashboard/inspections"
          className="text-sm text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200 transition-colors"
        >
          ← Back to Inspections History
        </Link>
        <div className="flex items-center gap-4">
          <Link
            href={`/dashboard/reports/${inspection.id}`}
            className="text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-md transition-colors shadow-sm flex items-center gap-2"
          >
            {isFinal ? 'View Final Report' : 'View Draft Report'}
          </Link>
          {isFinal && inspection.verification_token && (
            <Link
              href={`/verify/${inspection.verification_token}`}
              className="text-sm font-medium text-green-700 dark:text-green-300 hover:underline"
            >
              View Verification →
            </Link>
          )}
          {inspection.instrument?.id && (
            <Link
              href={`/dashboard/instruments/${inspection.instrument.id}`}
              className="text-sm font-medium text-blue-600 dark:text-blue-400 hover:underline"
            >
              View Instrument Details →
            </Link>
          )}
        </div>
      </div>

      {/* Rule Framework Banner */}
      <div className="p-4 bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900/60 rounded-xl text-xs space-y-1">
        <div className="flex items-center justify-between">
          <span className="font-bold text-blue-900 dark:text-blue-200 text-sm">
            📜 Governing Rule Standard:{' '}
            {inspection.rule_set?.standard || inspection.rule_version || 'OIML R-76'}
          </span>
          <span className="px-2.5 py-0.5 rounded font-mono font-bold bg-blue-100 dark:bg-blue-900/60 text-blue-800 dark:bg-blue-300">
            Version: {inspection.rule_set?.version || inspection.rule_version || '2006'}
          </span>
        </div>
        <p className="text-blue-800 dark:text-blue-300">
          Jurisdiction:{' '}
          <strong>{inspection.rule_set?.jurisdiction || 'INTERNATIONAL'}</strong> | Control Stage:{' '}
          <strong>{inspection.inspection_type}</strong>
        </p>
      </div>

      {/* Metadata Overview Card */}
      <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-sm border border-zinc-200 dark:border-zinc-800 overflow-hidden">
        <div className="p-6 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-800/30 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">
              Inspection Record #{inspection.id.slice(0, 8)}
            </h2>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
              Target Instrument: {inspection.instrument?.manufacturer}{' '}
              {inspection.instrument?.model} (SN: {inspection.instrument?.serial_number})
            </p>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-xs text-zinc-500 dark:text-zinc-400 font-medium">
              Calculated Overall Status:
            </span>
            {getResultBadge(inspection.overall_result)}
          </div>
        </div>

        <div className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
          <div className="p-3.5 bg-zinc-50 dark:bg-zinc-800/40 rounded-xl space-y-1">
            <span className="text-xs text-zinc-500 dark:text-zinc-400 block font-medium uppercase">
              Control Stage
            </span>
            <span className="font-semibold text-zinc-900 dark:text-zinc-100">
              {inspection.inspection_type}
            </span>
          </div>

          <div className="p-3.5 bg-zinc-50 dark:bg-zinc-800/40 rounded-xl space-y-1">
            <span className="text-xs text-zinc-500 dark:text-zinc-400 block font-medium uppercase">
              Inspection Date
            </span>
            <span className="font-semibold text-zinc-900 dark:text-zinc-100">
              {new Date(inspection.inspection_date).toLocaleString()}
            </span>
          </div>

          <div className="p-3.5 bg-zinc-50 dark:bg-zinc-800/40 rounded-xl space-y-1">
            <span className="text-xs text-zinc-500 dark:text-zinc-400 block font-medium uppercase">
              Assigned Inspector
            </span>
            <span className="font-semibold text-zinc-900 dark:text-zinc-100">
              {inspection.inspector?.full_name || 'Inspector'}
            </span>
          </div>

          <div className="p-3.5 bg-zinc-50 dark:bg-zinc-800/40 rounded-xl space-y-1">
            <span className="text-xs text-zinc-500 dark:text-zinc-400 block font-medium uppercase">
              Data Source Environment
            </span>
            <span
              className={`inline-block font-mono text-xs px-2 py-0.5 rounded ${
                inspection.data_source === 'SIMULATED'
                  ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                  : 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300'
              }`}
            >
              {inspection.data_source}
            </span>
          </div>
        </div>
      </div>

      {/* Tests Section */}
      <div className="space-y-4">
        <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
          Inspection Test Cards ({(inspection.tests || []).length})
        </h3>

        <div className="space-y-4">
          {(inspection.tests || []).map((test, index) => {
            const isJsonOpen = expandedJson[test.id || String(index)];

            return (
              <div
                key={test.id || index}
                className="bg-white dark:bg-zinc-900 p-6 rounded-xl shadow-sm border border-zinc-200 dark:border-zinc-800 space-y-4"
              >
                <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-3">
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300 text-xs font-bold flex items-center justify-center">
                      {test.test_sequence || index + 1}
                    </span>
                    <div>
                      <span className="font-mono text-xs font-bold text-blue-600 dark:text-blue-400 mr-2">
                        {test.test_type}
                      </span>
                      <span className="font-bold text-sm text-zinc-900 dark:text-zinc-100">
                        {test.test_definition?.name || test.test_type}
                      </span>
                      {test.test_definition?.clause && (
                        <span className="ml-2 px-2 py-0.5 text-[10px] font-mono bg-zinc-100 dark:bg-zinc-800 rounded">
                          Clause {test.test_definition.clause}
                        </span>
                      )}
                    </div>
                  </div>

                  <div>{getResultBadge(test.result)}</div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 text-xs">
                  <div className="p-3 bg-zinc-50 dark:bg-zinc-800/40 rounded-lg space-y-1">
                    <span className="text-zinc-500 dark:text-zinc-400 block font-medium">
                      Test Load
                    </span>
                    <span className="font-semibold text-zinc-900 dark:text-zinc-100 text-sm">
                      {test.test_load !== null ? `${test.test_load} ${unit}` : 'N/A'}
                    </span>
                  </div>

                  <div className="p-3 bg-zinc-50 dark:bg-zinc-800/40 rounded-lg space-y-1">
                    <span className="text-zinc-500 dark:text-zinc-400 block font-medium">
                      Calculation Method
                    </span>
                    <span className="font-mono text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                      {test.calculation_method || 'DETERMINISTIC'}
                    </span>
                  </div>

                  <div className="p-3 bg-zinc-50 dark:bg-zinc-800/40 rounded-lg space-y-1">
                    <span className="text-zinc-500 dark:text-zinc-400 block font-medium">
                      Calculated Error
                    </span>
                    <span className="font-mono font-bold text-zinc-900 dark:text-zinc-100 text-sm">
                      {test.calculated_error !== null || test.error !== null
                        ? `${(test.calculated_error ?? test.error)! > 0 ? '+' : ''}${
                            test.calculated_error ?? test.error
                          } ${unit}`
                        : 'N/A'}
                    </span>
                  </div>

                  <div className="p-3 bg-zinc-50 dark:bg-zinc-800/40 rounded-lg space-y-1">
                    <span className="text-zinc-500 dark:text-zinc-400 block font-medium">
                      Database MPE Limit
                    </span>
                    <span className="font-mono font-bold text-zinc-900 dark:text-zinc-100 text-sm">
                      {test.mpe !== null ? `+/- ${test.mpe} ${unit}` : 'N/A'}
                    </span>
                  </div>
                </div>

                {test.remarks && (
                  <div className="p-3 bg-zinc-50 dark:bg-zinc-800/40 rounded-lg text-xs space-y-1">
                    <span className="text-zinc-500 dark:text-zinc-400 font-medium block">
                      Inspector Remarks
                    </span>
                    <p className="text-zinc-800 dark:text-zinc-200">{test.remarks}</p>
                  </div>
                )}

                {/* Auditable JSON Details Drawer */}
                {test.calculation_details && (
                  <div className="pt-2 border-t border-zinc-100 dark:border-zinc-800">
                    <button
                      type="button"
                      onClick={() => toggleJson(test.id || String(index))}
                      className="text-xs font-mono font-semibold text-blue-600 hover:underline cursor-pointer flex items-center gap-1"
                    >
                      <span>{isJsonOpen ? '▼ Hide' : '▶ Show'} Auditable Calculation Details (JSONB)</span>
                    </button>

                    {isJsonOpen && (
                      <pre className="mt-2 p-3 bg-zinc-900 text-green-400 text-[11px] font-mono rounded-lg overflow-x-auto">
                        {JSON.stringify(test.calculation_details, null, 2)}
                      </pre>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Audit trail - append-only, written by the database on finalization */}
      {auditEntries.length > 0 && (
        <section className="bg-white dark:bg-zinc-900 rounded-xl shadow-sm border border-zinc-200 dark:border-zinc-800 p-6">
          <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-100 mb-1">
            Report audit trail
          </h3>
          <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mb-4">
            Recorded by the database. These entries cannot be edited or deleted.
          </p>
          <ol className="space-y-2">
            {auditEntries.map((entry) => (
              <li
                key={entry.id}
                className="flex flex-wrap items-baseline gap-x-3 gap-y-1 text-xs border-l-2 border-zinc-200 dark:border-zinc-700 pl-3 py-1"
              >
                <span className="font-mono font-bold text-zinc-900 dark:text-zinc-100">
                  {entry.action}
                </span>
                <span className="text-zinc-500 dark:text-zinc-400">
                  {new Date(entry.performed_at).toLocaleString()}
                </span>
              </li>
            ))}
          </ol>
        </section>
      )}
    </div>
  );
}
