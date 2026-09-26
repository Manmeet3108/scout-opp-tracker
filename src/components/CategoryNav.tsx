import React from 'react';
import { Opportunity, OpportunityCategory } from '../types/opportunity';

interface CategoryNavProps {
  selectedCategory: 'all' | OpportunityCategory;
  onSelectCategory: (category: 'all' | OpportunityCategory) => void;
  opportunities: Opportunity[];
}

const CATEGORIES: { id: 'all' | OpportunityCategory; label: string }[] = [
  { id: 'all', label: 'All Opportunities' },
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
    <div id="categories" className="border-b border-slate-800 bg-slate-950/60">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex space-x-1 overflow-x-auto py-2.5 no-scrollbar scroll-smooth">
          {CATEGORIES.map((cat) => {
            const count = getCount(cat.id);
            const isActive = selectedCategory === cat.id;

            return (
              <button
                key={cat.id}
                onClick={() => onSelectCategory(cat.id)}
                className={`flex shrink-0 items-center gap-2 rounded-lg px-3.5 py-2 text-xs font-medium transition-colors whitespace-nowrap ${
                  isActive
                    ? 'bg-slate-800 text-white shadow-sm ring-1 ring-slate-700'
                    : 'text-slate-400 hover:bg-slate-900 hover:text-slate-200'
                }`}
              >
                <span>{cat.label}</span>
                <span
                  className={`text-[11px] font-mono tabular-nums ${
                    isActive ? 'text-indigo-400' : 'text-slate-500'
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
