import React from 'react';
import { ReportData } from '@/lib/reports/report-types';

export default function ReportSummary({ data }: { data: ReportData }) {
  const { inspection, rule_set, tests } = data;

  const isPass = inspection.overall_result === 'PASS';
  const isFail = inspection.overall_result === 'FAIL';

  const counts = tests.reduce(
    (acc, t) => {
      const key = t.result as keyof typeof acc;
      if (key in acc) acc[key] += 1;
      return acc;
    },
    { PASS: 0, FAIL: 0, PENDING: 0, NOT_APPLICABLE: 0 }
  );

  const conclusion = isPass
    ? 'All applicable tests were completed and every result was within the maximum permissible error defined by the rule set recorded below.'
    : isFail
    ? 'One or more applicable tests produced an error exceeding the maximum permissible error defined by the rule set recorded below.'
    : 'This inspection is incomplete. One or more applicable tests did not produce a result, so no overall conclusion can be drawn yet.';

  return (
    <div className="space-y-8 print:space-y-6">
      {/* Overall conclusion */}
      <section
        className={`p-6 rounded-lg border-2 print:break-inside-avoid ${
          isPass
            ? 'border-green-400 bg-green-50'
            : isFail
            ? 'border-red-400 bg-red-50'
            : 'border-amber-400 bg-amber-50'
        } print:bg-transparent`}
      >
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex-1">
            <h3 className="text-lg font-bold mb-1 text-slate-900 uppercase tracking-wide">
              Overall Result
            </h3>
            <p className="text-sm text-slate-700">{conclusion}</p>
            <p className="text-xs text-slate-600 mt-2">
              {counts.PASS} passed · {counts.FAIL} failed · {counts.PENDING} pending ·{' '}
              {counts.NOT_APPLICABLE} not applicable
            </p>
          </div>
          <div className="flex-shrink-0">
            <span
              className={`inline-block px-6 py-3 text-2xl font-black uppercase tracking-widest rounded border-2 ${
                isPass
                  ? 'text-green-800 border-green-600 bg-green-100'
                  : isFail
                  ? 'text-red-800 border-red-600 bg-red-100'
                  : 'text-amber-800 border-amber-600 bg-amber-100'
              } print:bg-transparent`}
            >
              {inspection.overall_result}
            </span>
          </div>
        </div>
      </section>

      {/* Traceability */}
      <section className="bg-slate-50 p-6 rounded-lg border border-slate-200 text-sm print:bg-transparent print:border-none print:p-0 print:break-inside-avoid">
        <h4 className="font-bold text-slate-800 mb-2 uppercase tracking-wide text-xs">
          Rule Set Traceability
        </h4>
        <p className="text-slate-600 mb-3 text-xs">
          Every maximum permissible error and applicability decision in this report was taken from the
          rule set below. The rule set identifier and version were stored with the inspection, and the
          MPE value and full calculation inputs were stored with each individual test, so this result
          can be reproduced even if a newer rule set is later activated.
        </p>
        <div className="font-mono bg-white border border-slate-200 p-3 rounded text-slate-800 text-xs print:border-slate-300 print:bg-transparent">
          <div className="grid grid-cols-[110px_1fr] gap-1">
            <span className="text-slate-500">Standard:</span>
            <span className="font-bold">{rule_set.standard}</span>
            <span className="text-slate-500">Version:</span>
            <span>{inspection.rule_version || rule_set.version}</span>
            <span className="text-slate-500">Jurisdiction:</span>
            <span>{rule_set.jurisdiction}</span>
            <span className="text-slate-500">Rule set ID:</span>
            <span className="break-all">{rule_set.id}</span>
          </div>
        </div>
        <p className="text-[11px] text-slate-500 mt-3 leading-relaxed">
          OIML R 76 is an international recommendation issued by the International Organization of
          Legal Metrology. It is a technical reference, not Indian law. Where an Indian Legal
          Metrology rule set is selected, it is applied as a separate framework in its own right.
        </p>
      </section>

      {/* Signatures */}
      <section className="mt-10 pt-6 grid grid-cols-2 gap-8 text-center print:mt-12 print:break-inside-avoid">
        <div>
          <div className="border-b border-slate-400 mx-6 mb-2 h-14" />
          <p className="font-semibold text-slate-800 text-sm">
            {data.inspector.full_name || 'Inspecting officer'}
          </p>
          <p className="text-xs text-slate-500">Inspecting officer (signature)</p>
        </div>
        <div>
          <div className="border-b border-slate-400 mx-6 mb-2 h-14" />
          <p className="font-semibold text-slate-800 text-sm">Instrument owner / representative</p>
          <p className="text-xs text-slate-500">Acknowledged receipt of report</p>
        </div>
      </section>

      {/* Footer disclaimer */}
      <footer className="pt-5 mt-6 border-t border-slate-300 text-[11px] text-slate-500 leading-relaxed print:break-inside-avoid">
        {inspection.report_status !== 'FINAL' && (
          <p className="mb-1.5">
            <strong className="text-slate-700">Draft:</strong> this report has not been issued as a
            final report. It may still change and cannot be independently verified.
          </p>
        )}
        <p>
          <strong className="text-slate-700">Prototype notice:</strong> this document was produced by
          a student prototype built for Smart India Hackathon 2026 (problem statement 26035). It is a
          demonstration of an automated test-report workflow. It is <strong>not</strong> an officially
          certified Legal Metrology document, carries no legal standing, and must not be used as
          evidence of verification or as authority to use an instrument for trade.
        </p>
        <p className="mt-1.5">
          Inspection ID {inspection.id} · generated {new Date().toLocaleString()}
        </p>
      </footer>
    </div>
  );
}
