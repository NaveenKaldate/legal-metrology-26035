import React from 'react';
import { ReportData } from '@/lib/reports/report-types';

export default function ReportDetails({ data }: { data: ReportData }) {
  const { inspection, instrument, inspector } = data;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8 print:gap-6 print:mb-6">
      {/* Instrument Details */}
      <section className="bg-slate-50 p-6 rounded-lg border border-slate-200 print:bg-transparent print:border-none print:p-0">
        <h3 className="text-lg font-bold border-b border-slate-300 pb-2 mb-4 text-slate-800">
          Instrument Details
        </h3>
        <dl className="grid grid-cols-[140px_1fr] gap-y-3 text-sm">
          <dt className="font-semibold text-slate-600">Type:</dt>
          <dd className="text-slate-900 font-medium">{instrument.instrument_type.replace('_', ' ')}</dd>
          
          <dt className="font-semibold text-slate-600">Manufacturer:</dt>
          <dd className="text-slate-900">{instrument.manufacturer || 'N/A'}</dd>
          
          <dt className="font-semibold text-slate-600">Model:</dt>
          <dd className="text-slate-900">{instrument.model || 'N/A'}</dd>
          
          <dt className="font-semibold text-slate-600">Serial No:</dt>
          <dd className="text-slate-900 font-mono bg-white px-1 border border-slate-200 rounded print:border-none print:bg-transparent print:p-0">
            {instrument.serial_number || 'N/A'}
          </dd>

          <dt className="font-semibold text-slate-600">Class:</dt>
          <dd className="text-slate-900">Class {instrument.accuracy_class || 'N/A'}</dd>

          <dt className="font-semibold text-slate-600">Max / Min:</dt>
          <dd className="text-slate-900">
            {instrument.max_capacity ?? 'N/A'} {instrument.unit} / {instrument.min_capacity ?? 'N/A'} {instrument.unit}
          </dd>
          
          <dt className="font-semibold text-slate-600">e / d:</dt>
          <dd className="text-slate-900">
            e={instrument.verification_interval_e ?? 'N/A'} {instrument.unit}, 
            d={instrument.actual_interval_d ?? 'N/A'} {instrument.unit}
          </dd>
        </dl>
      </section>

      {/* Inspection Details */}
      <section className="bg-slate-50 p-6 rounded-lg border border-slate-200 print:bg-transparent print:border-none print:p-0">
        <h3 className="text-lg font-bold border-b border-slate-300 pb-2 mb-4 text-slate-800">
          Inspection Context
        </h3>
        <dl className="grid grid-cols-[140px_1fr] gap-y-3 text-sm">
          <dt className="font-semibold text-slate-600">Inspection ID:</dt>
          <dd className="text-slate-900 font-mono text-xs">{inspection.id}</dd>

          <dt className="font-semibold text-slate-600">Type:</dt>
          <dd className="text-slate-900">{inspection.inspection_type.replace('_', ' ')}</dd>
          
          <dt className="font-semibold text-slate-600">Date:</dt>
          <dd className="text-slate-900">
            {new Date(inspection.inspection_date).toLocaleDateString()}
          </dd>

          <dt className="font-semibold text-slate-600">Inspector:</dt>
          <dd className="text-slate-900">{inspector.full_name || 'Unknown'}</dd>

          <dt className="font-semibold text-slate-600 mt-4">Environment:</dt>
          <dd className="text-slate-500 italic mt-4">Not recorded</dd>
        </dl>
      </section>
    </div>
  );
}

