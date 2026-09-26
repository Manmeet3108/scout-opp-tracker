-- ============================================================
-- SCOUT OPPORTUNITY TRACKER & SCANNER SCHEMA
-- Target: PostgreSQL / Supabase / Render Postgres
-- Contains all 21 core opportunity fields + audit columns
-- ============================================================

CREATE TABLE IF NOT EXISTS opportunities (
    id VARCHAR(64) PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    organizer VARCHAR(255) NOT NULL,
    category VARCHAR(64) NOT NULL CHECK (category IN (
        'fellowship', 
        'grant', 
        'ambassador', 
        'opensource', 
        'hackathon_conference', 
        'competition'
    )),
    subcategory VARCHAR(255),
    description TEXT,
    eligibility TEXT,
    indian_eligibility VARCHAR(32) NOT NULL DEFAULT 'Eligible' CHECK (indian_eligibility IN (
        'Eligible', 
        'Not Eligible', 
        'Conditional / Varies'
    )),
    geography VARCHAR(255) DEFAULT 'Global / Remote',
    stipend TEXT,
    stipend_type VARCHAR(64) DEFAULT 'Paid / Stipend' CHECK (stipend_type IN (
        'Paid / Stipend', 
        'Equity-free Grant', 
        'Prizes / Hardware', 
        'Unpaid / Perks'
    )),
    deadline VARCHAR(64) NOT NULL,
    timeline VARCHAR(255),
    duration VARCHAR(128),
    application_url TEXT NOT NULL,
    required_materials TEXT,
    competitiveness VARCHAR(32) DEFAULT 'High' CHECK (competitiveness IN ('High', 'Medium', 'Low')),
    mentor_notes TEXT,
    target_persona TEXT,
    status VARCHAR(32) DEFAULT 'Open' CHECK (status IN ('Open', 'Closing Soon', 'Closed', 'Rolling')),
    last_verified DATE DEFAULT CURRENT_DATE,
    source VARCHAR(255) DEFAULT 'Automated Web Scan',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS scan_logs (
    id VARCHAR(64) PRIMARY KEY,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    trigger_type VARCHAR(64) NOT NULL,
    status VARCHAR(32) NOT NULL,
    categories_scanned TEXT[],
    new_items_found INT DEFAULT 0,
    items_verified INT DEFAULT 0,
    items_pruned INT DEFAULT 0,
    details TEXT
);

-- Performance Indexes
CREATE INDEX IF NOT EXISTS idx_opps_category ON opportunities(category);
CREATE INDEX IF NOT EXISTS idx_opps_indian_eligibility ON opportunities(indian_eligibility);
CREATE INDEX IF NOT EXISTS idx_opps_status ON opportunities(status);
CREATE INDEX IF NOT EXISTS idx_opps_deadline ON opportunities(deadline);
CREATE INDEX IF NOT EXISTS idx_opps_created_at ON opportunities(created_at DESC);
