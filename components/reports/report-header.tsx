import React from 'react';

interface ReportHeaderProps {
  reportReference?: string;
}

export default function ReportHeader({ reportReference }: ReportHeaderProps) {
  return (
    <header className="border-b-2 border-slate-800 pb-5 mb-8 print:mb-6">
      {/* Prototype notice - deliberately prominent and printed. */}
      <div className="mb-5 px-4 py-2 border border-amber-400 bg-amber-50 rounded text-center print:bg-transparent print:border-slate-400">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-amber-900 print:text-slate-900">
          Prototype / demonstration document — not an officially certified Legal Metrology report
        </p>
      </div>

      <div className="text-center">
        <h1 className="text-2xl md:text-3xl font-bold uppercase tracking-wide text-slate-900 mb-1">
          Test Report
        </h1>
        <h2 className="text-base md:text-lg font-medium text-slate-700">
          Non-Automatic Weighing Instrument (NAWI)
        </h2>
        <p className="text-xs text-slate-500 mt-2">
          NAWI Inspection &amp; Test Report Platform · SIH 2026 (PS 26035)
        </p>
        {reportReference && (
          <p className="text-xs font-mono text-slate-600 mt-2">
            Report reference: <span className="font-semibold">{reportReference}</span>
          </p>
        )}
      </div>
    </header>
  );
}
