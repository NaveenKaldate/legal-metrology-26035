import React from 'react';
import { ReportData } from '@/lib/reports/report-types';
import { formatDecimal, formatSigned } from '@/lib/compliance/decimal';

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    PASS: 'text-green-800 bg-green-50 border-green-300 print:text-green-900',
    FAIL: 'text-red-800 bg-red-50 border-red-300 print:text-red-900',
    PENDING: 'text-amber-800 bg-amber-50 border-amber-300 print:text-amber-900',
    NOT_APPLICABLE: 'text-slate-600 bg-slate-100 border-slate-300',
  };

  return (
    <span
      className={`inline-block px-2 py-0.5 text-[11px] font-bold rounded border whitespace-nowrap ${
        styles[status] || styles.NOT_APPLICABLE
      } print:bg-transparent`}
    >
      {status === 'NOT_APPLICABLE' ? 'N/A' : status}
    </span>
  );
}

/** Load points recorded by the multi-point errors-of-indication test. */
interface RecordedPoint {
  label?: string;
  direction?: string;
  load?: number | null;
  observed?: number | null;
  load_in_e?: number | null;
  calculated_error?: number | null;
  mpe_value?: number | null;
  mpe_in_e?: number | null;
  result?: string;
}

export default function ReportTestsTable({ data }: { data: ReportData }) {
  const { tests, instrument } = data;
  const unit = instrument.unit || '';

  return (
    <section className="mb-8 print:mb-6">
      <h3 className="text-base font-bold border-b border-slate-300 pb-2 mb-4 text-slate-800 uppercase tracking-wide">
        Test Results
      </h3>

      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left border-collapse">
          <caption className="sr-only">
            Test results with observed values, calculated errors and the maximum permissible error applied
          </caption>
          <thead>
            <tr className="bg-slate-100 text-slate-700 border-y border-slate-300 print:bg-slate-50 text-[11px] uppercase tracking-wide">
              <th scope="col" className="py-2.5 px-3 font-semibold w-8 text-center">#</th>
              <th scope="col" className="py-2.5 px-3 font-semibold">Test</th>
              <th scope="col" className="py-2.5 px-3 font-semibold text-right">Load</th>
              <th scope="col" className="py-2.5 px-3 font-semibold text-right">Observed</th>
              <th scope="col" className="py-2.5 px-3 font-semibold text-right">Error</th>
              <th scope="col" className="py-2.5 px-3 font-semibold text-right">MPE</th>
              <th scope="col" className="py-2.5 px-3 font-semibold text-center w-20">Result</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {tests.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-6 text-center text-slate-500 italic">
                  No tests recorded for this inspection.
                </td>
              </tr>
            ) : (
              tests.map((test, index) => {
                const details = (test.calculation_details || {}) as Record<string, unknown>;
                const points = Array.isArray(details.points)
                  ? (details.points as RecordedPoint[])
                  : null;
                const clause =
                  (details.mpe_clause as string | null) || test.mpe_rule?.clause || null;
                const isNotApplicable = test.result === 'NOT_APPLICABLE';

                return (
                  <React.Fragment key={test.id}>
                    <tr className="align-top print:break-inside-avoid">
                      <td className="py-2.5 px-3 text-center text-slate-500">
                        {test.test_sequence ?? index + 1}
                      </td>
                      <td className="py-2.5 px-3">
                        <div className="font-medium text-slate-900">
                          <span className="font-mono text-xs text-slate-500 mr-1.5">
                            {test.test_type}
                          </span>
                          {test.test_definition?.name || test.test_type}
                        </div>
                        {test.test_definition?.clause && (
                          <div className="text-[11px] text-slate-500 font-mono mt-0.5">
                            Clause {test.test_definition.clause}
                          </div>
                        )}
                        {clause && (
                          <div className="text-[11px] text-slate-500 mt-0.5">
                            MPE rule: {clause}
                          </div>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono whitespace-nowrap">
                        {test.test_load !== null ? (
                          <>
                            {formatDecimal(test.test_load, 4)} {unit}
                            {typeof details.load_in_e === 'number' && (
                              <div className="text-[11px] text-slate-500">
                                {formatDecimal(details.load_in_e, 0)}e
                              </div>
                            )}
                          </>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono whitespace-nowrap">
                        {test.observed_value !== null
                          ? `${formatDecimal(test.observed_value, 4)} ${unit}`
                          : '—'}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono whitespace-nowrap">
                        {test.calculated_error !== null && test.calculated_error !== undefined ? (
                          <span className={test.result === 'FAIL' ? 'text-red-700 font-bold' : ''}>
                            {formatSigned(test.calculated_error, 4)} {unit}
                          </span>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono text-slate-600 whitespace-nowrap">
                        {test.mpe !== null && test.mpe !== undefined ? (
                          <>
                            ±{formatDecimal(test.mpe, 4)} {unit}
                            {typeof details.mpe_in_e === 'number' && (
                              <div className="text-[11px] text-slate-500">
                                {formatDecimal(details.mpe_in_e, 2)}e
                              </div>
                            )}
                          </>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <StatusBadge status={test.result} />
                      </td>
                    </tr>

                    {/* Per-point breakdown for multi-load errors of indication */}
                    {points && points.length > 0 && (
                      <tr className="print:break-inside-avoid">
                        <td />
                        <td colSpan={6} className="pb-3 px-3">
                          <table className="w-full text-[11px] border border-slate-200">
                            <thead>
                              <tr className="bg-slate-50 text-slate-600">
                                <th scope="col" className="py-1 px-2 text-left font-semibold">Load point</th>
                                <th scope="col" className="py-1 px-2 text-right font-semibold">Load</th>
                                <th scope="col" className="py-1 px-2 text-right font-semibold">Observed</th>
                                <th scope="col" className="py-1 px-2 text-right font-semibold">Error</th>
                                <th scope="col" className="py-1 px-2 text-right font-semibold">MPE</th>
                                <th scope="col" className="py-1 px-2 text-center font-semibold">Result</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                              {points.map((point, i) => (
                                <tr key={`${test.id}-p${i}`}>
                                  <td className="py-1 px-2">
                                    {point.label || `Point ${i + 1}`}
                                    {point.direction === 'DOWN' && (
                                      <span className="text-slate-500"> (unloading)</span>
                                    )}
                                  </td>
                                  <td className="py-1 px-2 text-right font-mono">
                                    {formatDecimal(point.load, 4)} {unit}
                                  </td>
                                  <td className="py-1 px-2 text-right font-mono">
                                    {formatDecimal(point.observed, 4)} {unit}
                                  </td>
                                  <td className="py-1 px-2 text-right font-mono">
                                    {formatSigned(point.calculated_error, 4)} {unit}
                                  </td>
                                  <td className="py-1 px-2 text-right font-mono text-slate-600">
                                    ±{formatDecimal(point.mpe_value, 4)} {unit}
                                  </td>
                                  <td className="py-1 px-2 text-center">
                                    <StatusBadge status={point.result || 'PENDING'} />
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </td>
                      </tr>
                    )}

                    {/* Remarks / reason */}
                    {test.remarks && (
                      <tr className="print:break-inside-avoid">
                        <td />
                        <td
                          colSpan={6}
                          className={`pb-3 px-3 text-xs ${
                            isNotApplicable ? 'text-slate-500 italic' : 'text-slate-600'
                          }`}
                        >
                          {test.remarks}
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
