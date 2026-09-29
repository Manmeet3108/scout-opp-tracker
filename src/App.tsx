import React, { useState, useEffect, useMemo } from 'react';
import { Opportunity, OpportunityInput, FilterState, OpportunityCategory, IndianEligibility, StipendType, OpportunityStatus } from './types/opportunity';
import { fetchOpportunities, createOpportunityApi, updateOpportunityApi, deleteOpportunityApi } from './utils/api';
import { exportOpportunitiesToExcel, exportOpportunitiesToCSV } from './utils/exportExcel';
import { Header } from './components/Header';
import { StatsBanner } from './components/StatsBanner';
import { CategoryNav } from './components/CategoryNav';
import { FilterBar } from './components/FilterBar';
import { OpportunityTable } from './components/OpportunityTable';
import { OpportunityModal } from './components/OpportunityModal';
import { ScannerModal } from './components/ScannerModal';
import { MenteeShareModal } from './components/MenteeShareModal';
import { RenderDeployModal } from './components/RenderDeployModal';
import { Check, Info, AlertTriangle } from 'lucide-react';

const INITIAL_FILTERS: FilterState = {
  search: '',
  category: 'all',
  indianEligibility: 'all',
  stipendType: 'all',
  status: 'all',
  competitiveness: 'all',
  sortBy: 'deadline_asc',
};

export default function App() {
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filters, setFilters] = useState<FilterState>(INITIAL_FILTERS);

  // Modals
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Opportunity | null>(null);
  const [isScannerModalOpen, setIsScannerModalOpen] = useState(false);
  const [isRenderModalOpen, setIsRenderModalOpen] = useState(false);
  const [sharingItem, setSharingItem] = useState<Opportunity | null>(null);

  // Toast notifications
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'info' | 'error' } | null>(null);

  const showToast = (message: string, type: 'success' | 'info' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  const loadData = async () => {
    try {
      setIsLoading(true);
      const data = await fetchOpportunities();
      setOpportunities(data);
    } catch (err: any) {
      console.error('Failed to load opportunities:', err);
      showToast('Error loading opportunities from database', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleFilterChange = (updates: Partial<FilterState>) => {
    setFilters((prev) => ({ ...prev, ...updates }));
  };

  const handleResetFilters = () => {
    setFilters(INITIAL_FILTERS);
  };

  // Filter & Sort Logic
  const opportunitiesMatchingOtherFilters = useMemo(() => {
    return opportunities.filter((opp) => {
      // Search filter
      if (filters.search.trim()) {
        const q = filters.search.toLowerCase();
        const matchTitle = opp.title.toLowerCase().includes(q);
        const matchOrganizer = opp.organizer.toLowerCase().includes(q);
        const matchSubcat = opp.subcategory?.toLowerCase().includes(q);
        const matchDesc = opp.description.toLowerCase().includes(q);
        const matchNotes = opp.mentor_notes?.toLowerCase().includes(q);
        const matchEligibility = opp.eligibility.toLowerCase().includes(q);
        if (
          !matchTitle &&
          !matchOrganizer &&
          !matchSubcat &&
          !matchDesc &&
          !matchNotes &&
          !matchEligibility
        ) {
          return false;
        }
      }

      // Indian student eligibility
      if (
        filters.indianEligibility !== 'all' &&
        opp.indian_eligibility !== filters.indianEligibility
      ) {
        return false;
      }

      // Stipend type
      if (filters.stipendType === 'paid_or_grant') {
        if (
          opp.stipend_type !== 'Paid / Stipend' &&
          opp.stipend_type !== 'Equity-free Grant'
        ) {
          return false;
        }
      } else if (
        filters.stipendType !== 'all' &&
        opp.stipend_type !== filters.stipendType
      ) {
        return false;
      }

      // Status (always derive effective status from deadline so past deadlines are never treated as Open)
      const effectiveStatus: OpportunityStatus = (() => {
        if (!opp.deadline || opp.deadline.trim().toLowerCase() === 'rolling') {
          return 'Rolling';
        }
        const d = new Date(opp.deadline);
        if (isNaN(d.getTime())) return opp.status;
        const diffDays = Math.ceil((d.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
        if (diffDays < 0) return 'Closed';
        if (diffDays <= 14) return 'Closing Soon';
        return 'Open';
      })();

      if (filters.status === 'active_open') {
        if (
          effectiveStatus !== 'Open' &&
          effectiveStatus !== 'Closing Soon' &&
          effectiveStatus !== 'Rolling'
        ) {
          return false;
        }
      } else if (filters.status !== 'all' && effectiveStatus !== filters.status) {
        return false;
      }

      // Competitiveness
      if (
        filters.competitiveness !== 'all' &&
        opp.competitiveness !== filters.competitiveness
      ) {
        return false;
      }

      return true;
    });
  }, [opportunities, filters]);

  const filteredOpportunities = useMemo(() => {
    return opportunitiesMatchingOtherFilters
      .filter((opp) => {
        if (filters.category !== 'all' && opp.category !== filters.category) {
          return false;
        }
        return true;
      })
      .sort((a, b) => {
        if (filters.sortBy === 'deadline_asc') {
          // Put Rolling at the end, date comparison otherwise
          if (a.deadline === 'Rolling') return 1;
          if (b.deadline === 'Rolling') return -1;
          return a.deadline.localeCompare(b.deadline);
        }
        if (filters.sortBy === 'deadline_desc') {
          if (a.deadline === 'Rolling') return 1;
          if (b.deadline === 'Rolling') return -1;
          return b.deadline.localeCompare(a.deadline);
        }
        if (filters.sortBy === 'created_desc') {
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        }
        if (filters.sortBy === 'title_asc') {
          return a.title.localeCompare(b.title);
        }
        return 0;
      });
  }, [opportunitiesMatchingOtherFilters, filters.category, filters.sortBy]);

  // Opportunity Actions
  const handleSaveOpportunity = async (data: OpportunityInput, id?: string) => {
    if (id) {
      await updateOpportunityApi(id, data);
      showToast(`Updated "${data.title}" successfully.`);
    } else {
      await createOpportunityApi(data);
      showToast(`Added "${data.title}" to tracker.`);
    }
    await loadData();
    setIsAddModalOpen(false);
    setEditingItem(null);
  };

  const handleDeleteOpportunity = async (id: string, title: string) => {
    if (!confirm(`Are you sure you want to delete "${title}" from the tracker?`)) {
      return;
    }
    try {
      await deleteOpportunityApi(id);
      showToast(`Deleted "${title}".`, 'info');
      await loadData();
    } catch (err: any) {
      showToast(err.message || 'Failed to delete opportunity', 'error');
    }
  };

  const handleExportExcel = () => {
    try {
      exportOpportunitiesToExcel(filteredOpportunities);
      showToast(`Exported ${filteredOpportunities.length} opportunities to Excel (.xlsx)!`);
    } catch (err) {
      showToast('Export failed. Trying CSV download...', 'info');
      exportOpportunitiesToCSV(filteredOpportunities);
    }
  };

  const handleExportCSV = () => {
    exportOpportunitiesToCSV(filteredOpportunities);
    showToast(`Exported ${filteredOpportunities.length} opportunities to CSV!`);
  };

  return (
    <div className="min-h-screen bg-[#060913] text-slate-100 font-sans flex flex-col">
      {/* Top Bar Contract (Wordmark — Nav links — Primary actions) */}
      <Header
        onOpenAddModal={() => {
          setEditingItem(null);
          setIsAddModalOpen(true);
        }}
        onOpenScannerModal={() => setIsScannerModalOpen(true)}
        onOpenRenderModal={() => setIsRenderModalOpen(true)}
        onExportExcel={handleExportExcel}
      />

      {/* Hero Title + Quantitative Stats Banner */}
      <StatsBanner
        opportunities={opportunities}
        onFilterActiveOpen={() =>
          setFilters({ ...INITIAL_FILTERS, status: 'active_open' })
        }
        onFilterClosingSoon={() =>
          setFilters({ ...INITIAL_FILTERS, status: 'Closing Soon' })
        }
        onFilterIndianEligible={() =>
          setFilters({ ...INITIAL_FILTERS, indianEligibility: 'Eligible' })
        }
        onFilterPaid={() =>
          setFilters({ ...INITIAL_FILTERS, stipendType: 'paid_or_grant' })
        }
        onResetFilters={handleResetFilters}
      />

      {/* 6 Category Segmented Navigation */}
      <CategoryNav
        selectedCategory={filters.category}
        onSelectCategory={(cat: 'all' | OpportunityCategory) =>
          handleFilterChange({ category: cat })
        }
        opportunities={opportunitiesMatchingOtherFilters}
      />

      {/* Search, Filter & Sort Bar */}
      <FilterBar
        filters={filters}
        onFilterChange={handleFilterChange}
        onResetFilters={handleResetFilters}
        totalFilteredCount={filteredOpportunities.length}
        totalAllCount={opportunities.length}
        onExportCSV={handleExportCSV}
      />

      {/* Main High-Density Table with Expandable 21-Field Views */}
      <main className="flex-1 pb-16">
        <OpportunityTable
          opportunities={filteredOpportunities}
          isLoading={isLoading}
          onEdit={(opp) => {
            setEditingItem(opp);
            setIsAddModalOpen(true);
          }}
          onDelete={handleDeleteOpportunity}
          onShare={(opp) => setSharingItem(opp)}
        />
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-900 bg-[#060913] py-6 text-center text-xs text-slate-400">
        <div className="mx-auto max-w-7xl px-4 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p>Scout Mentorship Tracker</p>
          <div className="flex items-center gap-4 text-slate-400">
            <button onClick={handleExportExcel} className="hover:text-slate-300">
              Export to Excel
            </button>
            <button onClick={() => setIsScannerModalOpen(true)} className="hover:text-slate-300">
              Web Scanner
            </button>
          </div>
        </div>
      </footer>

      {/* Add / Edit Modal */}
      <OpportunityModal
        isOpen={isAddModalOpen}
        onClose={() => {
          setIsAddModalOpen(false);
          setEditingItem(null);
        }}
        onSave={handleSaveOpportunity}
        editItem={editingItem}
      />

      {/* Daily Scanner Modal */}
      <ScannerModal
        isOpen={isScannerModalOpen}
        onClose={() => setIsScannerModalOpen(false)}
        onOpportunityAdded={loadData}
      />

      {/* Mentee Sharing Packet Modal */}
      <MenteeShareModal
        isOpen={Boolean(sharingItem)}
        onClose={() => setSharingItem(null)}
        opportunity={sharingItem}
      />

      {/* Render Deployment Guide Modal */}
      <RenderDeployModal
        isOpen={isRenderModalOpen}
        onClose={() => setIsRenderModalOpen(false)}
      />

      {/* Toast Notification */}
      {toast && (
        <div className="fixed bottom-5 right-5 z-50 flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-900 px-4 py-3 text-xs text-white shadow-xl animate-fade-in">
          {toast.type === 'success' && <Check className="h-4 w-4 text-emerald-400 shrink-0" />}
          {toast.type === 'info' && <Info className="h-4 w-4 text-indigo-400 shrink-0" />}
          {toast.type === 'error' && <AlertTriangle className="h-4 w-4 text-rose-400 shrink-0" />}
          <span>{toast.message}</span>
        </div>
      )}
    </div>
  );
}
