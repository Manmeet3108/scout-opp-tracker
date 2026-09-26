import React, { useState, useEffect } from 'react';
import { X, Sparkles, AlertCircle, Check, Loader2 } from 'lucide-react';
import { Opportunity, OpportunityInput, OpportunityCategory, IndianEligibility, StipendType, OpportunityStatus, Competitiveness } from '../types/opportunity';
import { parseTextWithAiApi } from '../utils/api';

interface OpportunityModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: OpportunityInput, id?: string) => Promise<void>;
  editItem?: Opportunity | null;
}

const DEFAULT_FORM: OpportunityInput = {
  title: '',
  organizer: '',
  category: 'fellowship',
  subcategory: '',
  description: '',
  eligibility: '',
  indian_eligibility: 'Eligible',
  geography: 'Global / Remote',
  stipend: '',
  stipend_type: 'Paid / Stipend',
  deadline: '',
  timeline: '',
  duration: '',
  application_url: '',
  required_materials: '',
  competitiveness: 'High',
  mentor_notes: '',
  target_persona: '',
  status: 'Open',
  last_verified: new Date().toISOString().split('T')[0],
  source: 'Mentor Entry',
};

export const OpportunityModal: React.FC<OpportunityModalProps> = ({
  isOpen,
  onClose,
  onSave,
  editItem,
}) => {
  const [formData, setFormData] = useState<OpportunityInput>(DEFAULT_FORM);
  const [activeTab, setActiveTab] = useState<'form' | 'ai_parse'>('form');
  const [rawTextToParse, setRawTextToParse] = useState('');
  const [isParsing, setIsParsing] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const [parseSuccess, setParseSuccess] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (editItem) {
      const { id, created_at, updated_at, ...rest } = editItem;
      setFormData(rest);
      setActiveTab('form');
    } else {
      setFormData({
        ...DEFAULT_FORM,
        last_verified: new Date().toISOString().split('T')[0],
      });
      setActiveTab('form');
    }
    setRawTextToParse('');
    setParseError(null);
    setParseSuccess(false);
    setFormError(null);
  }, [editItem, isOpen]);

  if (!isOpen) return null;

  const handleInputChange = (field: keyof OpportunityInput, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleAiParse = async () => {
    if (!rawTextToParse.trim()) {
      setParseError('Please paste announcement text or program notes to parse.');
      return;
    }

    setIsParsing(true);
    setParseError(null);
    setParseSuccess(false);

    try {
      const result = await parseTextWithAiApi(rawTextToParse);
      setFormData((prev) => ({
        ...prev,
        ...result,
        last_verified: new Date().toISOString().split('T')[0],
        source: 'AI Quick-Parse Extractor',
      }));
      setParseSuccess(true);
      setActiveTab('form');
    } catch (err: any) {
      setParseError(err.message || 'Failed to parse text. You can still fill the form manually.');
    } finally {
      setIsParsing(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title.trim() || !formData.organizer.trim() || !formData.application_url.trim()) {
      setFormError('Please fill in Title, Organizer, and Application URL.');
      return;
    }

    setIsSubmitting(true);
    setFormError(null);

    try {
      await onSave(formData, editItem ? editItem.id : undefined);
      onClose();
    } catch (err: any) {
      setFormError(err.message || 'Failed to save opportunity');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm overflow-y-auto">
      <div className="relative w-full max-w-3xl rounded-xl border border-slate-800 bg-slate-900 shadow-xl overflow-hidden my-8">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 px-6 py-4 bg-slate-950/80">
          <div>
            <h3 className="text-base font-semibold text-white">
              {editItem ? 'Edit Opportunity' : 'Add New Opportunity'}
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Tracks all 21 mentorship data fields for student discovery.
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-800 hover:text-white transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Tab switcher: AI Quick Parse vs Manual Form */}
        {!editItem && (
          <div className="border-b border-slate-800 bg-slate-900/60 px-6 py-2 flex items-center gap-2">
            <button
              onClick={() => setActiveTab('form')}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                activeTab === 'form'
                  ? 'bg-slate-800 text-white'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Manual Form (21 Fields)
            </button>
            <button
              onClick={() => setActiveTab('ai_parse')}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                activeTab === 'ai_parse'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Sparkles className="h-3.5 w-3.5" />
              <span>AI Auto-Fill from Announcement / URL</span>
            </button>
          </div>
        )}

        {/* Content Body */}
        {activeTab === 'ai_parse' ? (
          <div className="p-6 space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Paste Announcement Text, Website Snippet, or Mentor Notes:
              </label>
              <textarea
                value={rawTextToParse}
                onChange={(e) => setRawTextToParse(e.target.value)}
                rows={8}
                placeholder="Paste any opportunity description, e.g.: 'Google Summer of Code 2026 is officially open! Stipends up to $3000 USD. Open to international students including India. 12-week coding project with open source maintainers...'"
                className="w-full rounded-lg border border-slate-800 bg-slate-950 p-3 text-xs text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none"
              />
            </div>

            {parseError && (
              <div className="flex items-center gap-2 rounded-lg bg-rose-950/40 border border-rose-900/50 p-3 text-xs text-rose-300">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{parseError}</span>
              </div>
            )}

            <div className="flex items-center justify-between pt-2">
              <span className="text-[11px] text-slate-400">
                Gemini will extract organizer, stipend, Indian student eligibility, deadlines, and mentor tips.
              </span>
              <button
                type="button"
                onClick={handleAiParse}
                disabled={isParsing}
                className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow hover:bg-indigo-500 disabled:opacity-50 transition"
              >
                {isParsing ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    <span>Extracting 21 Fields...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="h-3.5 w-3.5" />
                    <span>Auto-Fill Form</span>
                  </>
                )}
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-6 space-y-5 max-h-[70vh] overflow-y-auto">
            {parseSuccess && (
              <div className="flex items-center gap-2 rounded-lg bg-emerald-950/40 border border-emerald-900/50 p-3 text-xs text-emerald-300">
                <Check className="h-4 w-4 shrink-0 text-emerald-400" />
                <span>Successfully extracted opportunity details! Review the fields below before saving.</span>
              </div>
            )}

            {formError && (
              <div className="flex items-center gap-2 rounded-lg bg-rose-950/40 border border-rose-900/50 p-3 text-xs text-rose-300">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            {/* Section 1: Basic Identifiers */}
            <div>
              <h4 className="text-xs font-semibold text-indigo-400 uppercase tracking-wider mb-2">
                1. Core Identifiers
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="block text-slate-300 mb-1">Opportunity Title *</label>
                  <input
                    type="text"
                    required
                    value={formData.title}
                    onChange={(e) => handleInputChange('title', e.target.value)}
                    placeholder="e.g. MLH Fellowship 2026"
                    className="w-full rounded-lg border border-slate-800 bg-slate-950 p-2 text-white focus:border-indigo-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 mb-1">Organizer / Company *</label>
                  <input
                    type="text"
                    required
                    value={formData.organizer}
                    onChange={(e) => handleInputChange('organizer', e.target.value)}
                    placeholder="e.g. Major League Hacking & GitHub"
                    className="w-full rounded-lg border border-slate-800 bg-slate-950 p-2 text-white focus:border-indigo-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 mb-1">Category *</label>
                  <select
                    value={formData.category}
                    onChange={(e) => handleInputChange('category', e.target.value as OpportunityCategory)}
                    className="w-full rounded-lg border border-slate-800 bg-slate-950 p-2 text-white focus:border-indigo-500 focus:outline-none"
                  >
                    <option value="fellowship">Fellowship</option>
                    <option value="grant">Grant</option>
                    <option value="ambassador">Ambassador Program</option>
                    <option value="opensource">Open Source Program</option>
                    <option value="hackathon_conference">Hackathon & Conference</option>
                    <option value="competition">Competition</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-300 mb-1">Subcategory / Domain Focus</label>
                  <input
                    type="text"
                    value={formData.subcategory}
                    onChange={(e) => handleInputChange('subcategory', e.target.value)}
                    placeholder="e.g. Systems & Open Source, AI Alignment"
                    className="w-full rounded-lg border border-slate-800 bg-slate-950 p-2 text-white focus:border-indigo-500 focus:outline-none"
                  />
                </div>
              </div>
            </div>

            {/* Section 2: Eligibility & Indian Student Rules */}
            <div className="pt-2 border-t border-slate-800">
              <h4 className="text-xs font-semibold text-indigo-400 uppercase tracking-wider mb-2">
                2. Eligibility & Demographics
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="block text-slate-300 mb-1">Indian Student Eligibility *</label>
                  <select
                    value={formData.indian_eligibility}
                    onChange={(e) => handleInputChange('indian_eligibility', e.target.value as IndianEligibility)}
                    className="w-full rounded-lg border border-slate-800 bg-slate-950 p-2 text-white focus:border-indigo-500 focus:outline-none"
                  >
                    <option value="Eligible">Eligible (Indian students welcome)</option>
                    <option value="Conditional / Varies">Conditional / Varies</option>
                    <option value="Not Eligible">Not Eligible (Geographic restriction)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-300 mb-1">Geography / Location</label>
                  <input
                    type="text"
                    value={formData.geography}
                    onChange={(e) => handleInputChange('geography', e.target.value)}
                    placeholder="e.g. Global / Remote, India (Hybrid)"
                    className="w-full rounded-lg border border-slate-800 bg-slate-950 p-2 text-white focus:border-indigo-500 focus:outline-none"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-slate-300 mb-1">Academic Eligibility Criteria</label>
                  <input
                    type="text"
                    value={formData.eligibility}
                    onChange={(e) => handleInputChange('eligibility', e.target.value)}
                    placeholder="e.g. Enrolled undergraduate students in CS, EE, or related; 18+ years"
                    className="w-full rounded-lg border border-slate-800 bg-slate-950 p-2 text-white focus:border-indigo-500 focus:outline-none"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-slate-300 mb-1">Target Student Persona / Best Fit</label>
                  <input
                    type="text"
                    value={formData.target_persona}
                    onChange={(e) => handleInputChange('target_persona', e.target.value)}
                    placeholder="e.g. 2nd and 3rd year students with active GitHub repositories in Go or Rust"
                    className="w-full rounded-lg border border-slate-800 bg-slate-950 p-2 text-white focus:border-indigo-500 focus:outline-none"
                  />
                </div>
              </div>
            </div>

            {/* Section 3: Financials & Deadlines */}
            <div className="pt-2 border-t border-slate-800">
              <h4 className="text-xs font-semibold text-indigo-400 uppercase tracking-wider mb-2">
                3. Financial Support & Timeline
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="block text-slate-300 mb-1">Stipend / Support Details</label>
                  <input
                    type="text"
                    value={formData.stipend}
                    onChange={(e) => handleInputChange('stipend', e.target.value)}
                    placeholder="e.g. $3,000 USD stipend + travel grant"
                    className="w-full rounded-lg border border-slate-800 bg-slate-950 p-2 text-white focus:border-indigo-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 mb-1">Funding Type</label>
                  <select
                    value={formData.stipend_type}
                    onChange={(e) => handleInputChange('stipend_type', e.target.value as StipendType)}
                    className="w-full rounded-lg border border-slate-800 bg-slate-950 p-2 text-white focus:border-indigo-500 focus:outline-none"
                  >
                    <option value="Paid / Stipend">Paid / Stipend</option>
                    <option value="Equity-free Grant">Equity-free Grant</option>
                    <option value="Prizes / Hardware">Prizes / Hardware</option>
                    <option value="Unpaid / Perks">Unpaid / Perks</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-300 mb-1">Application Deadline</label>
                  <input
                    type="text"
                    value={formData.deadline}
                    onChange={(e) => handleInputChange('deadline', e.target.value)}
                    placeholder="e.g. 2026-10-31 or Rolling"
                    className="w-full rounded-lg border border-slate-800 bg-slate-950 p-2 text-white focus:border-indigo-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 mb-1">Status</label>
                  <select
                    value={formData.status}
                    onChange={(e) => handleInputChange('status', e.target.value as OpportunityStatus)}
                    className="w-full rounded-lg border border-slate-800 bg-slate-950 p-2 text-white focus:border-indigo-500 focus:outline-none"
                  >
                    <option value="Open">Open</option>
                    <option value="Closing Soon">Closing Soon</option>
                    <option value="Rolling">Rolling</option>
                    <option value="Closed">Closed</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-300 mb-1">Program Timeline</label>
                  <input
                    type="text"
                    value={formData.timeline}
                    onChange={(e) => handleInputChange('timeline', e.target.value)}
                    placeholder="e.g. June – August 2026"
                    className="w-full rounded-lg border border-slate-800 bg-slate-950 p-2 text-white focus:border-indigo-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 mb-1">Program Duration</label>
                  <input
                    type="text"
                    value={formData.duration}
                    onChange={(e) => handleInputChange('duration', e.target.value)}
                    placeholder="e.g. 12 weeks (30 hrs/week)"
                    className="w-full rounded-lg border border-slate-800 bg-slate-950 p-2 text-white focus:border-indigo-500 focus:outline-none"
                  />
                </div>
              </div>
            </div>

            {/* Section 4: URLs, Materials & Mentor Notes */}
            <div className="pt-2 border-t border-slate-800">
              <h4 className="text-xs font-semibold text-indigo-400 uppercase tracking-wider mb-2">
                4. Application & Mentor Strategy
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                <div className="md:col-span-2">
                  <label className="block text-slate-300 mb-1">Application URL *</label>
                  <input
                    type="url"
                    required
                    value={formData.application_url}
                    onChange={(e) => handleInputChange('application_url', e.target.value)}
                    placeholder="https://..."
                    className="w-full rounded-lg border border-slate-800 bg-slate-950 p-2 text-white focus:border-indigo-500 focus:outline-none"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-slate-300 mb-1">Required Materials / Checklist</label>
                  <input
                    type="text"
                    value={formData.required_materials}
                    onChange={(e) => handleInputChange('required_materials', e.target.value)}
                    placeholder="e.g. Resume, GitHub profile, 500-word proposal, recommendation letter"
                    className="w-full rounded-lg border border-slate-800 bg-slate-950 p-2 text-white focus:border-indigo-500 focus:outline-none"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-slate-300 mb-1">Program Description / Summary</label>
                  <textarea
                    rows={2}
                    value={formData.description}
                    onChange={(e) => handleInputChange('description', e.target.value)}
                    placeholder="Concise overview of what fellows/students do..."
                    className="w-full rounded-lg border border-slate-800 bg-slate-950 p-2 text-white focus:border-indigo-500 focus:outline-none"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-amber-300 font-medium mb-1">Mentor Strategic Notes & Tips</label>
                  <textarea
                    rows={2}
                    value={formData.mentor_notes}
                    onChange={(e) => handleInputChange('mentor_notes', e.target.value)}
                    placeholder="Actionable insider guidance for your mentees to win acceptance..."
                    className="w-full rounded-lg border border-slate-800 bg-slate-950 p-2 text-white focus:border-indigo-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 mb-1">Selectivity / Competitiveness</label>
                  <select
                    value={formData.competitiveness}
                    onChange={(e) => handleInputChange('competitiveness', e.target.value as Competitiveness)}
                    className="w-full rounded-lg border border-slate-800 bg-slate-950 p-2 text-white focus:border-indigo-500 focus:outline-none"
                  >
                    <option value="High">High (Very competitive)</option>
                    <option value="Medium">Medium (Moderate acceptance rate)</option>
                    <option value="Low">Low (Open / Accessible)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-300 mb-1">Source Label</label>
                  <input
                    type="text"
                    value={formData.source}
                    onChange={(e) => handleInputChange('source', e.target.value)}
                    placeholder="e.g. Curated Mentor Pipeline"
                    className="w-full rounded-lg border border-slate-800 bg-slate-950 p-2 text-white focus:border-indigo-500 focus:outline-none"
                  />
                </div>
              </div>
            </div>

            {/* Footer Buttons */}
            <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg border border-slate-700 bg-slate-800 px-4 py-2 text-xs font-medium text-slate-300 hover:bg-slate-700 transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-5 py-2 text-xs font-semibold text-white shadow-sm hover:bg-indigo-500 disabled:opacity-50 transition"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    <span>Saving...</span>
                  </>
                ) : (
                  <span>{editItem ? 'Save Changes' : 'Create Opportunity'}</span>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
