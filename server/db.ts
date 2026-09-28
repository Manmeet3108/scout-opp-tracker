import fs from 'fs';
import path from 'path';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Opportunity, OpportunityInput, ScanLog } from '../src/types/opportunity';
import { SEED_OPPORTUNITIES } from '../src/data/seedOpportunities';

const DATA_DIR = path.resolve(process.cwd(), 'data');
const OPPS_FILE = path.join(DATA_DIR, 'opportunities.json');
const LOGS_FILE = path.join(DATA_DIR, 'scan_logs.json');

let supabaseInstance: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient | null {
  if (supabaseInstance) return supabaseInstance;
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
  if (supabaseUrl && supabaseKey) {
    supabaseInstance = createClient(supabaseUrl, supabaseKey);
    return supabaseInstance;
  }
  return null;
}

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

/**
 * Syncs local cache with Supabase on startup if SUPABASE_URL is configured.
 */
async function syncFromSupabaseOnStartup() {
  const supabase = getSupabaseClient();
  if (!supabase) return;

  try {
    const { data, error } = await supabase
      .from('opportunities')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Supabase initial fetch error:', error.message);
      return;
    }

    if (data && data.length > 0) {
      ensureDataDir();
      fs.writeFileSync(OPPS_FILE, JSON.stringify(data, null, 2), 'utf-8');
      console.log(`Synced ${data.length} opportunities from Supabase.`);
    } else {
      // If Supabase table is empty on first connect, seed it with current local opportunities
      const currentLocal = getAllOpportunities();
      if (currentLocal.length > 0) {
        const { error: upsertErr } = await supabase
          .from('opportunities')
          .upsert(currentLocal, { onConflict: 'id' });
        if (!upsertErr) {
          console.log(`Initialized Supabase table with ${currentLocal.length} opportunities.`);
        }
      }
    }
  } catch (err) {
    console.error('Failed to sync from Supabase on startup:', err);
  }
}

function upsertOpportunitiesToSupabase(items: Opportunity[]) {
  const supabase = getSupabaseClient();
  if (!supabase || items.length === 0) return;

  supabase
    .from('opportunities')
    .upsert(items, { onConflict: 'id' })
    .then(({ error }) => {
      if (error) {
        console.error('Supabase upsert error:', error.message);
      }
    });
}

function deleteOpportunityFromSupabase(id: string) {
  const supabase = getSupabaseClient();
  if (!supabase) return;

  supabase
    .from('opportunities')
    .delete()
    .eq('id', id)
    .then(({ error }) => {
      if (error) {
        console.error('Supabase delete error:', error.message);
      }
    });
}

export function initDatabase() {
  ensureDataDir();

  // Only create opportunities.json if it doesn't exist yet — NEVER overwrite existing live/edited data with SEED_OPPORTUNITIES
  if (!fs.existsSync(OPPS_FILE)) {
    fs.writeFileSync(OPPS_FILE, JSON.stringify(SEED_OPPORTUNITIES, null, 2), 'utf-8');
  }

  if (!fs.existsSync(LOGS_FILE)) {
    const initialLog: ScanLog = {
      id: 'scan-log-initial',
      timestamp: new Date().toISOString(),
      trigger_type: 'automated_nightly',
      status: 'completed',
      categories_scanned: [
        'fellowship',
        'grant',
        'ambassador',
        'opensource',
        'hackathon_conference',
        'competition',
      ],
      new_items_found: SEED_OPPORTUNITIES.length,
      items_verified: SEED_OPPORTUNITIES.length,
      items_pruned: 0,
      details:
        'Verified official application timelines and deadlines across all opportunities.',
    };
    fs.writeFileSync(LOGS_FILE, JSON.stringify([initialLog], null, 2), 'utf-8');
  }

  // Run initial deadline status refresh based on current date
  updateDeadlineStatuses();

  // If Supabase is configured, pull latest records from Supabase
  syncFromSupabaseOnStartup();
}

export function getAllOpportunities(): Opportunity[] {
  ensureDataDir();
  if (!fs.existsSync(OPPS_FILE)) {
    fs.writeFileSync(OPPS_FILE, JSON.stringify(SEED_OPPORTUNITIES, null, 2), 'utf-8');
  }
  try {
    const raw = fs.readFileSync(OPPS_FILE, 'utf-8');
    return JSON.parse(raw);
  } catch (err) {
    console.error('Error reading opportunities.json:', err);
    return SEED_OPPORTUNITIES;
  }
}

export function saveAllOpportunities(items: Opportunity[]): void {
  ensureDataDir();
  fs.writeFileSync(OPPS_FILE, JSON.stringify(items, null, 2), 'utf-8');
  upsertOpportunitiesToSupabase(items);
}

export function getOpportunityById(id: string): Opportunity | undefined {
  const items = getAllOpportunities();
  return items.find((o) => o.id === id);
}

export function createOpportunity(input: OpportunityInput): Opportunity {
  const items = getAllOpportunities();
  const newOpp: Opportunity = {
    ...input,
    id: `scout-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    created_at: new Date().toISOString(),
    last_verified: input.last_verified || new Date().toISOString().split('T')[0],
  };

  items.unshift(newOpp);
  saveAllOpportunities(items);
  return newOpp;
}

export function updateOpportunity(
  id: string,
  input: Partial<OpportunityInput>
): Opportunity | null {
  const items = getAllOpportunities();
  const index = items.findIndex((o) => o.id === id);
  if (index === -1) return null;

  items[index] = {
    ...items[index],
    ...input,
    updated_at: new Date().toISOString(),
    last_verified: input.last_verified || new Date().toISOString().split('T')[0],
  };

  saveAllOpportunities(items);
  return items[index];
}

export function deleteOpportunity(id: string): boolean {
  const items = getAllOpportunities();
  const filtered = items.filter((o) => o.id !== id);
  if (filtered.length === items.length) return false;

  saveAllOpportunities(filtered);
  deleteOpportunityFromSupabase(id);
  return true;
}

export function batchAddOpportunities(newItems: OpportunityInput[]): {
  added: number;
  skipped: number;
} {
  const existing = getAllOpportunities();
  let added = 0;
  let skipped = 0;

  for (const item of newItems) {
    const dup = existing.some(
      (e) => e.title.trim().toLowerCase() === item.title.trim().toLowerCase()
    );
    if (!dup) {
      existing.unshift({
        ...item,
        id: `scout-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        created_at: new Date().toISOString(),
      });
      added++;
    } else {
      skipped++;
    }
  }

  if (added > 0) {
    saveAllOpportunities(existing);
  }
  return { added, skipped };
}

export function updateDeadlineStatuses(): { updatedCount: number } {
  const items = getAllOpportunities();
  const now = new Date();
  let updatedCount = 0;

  const modified = items.map((opp) => {
    if (opp.deadline === 'Rolling' || !opp.deadline) {
      if (opp.status !== 'Rolling') {
        updatedCount++;
        return { ...opp, status: 'Rolling' as const };
      }
      return opp;
    }

    const deadlineDate = new Date(opp.deadline);
    if (isNaN(deadlineDate.getTime())) return opp;

    const diffDays = Math.ceil(
      (deadlineDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
    );

    let newStatus = opp.status;
    if (diffDays < 0) {
      newStatus = 'Closed';
    } else if (diffDays <= 14) {
      newStatus = 'Closing Soon';
    } else {
      newStatus = 'Open';
    }

    if (newStatus !== opp.status) {
      updatedCount++;
      return { ...opp, status: newStatus };
    }
    return opp;
  });

  if (updatedCount > 0) {
    saveAllOpportunities(modified);
  }
  return { updatedCount };
}

export function pruneExpiredOpportunities(daysThreshold: number = 15): {
  prunedCount: number;
} {
  const items = getAllOpportunities();
  const now = new Date();

  const prunedIds: string[] = [];
  const active = items.filter((opp) => {
    // Keep flagship recurring annual programs in the tracker so mentors can track their official 2026 cycle dates
    if (opp.id.startsWith('scout-opp-')) return true;
    if (opp.deadline === 'Rolling' || !opp.deadline) return true;
    const deadlineDate = new Date(opp.deadline);
    if (isNaN(deadlineDate.getTime())) return true;

    const diffDays = Math.ceil(
      (deadlineDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
    );
    if (diffDays < -daysThreshold) {
      prunedIds.push(opp.id);
      return false;
    }
    return true;
  });

  const prunedCount = prunedIds.length;
  if (prunedCount > 0) {
    saveAllOpportunities(active);
    for (const id of prunedIds) {
      deleteOpportunityFromSupabase(id);
    }
  }
  return { prunedCount };
}

export function getScanLogs(): ScanLog[] {
  ensureDataDir();
  if (!fs.existsSync(LOGS_FILE)) {
    return [];
  }
  try {
    const raw = fs.readFileSync(LOGS_FILE, 'utf-8');
    return JSON.parse(raw);
  } catch (err) {
    console.error('Error reading scan_logs.json:', err);
    return [];
  }
}

export function addScanLog(log: ScanLog): void {
  ensureDataDir();
  const logs = getScanLogs();
  logs.unshift(log);
  const trimmed = logs.slice(0, 50);
  fs.writeFileSync(LOGS_FILE, JSON.stringify(trimmed, null, 2), 'utf-8');
}
