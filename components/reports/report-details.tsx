import React from 'react';
import { ReportData } from '@/lib/reports/report-types';
import { formatDecimal } from '@/lib/compliance/decimal';

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <>
      <dt className="font-semibold text-slate-600">{label}</dt>
      <dd className="text-slate-900">{children}</dd>
    </>
  );
}

export default function ReportDetails({ data }: { data: ReportData }) {
  const { inspection, instrument, inspector, rule_set } = data;
  const unit = instrument.unit || '';

  const formatStage = (value: string) => value.replace(/_/g, ' ');

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8 print:gap-6 print:mb-6 print:break-inside-avoid">
      {/* Instrument under test */}
      <section className="bg-slate-50 p-6 rounded-lg border border-slate-200 print:bg-transparent print:border-none print:p-0">
        <h3 className="text-base font-bold border-b border-slate-300 pb-2 mb-4 text-slate-800 uppercase tracking-wide">
          Instrument Under Test
        </h3>
        <dl className="grid grid-cols-[130px_1fr] gap-y-2.5 text-sm">
          <Row label="Type">{formatStage(instrument.instrument_type)}</Row>
          <Row label="Manufacturer">{instrument.manufacturer || 'Not recorded'}</Row>
          <Row label="Model">{instrument.model || 'Not recorded'}</Row>
          <Row label="Serial No.">
            <span className="font-mono">{instrument.serial_number || 'Not recorded'}</span>
          </Row>
          {/* accuracy_class already contains the word "Class" - do not prefix it again */}
          <Row label="Accuracy class">{instrument.accuracy_class || 'Not recorded'}</Row>
          <Row label="Max capacity">
            {instrument.max_capacity !== null
              ? `${formatDecimal(instrument.max_capacity, 3)} ${unit}`
              : 'Not recorded'}
          </Row>
          <Row label="Min capacity">
            {instrument.min_capacity !== null
              ? `${formatDecimal(instrument.min_capacity, 3)} ${unit}`
              : 'Not recorded'}
          </Row>
          <Row label="Verification interval e">
            {instrument.verification_interval_e !== null
              ? `${formatDecimal(instrument.verification_interval_e, 4)} ${unit}`
              : 'Not recorded'}
          </Row>
          <Row label="Actual interval d">
            {instrument.actual_interval_d !== null
              ? `${formatDecimal(instrument.actual_interval_d, 4)} ${unit}`
              : 'Not recorded'}
          </Row>
        </dl>
      </section>

      {/* Inspection context */}
      <section className="bg-slate-50 p-6 rounded-lg border border-slate-200 print:bg-transparent print:border-none print:p-0">
        <h3 className="text-base font-bold border-b border-slate-300 pb-2 mb-4 text-slate-800 uppercase tracking-wide">
          Inspection Context
        </h3>
        <dl className="grid grid-cols-[130px_1fr] gap-y-2.5 text-sm">
          <Row label="Inspection ID">
            <span className="font-mono text-xs break-all">{inspection.id}</span>
          </Row>
          <Row label="Control stage">{formatStage(inspection.inspection_type)}</Row>
          <Row label="Inspection date">
            {new Date(inspection.inspection_date).toLocaleString(undefined, {
              dateStyle: 'long',
              timeStyle: 'short',
            })}
          </Row>
          <Row label="Inspector">{inspector.full_name || 'Not recorded'}</Row>
          <Row label="Rule set">{rule_set.standard}</Row>
          <Row label="Rule version">
            {/* The version stored ON the inspection is authoritative: it is what
                was actually applied, even if the rule set has changed since. */}
            {inspection.rule_version || rule_set.version}
            {inspection.rule_version &&
              inspection.rule_version !== rule_set.version && (
                <span className="block text-xs text-amber-700 mt-0.5">
                  Applied at inspection time; the rule set is now at version {rule_set.version}.
                </span>
              )}
          </Row>
          <Row label="Jurisdiction">{rule_set.jurisdiction}</Row>
          <Row label="Data source">{formatStage(inspection.data_source)}</Row>
        </dl>
      </section>
    </div>
  );
}
