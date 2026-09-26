import React from 'react';
import { Opportunity } from '../types/opportunity';

interface StatsBannerProps {
  opportunities: Opportunity[];
  onFilterClosingSoon: () => void;
  onFilterIndianEligible: () => void;
  onFilterPaid: () => void;
  onResetFilters: () => void;
}

export const StatsBanner: React.FC<StatsBannerProps> = ({
  opportunities,
  onFilterClosingSoon,
  onFilterIndianEligible,
  onFilterPaid,
  onResetFilters,
}) => {
  const total = opportunities.length;
  const openCount = opportunities.filter((o) => o.status === 'Open' || o.status === 'Rolling').length;
  const closingSoonCount = opportunities.filter((o) => o.status === 'Closing Soon').length;
  const indianEligibleCount = opportunities.filter((o) => o.indian_eligibility === 'Eligible').length;
  const paidCount = opportunities.filter((o) => o.stipend_type === 'Paid / Stipend' || o.stipend_type === 'Equity-free Grant').length;

  return (
    <div className="border-b border-slate-800 bg-slate-900/50 py-3">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5 text-xs">
          <button
            onClick={onResetFilters}
            className="flex flex-col rounded-lg border border-slate-800/80 bg-slate-900/80 p-2.5 text-left transition hover:border-slate-700"
          >
            <span className="text-slate-400">Total Opportunities</span>
            <span className="mt-1 text-lg font-semibold text-white tabular-nums font-mono">
              {total}
            </span>
          </button>

          <div className="flex flex-col rounded-lg border border-slate-800/80 bg-slate-900/80 p-2.5 text-left">
            <span className="text-emerald-400">Active & Open</span>
            <span className="mt-1 text-lg font-semibold text-white tabular-nums font-mono">
              {openCount}
            </span>
          </div>

          <button
            onClick={onFilterClosingSoon}
            className="flex flex-col rounded-lg border border-amber-900/40 bg-amber-950/20 p-2.5 text-left transition hover:border-amber-700/60"
          >
            <span className="text-amber-400">Closing Soon (&le;14d)</span>
            <span className="mt-1 text-lg font-semibold text-amber-300 tabular-nums font-mono">
              {closingSoonCount}
            </span>
          </button>

          <button
            onClick={onFilterIndianEligible}
            className="flex flex-col rounded-lg border border-slate-800/80 bg-slate-900/80 p-2.5 text-left transition hover:border-slate-700"
          >
            <span className="text-indigo-300">Indian Students Eligible</span>
            <span className="mt-1 text-lg font-semibold text-white tabular-nums font-mono">
              {indianEligibleCount}
            </span>
          </button>

          <button
            onClick={onFilterPaid}
            className="col-span-2 sm:col-span-1 flex flex-col rounded-lg border border-slate-800/80 bg-slate-900/80 p-2.5 text-left transition hover:border-slate-700"
          >
            <span className="text-cyan-400">Paid Stipends & Grants</span>
            <span className="mt-1 text-lg font-semibold text-white tabular-nums font-mono">
              {paidCount}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};
