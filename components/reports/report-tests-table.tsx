import React from 'react';
import { ReportData } from '@/lib/reports/report-types';

function StatusBadge({ status }: { status: string }) {
  let badgeClass = 'text-slate-500 bg-slate-100 border-slate-200';
  if (status === 'PASS') badgeClass = 'text-green-700 bg-green-50 border-green-200';
  if (status === 'FAIL') badgeClass = 'text-red-700 bg-red-50 border-red-200';
  if (status === 'NOT_APPLICABLE') badgeClass = 'text-slate-500 bg-slate-100 border-slate-200';
  if (status === 'PENDING') badgeClass = 'text-yellow-700 bg-yellow-50 border-yellow-200';

  return (
    <span className={`px-2 py-1 text-xs font-semibold rounded border ${badgeClass} print:bg-transparent print:border-none print:p-0 print:font-bold ${status === 'PASS' ? 'print:text-green-700' : status === 'FAIL' ? 'print:text-red-700' : ''}`}>
      {status.replace('_', ' ')}
    </span>
  );
}

export default function ReportTestsTable({ data }: { data: ReportData }) {
  const { tests, instrument } = data;
  const unit = instrument.unit || 'g';

  return (
    <section className="mb-8 print:mb-6">
      <h3 className="text-lg font-bold border-b border-slate-300 pb-2 mb-4 text-slate-800">
        Test Results
      </h3>
      
      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left border-collapse">
          <thead>
            <tr className="bg-slate-100 text-slate-700 border-y border-slate-300 print:bg-slate-50">
              <th className="py-3 px-4 font-semibold w-12 text-center">#</th>
              <th className="py-3 px-4 font-semibold">Test Item</th>
              <th className="py-3 px-4 font-semibold text-right">Load</th>
              <th className="py-3 px-4 font-semibold text-right">Error</th>
              <th className="py-3 px-4 font-semibold text-right">MPE Limit</th>
              <th className="py-3 px-4 font-semibold text-center w-28">Result</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {tests.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-6 text-center text-slate-500 italic">
                  No tests recorded for this inspection.
                </td>
              </tr>
            ) : (
              tests.map((test) => (
                <tr key={test.id} className="hover:bg-slate-50 print:hover:bg-transparent">
                  <td className="py-3 px-4 text-center text-slate-500">{test.test_sequence}</td>
                  <td className="py-3 px-4">
                    <div className="font-medium text-slate-900">{test.test_definition?.name || test.test_type}</div>
                    <div className="text-xs text-slate-500 font-mono mt-0.5">{test.test_definition?.clause}</div>
                  </td>
                  <td className="py-3 px-4 text-right">
                    {test.test_load !== null ? `${test.test_load} ${unit}` : '-'}
                  </td>
                  <td className="py-3 px-4 text-right font-mono">
                    {test.error !== null ? (
                      <span className={test.error && test.mpe && Math.abs(test.error) > test.mpe ? 'text-red-600 font-bold' : ''}>
                        {test.error > 0 ? '+' : ''}{test.error} {unit}
                      </span>
                    ) : '-'}
                  </td>
                  <td className="py-3 px-4 text-right font-mono text-slate-600">
                    {test.mpe !== null ? `±${test.mpe} ${unit}` : '-'}
                  </td>
                  <td className="py-3 px-4 text-center">
                    <StatusBadge status={test.result} />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
