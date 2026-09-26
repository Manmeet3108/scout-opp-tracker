import React from 'react';
import { Opportunity, OpportunityCategory } from '../types/opportunity';

interface CategoryNavProps {
  selectedCategory: 'all' | OpportunityCategory;
  onSelectCategory: (category: 'all' | OpportunityCategory) => void;
  opportunities: Opportunity[];
}

const CATEGORIES: { id: 'all' | OpportunityCategory; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'fellowship', label: 'Fellowships' },
  { id: 'grant', label: 'Grants' },
  { id: 'ambassador', label: 'Ambassador Programs' },
  { id: 'opensource', label: 'Open Source Programs' },
  { id: 'hackathon_conference', label: 'Hackathons & Conferences' },
  { id: 'competition', label: 'Competitions' },
];

export const CategoryNav: React.FC<CategoryNavProps> = ({
  selectedCategory,
  onSelectCategory,
  opportunities,
}) => {
  const getCount = (cat: 'all' | OpportunityCategory) => {
    if (cat === 'all') return opportunities.length;
    return opportunities.filter((o) => o.category === cat).length;
  };

  return (
    <div id="categories" className="bg-[#060913] py-2">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-center gap-2 py-1">
          {CATEGORIES.map((cat) => {
            const count = getCount(cat.id);
            const isActive = selectedCategory === cat.id;

            return (
              <button
                key={cat.id}
                onClick={() => onSelectCategory(cat.id)}
                className={`flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-semibold transition-all whitespace-nowrap ${
                  isActive
                    ? 'bg-indigo-600 text-white shadow-sm ring-1 ring-indigo-400/40'
                    : 'border border-slate-800/90 bg-slate-900/50 text-slate-200 hover:border-slate-700 hover:bg-slate-900'
                }`}
              >
                <span>{cat.label}</span>
                <span
                  className={`inline-flex items-center justify-center rounded-full px-2 py-0.5 text-[11px] font-mono tabular-nums ${
                    isActive
                      ? 'bg-indigo-800/90 text-indigo-100'
                      : 'bg-slate-800 text-slate-300'
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
