import React from 'react';
import { ReportData } from '@/lib/reports/report-types';
import { buildReportReference, buildVerificationUrl } from '@/lib/reports/finalization';
import ReportHeader from './report-header';
import ReportDetails from './report-details';
import ReportTestsTable from './report-tests-table';
import ReportSummary from './report-summary';
import ReportQr from './report-qr';

interface ReportDocumentProps {
  data: ReportData;
}

export default function ReportDocument({ data }: ReportDocumentProps) {
  const { inspection } = data;
  const isFinal = inspection.report_status === 'FINAL';
  const token = inspection.verification_token;

  // A reference is only meaningful once a token exists, i.e. once issued.
  const reference = token
    ? buildReportReference(token, inspection.inspection_date)
    : undefined;

  const verificationUrl = token ? buildVerificationUrl(token) : null;

  return (
    <article className="report-document bg-white text-slate-900 w-full max-w-4xl mx-auto shadow-xl rounded-xl border border-slate-200 print:shadow-none print:border-none print:max-w-none print:rounded-none">
      <div className="p-8 md:p-12 print:p-0">
        <ReportHeader
          reportReference={reference}
          reportStatus={inspection.report_status}
          finalizedAt={inspection.finalized_at}
        />

        <ReportDetails data={data} />
        <ReportTestsTable data={data} />

        {/* Verification block - only for issued reports. A draft has no
            verification code, so none is shown or implied. */}
        {isFinal && verificationUrl && (
          <section className="mb-8 print:mb-6 print:break-inside-avoid">
            <h3 className="text-base font-bold border-b border-slate-300 pb-2 mb-4 text-slate-800 uppercase tracking-wide">
              Independent Verification
            </h3>
            <div className="flex flex-col sm:flex-row items-start gap-6 bg-slate-50 p-5 rounded-lg border border-slate-200 print:bg-transparent print:border-slate-300">
              <ReportQr verificationUrl={verificationUrl} size={120} />
              <div className="text-xs text-slate-700 space-y-2 flex-1">
                <p>
                  Scan the code, or open the address below, to confirm that this report was issued
                  by this system and has not been altered since.
                </p>
                <p className="font-mono text-[11px] break-all text-slate-900">{verificationUrl}</p>
                <p className="text-slate-500">
                  The code contains only this address. It carries no personal data and no report
                  content.
                </p>
              </div>
            </div>
          </section>
        )}

        <ReportSummary data={data} />
      </div>
    </article>
  );
}
