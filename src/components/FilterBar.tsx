import React from 'react';
import { Search, X, Users, DollarSign, ListFilter, ArrowUpDown, ChevronDown } from 'lucide-react';
import { FilterState, IndianEligibility, StipendType, OpportunityStatus } from '../types/opportunity';

interface FilterBarProps {
  filters: FilterState;
  onFilterChange: (updates: Partial<FilterState>) => void;
  onResetFilters: () => void;
  totalFilteredCount: number;
  totalAllCount: number;
  onExportCSV?: () => void;
}

export const FilterBar: React.FC<FilterBarProps> = ({
  filters,
  onFilterChange,
}) => {
  return (
    <div className="bg-[#060913] py-2.5">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-2.5">
          {/* Search Input */}
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={filters.search}
              onChange={(e) => onFilterChange({ search: e.target.value })}
              placeholder="Search opportunities, organizations, or categories..."
              className="w-full rounded-xl border border-slate-800/90 bg-slate-900/60 py-2.5 pl-10 pr-8 text-xs text-white placeholder-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-colors"
            />
            {filters.search && (
              <button
                onClick={() => onFilterChange({ search: '' })}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* 4 Dropdown Filters in Same Single Row */}
          <div className="flex items-center gap-2 shrink-0">
            {/* Indian Students Filter */}
            <div className="relative flex items-center">
              <Users className="pointer-events-none absolute left-3 h-3.5 w-3.5 text-slate-400" />
              <select
                value={filters.indianEligibility}
                onChange={(e) => onFilterChange({ indianEligibility: e.target.value as 'all' | IndianEligibility })}
                className="appearance-none rounded-xl border border-slate-800/90 bg-slate-900/60 py-2.5 pl-8 pr-7 text-xs font-medium text-slate-200 hover:border-slate-700 focus:border-indigo-500 focus:outline-none cursor-pointer"
              >
                <option value="all">Indian Students: All</option>
                <option value="Eligible">Indian Students: Eligible</option>
                <option value="Conditional / Varies">Indian Students: Conditional</option>
                <option value="Not Eligible">Indian Students: Excluded</option>
              </select>
              <ChevronDown className="pointer-events-none absolute right-2.5 h-3.5 w-3.5 text-slate-400" />
            </div>

            {/* Funding Filter */}
            <div className="relative flex items-center">
              <DollarSign className="pointer-events-none absolute left-3 h-3.5 w-3.5 text-slate-400" />
              <select
                value={filters.stipendType}
                onChange={(e) => onFilterChange({ stipendType: e.target.value as 'all' | StipendType })}
                className="appearance-none rounded-xl border border-slate-800/90 bg-slate-900/60 py-2.5 pl-7 pr-7 text-xs font-medium text-slate-200 hover:border-slate-700 focus:border-indigo-500 focus:outline-none cursor-pointer"
              >
                <option value="all">Funding: All</option>
                <option value="Paid / Stipend">Paid / Stipend</option>
                <option value="Equity-free Grant">Equity-free Grant</option>
                <option value="Prizes / Hardware">Prizes / Hardware</option>
                <option value="Unpaid / Perks">Unpaid / Perks</option>
              </select>
              <ChevronDown className="pointer-events-none absolute right-2.5 h-3.5 w-3.5 text-slate-400" />
            </div>

            {/* Status Filter */}
            <div className="relative flex items-center">
              <ListFilter className="pointer-events-none absolute left-3 h-3.5 w-3.5 text-slate-400" />
              <select
                value={filters.status}
                onChange={(e) => onFilterChange({ status: e.target.value as 'all' | OpportunityStatus })}
                className="appearance-none rounded-xl border border-slate-800/90 bg-slate-900/60 py-2.5 pl-8 pr-7 text-xs font-medium text-slate-200 hover:border-slate-700 focus:border-indigo-500 focus:outline-none cursor-pointer"
              >
                <option value="all">Status: All</option>
                <option value="Open">Status: Open</option>
                <option value="Closing Soon">Status: Closing Soon</option>
                <option value="Rolling">Status: Rolling</option>
                <option value="Closed">Status: Closed</option>
              </select>
              <ChevronDown className="pointer-events-none absolute right-2.5 h-3.5 w-3.5 text-slate-400" />
            </div>

            {/* Sort By */}
            <div className="relative flex items-center">
              <ArrowUpDown className="pointer-events-none absolute left-3 h-3.5 w-3.5 text-slate-400" />
              <select
                value={filters.sortBy}
                onChange={(e) => onFilterChange({ sortBy: e.target.value as any })}
                className="appearance-none rounded-xl border border-slate-800/90 bg-slate-900/60 py-2.5 pl-8 pr-7 text-xs font-medium text-slate-200 hover:border-slate-700 focus:border-indigo-500 focus:outline-none cursor-pointer"
              >
                <option value="deadline_asc">Sort: Deadline (Soonest)</option>
                <option value="deadline_desc">Sort: Deadline (Latest)</option>
                <option value="created_desc">Sort: Recently Added</option>
                <option value="title_asc">Sort: Title (A-Z)</option>
              </select>
              <ChevronDown className="pointer-events-none absolute right-2.5 h-3.5 w-3.5 text-slate-400" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
