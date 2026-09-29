import React, { useState } from 'react';
import {
  ChevronDown,
  ChevronUp,
  Share2,
  Edit3,
  Trash2,
  DollarSign,
  GraduationCap,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Clock,
  ArrowRight,
  Bookmark,
  List,
  LayoutGrid,
} from 'lucide-react';
import { Opportunity, OpportunityCategory } from '../types/opportunity';
import { formatCategoryLabel } from '../utils/exportExcel';

interface OpportunityTableProps {
  opportunities: Opportunity[];
  onEdit: (opp: Opportunity) => void;
  onDelete: (id: string, title: string) => void;
  onShare: (opp: Opportunity) => void;
  isLoading?: boolean;
}

export const OpportunityTable: React.FC<OpportunityTableProps> = ({
  opportunities,
  onEdit,
  onDelete,
  onShare,
  isLoading = false,
}) => {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [bookmarkedIds, setBookmarkedIds] = useState<Set<string>>(new Set());
  const [viewMode, setViewMode] = useState<'list' | 'cards'>('list');

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const toggleBookmark = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setBookmarkedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const expandAll = () => {
    setExpandedIds(new Set(opportunities.map((o) => o.id)));
  };

  const collapseAll = () => {
    setExpandedIds(new Set());
  };

  if (isLoading) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8 text-center">
        <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-indigo-500 border-r-transparent"></div>
        <p className="mt-3 text-sm text-slate-400">Loading opportunities from database...</p>
      </div>
    );
  }

  if (opportunities.length === 0) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-slate-800 text-slate-400">
          <AlertCircle className="h-6 w-6" />
        </div>
        <h3 className="mt-4 text-base font-semibold text-white">No matching opportunities found</h3>
        <p className="mt-1 text-xs text-slate-400 max-w-md mx-auto">
          Try loosening your search query or filters, or trigger the Scanner to discover new programs.
        </p>
      </div>
    );
  }

  return (
    <div id="opportunities" className="mx-auto max-w-7xl px-4 py-3 sm:px-6 lg:px-8">
      {/* Toolbar Bar: Count on Left, List/Cards Toggle + Expand/Collapse on Right */}
      <div className="mb-3.5 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-base font-bold text-white tracking-tight">
          {opportunities.length} {opportunities.length === 1 ? 'opportunity' : 'opportunities'}
        </h2>

        <div className="flex items-center gap-2.5 sm:gap-3 text-xs">
          {/* List / Cards Segmented Control */}
          <div className="inline-flex items-center rounded-xl border border-slate-800 bg-slate-900/70 p-0.5">
            <button
              onClick={() => setViewMode('list')}
              className={`flex items-center gap-1.5 rounded-lg px-2.5 sm:px-3 py-1.5 text-xs font-semibold transition-colors ${
                viewMode === 'list'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <List className="h-3.5 w-3.5" />
              <span>List</span>
            </button>
            <button
              onClick={() => setViewMode('cards')}
              className={`flex items-center gap-1.5 rounded-lg px-2.5 sm:px-3 py-1.5 text-xs font-semibold transition-colors ${
                viewMode === 'cards'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <LayoutGrid className="h-3.5 w-3.5" />
              <span>Cards</span>
            </button>
          </div>

          <span className="text-slate-700">|</span>

          <div className="flex items-center gap-2 font-medium">
            <button
              onClick={expandAll}
              className="text-indigo-400 hover:text-indigo-300 transition"
            >
              Expand All
            </button>
            <span className="text-slate-600">·</span>
            <button
              onClick={collapseAll}
              className="text-indigo-400 hover:text-indigo-300 transition"
            >
              Collapse All
            </button>
          </div>
        </div>
      </div>

      {viewMode === 'cards' ? (
        /* CARDS VIEW (1 col on mobile, 2 on tablet, 3 on desktop) */
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {opportunities.map((opp) => {
            const deadlineDays = calculateDaysLeft(opp.deadline);
            const formattedDate = formatReadableDate(opp.deadline);
            const isBookmarked = bookmarkedIds.has(opp.id);

            return (
              <div
                key={opp.id}
                onClick={() => toggleExpand(opp.id)}
                className="flex flex-col justify-between rounded-2xl border border-slate-800/90 bg-[#0b1020] p-5 hover:border-slate-700 transition cursor-pointer"
              >
                <div>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <OrgAvatar organizer={opp.organizer} title={opp.title} />
                      <div className="min-w-0">
                        <h3 className="text-sm font-bold text-white leading-snug">
                          {opp.title}
                        </h3>
                        <p className="text-xs text-slate-300 mt-0.5 truncate">{opp.organizer}</p>
                        <p className="text-[11px] text-slate-400 truncate">{opp.geography}</p>
                      </div>
                    </div>
                  </div>

                  <p className="mt-3 text-xs text-slate-400 line-clamp-2 leading-relaxed">
                    {opp.description}
                  </p>

                  <div className="mt-4 flex flex-wrap items-center gap-2">
                    <CategoryBadge category={opp.category} />
                    <IndianEligibilityBadge eligibility={opp.indian_eligibility} />
                  </div>
                </div>

                <div className="mt-5 pt-4 border-t border-slate-800/80 flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-xs font-bold text-white truncate">{opp.stipend}</div>
                    <div className="text-[11px] text-slate-400">
                      {formattedDate}
                      {deadlineDays !== null && deadlineDays >= 0 && ` · ${deadlineDays}d left`}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0" onClick={(e) => e.stopPropagation()}>
                    <a
                      href={opp.application_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      draggable={false}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-indigo-500 transition whitespace-nowrap"
                    >
                      <span>View Opportunity</span>
                      <ArrowRight className="h-3.5 w-3.5" />
                    </a>
                    <button
                      onClick={(e) => toggleBookmark(opp.id, e)}
                      className={`flex h-9 w-9 items-center justify-center rounded-xl border transition ${
                        isBookmarked
                          ? 'border-indigo-500/60 bg-indigo-950/60 text-indigo-400'
                          : 'border-slate-800 bg-slate-900/70 text-slate-400 hover:border-slate-700 hover:text-white'
                      }`}
                      title="Bookmark opportunity"
                    >
                      <Bookmark className={`h-4 w-4 ${isBookmarked ? 'fill-indigo-400' : ''}`} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <>
          {/* MOBILE & TABLET STACKED LIST (< lg) — Zero horizontal scrolling, fits phone screens cleanly */}
          <div className="lg:hidden space-y-3">
            {opportunities.map((opp) => {
              const isExpanded = expandedIds.has(opp.id);
              const isBookmarked = bookmarkedIds.has(opp.id);
              const deadlineDays = calculateDaysLeft(opp.deadline);
              const formattedDate = formatReadableDate(opp.deadline);

              return (
                <div
                  key={opp.id}
                  className="overflow-hidden rounded-2xl border border-slate-800/90 bg-[#090d1a] shadow-md"
                >
                  <div
                    onClick={() => toggleExpand(opp.id)}
                    className="p-4 cursor-pointer hover:bg-slate-900/40 transition-colors"
                  >
                    {/* Top Row: Org Avatar + Title + Expand Chevron */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3 min-w-0">
                        <OrgAvatar organizer={opp.organizer} title={opp.title} />
                        <div className="min-w-0">
                          <h3 className="text-sm font-bold text-white leading-snug">
                            {opp.title}
                          </h3>
                          <p className="text-xs font-medium text-slate-300 mt-0.5">
                            {opp.organizer}
                          </p>
                          <p className="text-[11px] text-slate-400 mt-0.5">
                            {opp.geography}
                          </p>
                        </div>
                      </div>
                      <button className="p-1 text-slate-400">
                        {isExpanded ? (
                          <ChevronUp className="h-4 w-4 text-slate-200" />
                        ) : (
                          <ChevronDown className="h-4 w-4" />
                        )}
                      </button>
                    </div>

                    <p className="mt-2.5 text-xs text-slate-400 line-clamp-2">
                      {opp.description}
                    </p>

                    {/* Badges Row */}
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <CategoryBadge category={opp.category} />
                      <IndianEligibilityBadge eligibility={opp.indian_eligibility} />
                      {deadlineDays !== null && deadlineDays >= 0 && deadlineDays <= 14 && (
                        <span
                          className={`inline-flex items-center gap-1 rounded-lg px-2 py-0.5 text-[11px] font-semibold ${
                            deadlineDays <= 10
                              ? 'border border-rose-500/30 bg-rose-950/60 text-rose-300'
                              : 'border border-amber-500/30 bg-amber-950/60 text-amber-300'
                          }`}
                        >
                          <Clock className="h-3 w-3" />
                          <span>{deadlineDays} days left</span>
                        </span>
                      )}
                    </div>

                    {/* Bottom Info + Action Buttons */}
                    <div className="mt-3.5 pt-3 border-t border-slate-800/80 flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-white truncate">{opp.stipend}</div>
                        <div className="text-[11px] text-slate-400">
                          Deadline: {formattedDate}
                        </div>
                      </div>

                      <div
                        className="flex items-center gap-1.5 shrink-0"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <a
                          href={opp.application_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          draggable={false}
                          className="inline-flex items-center gap-1 rounded-xl bg-indigo-600 px-3 py-2 text-xs font-semibold text-white shadow-sm hover:bg-indigo-500 transition-colors whitespace-nowrap"
                        >
                          <span>View Opportunity</span>
                          <ArrowRight className="h-3.5 w-3.5" />
                        </a>
                        <button
                          onClick={(e) => toggleBookmark(opp.id, e)}
                          className={`flex h-8 w-8 items-center justify-center rounded-xl border transition-colors ${
                            isBookmarked
                              ? 'border-indigo-500/60 bg-indigo-950/60 text-indigo-400'
                              : 'border-slate-800 bg-slate-900/70 text-slate-400 hover:text-white'
                          }`}
                          title="Bookmark opportunity"
                        >
                          <Bookmark
                            className={`h-3.5 w-3.5 ${isBookmarked ? 'fill-indigo-400' : ''}`}
                          />
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Mobile Expanded 21-Field Detail Drawer */}
                  {isExpanded && (
                    <div className="border-t border-slate-800 bg-[#060913]/90 p-4">
                      <ExpandedDetails
                        opp={opp}
                        formattedDate={formattedDate}
                        onShare={onShare}
                        onEdit={onEdit}
                        onDelete={onDelete}
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* DESKTOP TABLE VIEW (lg:block) — Exact Non-Draggable 7-Column Layout */}
          <div className="hidden lg:block overflow-hidden rounded-2xl border border-slate-800/90 bg-[#090d1a] shadow-lg">
            <table className="w-full table-fixed text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-800/90 bg-[#0c1222] text-slate-300 font-semibold text-xs">
                  <th className="py-3.5 pl-3 pr-1 w-[3%]"></th>
                  <th className="py-3.5 px-3 w-[31%]">Opportunity &amp; Organizer</th>
                  <th className="py-3.5 px-2.5 w-[15%]">Category &amp; Focus</th>
                  <th className="py-3.5 px-2 w-[11%]">Indian Eligibility</th>
                  <th className="py-3.5 px-2.5 w-[14%]">Stipend &amp; Support</th>
                  <th className="py-3.5 px-2 w-[10%]">Deadline</th>
                  <th className="py-3.5 pr-3 pl-2 w-[16%]">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80">
                {opportunities.map((opp) => {
                  const isExpanded = expandedIds.has(opp.id);
                  const isBookmarked = bookmarkedIds.has(opp.id);
                  const deadlineDays = calculateDaysLeft(opp.deadline);
                  const formattedDate = formatReadableDate(opp.deadline);

                  return (
                    <React.Fragment key={opp.id}>
                      {/* Main Row */}
                      <tr
                        className={`group transition-colors cursor-pointer ${
                          isExpanded ? 'bg-slate-900/70' : 'hover:bg-slate-900/40'
                        }`}
                        onClick={() => toggleExpand(opp.id)}
                      >
                        {/* Expand Toggle Chevron */}
                        <td className="py-4 pl-3 pr-1 align-middle text-slate-400">
                          {isExpanded ? (
                            <ChevronUp className="h-4 w-4 text-slate-200" />
                          ) : (
                            <ChevronDown className="h-4 w-4 group-hover:text-slate-200 transition-colors" />
                          )}
                        </td>

                        {/* Column 1: Avatar + Full Title + Organizer + Geography + Description */}
                        <td className="py-4 px-3 align-middle">
                          <div className="flex items-start gap-3">
                            <OrgAvatar organizer={opp.organizer} title={opp.title} />
                            <div className="flex flex-col min-w-0">
                              <span
                                title={opp.title}
                                className="text-sm font-bold text-white group-hover:text-indigo-300 transition-colors leading-snug break-words"
                              >
                                {opp.title}
                              </span>
                              <span
                                title={opp.organizer}
                                className="text-xs font-medium text-slate-300 mt-0.5 break-words"
                              >
                                {opp.organizer}
                              </span>
                              <span
                                title={opp.geography}
                                className="truncate text-xs text-slate-400 mt-0.5"
                              >
                                {opp.geography}
                              </span>
                              <p
                                title={opp.description}
                                className="text-xs text-slate-400 mt-1 line-clamp-1"
                              >
                                {opp.description}
                              </p>
                            </div>
                          </div>
                        </td>

                        {/* Column 2: Category Pill & Focus Subcategory */}
                        <td className="py-4 px-2.5 align-middle">
                          <div className="flex flex-col items-start min-w-0">
                            <CategoryBadge category={opp.category} />
                            {opp.subcategory && (
                              <span
                                title={opp.subcategory}
                                className="mt-1.5 text-xs text-slate-300 leading-snug line-clamp-2"
                              >
                                {opp.subcategory}
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Column 3: Indian Eligibility Pill */}
                        <td className="py-4 px-2 align-middle">
                          <IndianEligibilityBadge eligibility={opp.indian_eligibility} />
                        </td>

                        {/* Column 4: Stipend & Support */}
                        <td className="py-4 px-2.5 align-middle">
                          <div className="flex flex-col min-w-0">
                            <span
                              title={opp.stipend}
                              className="text-sm font-bold text-white leading-snug line-clamp-2 break-words"
                            >
                              {opp.stipend}
                            </span>
                            <span className="truncate text-xs text-slate-400 mt-1">
                              {opp.stipend_type}
                            </span>
                          </div>
                        </td>

                        {/* Column 5: Deadline */}
                        <td className="py-4 px-2 align-middle">
                          {deadlineDays !== null && deadlineDays >= 0 && deadlineDays <= 14 ? (
                            <div className="flex flex-col items-start">
                              <span
                                className={`inline-flex items-center gap-1 rounded-lg px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap ${
                                  deadlineDays <= 10
                                    ? 'border border-rose-500/30 bg-rose-950/60 text-rose-300'
                                    : 'border border-amber-500/30 bg-amber-950/60 text-amber-300'
                                }`}
                              >
                                <Clock className="h-3 w-3 shrink-0" />
                                <span>{deadlineDays} days left</span>
                              </span>
                              <span className="mt-1 text-xs text-slate-300 font-medium whitespace-nowrap">
                                {formattedDate}
                              </span>
                            </div>
                          ) : (
                            <div className="flex flex-col">
                              <span className="text-sm font-bold text-white leading-snug whitespace-nowrap">
                                {formattedDate}
                              </span>
                              <span className="mt-1 text-xs text-slate-400 whitespace-nowrap">
                                {deadlineDays === null
                                  ? 'Rolling'
                                  : deadlineDays < 0
                                  ? '2026 Cycle Closed'
                                  : `${deadlineDays} days left`}
                              </span>
                            </div>
                          )}
                        </td>

                        {/* Column 6: Primary Action + Bookmark */}
                        <td
                          className="py-4 pr-3 pl-2 align-middle"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div className="flex items-center gap-1.5">
                            <a
                              href={opp.application_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              draggable={false}
                              className="inline-flex items-center gap-1 rounded-xl bg-indigo-600 px-2.5 py-2 text-xs font-semibold text-white shadow-sm hover:bg-indigo-500 transition-colors whitespace-nowrap"
                            >
                              <span>View Opportunity</span>
                              <ArrowRight className="h-3.5 w-3.5 shrink-0" />
                            </a>
                            <button
                              onClick={(e) => toggleBookmark(opp.id, e)}
                              className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border transition-colors ${
                                isBookmarked
                                  ? 'border-indigo-500/60 bg-indigo-950/60 text-indigo-400'
                                  : 'border-slate-800 bg-slate-900/70 text-slate-400 hover:border-slate-700 hover:text-white'
                              }`}
                              title="Bookmark opportunity"
                            >
                              <Bookmark
                                className={`h-3.5 w-3.5 ${isBookmarked ? 'fill-indigo-400' : ''}`}
                              />
                            </button>
                          </div>
                        </td>
                      </tr>

                      {/* EXPANDABLE DETAIL VIEW (All 21 Fields + Mentor Actions) */}
                      {isExpanded && (
                        <tr className="bg-[#060913]/90 border-t border-b border-slate-800/90">
                          <td colSpan={7} className="p-5 sm:p-6">
                            <ExpandedDetails
                              opp={opp}
                              formattedDate={formattedDate}
                              onShare={onShare}
                              onEdit={onEdit}
                              onDelete={onDelete}
                            />
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
};

/* Shared Expanded 21-Field Detail Drawer Component */
const ExpandedDetails: React.FC<{
  opp: Opportunity;
  formattedDate: string;
  onShare: (opp: Opportunity) => void;
  onEdit: (opp: Opportunity) => void;
  onDelete: (id: string, title: string) => void;
}> = ({ opp, formattedDate, onShare, onEdit, onDelete }) => (
  <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-xs">
    {/* Block 1: Program Scope & Eligibility */}
    <div className="flex flex-col gap-3">
      <div>
        <h4 className="font-semibold text-slate-200 flex items-center gap-1.5 mb-1">
          <GraduationCap className="h-4 w-4 text-indigo-400" />
          <span>Overview &amp; Eligibility</span>
        </h4>
        <p className="text-white font-semibold text-xs mb-1">
          {opp.title} — <span className="text-indigo-300 font-medium">{opp.organizer}</span>
        </p>
        <p className="text-slate-300 leading-relaxed text-xs">{opp.description}</p>
      </div>

      <div className="border-t border-slate-800/80 pt-2.5">
        <span className="text-slate-400 block font-medium">Academic Eligibility Criteria:</span>
        <p className="text-slate-200 mt-0.5">{opp.eligibility}</p>
      </div>

      <div className="border-t border-slate-800/80 pt-2.5">
        <span className="text-slate-400 block font-medium">Indian Student Criteria:</span>
        <p className="text-slate-200 mt-0.5 flex items-center gap-1.5">
          <span className="font-semibold text-indigo-300">{opp.indian_eligibility}</span>
          <span className="text-slate-400">· {opp.geography}</span>
        </p>
      </div>

      <div className="border-t border-slate-800/80 pt-2.5">
        <span className="text-slate-400 block font-medium">Target Mentee Persona:</span>
        <p className="text-slate-200 mt-0.5">
          {opp.target_persona || 'Undergraduate engineering and computer science students.'}
        </p>
      </div>
    </div>

    {/* Block 2: Stipend, Duration & Prerequisites */}
    <div className="flex flex-col gap-3">
      <div>
        <h4 className="font-semibold text-slate-200 flex items-center gap-1.5 mb-1">
          <DollarSign className="h-4 w-4 text-emerald-400" />
          <span>Financials &amp; Key Dates</span>
        </h4>
        <div className="space-y-1.5">
          <div>
            <span className="text-slate-400">Financial Support:</span>
            <p className="text-emerald-300 font-mono font-medium">{opp.stipend}</p>
          </div>
          <div>
            <span className="text-slate-400">Funding Model:</span>
            <p className="text-slate-200">{opp.stipend_type}</p>
          </div>
          <div>
            <span className="text-slate-400">Application Deadline:</span>
            <p className="text-slate-200 font-mono">
              {formattedDate} ({getEffectiveStatusLabel(opp)})
            </p>
          </div>
          <div>
            <span className="text-slate-400">Program Timeline &amp; Duration:</span>
            <p className="text-slate-200">
              {opp.timeline} · {opp.duration}
            </p>
          </div>
        </div>
      </div>

      <div className="border-t border-slate-800/80 pt-2.5">
        <span className="text-slate-400 block font-medium">Required Application Materials:</span>
        <p className="text-slate-200 mt-0.5">
          {opp.required_materials || 'Online application form, resume.'}
        </p>
      </div>

      <div className="border-t border-slate-800/80 pt-2.5">
        <span className="text-slate-400 block font-medium">Effort Level / Selectivity:</span>
        <p className="text-slate-200 mt-0.5">
          Competitiveness: <strong className="text-white">{opp.competitiveness}</strong>
        </p>
      </div>
    </div>

    {/* Block 3: Mentor Strategic Notes & Student Action Pack */}
    <div className="flex flex-col gap-3 bg-slate-900/90 rounded-xl p-4 border border-slate-800">
      <div>
        <h4 className="font-semibold text-amber-300 flex items-center gap-1.5 mb-1.5">
          <Sparkles className="h-4 w-4 text-amber-400" />
          <span>Mentor Guidance &amp; Strategy</span>
        </h4>
        <p className="text-slate-300 text-xs leading-relaxed italic bg-slate-950/60 p-3 rounded-lg border border-slate-800/60">
          "
          {opp.mentor_notes ||
            'Encourage students to emphasize demonstrable prototypes, clean GitHub activity, and clarity in their statements.'}
          "
        </p>
      </div>

      <div className="pt-2 text-[11px] text-slate-400 space-y-1">
        <div className="flex items-center justify-between">
          <span>Last Verified:</span>
          <span className="text-slate-300 font-mono">{opp.last_verified}</span>
        </div>
        <div className="flex items-center justify-between">
          <span>Source:</span>
          <span className="text-slate-300">{opp.source}</span>
        </div>
      </div>

      {/* Interactive Actions in Detail View */}
      <div className="mt-auto pt-3 border-t border-slate-800 flex flex-wrap gap-2">
        <button
          onClick={() => onShare(opp)}
          className="flex-1 flex items-center justify-center gap-1.5 rounded-lg bg-indigo-600/90 px-3 py-2 text-xs font-medium text-white hover:bg-indigo-500 transition"
        >
          <Share2 className="h-3.5 w-3.5" />
          <span>Share Packet</span>
        </button>
        <button
          onClick={() => onEdit(opp)}
          className="inline-flex items-center gap-1 rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-xs text-slate-200 hover:bg-slate-700 transition"
        >
          <Edit3 className="h-3.5 w-3.5" />
          <span>Edit</span>
        </button>
        <button
          onClick={() => onDelete(opp.id, opp.title)}
          className="inline-flex items-center gap-1 rounded-lg border border-rose-900/50 bg-rose-950/30 px-2.5 py-2 text-xs text-rose-300 hover:bg-rose-900/40 transition"
          title="Delete opportunity"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  </div>
);

/* Helper Components for Badges & Organization Avatars */

const CategoryBadge: React.FC<{ category: OpportunityCategory }> = ({ category }) => {
  const label = formatCategoryLabel(category);
  const styles: Record<OpportunityCategory, string> = {
    hackathon_conference: 'bg-indigo-600/90 text-white',
    opensource: 'bg-sky-700/90 text-sky-100',
    ambassador: 'bg-rose-800/90 text-rose-100',
    fellowship: 'bg-violet-700/90 text-violet-100',
    grant: 'bg-emerald-700/90 text-emerald-100',
    competition: 'bg-amber-700/90 text-amber-100',
  };

  return (
    <span
      className={`inline-flex items-center rounded-lg px-2.5 py-1 text-[11px] font-semibold whitespace-nowrap ${
        styles[category] || 'bg-slate-800 text-slate-200'
      }`}
    >
      {label}
    </span>
  );
};

const IndianEligibilityBadge: React.FC<{ eligibility: string }> = ({ eligibility }) => {
  if (eligibility === 'Eligible') {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-500/35 bg-emerald-950/40 px-2.5 py-1 text-xs font-semibold text-emerald-400 whitespace-nowrap">
        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
        <span>Eligible</span>
      </span>
    );
  }
  if (eligibility === 'Conditional / Varies') {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-xl border border-amber-500/35 bg-amber-950/40 px-2.5 py-1 text-xs font-semibold text-amber-400 whitespace-nowrap">
        <AlertCircle className="h-3.5 w-3.5 text-amber-400 shrink-0" />
        <span>Conditional</span>
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-xl border border-rose-500/35 bg-rose-950/40 px-2.5 py-1 text-xs font-semibold text-rose-400 whitespace-nowrap">
      <span>Not Eligible</span>
    </span>
  );
};

const OrgAvatar: React.FC<{ organizer: string; title: string }> = ({ organizer, title }) => {
  const key = `${organizer} ${title}`.toLowerCase();

  if (key.includes('mit') || key.includes('hackmit')) {
    return (
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white text-[#A31F34] font-black text-xs tracking-tighter shadow-sm">
        MIT
      </div>
    );
  }

  if (key.includes('google') || key.includes('outreachy')) {
    return (
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white shadow-sm">
        <span className="text-lg font-extrabold bg-gradient-to-tr from-blue-600 via-red-500 to-amber-500 bg-clip-text text-transparent">
          G
        </span>
      </div>
    );
  }

  if (key.includes('nvidia')) {
    return (
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#76B900] text-black font-black text-xs shadow-sm">
        NV
      </div>
    );
  }

  if (key.includes('thiel')) {
    return (
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white text-slate-950 font-black text-lg shadow-sm">
        T
      </div>
    );
  }

  if (key.includes('microsoft')) {
    return (
      <div className="grid grid-cols-2 gap-0.5 p-2.5 h-11 w-11 shrink-0 rounded-xl bg-white shadow-sm">
        <span className="bg-[#F25022] rounded-[1px]" />
        <span className="bg-[#7FBA00] rounded-[1px]" />
        <span className="bg-[#00A4EF] rounded-[1px]" />
        <span className="bg-[#FFB900] rounded-[1px]" />
      </div>
    );
  }

  if (key.includes('github') || key.includes('mlh')) {
    return (
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-slate-800 text-white font-black text-xs border border-slate-700 shadow-sm">
        GH
      </div>
    );
  }

  if (key.includes('linux')) {
    return (
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#003778] text-white font-black text-xs shadow-sm">
        LFX
      </div>
    );
  }

  if (key.includes('ethereum') || key.includes('ethglobal') || key.includes('devfolio')) {
    return (
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-indigo-950 text-indigo-300 border border-indigo-700/50 font-black text-xs shadow-sm">
        ETH
      </div>
    );
  }

  const initials = organizer
    .split(/[\s/&,-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join('');

  return (
    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-slate-800 text-white font-bold text-xs border border-slate-700/80 shadow-sm">
      {initials || 'OP'}
    </div>
  );
};

function getEffectiveStatusLabel(opp: Opportunity): string {
  const days = calculateDaysLeft(opp.deadline);
  if (days === null) return 'Rolling';
  if (days < 0) return 'Closed';
  if (days <= 14) return 'Closing Soon';
  return 'Open';
}

function calculateDaysLeft(deadlineStr: string): number | null {
  if (deadlineStr === 'Rolling' || !deadlineStr) return null;
  const d = new Date(deadlineStr);
  if (isNaN(d.getTime())) return null;
  const now = new Date();
  return Math.ceil((d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

function formatReadableDate(deadlineStr: string): string {
  if (!deadlineStr || deadlineStr === 'Rolling') return 'Rolling';
  const d = new Date(deadlineStr);
  if (isNaN(d.getTime())) return deadlineStr;
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}
