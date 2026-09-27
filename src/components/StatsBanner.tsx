import React from 'react';
import { FileText, Clock, Users, Database, ArrowRight } from 'lucide-react';
import { Opportunity } from '../types/opportunity';

interface StatsBannerProps {
  opportunities: Opportunity[];
  onFilterActiveOpen: () => void;
  onFilterClosingSoon: () => void;
  onFilterIndianEligible: () => void;
  onFilterPaid: () => void;
  onResetFilters: () => void;
}

export const StatsBanner: React.FC<StatsBannerProps> = ({
  opportunities,
  onFilterActiveOpen,
  onFilterClosingSoon,
  onFilterIndianEligible,
  onFilterPaid,
  onResetFilters,
}) => {
  const total = opportunities.length;
  const openCount = opportunities.filter((o) => o.status === 'Open' || o.status === 'Rolling').length;
  const closingSoonCount = opportunities.filter((o) => o.status === 'Closing Soon').length;
  const indianEligibleCount = opportunities.filter((o) => o.indian_eligibility === 'Eligible').length;
  const paidCount = opportunities.filter(
    (o) => o.stipend_type === 'Paid / Stipend' || o.stipend_type === 'Equity-free Grant'
  ).length;

  return (
    <div className="bg-[#060913] pt-5 sm:pt-6 pb-3">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Heading & Subtitle */}
        <div className="mb-4 sm:mb-5">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white font-display">
            Opportunity Scout
          </h1>
          <p className="mt-1 text-xs sm:text-sm text-slate-400">
            Find and track verified opportunities for your students.
          </p>
        </div>

        {/* 5 Stat Cards: 2 cols on mobile, 3 on tablet, all 5 in 1 line on desktop */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5 sm:gap-3">
          {/* Card 1: Total Opportunities */}
          <button
            onClick={onResetFilters}
            className="flex min-w-0 items-start gap-3 rounded-2xl border border-slate-800/90 bg-slate-900/50 p-3 sm:p-3.5 text-left transition hover:border-slate-700"
          >
            <div className="flex h-9 w-9 sm:h-10 sm:w-10 shrink-0 items-center justify-center rounded-xl bg-slate-800/80 text-slate-400">
              <FileText className="h-4 w-4" />
            </div>
            <div className="flex min-w-0 flex-col">
              <span className="truncate text-[11px] sm:text-xs font-medium text-slate-300">
                Total Opportunities
              </span>
              <span className="mt-1 text-xl sm:text-2xl font-bold text-white tabular-nums font-mono leading-none">
                {total}
              </span>
            </div>
          </button>

          {/* Card 2: Active & Open */}
          <button
            onClick={onFilterActiveOpen}
            className="flex min-w-0 items-start gap-3 rounded-2xl border border-emerald-500/25 bg-emerald-950/15 p-3 sm:p-3.5 text-left transition hover:border-emerald-500/40"
          >
            <div className="flex h-9 w-9 sm:h-10 sm:w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10">
              <span className="h-3.5 w-3.5 rounded-full bg-emerald-400" />
            </div>
            <div className="flex min-w-0 flex-col">
              <span className="truncate text-[11px] sm:text-xs font-medium text-emerald-400">
                Active &amp; Open
              </span>
              <span className="mt-1 text-xl sm:text-2xl font-bold text-white tabular-nums font-mono leading-none">
                {openCount}
              </span>
              <span className="mt-1 truncate text-[10px] sm:text-[11px] text-slate-400">
                of {total} opportunities
              </span>
            </div>
          </button>

          {/* Card 3: Closing Soon */}
          <button
            onClick={onFilterClosingSoon}
            className="flex min-w-0 items-start gap-3 rounded-2xl border border-amber-500/35 bg-amber-950/20 p-3 sm:p-3.5 text-left transition hover:border-amber-500/60"
          >
            <div className="flex h-9 w-9 sm:h-10 sm:w-10 shrink-0 items-center justify-center rounded-xl bg-amber-500/15 text-amber-400">
              <Clock className="h-4 w-4" />
            </div>
            <div className="flex min-w-0 flex-col">
              <span className="truncate text-[11px] sm:text-xs font-medium text-amber-400">
                Closing Soon
              </span>
              <span className="mt-1 text-xl sm:text-2xl font-bold text-amber-300 tabular-nums font-mono leading-none">
                {closingSoonCount}
              </span>
              <span className="mt-1 flex items-center gap-1 truncate text-[10px] sm:text-[11px] font-medium text-amber-400">
                <span className="truncate">within 14 days</span>
                <ArrowRight className="h-3 w-3 shrink-0" />
              </span>
            </div>
          </button>

          {/* Card 4: Indian Students Eligible */}
          <button
            onClick={onFilterIndianEligible}
            className="flex min-w-0 items-start gap-3 rounded-2xl border border-slate-800/90 bg-slate-900/50 p-3 sm:p-3.5 text-left transition hover:border-slate-700"
          >
            <div className="flex h-9 w-9 sm:h-10 sm:w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-500/15 text-indigo-400">
              <Users className="h-4 w-4" />
            </div>
            <div className="flex min-w-0 flex-col">
              <span className="truncate text-[11px] sm:text-xs font-medium text-slate-300">
                Indian Students Eligible
              </span>
              <span className="mt-1 text-xl sm:text-2xl font-bold text-white tabular-nums font-mono leading-none">
                {indianEligibleCount}
              </span>
              <span className="mt-1 truncate text-[10px] sm:text-[11px] text-slate-400">
                eligible opportunities
              </span>
            </div>
          </button>

          {/* Card 5: Paid Stipends & Grants */}
          <button
            onClick={onFilterPaid}
            className="col-span-2 sm:col-span-1 flex min-w-0 items-start gap-3 rounded-2xl border border-slate-800/90 bg-slate-900/50 p-3 sm:p-3.5 text-left transition hover:border-slate-700"
          >
            <div className="flex h-9 w-9 sm:h-10 sm:w-10 shrink-0 items-center justify-center rounded-xl bg-cyan-500/15 text-cyan-400">
              <Database className="h-4 w-4" />
            </div>
            <div className="flex min-w-0 flex-col">
              <span className="truncate text-[11px] sm:text-xs font-medium text-cyan-400">
                Paid Stipends &amp; Grants
              </span>
              <span className="mt-1 text-xl sm:text-2xl font-bold text-white tabular-nums font-mono leading-none">
                {paidCount}
              </span>
              <span className="mt-1 truncate text-[10px] sm:text-[11px] text-slate-400">
                with stipends or grants
              </span>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
};
