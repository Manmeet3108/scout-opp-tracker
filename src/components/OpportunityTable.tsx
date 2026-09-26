import React, { useState } from 'react';
import { 
  ChevronDown, 
  ChevronUp, 
  ExternalLink, 
  Share2, 
  Edit3, 
  Trash2, 
  Calendar, 
  DollarSign, 
  GraduationCap, 
  Sparkles, 
  CheckCircle2, 
  AlertCircle, 
  Clock,
  MapPin,
  FileText,
  UserCheck
} from 'lucide-react';
import { Opportunity } from '../types/opportunity';
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
          Try loosening your search query or filters, or trigger the Daily Scanner to discover new programs.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
      {/* Expand/Collapse Header Bar */}
      <div className="mb-2 flex items-center justify-between text-xs text-slate-400">
        <div className="flex items-center gap-2">
          <span>{opportunities.length} opportunities listed</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={expandAll}
            className="hover:text-slate-200 transition"
          >
            Expand All
          </button>
          <span>·</span>
          <button
            onClick={collapseAll}
            className="hover:text-slate-200 transition"
          >
            Collapse All
          </button>
        </div>
      </div>

      {/* Main High-Density Table Container */}
      <div className="overflow-hidden rounded-xl border border-slate-800 bg-slate-900/60 shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-950/70 text-slate-400 font-medium">
                <th className="py-3 pl-4 pr-2 w-8"></th>
                <th className="py-3 px-3 min-w-[280px]">Opportunity & Organizer</th>
                <th className="py-3 px-3 min-w-[160px]">Category & Focus</th>
                <th className="py-3 px-3 min-w-[140px]">Indian Eligibility</th>
                <th className="py-3 px-3 min-w-[160px]">Stipend & Support</th>
                <th className="py-3 px-3 min-w-[130px]">Deadline</th>
                <th className="py-3 px-3 min-w-[100px]">Status</th>
                <th className="py-3 pr-4 pl-2 text-right min-w-[120px]">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80">
              {opportunities.map((opp) => {
                const isExpanded = expandedIds.has(opp.id);
                const deadlineDays = calculateDaysLeft(opp.deadline);

                return (
                  <React.Fragment key={opp.id}>
                    {/* Collapsed / Summary Row */}
                    <tr 
                      className={`group transition-colors cursor-pointer ${
                        isExpanded ? 'bg-slate-800/40' : 'hover:bg-slate-800/25'
                      }`}
                      onClick={() => toggleExpand(opp.id)}
                    >
                      {/* Expand Toggle Chevron */}
                      <td className="py-3 pl-4 pr-2 text-slate-500">
                        {isExpanded ? (
                          <ChevronUp className="h-4 w-4 text-slate-300" />
                        ) : (
                          <ChevronDown className="h-4 w-4 group-hover:text-slate-300 transition-colors" />
                        )}
                      </td>

                      {/* Title & Organizer */}
                      <td className="py-3 px-3">
                        <div className="flex flex-col">
                          <span className="font-semibold text-white group-hover:text-indigo-300 transition-colors">
                            {opp.title}
                          </span>
                          <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-slate-400">
                            <span className="text-slate-300">{opp.organizer}</span>
                            <span aria-hidden="true">·</span>
                            <span>{opp.geography}</span>
                          </div>
                        </div>
                      </td>

                      {/* Category & Subcategory */}
                      <td className="py-3 px-3">
                        <div className="flex flex-col">
                          <span className="text-slate-200 font-medium">
                            {formatCategoryLabel(opp.category)}
                          </span>
                          {opp.subcategory && (
                            <span className="text-[11px] text-slate-400 truncate max-w-[180px]">
                              {opp.subcategory}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Indian Eligibility */}
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-1.5">
                          {opp.indian_eligibility === 'Eligible' ? (
                            <span className="text-emerald-400 font-medium">Eligible</span>
                          ) : opp.indian_eligibility === 'Conditional / Varies' ? (
                            <span className="text-amber-400 font-medium">Conditional</span>
                          ) : (
                            <span className="text-rose-400 font-medium">Not Eligible</span>
                          )}
                        </div>
                      </td>

                      {/* Stipend */}
                      <td className="py-3 px-3">
                        <div className="flex flex-col">
                          <span className="text-slate-200 font-mono text-[11px] font-medium truncate max-w-[170px]">
                            {opp.stipend}
                          </span>
                          <span className="text-[10px] text-slate-400">
                            {opp.stipend_type}
                          </span>
                        </div>
                      </td>

                      {/* Deadline */}
                      <td className="py-3 px-3">
                        <div className="flex flex-col">
                          <span className="font-mono text-slate-200 tabular-nums">
                            {opp.deadline}
                          </span>
                          {deadlineDays !== null && (
                            <span className={`text-[10px] tabular-nums ${
                              deadlineDays < 0 
                                ? 'text-slate-500' 
                                : deadlineDays <= 14 
                                ? 'text-amber-400 font-medium' 
                                : 'text-slate-400'
                            }`}>
                              {deadlineDays < 0 ? 'Passed' : `${deadlineDays} days left`}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Status */}
                      <td className="py-3 px-3">
                        <span className={`text-[11px] font-medium ${
                          opp.status === 'Open'
                            ? 'text-emerald-400'
                            : opp.status === 'Closing Soon'
                            ? 'text-amber-400'
                            : opp.status === 'Rolling'
                            ? 'text-indigo-400'
                            : 'text-slate-500'
                        }`}>
                          {opp.status}
                        </span>
                      </td>

                      {/* Row Actions */}
                      <td className="py-3 pr-4 pl-2 text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => onShare(opp)}
                            className="rounded p-1 text-slate-400 hover:bg-slate-800 hover:text-white transition"
                            title="Generate mentee packet for Discord/WhatsApp"
                          >
                            <Share2 className="h-3.5 w-3.5" />
                          </button>
                          <a
                            href={opp.application_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="rounded p-1 text-slate-400 hover:bg-slate-800 hover:text-indigo-300 transition"
                            title="Open official program application link"
                          >
                            <ExternalLink className="h-3.5 w-3.5" />
                          </a>
                          <button
                            onClick={() => onEdit(opp)}
                            className="rounded p-1 text-slate-400 hover:bg-slate-800 hover:text-white transition"
                            title="Edit entry"
                          >
                            <Edit3 className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => onDelete(opp.id, opp.title)}
                            className="rounded p-1 text-slate-400 hover:bg-slate-800 hover:text-rose-400 transition"
                            title="Delete entry"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>

                    {/* EXPANDABLE DETAIL VIEW (All 21 Fields) */}
                    {isExpanded && (
                      <tr className="bg-slate-950/80 border-t border-b border-slate-800">
                        <td colSpan={8} className="p-4 sm:p-6">
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-xs">
                            {/* Block 1: Program Scope & Eligibility */}
                            <div className="flex flex-col gap-3">
                              <div>
                                <h4 className="font-semibold text-slate-200 flex items-center gap-1.5 mb-1">
                                  <GraduationCap className="h-3.5 w-3.5 text-indigo-400" />
                                  <span>Overview & Eligibility</span>
                                </h4>
                                <p className="text-slate-300 leading-relaxed text-xs">
                                  {opp.description}
                                </p>
                              </div>

                              <div className="border-t border-slate-800/80 pt-2">
                                <span className="text-slate-400 block font-medium">Academic Eligibility Criteria:</span>
                                <p className="text-slate-200 mt-0.5">{opp.eligibility}</p>
                              </div>

                              <div className="border-t border-slate-800/80 pt-2">
                                <span className="text-slate-400 block font-medium">Indian Student Criteria:</span>
                                <p className="text-slate-200 mt-0.5 flex items-center gap-1.5">
                                  <span className="font-semibold text-indigo-300">{opp.indian_eligibility}</span>
                                  <span className="text-slate-400">· {opp.geography}</span>
                                </p>
                              </div>

                              <div className="border-t border-slate-800/80 pt-2">
                                <span className="text-slate-400 block font-medium">Target Mentee Persona:</span>
                                <p className="text-slate-200 mt-0.5">{opp.target_persona || 'Undergraduate engineering and science students.'}</p>
                              </div>
                            </div>

                            {/* Block 2: Stipend, Duration & Prerequisites */}
                            <div className="flex flex-col gap-3">
                              <div>
                                <h4 className="font-semibold text-slate-200 flex items-center gap-1.5 mb-1">
                                  <DollarSign className="h-3.5 w-3.5 text-emerald-400" />
                                  <span>Financials & Key Dates</span>
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
                                    <p className="text-slate-200 font-mono">{opp.deadline} ({opp.status})</p>
                                  </div>
                                  <div>
                                    <span className="text-slate-400">Program Timeline & Duration:</span>
                                    <p className="text-slate-200">{opp.timeline} · {opp.duration}</p>
                                  </div>
                                </div>
                              </div>

                              <div className="border-t border-slate-800/80 pt-2">
                                <span className="text-slate-400 block font-medium">Required Application Materials:</span>
                                <p className="text-slate-200 mt-0.5">{opp.required_materials || 'Online application form, resume.'}</p>
                              </div>

                              <div className="border-t border-slate-800/80 pt-2">
                                <span className="text-slate-400 block font-medium">Effort Level / Selectivity:</span>
                                <p className="text-slate-200 mt-0.5">
                                  Competitiveness: <strong className="text-white">{opp.competitiveness}</strong>
                                </p>
                              </div>
                            </div>

                            {/* Block 3: Mentor Strategic Notes & Student Action Pack */}
                            <div className="flex flex-col gap-3 bg-slate-900/90 rounded-lg p-3.5 border border-slate-800">
                              <div>
                                <h4 className="font-semibold text-amber-300 flex items-center gap-1.5 mb-1">
                                  <Sparkles className="h-3.5 w-3.5 text-amber-400" />
                                  <span>Mentor Guidance & Strategy</span>
                                </h4>
                                <p className="text-slate-300 text-xs leading-relaxed italic bg-slate-950/60 p-2.5 rounded border border-slate-800/60">
                                  "{opp.mentor_notes || 'Encourage students to emphasize demonstrable prototypes, clean GitHub activity, and clarity in their statements.'}"
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
                                <div className="flex items-center justify-between">
                                  <span>Internal ID:</span>
                                  <span className="text-slate-500 font-mono">{opp.id}</span>
                                </div>
                              </div>

                              {/* Interactive Actions in Detail View */}
                              <div className="mt-auto pt-3 border-t border-slate-800 flex flex-wrap gap-2">
                                <button
                                  onClick={() => onShare(opp)}
                                  className="flex-1 flex items-center justify-center gap-1.5 rounded-lg bg-indigo-600/90 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-500 transition"
                                >
                                  <Share2 className="h-3.5 w-3.5" />
                                  <span>Copy Student Packet</span>
                                </button>
                                <a
                                  href={opp.application_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="flex-1 flex items-center justify-center gap-1.5 rounded-lg bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-200 hover:bg-slate-700 transition"
                                >
                                  <ExternalLink className="h-3.5 w-3.5" />
                                  <span>Official Portal</span>
                                </a>
                                <button
                                  onClick={() => onEdit(opp)}
                                  className="rounded-lg border border-slate-700 bg-slate-800 px-2.5 py-1.5 text-xs text-slate-300 hover:bg-slate-700 transition"
                                >
                                  Edit
                                </button>
                              </div>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

function calculateDaysLeft(deadlineStr: string): number | null {
  if (deadlineStr === 'Rolling' || !deadlineStr) return null;
  const d = new Date(deadlineStr);
  if (isNaN(d.getTime())) return null;
  const now = new Date();
  return Math.ceil((d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}
