import React from 'react';
import { ReportData } from '@/lib/reports/report-types';
import ReportHeader from './report-header';
import ReportDetails from './report-details';
import ReportTestsTable from './report-tests-table';
import ReportSummary from './report-summary';

interface ReportDocumentProps {
  data: ReportData;
}

/**
 * Builds a short, human-readable reference for the report.
 *
 * This is a derived display reference only - it is deterministic (same
 * inspection always yields the same string) but it is NOT an officially
 * issued report number and is not stored or uniqueness-checked. A real
 * sequential report number needs a database column; see AUDIT_REPORT.md.
 */
function buildReportReference(inspectionId: string, inspectionDate: string): string {
  const date = new Date(inspectionDate);
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const shortId = inspectionId.replace(/-/g, '').slice(0, 8).toUpperCase();
  return `NAWI/${yyyy}${mm}/${shortId}`;
}

export default function ReportDocument({ data }: ReportDocumentProps) {
  const reference = buildReportReference(data.inspection.id, data.inspection.inspection_date);

  return (
    <article className="report-document bg-white text-slate-900 w-full max-w-4xl mx-auto shadow-xl rounded-xl border border-slate-200 print:shadow-none print:border-none print:max-w-none print:rounded-none">
      <div className="p-8 md:p-12 print:p-0">
        <ReportHeader reportReference={reference} />
        <ReportDetails data={data} />
        <ReportTestsTable data={data} />
        <ReportSummary data={data} />
      </div>
    </article>
  );
}
