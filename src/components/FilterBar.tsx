import React from 'react';
import { Search, X, SlidersHorizontal, ArrowUpDown, FileSpreadsheet } from 'lucide-react';
import { FilterState, IndianEligibility, StipendType, OpportunityStatus, Competitiveness } from '../types/opportunity';

interface FilterBarProps {
  filters: FilterState;
  onFilterChange: (updates: Partial<FilterState>) => void;
  onResetFilters: () => void;
  totalFilteredCount: number;
  totalAllCount: number;
  onExportCSV: () => void;
}

export const FilterBar: React.FC<FilterBarProps> = ({
  filters,
  onFilterChange,
  onResetFilters,
  totalFilteredCount,
  totalAllCount,
  onExportCSV,
}) => {
  const hasActiveFilters = 
    filters.search !== '' ||
    filters.category !== 'all' ||
    filters.indianEligibility !== 'all' ||
    filters.stipendType !== 'all' ||
    filters.status !== 'all' ||
    filters.competitiveness !== 'all';

  return (
    <div className="border-b border-slate-800 bg-slate-900/30 px-4 py-3 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl flex flex-col gap-3">
        {/* Row 1: Search & Primary Selectors */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
          {/* Search Input */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={filters.search}
              onChange={(e) => onFilterChange({ search: e.target.value })}
              placeholder="Search by title, organizer, subcategory, keywords, or mentor tips..."
              className="w-full rounded-lg border border-slate-800 bg-slate-900/90 py-2 pl-9 pr-9 text-xs text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-colors"
            />
            {filters.search && (
              <button
                onClick={() => onFilterChange({ search: '' })}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* Indian Eligibility filter */}
          <div className="flex items-center gap-1.5 shrink-0">
            <select
              value={filters.indianEligibility}
              onChange={(e) => onFilterChange({ indianEligibility: e.target.value as 'all' | IndianEligibility })}
              className="rounded-lg border border-slate-800 bg-slate-900/90 px-3 py-2 text-xs text-slate-200 focus:border-indigo-500 focus:outline-none"
            >
              <option value="all">Indian Students: All</option>
              <option value="Eligible">Indian Students: Eligible Only</option>
              <option value="Conditional / Varies">Indian Students: Conditional</option>
              <option value="Not Eligible">Indian Students: Excluded</option>
            </select>

            {/* Stipend Type filter */}
            <select
              value={filters.stipendType}
              onChange={(e) => onFilterChange({ stipendType: e.target.value as 'all' | StipendType })}
              className="rounded-lg border border-slate-800 bg-slate-900/90 px-3 py-2 text-xs text-slate-200 focus:border-indigo-500 focus:outline-none"
            >
              <option value="all">Funding: All</option>
              <option value="Paid / Stipend">Paid / Stipend</option>
              <option value="Equity-free Grant">Equity-free Grant</option>
              <option value="Prizes / Hardware">Prizes / Hardware</option>
              <option value="Unpaid / Perks">Unpaid / Perks</option>
            </select>

            {/* Status filter */}
            <select
              value={filters.status}
              onChange={(e) => onFilterChange({ status: e.target.value as 'all' | OpportunityStatus })}
              className="rounded-lg border border-slate-800 bg-slate-900/90 px-3 py-2 text-xs text-slate-200 focus:border-indigo-500 focus:outline-none"
            >
              <option value="all">Status: All</option>
              <option value="Open">Open</option>
              <option value="Closing Soon">Closing Soon (&le;14d)</option>
              <option value="Rolling">Rolling</option>
              <option value="Closed">Closed</option>
            </select>

            {/* Sort by */}
            <div className="flex items-center">
              <select
                value={filters.sortBy}
                onChange={(e) => onFilterChange({ sortBy: e.target.value as any })}
                className="rounded-lg border border-slate-800 bg-slate-900/90 px-3 py-2 text-xs text-slate-200 focus:border-indigo-500 focus:outline-none"
              >
                <option value="deadline_asc">Sort: Deadline (Soonest first)</option>
                <option value="deadline_desc">Sort: Deadline (Latest)</option>
                <option value="created_desc">Sort: Recently Added</option>
                <option value="title_asc">Sort: Title (A-Z)</option>
              </select>
            </div>
          </div>
        </div>

        {/* Row 2: Results Count & Filter Reset */}
        <div className="flex items-center justify-between text-xs text-slate-400">
          <div className="flex items-center gap-2">
            <span>
              Showing <strong className="text-slate-200 font-mono tabular-nums">{totalFilteredCount}</strong> of{' '}
              <strong className="text-slate-200 font-mono tabular-nums">{totalAllCount}</strong> opportunities
            </span>
            {hasActiveFilters && (
              <button
                onClick={onResetFilters}
                className="flex items-center gap-1 rounded bg-slate-800 px-2 py-0.5 text-[11px] text-slate-300 hover:bg-slate-700 transition"
              >
                <X className="h-3 w-3" />
                <span>Reset Filters</span>
              </button>
            )}
          </div>

          <button
            onClick={onExportCSV}
            className="flex items-center gap-1 text-[11px] text-slate-400 hover:text-slate-200 transition"
          >
            <FileSpreadsheet className="h-3.5 w-3.5" />
            <span>Download CSV</span>
          </button>
        </div>
      </div>
    </div>
  );
};
