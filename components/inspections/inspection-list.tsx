'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { RuleSet } from '@/types/database';

export interface InspectionWithDetails {
  id: string;
  instrument_id: string;
  inspector_id: string;
  inspection_type: string;
  inspection_date: string;
  rule_version: string | null;
  rule_set_id: string | null;
  data_source: string;
  overall_result: string;
  created_at: string;
  rule_set?: RuleSet | null;
  instrument?: {
    instrument_type: string;
    manufacturer: string | null;
    model: string | null;
    serial_number: string | null;
  } | null;
  inspector?: {
    full_name: string | null;
  } | null;
}

interface InspectionListProps {
  initialInspections: InspectionWithDetails[];
}

export default function InspectionList({
  initialInspections,
}: InspectionListProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedType, setSelectedType] = useState<string>('ALL');
  const [selectedResult, setSelectedResult] = useState<string>('ALL');

  const filteredInspections = useMemo(() => {
    return initialInspections.filter((item) => {
      // Type Filter
      if (selectedType !== 'ALL' && item.inspection_type !== selectedType) {
        return false;
      }

      // Result Filter
      if (selectedResult !== 'ALL' && item.overall_result !== selectedResult) {
        return false;
      }

      // Search Filter
      if (searchQuery.trim() !== '') {
        const query = searchQuery.toLowerCase().trim();
        const id = item.id.toLowerCase();
        const serial = (item.instrument?.serial_number || '').toLowerCase();
        const manufacturer = (item.instrument?.manufacturer || '').toLowerCase();
        const model = (item.instrument?.model || '').toLowerCase();
        const inspectorName = (item.inspector?.full_name || '').toLowerCase();
        const ruleStd = (item.rule_set?.standard || '').toLowerCase();

        return (
          id.includes(query) ||
          serial.includes(query) ||
          manufacturer.includes(query) ||
          model.includes(query) ||
          inspectorName.includes(query) ||
          ruleStd.includes(query)
        );
      }

      return true;
    });
  }, [initialInspections, searchQuery, selectedType, selectedResult]);

  const getResultBadge = (result: string) => {
    switch (result) {
      case 'PASS':
        return (
          <span className="px-2.5 py-0.5 text-xs font-semibold rounded-full bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300">
            PASS
          </span>
        );
      case 'FAIL':
        return (
          <span className="px-2.5 py-0.5 text-xs font-semibold rounded-full bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300">
            FAIL
          </span>
        );
      case 'PENDING':
      default:
        return (
          <span className="px-2.5 py-0.5 text-xs font-semibold rounded-full bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300">
            PENDING
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Workflow Disclaimer Notice */}
      <div className="p-4 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900/50 rounded-xl text-blue-800 dark:text-blue-300 text-xs flex items-center justify-between">
        <span>
         <strong>Rule Framework Notice:</strong> Deterministic compliance evaluation for OIML R-76 &amp; Indian Legal Metrology Rules.
        </span>
      </div>

      {/* Header Actions & Filters */}
      <div className="bg-white dark:bg-zinc-900 p-4 rounded-xl shadow-sm border border-zinc-200 dark:border-zinc-800 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
        {/* Search Input */}
        <div className="relative flex-1">
          <input
            type="text"
            placeholder="Search serial number, manufacturer, model, rule set, or ID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-sm border rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-zinc-900 dark:text-zinc-100 bg-white dark:bg-zinc-800 border-zinc-300 dark:border-zinc-700"
          />
          <span className="absolute left-3 top-2.5 text-zinc-400 text-sm">
            🔍
          </span>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3">
          <select
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value)}
            className="px-3 py-2 text-sm border rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-zinc-900 dark:text-zinc-100 bg-white dark:bg-zinc-800 border-zinc-300 dark:border-zinc-700"
          >
            <option value="ALL">All Control Stages</option>
            <option value="INITIAL">INITIAL</option>
            <option value="IN_SERVICE">IN_SERVICE</option>
            <option value="TYPE_EVALUATION">TYPE_EVALUATION</option>
          </select>

          <select
            value={selectedResult}
            onChange={(e) => setSelectedResult(e.target.value)}
            className="px-3 py-2 text-sm border rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-zinc-900 dark:text-zinc-100 bg-white dark:bg-zinc-800 border-zinc-300 dark:border-zinc-700"
          >
            <option value="ALL">All Results</option>
            <option value="PASS">PASS</option>
            <option value="FAIL">FAIL</option>
            <option value="PENDING">PENDING</option>
          </select>

          <Link
            href="/dashboard/instruments"
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors whitespace-nowrap"
          >
            + New Inspection
          </Link>
        </div>
      </div>

      {/* Inspections Table */}
      {filteredInspections.length > 0 ? (
        <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-sm border border-zinc-200 dark:border-zinc-800 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-zinc-50 dark:bg-zinc-800/50 border-b border-zinc-200 dark:border-zinc-800 text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                  <th className="px-6 py-3">Inspection ID</th>
                  <th className="px-6 py-3">Instrument &amp; Serial No.</th>
                  <th className="px-6 py-3">Rule Framework</th>
                  <th className="px-6 py-3">Stage</th>
                  <th className="px-6 py-3">Inspection Date</th>
                  <th className="px-6 py-3">Inspector</th>
                  <th className="px-6 py-3">Overall Result</th>
                  <th className="px-6 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800 text-sm text-zinc-900 dark:text-zinc-100">
                {filteredInspections.map((item) => (
                  <tr
                    key={item.id}
                    className="hover:bg-zinc-50/50 dark:hover:bg-zinc-800/30 transition-colors"
                  >
                    <td className="px-6 py-4 font-mono text-xs font-semibold whitespace-nowrap">
                      {item.id.slice(0, 8)}...
                    </td>

                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="font-semibold">
                        {item.instrument?.manufacturer || 'Unknown'} {item.instrument?.model || ''}
                      </div>
                      <div className="text-xs font-mono text-zinc-500 dark:text-zinc-400">
                        SN: {item.instrument?.serial_number || 'N/A'}
                      </div>
                    </td>

                    <td className="px-6 py-4 whitespace-nowrap text-xs">
                      <div className="font-semibold text-zinc-900 dark:text-zinc-100">
                        {item.rule_set?.standard || item.rule_version || 'OIML R-76'}
                      </div>
                      <div className="text-[11px] font-mono text-zinc-500">
                        {item.rule_set?.jurisdiction || 'INTERNATIONAL'} ({item.rule_set?.version || '2006'})
                      </div>
                    </td>

                    <td className="px-6 py-4 whitespace-nowrap text-xs">
                      <span className="font-medium">{item.inspection_type}</span>
                    </td>

                    <td className="px-6 py-4 whitespace-nowrap text-xs text-zinc-500 dark:text-zinc-400">
                      {new Date(item.inspection_date).toLocaleDateString()}
                    </td>

                    <td className="px-6 py-4 whitespace-nowrap text-xs">
                      {item.inspector?.full_name || 'Inspector'}
                    </td>

                    <td className="px-6 py-4 whitespace-nowrap">
                      {getResultBadge(item.overall_result)}
                    </td>

                    <td className="px-6 py-4 text-right whitespace-nowrap">
                      <Link
                        href={`/dashboard/inspections/${item.id}`}
                        className="text-xs font-semibold text-blue-600 hover:text-blue-500 dark:text-blue-400 hover:underline"
                      >
                        View Inspection →
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* Empty State */
        <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-sm border border-zinc-200 dark:border-zinc-800 p-12 text-center space-y-4">
          <div className="text-4xl">📋</div>
          <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
            No inspection records found
          </h3>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 max-w-md mx-auto">
            {searchQuery || selectedType !== 'ALL' || selectedResult !== 'ALL'
              ? 'No inspection records match your selected filters. Try clearing search keywords or filters.'
              : 'There are currently no inspection records saved in the system.'}
          </p>
          <div className="pt-2">
            {searchQuery || selectedType !== 'ALL' || selectedResult !== 'ALL' ? (
              <button
                onClick={() => {
                  setSearchQuery('');
                  setSelectedType('ALL');
                  setSelectedResult('ALL');
                }}
                className="px-4 py-2 text-sm font-medium text-zinc-700 dark:text-zinc-300 bg-zinc-100 dark:bg-zinc-800 rounded-lg hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
              >
                Clear Filters
              </button>
            ) : (
              <Link
                href="/dashboard/instruments"
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors inline-block"
              >
                Select Instrument for Inspection
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
