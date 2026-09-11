import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';

export const metadata = {
  title: 'Verify Report - NAWI Inspection Platform',
  description: 'Independently verify a finalized NAWI inspection report',
};

// Verification must always reflect current database state.
export const dynamic = 'force-dynamic';

/** Exactly the fields verify_report() returns - nothing internal. */
interface VerifiedReport {
  report_reference: string;
  report_status: string;
  overall_result: string;
  inspection_type: string;
  inspection_date: string;
  finalized_at: string | null;
  instrument_manufacturer: string | null;
  instrument_model: string | null;
  instrument_serial: string | null;
  accuracy_class: string | null;
  rule_standard: string | null;
  rule_version: string | null;
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen bg-slate-100 dark:bg-zinc-950 flex items-center justify-center p-4">
      <div className="w-full max-w-xl">
        <div className="text-center mb-6">
          <h1 className="text-lg font-bold text-slate-900 dark:text-zinc-100">
            Report Verification
          </h1>
          <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1">
            NAWI Inspection &amp; Test Report Platform
          </p>
        </div>
        {children}
        <p className="text-[11px] text-slate-500 dark:text-zinc-500 text-center mt-6 leading-relaxed">
          This verification confirms that a report with this code exists in the system and has been
          issued as final. This is a prototype built for Smart India Hackathon 2026 and is not an
          officially certified Legal Metrology document.
        </p>
      </div>
    </main>
  );
}

function NotFound() {
  return (
    <Shell>
      <div className="bg-white dark:bg-zinc-900 rounded-xl border border-slate-200 dark:border-zinc-800 p-8 text-center">
        <div aria-hidden="true" className="text-4xl mb-3">
          ✕
        </div>
        <h2 className="text-xl font-bold text-slate-900 dark:text-zinc-100 mb-2">
          Report Not Found
        </h2>
        <p className="text-sm text-slate-600 dark:text-zinc-400">
          The verification code is invalid or the report could not be verified.
        </p>
      </div>
    </Shell>
  );
}

function NotFinalized() {
  return (
    <Shell>
      <div className="bg-white dark:bg-zinc-900 rounded-xl border-2 border-amber-300 dark:border-amber-900 p-8 text-center">
        <div aria-hidden="true" className="text-4xl mb-3">
          ⏳
        </div>
        <h2 className="text-xl font-bold text-slate-900 dark:text-zinc-100 mb-2">
          Report Not Yet Finalized
        </h2>
        <p className="text-sm text-slate-600 dark:text-zinc-400">
          This report has not been issued as a final report and cannot be independently verified.
        </p>
      </div>
    </Shell>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <>
      <dt className="text-slate-500 dark:text-zinc-400">{label}</dt>
      <dd className="text-slate-900 dark:text-zinc-100 font-medium">{value}</dd>
    </>
  );
}

export default async function VerifyPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  // Reject anything that is not a UUID before touching the database.
  if (!UUID_PATTERN.test(token)) {
    return <NotFound />;
  }

  const supabase = await createClient();

  // Narrow SECURITY DEFINER function. There is no public read access to the
  // inspections table - this returns only the fields below, for one token.
  const { data, error } = await supabase.rpc('verify_report', { p_token: token });

  if (error) {
    // Never surface database detail to an anonymous visitor.
    return <NotFound />;
  }

  const report = (data as VerifiedReport[] | null)?.[0];

  if (!report) {
    // Distinguish "no such token" from "exists but still a draft", without
    // revealing anything about the draft itself.
    //
    // verification_token_state is granted to authenticated users only, so for
    // an anonymous visitor this call returns no data and the page falls
    // through to "Report Not Found". That is deliberate: the public surface is
    // verify_report() alone, and draft existence is not disclosed anonymously.
    // A signed-in user sees the precise "not yet finalized" message.
    const { data: state } = await supabase.rpc('verification_token_state', {
      p_token: token,
    });
    return state === 'DRAFT' ? <NotFinalized /> : <NotFound />;
  }

  const isPass = report.overall_result === 'PASS';
  const instrument = [report.instrument_manufacturer, report.instrument_model]
    .filter(Boolean)
    .join(' ');

  return (
    <Shell>
      <div className="bg-white dark:bg-zinc-900 rounded-xl border-2 border-green-400 dark:border-green-800 overflow-hidden">
        <div className="bg-green-50 dark:bg-green-950/40 px-8 py-6 text-center border-b border-green-200 dark:border-green-900">
          <div aria-hidden="true" className="text-4xl mb-2">
            ✓
          </div>
          <h2 className="text-xl font-bold text-green-900 dark:text-green-200">Report Verified</h2>
          <p className="text-xs text-green-800 dark:text-green-300 mt-1">
            This report exists and has been issued as final.
          </p>
        </div>

        <div className="p-8">
          <dl className="grid grid-cols-[150px_1fr] gap-y-3 text-sm">
            <Row label="Reference" value={report.report_reference} />
            <Row label="Report status" value={report.report_status} />

            <dt className="text-slate-500 dark:text-zinc-400">Overall result</dt>
            <dd>
              <span
                className={`px-2 py-0.5 text-xs font-bold rounded ${
                  isPass
                    ? 'bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300'
                    : 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300'
                }`}
              >
                {report.overall_result}
              </span>
            </dd>

            {instrument && <Row label="Instrument" value={instrument} />}
            {report.instrument_serial && (
              <Row label="Serial number" value={report.instrument_serial} />
            )}
            {report.accuracy_class && <Row label="Accuracy class" value={report.accuracy_class} />}
            <Row
              label="Control stage"
              value={report.inspection_type.replace(/_/g, ' ')}
            />
            <Row
              label="Inspection date"
              value={new Date(report.inspection_date).toLocaleDateString(undefined, {
                dateStyle: 'long',
              })}
            />
            {report.rule_standard && (
              <Row
                label="Rule set"
                value={`${report.rule_standard}${
                  report.rule_version ? ` v${report.rule_version}` : ''
                }`}
              />
            )}
            {report.finalized_at && (
              <Row
                label="Finalized"
                value={new Date(report.finalized_at).toLocaleString(undefined, {
                  dateStyle: 'long',
                  timeStyle: 'short',
                })}
              />
            )}
          </dl>
        </div>
      </div>

      <div className="text-center mt-4">
        <Link
          href="/"
          className="text-xs text-slate-500 dark:text-zinc-400 hover:text-slate-800 dark:hover:text-zinc-200 hover:underline"
        >
          About this platform
        </Link>
      </div>
    </Shell>
  );
}
