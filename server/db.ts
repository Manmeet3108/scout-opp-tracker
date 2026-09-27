import fs from 'fs';
import path from 'path';
import { Opportunity, OpportunityInput, ScanLog } from '../src/types/opportunity';
import { SEED_OPPORTUNITIES } from '../src/data/seedOpportunities';

const DATA_DIR = path.resolve(process.cwd(), 'data');
const OPPS_FILE = path.join(DATA_DIR, 'opportunities.json');
const LOGS_FILE = path.join(DATA_DIR, 'scan_logs.json');

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

export function initDatabase() {
  ensureDataDir();

  if (!fs.existsSync(OPPS_FILE)) {
    fs.writeFileSync(OPPS_FILE, JSON.stringify(SEED_OPPORTUNITIES, null, 2), 'utf-8');
  } else {
    // Sync built-in seed records (scout-opp-01 .. scout-opp-15) with latest verified official schedules
    // while preserving any custom opportunities added by the mentor.
    try {
      const existing: Opportunity[] = JSON.parse(fs.readFileSync(OPPS_FILE, 'utf-8'));
      const seedMap = new Map(SEED_OPPORTUNITIES.map((s) => [s.id, s]));
      const customItems = existing.filter((item) => !seedMap.has(item.id));
      const merged = [...customItems, ...SEED_OPPORTUNITIES];
      fs.writeFileSync(OPPS_FILE, JSON.stringify(merged, null, 2), 'utf-8');
    } catch (err) {
      console.error('Error syncing seed opportunities, resetting to verified seed:', err);
      fs.writeFileSync(OPPS_FILE, JSON.stringify(SEED_OPPORTUNITIES, null, 2), 'utf-8');
    }
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
        'Verified official application timelines and deadlines across all 15 flagship opportunities.',
    };
    fs.writeFileSync(LOGS_FILE, JSON.stringify([initialLog], null, 2), 'utf-8');
  }

  // Run initial deadline status refresh based on current date
  updateDeadlineStatuses();
}

export function getAllOpportunities(): Opportunity[] {
  ensureDataDir();
  if (!fs.existsSync(OPPS_FILE)) {
    initDatabase();
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

export function pruneExpiredOpportunities(daysThreshold: number = 30): {
  prunedCount: number;
} {
  const items = getAllOpportunities();
  const now = new Date();

  const active = items.filter((opp) => {
    if (opp.deadline === 'Rolling' || !opp.deadline) return true;
    const deadlineDate = new Date(opp.deadline);
    if (isNaN(deadlineDate.getTime())) return true;

    const diffDays = Math.ceil(
      (deadlineDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
    );
    if (diffDays < -daysThreshold) {
      return false;
    }
    return true;
  });

  const prunedCount = items.length - active.length;
  if (prunedCount > 0) {
    saveAllOpportunities(active);
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
