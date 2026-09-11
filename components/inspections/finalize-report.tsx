'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { FinalizationBlocker } from '@/lib/reports/finalization';

interface FinalizeReportProps {
  inspectionId: string;
  canFinalize: boolean;
  blockers: FinalizationBlocker[];
}

/**
 * Finalization trigger.
 *
 * The button state here is convenience only. Authorization, completeness and
 * the DRAFT -> FINAL transition are all re-checked inside the database
 * function `finalize_inspection`, which runs as one transaction, so a report
 * cannot become FINAL without its audit record - and a crafted request that
 * skips this component gains nothing.
 */
export default function FinalizeReport({
  inspectionId,
  canFinalize,
  blockers,
}: FinalizeReportProps) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFinalize = async () => {
    setSubmitting(true);
    setError(null);

    try {
      const supabase = createClient();
      const { error: rpcError } = await supabase.rpc('finalize_inspection', {
        p_inspection_id: inspectionId,
      });

      if (rpcError) {
        // The database raises readable messages for every rejection path
        // (already final, unresolved tests, not authorized, still pending).
        setError(rpcError.message.replace(/^.*?:\s*/, ''));
        setSubmitting(false);
        return;
      }

      setConfirming(false);
      router.refresh();
    } catch {
      setError('Could not finalize the report. Please try again.');
      setSubmitting(false);
    }
  };

  if (!canFinalize) {
    return (
      <div className="p-4 bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-900/60 rounded-xl text-xs text-amber-900 dark:text-amber-200 space-y-2">
        <span className="font-bold block">This report cannot be finalized yet</span>
        <ul className="list-disc list-inside space-y-1">
          {blockers.map((b) => (
            <li key={b.code}>{b.message}</li>
          ))}
        </ul>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {error && (
        <div
          role="alert"
          className="p-3 text-xs text-red-700 bg-red-50 dark:bg-red-950/40 dark:text-red-300 rounded-lg border border-red-200 dark:border-red-900"
        >
          {error}
        </div>
      )}

      {!confirming ? (
        <button
          type="button"
          onClick={() => setConfirming(true)}
          className="px-4 py-2 text-sm font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
        >
          Finalize Report
        </button>
      ) : (
        <div className="p-4 bg-white dark:bg-zinc-900 border-2 border-blue-300 dark:border-blue-800 rounded-xl space-y-3">
          <p className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
            Finalize this report?
          </p>
          <p className="text-xs text-zinc-600 dark:text-zinc-400">
            After finalization, the inspection and its test results cannot be edited or deleted
            through the normal workflow. A verification code will be issued so the report can be
            checked independently.
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              disabled={submitting}
              onClick={handleFinalize}
              className="px-4 py-2 text-xs font-bold text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {submitting ? 'Finalizing…' : 'Finalize Report'}
            </button>
            <button
              type="button"
              disabled={submitting}
              onClick={() => {
                setConfirming(false);
                setError(null);
              }}
              className="px-4 py-2 text-xs font-medium text-zinc-700 dark:text-zinc-300 bg-zinc-100 dark:bg-zinc-800 rounded-lg hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
