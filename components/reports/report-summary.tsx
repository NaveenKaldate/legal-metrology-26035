import React from 'react';
import { ReportData } from '@/lib/reports/report-types';

export default function ReportSummary({ data }: { data: ReportData }) {
  const { inspection, rule_set } = data;
  
  const isPass = inspection.overall_result === 'PASS';
  const isFail = inspection.overall_result === 'FAIL';

  return (
    <div className="space-y-8 print:break-inside-avoid">
      {/* Overall Compliance */}
      <section className={`p-6 rounded-lg border-2 ${
        isPass ? 'border-green-300 bg-green-50' : 
        isFail ? 'border-red-300 bg-red-50' : 
        'border-yellow-300 bg-yellow-50'
      } print:border-2 print:bg-transparent`}>
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <div>
            <h3 className="text-xl font-bold mb-1 text-slate-900">
              Overall Compliance Conclusion
            </h3>
            <p className="text-sm text-slate-700">
              {isPass && 'The instrument complies with all evaluated maximum permissible errors (MPE) and legal metrology requirements.'}
              {isFail && 'The instrument FAILS to comply with evaluated legal metrology requirements. It must not be used for trade until repaired and reverified.'}
              {!isPass && !isFail && 'The inspection is currently incomplete or pending further evaluation.'}
            </p>
          </div>
          <div className="flex-shrink-0">
            <span className={`inline-block px-6 py-3 text-2xl font-black uppercase tracking-widest rounded-md border-2 ${
              isPass ? 'text-green-700 border-green-500 bg-green-100 print:text-green-800' :
              isFail ? 'text-red-700 border-red-500 bg-red-100 print:text-red-800' :
              'text-yellow-700 border-yellow-500 bg-yellow-100 print:text-yellow-800'
            }`}>
              {inspection.overall_result}
            </span>
          </div>
        </div>
      </section>

      {/* Traceability */}
      <section className="bg-slate-50 p-6 rounded-lg border border-slate-200 text-sm print:bg-transparent print:border-none print:p-0 print:text-xs">
        <h4 className="font-bold text-slate-800 mb-2 uppercase tracking-wide text-xs">
          Legal & Metrological Traceability
        </h4>
        <p className="text-slate-600 mb-2">
          This inspection was evaluated using the following legally binding rule set. All Maximum Permissible Errors (MPE) and test applicability determinations were sourced strictly from this version:
        </p>
        <div className="font-mono bg-white border border-slate-200 p-3 rounded text-slate-800 print:border-slate-300 print:bg-transparent">
          <div className="grid grid-cols-[100px_1fr] gap-1">
            <span className="text-slate-500">Standard:</span> 
            <span className="font-bold">{rule_set.standard}</span>
            <span className="text-slate-500">Version:</span> 
            <span>{rule_set.version} ({rule_set.status})</span>
            <span className="text-slate-500">Jurisdiction:</span> 
            <span>{rule_set.jurisdiction}</span>
            <span className="text-slate-500">Rule Set ID:</span> 
            <span className="text-xs">{rule_set.id}</span>
          </div>
        </div>
      </section>
      
      {/* Signatures */}
      <section className="mt-12 pt-8 grid grid-cols-2 gap-8 print:mt-16 print:pt-8 text-center print:break-inside-avoid">
        <div>
          <div className="border-b border-slate-400 mx-8 mb-2 h-16 flex items-end justify-center pb-2">
            <span className="text-slate-400 italic text-sm">(Digital Signature / Authorized Stamp)</span>
          </div>
          <p className="font-bold text-slate-800">{data.inspector.full_name}</p>
          <p className="text-sm text-slate-500">Legal Metrology Officer</p>
        </div>
        <div>
          <div className="border-b border-slate-400 mx-8 mb-2 h-16"></div>
          <p className="font-bold text-slate-800">Instrument Owner / Representative</p>
          <p className="text-sm text-slate-500">Acknowledged receipt of report</p>
        </div>
      </section>
    </div>
  );
}

