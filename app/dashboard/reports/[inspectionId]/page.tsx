import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getInspectionReportData } from '@/lib/reports/report-data';
import ReportDocument from '@/components/reports/report-document';
import PrintControls from '@/components/reports/print-controls';

export const metadata = {
  title: 'Test Report - Legal Metrology Platform',
  description: 'Official test report for Non-Automatic Weighing Instrument (NAWI)',
};

interface ReportPageProps {
  params: Promise<{ inspectionId: string }>;
}

export default async function ReportPage({ params }: ReportPageProps) {
  const supabase = await createClient();
  const { inspectionId } = await params;

  // Validate session
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    redirect('/login');
  }

  // Fetch structured report data
  const reportData = await getInspectionReportData(inspectionId);

  // If reportData is null, either the inspection doesn't exist,
  // or it lacks the required foreign key associations (e.g., missing rule set)
  if (!reportData) {
    return (
      <div className="min-h-screen bg-slate-50 p-6 flex items-center justify-center print:hidden">
        <div className="max-w-md w-full bg-white p-8 rounded-xl shadow-sm border border-slate-200 text-center">
          <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-red-500 mx-auto mb-4"><circle cx="12" cy="12" r="10"/><line x1="12" x2="12" y1="8" y2="12"/><line x1="12" x2="12.01" y1="16" y2="16"/></svg>
          <h2 className="text-xl font-bold text-slate-900 mb-2">Report Validation Error</h2>
          <p className="text-slate-600 mb-6">
            Unable to generate test report. The inspection record is missing required historical associations (such as a valid Rule Set or Instrument data).
          </p>
          <PrintControls inspectionId={inspectionId} />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 p-4 md:p-8 print:p-0 print:bg-white">
      <div className="max-w-4xl mx-auto">
        <PrintControls inspectionId={inspectionId} />
        
        <ReportDocument data={reportData} />
      </div>
    </div>
  );
}
