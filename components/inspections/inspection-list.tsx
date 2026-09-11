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
  const [selectedInstrument, setSelectedInstrument] = useState<string>('ALL');
  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');

  // Instruments that actually appear in the history, for the filter dropdown.
  const instrumentOptions = useMemo(() => {
    const seen = new Map<string, string>();
    for (const item of initialInspections) {
      if (!item.instrument_id) continue;
      const label = [
        item.instrument?.manufacturer,
        item.instrument?.model,
        item.instrument?.serial_number ? `(${item.instrument.serial_number})` : null,
      ]
        .filter(Boolean)
        .join(' ');
      if (!seen.has(item.instrument_id)) {
        seen.set(item.instrument_id, label || 'Unknown instrument');
      }
    }
    return Array.from(seen.entries())
      .map(([id, label]) => ({ id, label }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [initialInspections]);

  const hasActiveFilters =
    searchQuery.trim() !== '' ||
    selectedType !== 'ALL' ||
    selectedResult !== 'ALL' ||
    selectedInstrument !== 'ALL' ||
    dateFrom !== '' ||
    dateTo !== '';

  const clearFilters = () => {
    setSearchQuery('');
    setSelectedType('ALL');
    setSelectedResult('ALL');
    setSelectedInstrument('ALL');
    setDateFrom('');
    setDateTo('');
  };

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

      // Instrument Filter
      if (selectedInstrument !== 'ALL' && item.instrument_id !== selectedInstrument) {
        return false;
      }

      // Date Range Filter (inclusive of both endpoints, local dates)
      if (dateFrom || dateTo) {
        const inspectedAt = new Date(item.inspection_date);
        if (Number.isNaN(inspectedAt.getTime())) return false;

        if (dateFrom) {
          const from = new Date(`${dateFrom}T00:00:00`);
          if (inspectedAt < from) return false;
        }
        if (dateTo) {
          const to = new Date(`${dateTo}T23:59:59.999`);
          if (inspectedAt > to) return false;
        }
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
  }, [
    initialInspections,
    searchQuery,
    selectedType,
    selectedResult,
    selectedInstrument,
    dateFrom,
    dateTo,
  ]);

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
      <div className="bg-white dark:bg-zinc-900 p-4 rounded-xl shadow-sm border border-zinc-200 dark:border-zinc-800 space-y-4">
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
          {/* Search Input */}
          <div className="relative flex-1">
            <label htmlFor="inspection-search" className="sr-only">
              Search inspections
            </label>
            <input
              id="inspection-search"
              type="search"
              placeholder="Search serial number, manufacturer, model, rule set, or inspection ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-sm border rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-zinc-900 dark:text-zinc-100 bg-white dark:bg-zinc-800 border-zinc-300 dark:border-zinc-700"
            />
            <span aria-hidden="true" className="absolute left-3 top-2.5 text-zinc-400 text-sm">
              🔍
            </span>
          </div>

          <Link
            href="/dashboard/instruments"
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors whitespace-nowrap text-center"
          >
            + New Inspection
          </Link>
        </div>

        {/* Filters */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          <div className="space-y-1">
            <label
              htmlFor="filter-stage"
              className="block text-[11px] font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wide"
            >
              Control stage
            </label>
            <select
              id="filter-stage"
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
              className="w-full px-3 py-2 text-sm border rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-zinc-900 dark:text-zinc-100 bg-white dark:bg-zinc-800 border-zinc-300 dark:border-zinc-700"
            >
              <option value="ALL">All stages</option>
              <option value="INITIAL">Initial</option>
              <option value="IN_SERVICE">In service</option>
              <option value="TYPE_EVALUATION">Type evaluation</option>
            </select>
          </div>

          <div className="space-y-1">
            <label
              htmlFor="filter-instrument"
              className="block text-[11px] font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wide"
            >
              Instrument
            </label>
            <select
              id="filter-instrument"
              value={selectedInstrument}
              onChange={(e) => setSelectedInstrument(e.target.value)}
              className="w-full px-3 py-2 text-sm border rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-zinc-900 dark:text-zinc-100 bg-white dark:bg-zinc-800 border-zinc-300 dark:border-zinc-700"
            >
              <option value="ALL">All instruments</option>
              {instrumentOptions.map((opt) => (
                <option key={opt.id} value={opt.id}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label
              htmlFor="filter-from"
              className="block text-[11px] font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wide"
            >
              From date
            </label>
            <input
              id="filter-from"
              type="date"
              value={dateFrom}
              max={dateTo || undefined}
              onChange={(e) => setDateFrom(e.target.value)}
              className="w-full px-3 py-2 text-sm border rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-zinc-900 dark:text-zinc-100 bg-white dark:bg-zinc-800 border-zinc-300 dark:border-zinc-700"
            />
          </div>

          <div className="space-y-1">
            <label
              htmlFor="filter-to"
              className="block text-[11px] font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wide"
            >
              To date
            </label>
            <input
              id="filter-to"
              type="date"
              value={dateTo}
              min={dateFrom || undefined}
              onChange={(e) => setDateTo(e.target.value)}
              className="w-full px-3 py-2 text-sm border rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-zinc-900 dark:text-zinc-100 bg-white dark:bg-zinc-800 border-zinc-300 dark:border-zinc-700"
            />
          </div>

          <div className="space-y-1">
            <label
              htmlFor="filter-result"
              className="block text-[11px] font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wide"
            >
              Result
            </label>
            <select
              id="filter-result"
              value={selectedResult}
              onChange={(e) => setSelectedResult(e.target.value)}
              className="w-full px-3 py-2 text-sm border rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-zinc-900 dark:text-zinc-100 bg-white dark:bg-zinc-800 border-zinc-300 dark:border-zinc-700"
            >
              <option value="ALL">All results</option>
              <option value="PASS">Pass</option>
              <option value="FAIL">Fail</option>
              <option value="PENDING">Pending</option>
            </select>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
          <p className="text-xs text-zinc-500 dark:text-zinc-400" aria-live="polite">
            Showing <strong className="text-zinc-700 dark:text-zinc-200">{filteredInspections.length}</strong>{' '}
            of {initialInspections.length} inspection{initialInspections.length === 1 ? '' : 's'}
          </p>
          {hasActiveFilters && (
            <button
              type="button"
              onClick={clearFilters}
              className="px-3 py-1.5 text-xs font-medium text-zinc-700 dark:text-zinc-300 bg-zinc-100 dark:bg-zinc-800 rounded-lg hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
            >
              Clear all filters
            </button>
          )}
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
                      <div className="flex items-center justify-end gap-3">
                        <Link
                          href={`/dashboard/inspections/${item.id}`}
                          className="text-xs font-semibold text-blue-600 hover:text-blue-500 dark:text-blue-400 hover:underline"
                        >
                          View
                        </Link>
                        <Link
                          href={`/dashboard/reports/${item.id}`}
                          className="text-xs font-semibold text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100 hover:underline"
                        >
                          Report / PDF
                        </Link>
                      </div>
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
            {hasActiveFilters
              ? 'No inspection records match your current search and filters. Try widening the date range or clearing the filters.'
              : 'There are currently no inspection records saved in the system.'}
          </p>
          <div className="pt-2">
            {hasActiveFilters ? (
              <button
                type="button"
                onClick={clearFilters}
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
