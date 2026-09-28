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
    <div className="bg-[#060913] pt-5 sm:pt-6 pb-2">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Heading & Subtitle with compact inline summary */}
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-2">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white font-display">
              Opportunity Scout
            </h1>
            <p className="mt-1 text-xs sm:text-sm text-slate-400">
              Find and track verified opportunities for your students.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400">
            <span>
              <strong className="text-white font-mono">{total}</strong> total
            </span>
            <span className="text-slate-700">•</span>
            <span>
              <strong className="text-emerald-400 font-mono">{openCount}</strong> active &amp; open
            </span>
            <span className="text-slate-700">•</span>
            <span>
              <strong className="text-indigo-400 font-mono">{indianEligibleCount}</strong> Indian eligible
            </span>
            <span className="text-slate-700">•</span>
            <span>
              <strong className="text-cyan-400 font-mono">{paidCount}</strong> paid / grants
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
