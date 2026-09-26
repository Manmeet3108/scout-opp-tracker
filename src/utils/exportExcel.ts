import * as XLSX from 'xlsx';
import { Opportunity } from '../types/opportunity';

export function exportOpportunitiesToExcel(opportunities: Opportunity[], filename = 'Scout_Opportunities_Export.xlsx') {
  const data = opportunities.map((opp, index) => ({
    '#': index + 1,
    'Opportunity Title': opp.title,
    'Organizer / Organization': opp.organizer,
    'Category': formatCategoryLabel(opp.category),
    'Subcategory / Tags': opp.subcategory || '',
    'Description': opp.description,
    'Eligibility Requirements': opp.eligibility,
    'Indian Student Eligibility': opp.indian_eligibility,
    'Geography / Location': opp.geography,
    'Stipend / Financial Support': opp.stipend,
    'Funding Type': opp.stipend_type,
    'Application Deadline': opp.deadline,
    'Program Timeline': opp.timeline || '',
    'Program Duration': opp.duration || '',
    'Application URL': opp.application_url,
    'Required Materials / Checklist': opp.required_materials || '',
    'Competitiveness / Effort': opp.competitiveness,
    'Mentor Strategic Notes & Tips': opp.mentor_notes || '',
    'Target Mentee Persona': opp.target_persona || '',
    'Status': opp.status,
    'Last Verified Date': opp.last_verified,
    'Discovery Source': opp.source,
    'Record Created Date': opp.created_at,
  }));

  const worksheet = XLSX.utils.json_to_sheet(data);

  // Set column widths for readability
  const colWidths = [
    { wch: 4 },  // #
    { wch: 35 }, // Title
    { wch: 25 }, // Organizer
    { wch: 20 }, // Category
    { wch: 25 }, // Subcategory
    { wch: 50 }, // Description
    { wch: 40 }, // Eligibility
    { wch: 22 }, // Indian Eligibility
    { wch: 25 }, // Geography
    { wch: 30 }, // Stipend
    { wch: 18 }, // Funding Type
    { wch: 16 }, // Deadline
    { wch: 22 }, // Timeline
    { wch: 18 }, // Duration
    { wch: 35 }, // URL
    { wch: 40 }, // Required Materials
    { wch: 16 }, // Competitiveness
    { wch: 50 }, // Mentor Notes
    { wch: 35 }, // Target Persona
    { wch: 14 }, // Status
    { wch: 16 }, // Last Verified
    { wch: 25 }, // Source
    { wch: 22 }, // Created At
  ];
  worksheet['!cols'] = colWidths;

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Open Opportunities');

  XLSX.writeFile(workbook, filename);
}

export function exportOpportunitiesToCSV(opportunities: Opportunity[], filename = 'Scout_Opportunities_Export.csv') {
  const headers = [
    'Title',
    'Organizer',
    'Category',
    'Subcategory',
    'Description',
    'Eligibility',
    'Indian Student Eligibility',
    'Geography',
    'Stipend',
    'Funding Type',
    'Deadline',
    'Timeline',
    'Duration',
    'Application URL',
    'Required Materials',
    'Competitiveness',
    'Mentor Notes',
    'Target Persona',
    'Status',
    'Last Verified',
    'Source',
  ];

  const escapeCSV = (str: string | undefined) => {
    if (!str) return '""';
    return `"${str.replace(/"/g, '""')}"`;
  };

  const rows = opportunities.map((opp) => [
    escapeCSV(opp.title),
    escapeCSV(opp.organizer),
    escapeCSV(formatCategoryLabel(opp.category)),
    escapeCSV(opp.subcategory),
    escapeCSV(opp.description),
    escapeCSV(opp.eligibility),
    escapeCSV(opp.indian_eligibility),
    escapeCSV(opp.geography),
    escapeCSV(opp.stipend),
    escapeCSV(opp.stipend_type),
    escapeCSV(opp.deadline),
    escapeCSV(opp.timeline),
    escapeCSV(opp.duration),
    escapeCSV(opp.application_url),
    escapeCSV(opp.required_materials),
    escapeCSV(opp.competitiveness),
    escapeCSV(opp.mentor_notes),
    escapeCSV(opp.target_persona),
    escapeCSV(opp.status),
    escapeCSV(opp.last_verified),
    escapeCSV(opp.source),
  ]);

  const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export function formatCategoryLabel(cat: string): string {
  switch (cat) {
    case 'fellowship':
      return 'Fellowships';
    case 'grant':
      return 'Grants';
    case 'ambassador':
      return 'Ambassador Programs';
    case 'opensource':
      return 'Open Source Programs';
    case 'hackathon_conference':
      return 'Hackathons & Conferences';
    case 'competition':
      return 'Competitions';
    default:
      return cat;
  }
}
