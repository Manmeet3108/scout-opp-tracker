import React, { useState } from 'react';
import { X, Copy, Check, MessageSquare, Send, Mail } from 'lucide-react';
import { Opportunity } from '../types/opportunity';
import { formatCategoryLabel } from '../utils/exportExcel';

interface MenteeShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  opportunity: Opportunity | null;
}

export const MenteeShareModal: React.FC<MenteeShareModalProps> = ({
  isOpen,
  onClose,
  opportunity,
}) => {
  const [format, setFormat] = useState<'whatsapp' | 'discord' | 'email'>('whatsapp');
  const [copied, setCopied] = useState(false);

  if (!isOpen || !opportunity) return null;

  const generateMessage = (): string => {
    if (format === 'whatsapp') {
      return `🚀 *Open Opportunity for Mentees: ${opportunity.title}*

🏢 *Organizer:* ${opportunity.organizer}
🏷️ *Category:* ${formatCategoryLabel(opportunity.category)} (${opportunity.subcategory || 'General'})
📍 *Eligibility:* ${opportunity.eligibility}
🇮🇳 *Indian Students:* ${opportunity.indian_eligibility} (${opportunity.geography})
💰 *Stipend / Support:* ${opportunity.stipend}
⏳ *Deadline:* ${opportunity.deadline} (${opportunity.status})
⏱️ *Duration:* ${opportunity.duration || 'Flexible'}

📝 *Overview:*
${opportunity.description}

💡 *Mentor Tip to Win Acceptance:*
"${opportunity.mentor_notes || 'Focus on your past building track record and clear communication.'}"

🔗 *Apply Here:* ${opportunity.application_url}`;
    }

    if (format === 'discord') {
      return `### 🚀 Opportunity Alert: **${opportunity.title}**

> **Organizer:** ${opportunity.organizer}
> **Category:** \`${formatCategoryLabel(opportunity.category)}\` · \`${opportunity.subcategory || 'General'}\`
> **Eligibility:** ${opportunity.eligibility}
> **Indian Students Eligible:** **${opportunity.indian_eligibility}** (${opportunity.geography})
> **Stipend:** \`${opportunity.stipend}\`
> **Deadline:** **${opportunity.deadline}** (${opportunity.status})

**Summary:**
${opportunity.description}

**Mentor Advice:**
> 💡 *"${opportunity.mentor_notes || 'Submit working prototypes and clean git commit logs.'}"*

🔗 **Official Application Portal:** <${opportunity.application_url}>`;
    }

    // Email format
    return `Subject: Opportunity Alert: ${opportunity.title} (${opportunity.organizer})

Hi everyone,

Here is an exciting opportunity that fits your profile:

Program: ${opportunity.title}
Organizer: ${opportunity.organizer}
Category: ${formatCategoryLabel(opportunity.category)}
Indian Student Eligibility: ${opportunity.indian_eligibility}
Stipend / Financial Support: ${opportunity.stipend}
Application Deadline: ${opportunity.deadline}

About the Program:
${opportunity.description}

Required Materials:
${opportunity.required_materials || 'Resume, portfolio/GitHub link'}

Mentor Advice for Applying:
"${opportunity.mentor_notes || 'Review past winning proposals and prepare early.'}"

Official Application Link:
${opportunity.application_url}

Let me know if you would like me to review your application draft!`;
  };

  const textToCopy = generateMessage();

  const handleCopy = () => {
    navigator.clipboard.writeText(textToCopy);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
      <div className="relative w-full max-w-2xl rounded-xl border border-slate-800 bg-slate-900 shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 px-6 py-4 bg-slate-950/80">
          <div>
            <h3 className="text-base font-semibold text-white">
              Share with Mentees
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Copy ready-to-send opportunity packets formatted for student channels.
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-800 hover:text-white transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Format Selector */}
        <div className="border-b border-slate-800 bg-slate-900/60 px-6 py-2.5 flex items-center gap-2">
          <button
            onClick={() => setFormat('whatsapp')}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition ${
              format === 'whatsapp'
                ? 'bg-emerald-600 text-white shadow'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Send className="h-3 w-3" />
            <span>WhatsApp / Telegram</span>
          </button>

          <button
            onClick={() => setFormat('discord')}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition ${
              format === 'discord'
                ? 'bg-indigo-600 text-white shadow'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <MessageSquare className="h-3 w-3" />
            <span>Discord / Slack</span>
          </button>

          <button
            onClick={() => setFormat('email')}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition ${
              format === 'email'
                ? 'bg-slate-700 text-white shadow'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Mail className="h-3 w-3" />
            <span>Email Broadcast</span>
          </button>
        </div>

        {/* Text Preview Area */}
        <div className="p-6 space-y-4">
          <div className="relative">
            <textarea
              readOnly
              rows={12}
              value={textToCopy}
              className="w-full rounded-lg border border-slate-800 bg-slate-950 p-3.5 font-mono text-xs text-slate-200 focus:outline-none select-all leading-relaxed"
            />
          </div>

          <div className="flex items-center justify-between pt-1">
            <span className="text-[11px] text-slate-400">
              Includes eligibility, stipend, application link, and mentor notes.
            </span>
            <button
              onClick={handleCopy}
              className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow hover:bg-indigo-500 transition"
            >
              {copied ? (
                <>
                  <Check className="h-3.5 w-3.5 text-emerald-400" />
                  <span>Copied to Clipboard!</span>
                </>
              ) : (
                <>
                  <Copy className="h-3.5 w-3.5" />
                  <span>Copy to Clipboard</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
