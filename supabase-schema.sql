-- Copy and paste this into your Supabase SQL Editor (https://supabase.com/dashboard)
-- to create the persistent opportunities table for Opportunity Scout:

CREATE TABLE IF NOT EXISTS public.opportunities (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  organizer TEXT NOT NULL,
  category TEXT NOT NULL,
  subcategory TEXT DEFAULT '',
  description TEXT NOT NULL,
  eligibility TEXT NOT NULL,
  indian_eligibility TEXT NOT NULL,
  geography TEXT DEFAULT 'Global',
  stipend TEXT NOT NULL,
  stipend_type TEXT DEFAULT 'Paid / Stipend',
  deadline TEXT NOT NULL,
  timeline TEXT DEFAULT '',
  duration TEXT DEFAULT '',
  application_url TEXT NOT NULL,
  required_materials TEXT DEFAULT '',
  competitiveness TEXT DEFAULT 'Medium',
  mentor_notes TEXT DEFAULT '',
  target_persona TEXT DEFAULT '',
  status TEXT DEFAULT 'Open',
  last_verified TEXT NOT NULL,
  source TEXT DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT
);
