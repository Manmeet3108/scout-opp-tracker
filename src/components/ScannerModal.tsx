import React, { useState, useEffect } from 'react';
import {
  X,
  Radar,
  Sparkles,
  Trash2,
  CheckCircle2,
  Loader2,
  Plus,
  History,
  ShieldCheck,
  Search,
  ExternalLink,
} from 'lucide-react';
import { OpportunityInput, ScanLog, OpportunityCategory } from '../types/opportunity';
import { triggerScanApi, fetchScanLogsApi, pruneExpiredApi, createOpportunityApi } from '../utils/api';
import { formatCategoryLabel } from '../utils/exportExcel';

interface ScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpportunityAdded: () => void;
}

const COUNT_OPTIONS = [6, 12, 18, 24, 30];

const QUICK_FOCUS_PRESETS = [
  'India Student Hackathons',
  'Devfolio & Unstop',
  'AI / ML Grants & Fellowships',
  'Paid Open Source Stipends',
  'Global Travel Scholarships',
];

export const ScannerModal: React.FC<ScannerModalProps> = ({
  isOpen,
  onClose,
  onOpportunityAdded,
}) => {
  const [logs, setLogs] = useState<ScanLog[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [discoveredItems, setDiscoveredItems] = useState<Partial<OpportunityInput>[]>([]);
  const [selectedCategories, setSelectedCategories] = useState<OpportunityCategory[]>([
    'fellowship',
    'grant',
    'ambassador',
    'opensource',
    'hackathon_conference',
    'competition',
  ]);
  const [targetCount, setTargetCount] = useState<number>(12);
  const [customQuery, setCustomQuery] = useState<string>('');
  const [scanMessage, setScanMessage] = useState<string | null>(null);
  const [isPruning, setIsPruning] = useState(false);
  const [pruneResult, setPruneResult] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'scanner' | 'history'>('scanner');
  const [addedTitles, setAddedTitles] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (isOpen) {
      loadLogs();
      setScanMessage(null);
      setPruneResult(null);
    }
  }, [isOpen]);

  const loadLogs = async () => {
    try {
      const data = await fetchScanLogsApi();
      setLogs(data);
    } catch (err) {
      console.error('Failed to load scan logs:', err);
    }
  };

  if (!isOpen) return null;

  const handleToggleCategory = (cat: OpportunityCategory) => {
    setSelectedCategories((prev) => {
      if (prev.includes(cat)) {
        if (prev.length === 1) return prev; // Keep at least one
        return prev.filter((c) => c !== cat);
      } else {
        return [...prev, cat];
      }
    });
  };

  const handleSelectAllCategories = () => {
    setSelectedCategories([
      'fellowship',
      'grant',
      'ambassador',
      'opensource',
      'hackathon_conference',
      'competition',
    ]);
  };

  const handleRunScan = async () => {
    setIsScanning(true);
    setScanMessage(null);
    setDiscoveredItems([]);

    try {
      const result = await triggerScanApi({
        categories: selectedCategories,
        autoAdd: false,
        targetCount,
        customQuery: customQuery.trim() || undefined,
      });

      setDiscoveredItems(result.discovered);
      setScanMessage(
        `Live scan complete! Verified ${result.stats.verified} existing programs against their official websites and discovered ${result.discovered.length} net-new opportunities (excluding programs already in your table).`
      );
      onOpportunityAdded();
      loadLogs();
    } catch (err: any) {
      setScanMessage(`Scan error: ${err.message || 'Check server connection'}`);
    } finally {
      setIsScanning(false);
    }
  };

  const handleAddDiscovered = async (item: Partial<OpportunityInput>) => {
    try {
      await createOpportunityApi({
        title: item.title || 'Untitled Opportunity',
        organizer: item.organizer || 'Unknown Organization',
        category: (item.category as OpportunityCategory) || 'fellowship',
        subcategory: item.subcategory || 'General',
        description: item.description || '',
        eligibility: item.eligibility || 'Open to students',
        indian_eligibility: (item.indian_eligibility as any) || 'Eligible',
        geography: item.geography || 'Global / Remote',
        stipend: item.stipend || 'Check official portal',
        stipend_type: (item.stipend_type as any) || 'Paid / Stipend',
        deadline: item.deadline || 'Rolling',
        timeline: item.timeline || '',
        duration: item.duration || '',
        application_url: item.application_url || 'https://google.com',
        required_materials: item.required_materials || 'Resume, GitHub',
        competitiveness: (item.competitiveness as any) || 'Medium',
        mentor_notes: item.mentor_notes || 'Scouted automatically by Scout Scanner.',
        target_persona: item.target_persona || 'Undergraduate engineering students',
        status: (item.status as any) || 'Open',
        last_verified: new Date().toISOString().split('T')[0],
        source: item.source || 'Automated Daily Web Scanner',
      });

      if (item.title) {
        setAddedTitles((prev) => new Set([...prev, item.title!]));
      }
      onOpportunityAdded();
    } catch (err: any) {
      setScanMessage(`Error adding opportunity: ${err.message}`);
    }
  };

  const handleAddAll = async () => {
    for (const item of discoveredItems) {
      if (!addedTitles.has(item.title || '')) {
        await handleAddDiscovered(item);
      }
    }
  };

  const handlePrune = async () => {
    setIsPruning(true);
    setPruneResult(null);
    try {
      const res = await pruneExpiredApi(15);
      setPruneResult(`Pruning complete: ${res.prunedCount} expired records (>15 days past deadline) safely removed.`);
      onOpportunityAdded();
      loadLogs();
    } catch (err: any) {
      setPruneResult(`Pruning error: ${err.message}`);
    } finally {
      setIsPruning(false);
    }
  };

  const CATEGORY_CHOICES: OpportunityCategory[] = [
    'fellowship',
    'grant',
    'ambassador',
    'opensource',
    'hackathon_conference',
    'competition',
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm overflow-y-auto">
      <div className="relative w-full max-w-3xl rounded-xl border border-slate-800 bg-slate-900 shadow-2xl overflow-hidden my-8">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 px-6 py-4 bg-slate-950/80">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600/30 text-indigo-400">
              <Radar className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-white">
                Multi-Category Parallel Web Scanner
              </h3>
              <p className="text-xs text-slate-400">
                Parallel category search, duplicate exclusion &amp; official website verification.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-800 hover:text-white transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Tab switch: Scanner vs Scan History */}
        <div className="border-b border-slate-800 bg-slate-900/60 px-6 py-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab('scanner')}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                activeTab === 'scanner'
                  ? 'bg-slate-800 text-white'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Trigger Scanner
            </button>
            <button
              onClick={() => setActiveTab('history')}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                activeTab === 'history'
                  ? 'bg-slate-800 text-white'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <History className="h-3.5 w-3.5" />
              <span>Scan Logs ({logs.length})</span>
            </button>
          </div>

          <button
            onClick={handlePrune}
            disabled={isPruning}
            className="flex items-center gap-1 text-[11px] text-slate-400 hover:text-rose-400 transition"
            title="Prune opportunities whose deadline passed >15 days ago"
          >
            <Trash2 className="h-3 w-3" />
            <span>{isPruning ? 'Pruning...' : 'Prune Expired (>15d)'}</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 max-h-[75vh] overflow-y-auto space-y-5">
          {activeTab === 'scanner' ? (
            <>
              {/* Cron Status Banner */}
              <div className="flex items-start gap-3 rounded-lg border border-indigo-900/40 bg-indigo-950/20 p-3.5 text-xs">
                <ShieldCheck className="h-4 w-4 text-indigo-400 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="font-semibold text-slate-200">
                    Parallel Multi-Category Discovery: <span className="text-emerald-400">Active</span>
                  </p>
                  <p className="text-slate-400 text-[11px]">
                    Scans each category in parallel via Google Search Grounding, automatically excludes all opportunities already in your table, and verifies official deadlines.
                  </p>
                </div>
              </div>

              {/* Category Scope Selection */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-xs font-medium text-slate-300">
                    1. Select Categories to Scan ({selectedCategories.length} selected):
                  </label>
                  {selectedCategories.length < CATEGORY_CHOICES.length && (
                    <button
                      type="button"
                      onClick={handleSelectAllCategories}
                      className="text-[11px] text-indigo-400 hover:text-indigo-300"
                    >
                      Select all 6 categories
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {CATEGORY_CHOICES.map((cat) => {
                    const isChecked = selectedCategories.includes(cat);
                    return (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => handleToggleCategory(cat)}
                        className={`flex items-center justify-between rounded-lg border p-2 text-xs transition text-left ${
                          isChecked
                            ? 'border-indigo-600/60 bg-indigo-950/30 text-white'
                            : 'border-slate-800 bg-slate-950/40 text-slate-400'
                        }`}
                      >
                        <span className="truncate">{formatCategoryLabel(cat)}</span>
                        {isChecked && (
                          <CheckCircle2 className="h-3.5 w-3.5 text-indigo-400 shrink-0 ml-1" />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Target Count + Custom Search Focus */}
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-4 pt-1">
                {/* Target Count Selector */}
                <div className="sm:col-span-4">
                  <label className="block text-xs font-medium text-slate-300 mb-2">
                    2. Opportunities to Find:
                  </label>
                  <div className="grid grid-cols-5 gap-1.5">
                    {COUNT_OPTIONS.map((cnt) => (
                      <button
                        key={cnt}
                        type="button"
                        onClick={() => setTargetCount(cnt)}
                        className={`rounded-lg border py-2 text-xs font-mono font-semibold transition ${
                          targetCount === cnt
                            ? 'border-indigo-500 bg-indigo-600 text-white'
                            : 'border-slate-800 bg-slate-950/60 text-slate-400 hover:border-slate-700 hover:text-slate-200'
                        }`}
                      >
                        {cnt}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Custom Search Topic / Platform Focus */}
                <div className="sm:col-span-8">
                  <label className="block text-xs font-medium text-slate-300 mb-2">
                    3. Custom Search Focus / Platforms <span className="text-slate-500 font-normal">(Optional)</span>:
                  </label>
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" />
                    <input
                      type="text"
                      value={customQuery}
                      onChange={(e) => setCustomQuery(e.target.value)}
                      placeholder="e.g., AI hackathons in India, Devfolio, Unstop, Web3 grants..."
                      className="w-full rounded-lg border border-slate-800 bg-slate-950/70 pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none"
                    />
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    {QUICK_FOCUS_PRESETS.map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() =>
                          setCustomQuery((prev) => (prev === preset ? '' : preset))
                        }
                        className={`rounded-md border px-2 py-0.5 text-[10px] transition ${
                          customQuery === preset
                            ? 'border-indigo-500/60 bg-indigo-950/50 text-indigo-300'
                            : 'border-slate-800 bg-slate-950/40 text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        {preset}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Action Button */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t border-slate-800/80">
                <span className="text-[11px] text-slate-400">
                  Will search for up to <strong className="text-white font-mono">{targetCount}</strong> net-new opportunities across <strong className="text-white font-mono">{selectedCategories.length}</strong> categories.
                </span>
                <button
                  type="button"
                  onClick={handleRunScan}
                  disabled={isScanning}
                  className="flex items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-xs font-semibold text-white shadow hover:bg-indigo-500 disabled:opacity-50 transition whitespace-nowrap"
                >
                  {isScanning ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      <span>Scanning ({targetCount} target)...</span>
                    </>
                  ) : (
                    <>
                      <Radar className="h-3.5 w-3.5" />
                      <span>Run Discovery Scan ({targetCount} New)</span>
                    </>
                  )}
                </button>
              </div>

              {scanMessage && (
                <div className="rounded-lg bg-slate-800/80 border border-slate-700 p-3 text-xs text-slate-200">
                  {scanMessage}
                </div>
              )}

              {pruneResult && (
                <div className="rounded-lg bg-slate-800/80 border border-slate-700 p-3 text-xs text-emerald-300">
                  {pruneResult}
                </div>
              )}

              {/* Discovered Opportunities Preview */}
              {discoveredItems.length > 0 && (
                <div className="space-y-3 pt-3 border-t border-slate-800">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-semibold text-white flex items-center gap-1.5">
                      <Sparkles className="h-3.5 w-3.5 text-indigo-400" />
                      <span>Net-New Discovered Opportunities ({discoveredItems.length})</span>
                    </h4>
                    <button
                      onClick={handleAddAll}
                      className="rounded-lg bg-indigo-600/20 border border-indigo-500/40 px-3 py-1 text-xs text-indigo-300 hover:bg-indigo-600/30 transition font-medium"
                    >
                      + Add All ({discoveredItems.length}) to Tracker
                    </button>
                  </div>

                  <div className="space-y-2">
                    {discoveredItems.map((item, idx) => {
                      const isAdded = addedTitles.has(item.title || '');
                      return (
                        <div
                          key={idx}
                          className="flex items-start justify-between gap-3 rounded-lg border border-slate-800 bg-slate-950 p-3 text-xs"
                        >
                          <div className="space-y-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-white truncate">
                                {item.title}
                              </span>
                              {item.application_url && (
                                <a
                                  href={item.application_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-indigo-400 hover:text-indigo-300 shrink-0"
                                  title="Open official application URL"
                                >
                                  <ExternalLink className="h-3 w-3" />
                                </a>
                              )}
                            </div>
                            <div className="text-[11px] text-slate-400">
                              <span>{item.organizer}</span> ·{' '}
                              <span>{formatCategoryLabel(item.category || '')}</span> ·{' '}
                              <span className="text-emerald-400">{item.indian_eligibility}</span>
                            </div>
                            <p className="text-[11px] text-slate-300 line-clamp-2">
                              {item.description}
                            </p>
                            <div className="text-[10px] text-slate-400 font-mono">
                              Stipend: {item.stipend} | Deadline: {item.deadline}
                            </div>
                          </div>

                          <button
                            onClick={() => handleAddDiscovered(item)}
                            disabled={isAdded}
                            className={`shrink-0 flex items-center gap-1 rounded-md px-2.5 py-1.5 text-xs font-medium transition ${
                              isAdded
                                ? 'bg-slate-800 text-slate-500 cursor-default'
                                : 'bg-indigo-600 text-white hover:bg-indigo-500'
                            }`}
                          >
                            {isAdded ? (
                              <>
                                <CheckCircle2 className="h-3 w-3 text-emerald-400" />
                                <span>Added</span>
                              </>
                            ) : (
                              <>
                                <Plus className="h-3 w-3" />
                                <span>Add to Tracker</span>
                              </>
                            )}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </>
          ) : (
            /* Tab 2: Historical Scan Logs */
            <div className="space-y-3">
              <h4 className="text-xs font-semibold text-slate-300">
                Historical Scan &amp; Maintenance Logs
              </h4>
              {logs.length === 0 ? (
                <p className="text-xs text-slate-500">No scan logs recorded yet.</p>
              ) : (
                <div className="space-y-2">
                  {logs.map((log) => (
                    <div
                      key={log.id}
                      className="rounded-lg border border-slate-800 bg-slate-950 p-3 text-xs space-y-1"
                    >
                      <div className="flex items-center justify-between text-slate-400">
                        <span className="font-mono text-[11px] tabular-nums">
                          {new Date(log.timestamp).toLocaleString()}
                        </span>
                        <span className="text-emerald-400 font-medium">{log.status}</span>
                      </div>
                      <p className="text-slate-200">{log.details}</p>
                      <div className="flex items-center gap-3 text-[11px] text-slate-400 pt-1 border-t border-slate-800/80">
                        <span>
                          Found: <strong className="text-white font-mono">{log.new_items_found}</strong>
                        </span>
                        <span>
                          Verified: <strong className="text-white font-mono">{log.items_verified}</strong>
                        </span>
                        <span>
                          Pruned: <strong className="text-white font-mono">{log.items_pruned}</strong>
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
