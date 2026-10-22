import { Opportunity, OpportunityInput, ScanLog, OpportunityCategory } from '../types/opportunity';

export async function fetchOpportunities(): Promise<Opportunity[]> {
  const res = await fetch('/api/opportunities');
  if (!res.ok) throw new Error('Failed to fetch opportunities');
  return res.json();
}

export async function createOpportunityApi(data: OpportunityInput): Promise<Opportunity> {
  const res = await fetch('/api/opportunities', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to create opportunity');
  }
  return res.json();
}

export async function updateOpportunityApi(id: string, data: Partial<OpportunityInput>): Promise<Opportunity> {
  const res = await fetch(`/api/opportunities/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to update opportunity');
  }
  return res.json();
}

export async function deleteOpportunityApi(id: string): Promise<void> {
  const res = await fetch(`/api/opportunities/${id}`, {
    method: 'DELETE',
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to delete opportunity');
  }
}

export async function triggerScanApi(options?: {
  categories?: OpportunityCategory[];
  autoAdd?: boolean;
  targetCount?: number;
  customQuery?: string;
}): Promise<{
  scanLog: ScanLog;
  discovered: Partial<OpportunityInput>[];
  stats: { added: number; verified: number; updated?: number; pruned: number };
}> {
  const res = await fetch('/api/scan', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(options || {}),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to execute opportunity scan');
  }
  return res.json();
}

export async function fetchScanLogsApi(): Promise<ScanLog[]> {
  const res = await fetch('/api/scan/logs');
  if (!res.ok) throw new Error('Failed to fetch scan logs');
  return res.json();
}

export async function parseTextWithAiApi(text: string): Promise<Partial<OpportunityInput>> {
  const res = await fetch('/api/opportunities/parse-text', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to parse text with AI');
  }
  return res.json();
}

export async function pruneExpiredApi(daysThreshold = 15): Promise<{ prunedCount: number }> {
  const res = await fetch('/api/opportunities/prune', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ daysThreshold }),
  });
  if (!res.ok) throw new Error('Failed to prune expired opportunities');
  return res.json();
}

export async function fetchHealthApi(): Promise<any> {
  const res = await fetch('/api/health');
  if (!res.ok) throw new Error('Failed to check health');
  return res.json();
}

export async function fetchIrrelevantOpportunitiesApi(): Promise<import('../types/opportunity').IrrelevantOpportunity[]> {
  const res = await fetch('/api/irrelevant');
  if (!res.ok) throw new Error('Failed to fetch irrelevant opportunities');
  return res.json();
}

export async function markOpportunityAsIrrelevantApi(data: {
  id?: string;
  title: string;
  organizer?: string;
  category?: import('../types/opportunity').OpportunityCategory;
  application_url?: string;
  reason?: string;
}): Promise<any> {
  const res = await fetch('/api/irrelevant', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to mark as irrelevant');
  }
  return res.json();
}

export async function unmarkIrrelevantOpportunityApi(id: string): Promise<any> {
  const res = await fetch(`/api/irrelevant/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
  if (!res.ok) throw new Error('Failed to remove from irrelevant list');
  return res.json();
}

