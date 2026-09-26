export type OpportunityCategory = 
  | 'fellowship' 
  | 'grant' 
  | 'ambassador' 
  | 'opensource' 
  | 'hackathon_conference' 
  | 'competition';

export type IndianEligibility = 'Eligible' | 'Not Eligible' | 'Conditional / Varies';

export type OpportunityStatus = 'Open' | 'Closing Soon' | 'Closed' | 'Rolling';

export type StipendType = 
  | 'Paid / Stipend' 
  | 'Equity-free Grant' 
  | 'Prizes / Hardware' 
  | 'Unpaid / Perks';

export type Competitiveness = 'High' | 'Medium' | 'Low';

export interface Opportunity {
  id: string;
  // 1. Title / Opportunity Name
  title: string;
  // 2. Organizer / Organization
  organizer: string;
  // 3. Category
  category: OpportunityCategory;
  // 4. Subcategory / Domain Tags
  subcategory: string;
  // 5. Description / Summary
  description: string;
  // 6. Eligibility (Degree, year, requirements)
  eligibility: string;
  // 7. Indian Student Eligibility
  indian_eligibility: IndianEligibility;
  // 8. Geography / Location
  geography: string;
  // 9. Stipend / Financial Support
  stipend: string;
  // 10. Stipend Type
  stipend_type: StipendType;
  // 11. Application Deadline (YYYY-MM-DD or Rolling)
  deadline: string;
  // 12. Program Timeline
  timeline: string;
  // 13. Program Duration
  duration: string;
  // 14. Application URL / Official Link
  application_url: string;
  // 15. Required Materials / Prerequisites
  required_materials: string;
  // 16. Effort Level / Competitiveness
  competitiveness: Competitiveness;
  // 17. Mentor Notes / Tips
  mentor_notes: string;
  // 18. Target Persona / Best Fit
  target_persona: string;
  // 19. Status
  status: OpportunityStatus;
  // 20. Last Verified Date
  last_verified: string;
  // 21. Source
  source: string;
  // System metadata
  created_at: string;
  updated_at?: string;
}

export type OpportunityInput = Omit<Opportunity, 'id' | 'created_at' | 'updated_at'>;

export interface ScanLog {
  id: string;
  timestamp: string;
  trigger_type: 'automated_nightly' | 'manual_scan';
  status: 'completed' | 'failed' | 'in_progress';
  categories_scanned: string[];
  new_items_found: number;
  items_verified: number;
  items_pruned: number;
  details: string;
  discovered_items?: Partial<Opportunity>[];
}

export interface FilterState {
  search: string;
  category: 'all' | OpportunityCategory;
  indianEligibility: 'all' | IndianEligibility;
  stipendType: 'all' | StipendType;
  status: 'all' | OpportunityStatus;
  competitiveness: 'all' | Competitiveness;
  sortBy: 'deadline_asc' | 'deadline_desc' | 'created_desc' | 'stipend_desc' | 'title_asc';
}
