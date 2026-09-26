import React, { useState, useEffect } from 'react';
import { 
  X, 
  Radar, 
  Sparkles, 
  Trash2, 
  CheckCircle2, 
  AlertCircle, 
  Loader2, 
  Calendar, 
  Plus, 
  History,
  ShieldCheck
} from 'lucide-react';
import { Opportunity, OpportunityInput, ScanLog, OpportunityCategory } from '../types/opportunity';
import { triggerScanApi, fetchScanLogsApi, pruneExpiredApi, createOpportunityApi } from '../utils/api';
import { formatCategoryLabel } from '../utils/exportExcel';

interface ScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpportunityAdded: () => void;
}

export const ScannerModal: React.FC<ScannerModalProps> = ({
  isOpen,
  onClose,
  onOpportunityAdded,
}) => {
  const [logs, setLogs] = useState<ScanLog[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [discoveredItems, setDiscoveredItems] = useState<Partial<OpportunityInput>[]>([]);
  const [selectedCategories, setSelectedCategories] = useState<OpportunityCategory[]>([
    'fellowship', 'grant', 'ambassador', 'opensource', 'hackathon_conference', 'competition'
  ]);
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

  const handleRunScan = async () => {
    setIsScanning(true);
    setScanMessage(null);
    setDiscoveredItems([]);

    try {
      const result = await triggerScanApi({
        categories: selectedCategories,
        autoAdd: false,
      });

      setDiscoveredItems(result.discovered);
      setScanMessage(`Scan completed! Discovered ${result.discovered.length} verified opportunities.`);
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
        source: 'Automated Daily Web Scanner',
      });

      if (item.title) {
        setAddedTitles((prev) => new Set([...prev, item.title!]));
      }
      onOpportunityAdded();
    } catch (err: any) {
      alert(`Error adding opportunity: ${err.message}`);
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
    if (!confirm('Prune opportunities with application deadlines closed more than 30 days ago?')) {
      return;
    }
    setIsPruning(true);
    setPruneResult(null);
    try {
      const res = await pruneExpiredApi(30);
      setPruneResult(`Pruning complete: ${res.prunedCount} expired records safely removed.`);
      onOpportunityAdded();
      loadLogs();
    } catch (err: any) {
      setPruneResult(`Pruning error: ${err.message}`);
    } finally {
      setIsPruning(false);
    }
  };

  const CATEGORY_CHOICES: OpportunityCategory[] = [
    'fellowship', 'grant', 'ambassador', 'opensource', 'hackathon_conference', 'competition'
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
                Daily Automated Web Scanner
              </h3>
              <p className="text-xs text-slate-400">
                Nightly crawl & verification engine for student opportunities.
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
            title="Prune opportunities whose deadline passed >30 days ago"
          >
            <Trash2 className="h-3 w-3" />
            <span>{isPruning ? 'Pruning...' : 'Prune Expired'}</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 max-h-[70vh] overflow-y-auto space-y-5">
          {activeTab === 'scanner' ? (
            <>
              {/* Cron Status Banner */}
              <div className="flex items-start gap-3 rounded-lg border border-indigo-900/40 bg-indigo-950/20 p-3.5 text-xs">
                <ShieldCheck className="h-4 w-4 text-indigo-400 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="font-semibold text-slate-200">
                    Automated Nightly Scheduler: <span className="text-emerald-400">Active</span>
                  </p>
                  <p className="text-slate-400 text-[11px]">
                    The server runs a scheduled sweep every 24 hours, evaluating active deadlines, flagging opportunities closing within 14 days, and pruning stale closed entries.
                  </p>
                </div>
              </div>

              {/* Category Scope Selection */}
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-2">
                  Select Categories to Scan:
                </label>
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
                        {isChecked && <CheckCircle2 className="h-3.5 w-3.5 text-indigo-400 shrink-0 ml-1" />}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Action Button */}
              <div className="flex items-center justify-between pt-2">
                <span className="text-[11px] text-slate-400">
                  Runs AI discovery across official portals, open source foundations, and student grants.
                </span>
                <button
                  type="button"
                  onClick={handleRunScan}
                  disabled={isScanning}
                  className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow hover:bg-indigo-500 disabled:opacity-50 transition"
                >
                  {isScanning ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      <span>Scanning Web for Opportunities...</span>
                    </>
                  ) : (
                    <>
                      <Radar className="h-3.5 w-3.5" />
                      <span>Run Discovery Scan Now</span>
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
                      <span>Discovered Opportunities ({discoveredItems.length})</span>
                    </h4>
                    <button
                      onClick={handleAddAll}
                      className="text-xs text-indigo-400 hover:text-indigo-300 transition font-medium"
                    >
                      + Add All to Tracker
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
                          <div className="space-y-1">
                            <span className="font-semibold text-white">{item.title}</span>
                            <div className="text-[11px] text-slate-400">
                              <span>{item.organizer}</span> · <span>{formatCategoryLabel(item.category || '')}</span> ·{' '}
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
              <h4 className="text-xs font-semibold text-slate-300">Historical Scan & Maintenance Logs</h4>
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
                        <span>Found: <strong className="text-white font-mono">{log.new_items_found}</strong></span>
                        <span>Verified: <strong className="text-white font-mono">{log.items_verified}</strong></span>
                        <span>Pruned: <strong className="text-white font-mono">{log.items_pruned}</strong></span>
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
