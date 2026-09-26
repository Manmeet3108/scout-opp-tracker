import React from 'react';
import { Download, Plus, Radar, Server, Share2 } from 'lucide-react';

interface HeaderProps {
  onOpenAddModal: () => void;
  onOpenScannerModal: () => void;
  onOpenRenderModal: () => void;
  onExportExcel: () => void;
  isScanning?: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  onOpenAddModal,
  onOpenScannerModal,
  onOpenRenderModal,
  onExportExcel,
  isScanning = false,
}) => {
  return (
    <header className="sticky top-0 z-30 border-b border-slate-800 bg-slate-950/90 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Zone 1: Single text element wordmark */}
        <div className="flex items-center gap-3">
          <a href="/" className="flex items-center gap-2 group">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-600 text-white shadow-sm font-semibold transition-transform group-hover:scale-105">
              S
            </div>
            <span className="text-xl font-bold tracking-tight text-white font-display">
              Scout
            </span>
          </a>
          <span className="hidden sm:inline-block text-xs text-slate-400 border-l border-slate-800 pl-3">
            Mentorship Opportunity Tracker
          </span>
        </div>

        {/* Zone 2: 4-6 clean text navigation links */}
        <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-300">
          <button 
            onClick={onOpenScannerModal}
            className="flex items-center gap-1.5 hover:text-white transition-colors"
          >
            <Radar className={`h-4 w-4 ${isScanning ? 'animate-spin text-indigo-400' : 'text-slate-400'}`} />
            <span>Daily Scanner</span>
          </button>
          <button 
            onClick={onOpenRenderModal}
            className="flex items-center gap-1.5 hover:text-white transition-colors"
          >
            <Server className="h-4 w-4 text-slate-400" />
            <span>Render Deploy</span>
          </button>
          <a 
            href="#categories" 
            className="hover:text-white transition-colors"
          >
            6 Categories
          </a>
        </nav>

        {/* Zone 3: 1-2 primary actions */}
        <div className="flex items-center gap-2">
          <a
            href="/api/download-zip"
            download="scout-opportunity-tracker.zip"
            className="flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs font-medium text-slate-200 hover:bg-slate-800 hover:border-slate-600 transition-colors whitespace-nowrap"
            title="Download complete project as .zip file"
          >
            <Download className="h-3.5 w-3.5 text-indigo-400" />
            <span>Download .ZIP</span>
          </a>
          <button
            onClick={onExportExcel}
            className="hidden sm:flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs font-medium text-slate-200 hover:bg-slate-800 hover:border-slate-600 transition-colors whitespace-nowrap"
            title="Export full 21-column dataset to Excel (.xlsx)"
          >
            <Download className="h-3.5 w-3.5 text-slate-400" />
            <span>Export Excel</span>
          </button>
          <button
            onClick={onOpenAddModal}
            className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-indigo-500 transition-colors whitespace-nowrap"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Add Opportunity</span>
          </button>
        </div>
      </div>
    </header>
  );
};
