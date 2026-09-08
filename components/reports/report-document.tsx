import React from 'react';
import { ReportData } from '@/lib/reports/report-types';
import ReportHeader from './report-header';
import ReportDetails from './report-details';
import ReportTestsTable from './report-tests-table';
import ReportSummary from './report-summary';

interface ReportDocumentProps {
  data: ReportData;
}

export default function ReportDocument({ data }: ReportDocumentProps) {
  return (
    <div className="bg-white text-slate-900 w-full max-w-4xl mx-auto shadow-xl rounded-xl border border-slate-200 print:shadow-none print:border-none print:max-w-none print:rounded-none">
      <div className="p-8 md:p-12 print:p-0">
        <ReportHeader />
        
        <ReportDetails data={data} />
        
        <ReportTestsTable data={data} />
        
        <ReportSummary data={data} />
      </div>
    </div>
  );
}

