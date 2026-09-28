import React from 'react';
import { Download, Plus } from 'lucide-react';

interface HeaderProps {
  onOpenAddModal: () => void;
  onOpenScannerModal: () => void;
  onOpenRenderModal?: () => void;
  onExportExcel: () => void;
  isScanning?: boolean;
  lastScanText?: string;
  newFoundCount?: number;
}

export const Header: React.FC<HeaderProps> = ({
  onOpenAddModal,
  onOpenScannerModal,
  onExportExcel,
  lastScanText = 'Last scanned today at 8:42 PM',
  newFoundCount = 3,
}) => {
  return (
    <header className="sticky top-0 z-30 border-b border-slate-800/80 bg-[#060913]/95 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Left: Brand + Desktop Navigation */}
        <div className="flex items-center gap-6 h-full">
          <a href="/" className="flex items-center gap-2.5 group">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-sm font-bold text-base transition-transform group-hover:scale-105">
              S
            </div>
            <span className="text-xl font-bold tracking-tight text-white font-display">
              Scout
            </span>
          </a>

          <div className="hidden md:block h-5 w-px bg-slate-800" />

          <nav className="hidden md:flex items-center gap-7 h-full text-sm font-medium">
            <a
              href="#opportunities"
              className="flex items-center h-full border-b-2 border-indigo-500 text-indigo-400 font-semibold whitespace-nowrap"
            >
              Opportunities
            </a>
            <button
              onClick={onOpenScannerModal}
              className="flex items-center h-full border-b-2 border-transparent text-slate-400 hover:text-white transition-colors whitespace-nowrap"
            >
              Scanner
            </button>
          </nav>
        </div>

        {/* Right: Scanner Status Button + Export Excel + Add Opportunity */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Desktop Full Scanner Status Pill */}
          <button
            onClick={onOpenScannerModal}
            className="hidden lg:flex items-center gap-3 rounded-xl border border-slate-800 bg-slate-900/60 px-3.5 py-1.5 text-left hover:border-slate-700 hover:bg-slate-900 transition-colors"
            title="Click to open Daily Scanner"
          >
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500/15">
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
            </span>
            <div className="flex flex-col">
              <span className="text-xs font-semibold text-emerald-400 leading-tight">
                Scanner active
              </span>
              <div className="flex items-center gap-2 text-[11px] text-slate-400 leading-tight mt-0.5 whitespace-nowrap">
                <span>{lastScanText}</span>
                <span className="text-slate-600">|</span>
                <span className="font-semibold text-slate-200">
                  {newFoundCount} new opportunities
                </span>
              </div>
            </div>
          </button>

          {/* Mobile/Tablet Compact Scanner Pill */}
          <button
            onClick={onOpenScannerModal}
            className="flex lg:hidden items-center gap-1.5 rounded-xl border border-slate-800 bg-slate-900/70 px-2.5 py-2 text-xs font-semibold text-emerald-400 hover:bg-slate-800 transition-colors"
            title="Open Daily Scanner"
          >
            <span className="h-2 w-2 rounded-full bg-emerald-400" />
            <span className="hidden xs:inline">Scanner</span>
          </button>

          {/* Export Excel Button (Icon + Text on Desktop, Icon on Mobile) */}
          <button
            onClick={onExportExcel}
            className="flex items-center gap-2 rounded-xl border border-slate-700/80 bg-slate-900/80 px-2.5 sm:px-3.5 py-2 text-xs font-medium text-slate-200 hover:bg-slate-800 hover:border-slate-600 transition-colors whitespace-nowrap"
            title="Export full 21-column dataset to Excel (.xlsx)"
          >
            <Download className="h-3.5 w-3.5 text-slate-400" />
            <span className="hidden sm:inline">Export Excel</span>
          </button>

          {/* Add Opportunity Button */}
          <button
            onClick={onOpenAddModal}
            className="flex items-center gap-1.5 rounded-xl bg-indigo-600 px-3 sm:px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-indigo-500 transition-colors whitespace-nowrap"
          >
            <Plus className="h-4 w-4" />
            <span className="hidden xs:inline">Add Opportunity</span>
            <span className="xs:hidden">Add</span>
          </button>
        </div>
      </div>

      {/* Mobile Navigation Bar (< md) */}
      <div className="flex md:hidden items-center justify-between border-t border-slate-800/60 px-4 py-2 text-xs font-medium bg-[#060913]">
        <div className="flex items-center gap-5">
          <a href="#opportunities" className="text-indigo-400 font-semibold">
            Opportunities
          </a>
          <button onClick={onOpenScannerModal} className="text-slate-400 hover:text-white">
            Scanner
          </button>
        </div>
        <span className="text-[11px] text-slate-400">
          {newFoundCount} new found
        </span>
      </div>
    </header>
  );
};
