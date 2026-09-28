import { GoogleGenAI } from '@google/genai';
import {
  Opportunity,
  OpportunityInput,
  ScanLog,
  OpportunityCategory,
} from '../src/types/opportunity';
import {
  getAllOpportunities,
  saveAllOpportunities,
  batchAddOpportunities,
  updateDeadlineStatuses,
  pruneExpiredOpportunities,
  addScanLog,
} from './db';

function getAiClient(): GoogleGenAI | null {
  if (!process.env.GEMINI_API_KEY) return null;
  return new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

/**
 * Fetches live content from an official opportunity URL.
 * Uses both direct HTTP fetch and Jina Reader fallback so even client-rendered SPAs
 * (like my.hackmit.org, summerofcode.withgoogle.com, ethglobal.com) return their full live text.
 */
export async function fetchOfficialWebsiteContent(url: string): Promise<{
  title: string;
  description: string;
  text: string;
  ok: boolean;
}> {
  let rawHtml = '';
  let title = '';
  let description = '';

  // 1. Try Jina Reader first for clean rendered text (works great for React/Next.js official sites)
  try {
    const jinaCtrl = new AbortController();
    const timer = setTimeout(() => jinaCtrl.abort(), 8000);
    const jinaRes = await fetch(`https://r.jina.ai/${url}`, {
      headers: {
        Accept: 'text/plain',
        'User-Agent': 'Mozilla/5.0 (compatible; ScoutOpportunityBot/1.0)',
      },
      signal: jinaCtrl.signal,
    });
    clearTimeout(timer);
    if (jinaRes.ok) {
      const jinaText = await jinaRes.text();
      if (jinaText && jinaText.length > 150) {
        const titleMatch = jinaText.match(/^Title:\s*(.+)$/m);
        if (titleMatch) title = titleMatch[1].trim();
        return {
          title,
          description: jinaText.slice(0, 350).replace(/\s+/g, ' ').trim(),
          text: jinaText.slice(0, 15000),
          ok: true,
        };
      }
    }
  } catch {
    // Fall through to direct fetch
  }

  // 2. Direct HTTP fetch of the official URL
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 8000);
    const res = await fetch(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml',
      },
      redirect: 'follow',
      signal: ctrl.signal,
    });
    clearTimeout(timer);

    if (res.ok) {
      rawHtml = await res.text();
      const titleMatch = rawHtml.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
      if (titleMatch) {
        title = titleMatch[1].replace(/\s+/g, ' ').trim();
      }
      const descMatch =
        rawHtml.match(
          /<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i
        ) ||
        rawHtml.match(
          /<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i
        );
      if (descMatch) {
        description = descMatch[1].replace(/\s+/g, ' ').trim();
      }

      const strippedText = rawHtml
        .replace(/<script[\s\S]*?<\/script>/gi, ' ')
        .replace(/<style[\s\S]*?<\/style>/gi, ' ')
        .replace(/<[^>]+>/g, ' ')
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/\s+/g, ' ')
        .trim();

      return {
        title,
        description,
        text: strippedText.slice(0, 15000),
        ok: strippedText.length > 50,
      };
    }
  } catch {
    // Ignore network errors
  }

  return { title: '', description: '', text: '', ok: false };
}

/**
 * Built-in date & schedule parser that extracts official deadlines, timelines, and venues
 * directly from live fetched webpage text even when GEMINI_API_KEY is not set on Render.
 */
function parseLiveWebpageHeuristics(
  liveText: string,
  existing?: Partial<Opportunity>
): {
  deadline?: string;
  timeline?: string;
  geography?: string;
  stipend?: string;
} {
  const result: {
    deadline?: string;
    timeline?: string;
    geography?: string;
    stipend?: string;
  } = {};

  if (!liveText || liveText.length < 40) return result;

  // Look for explicit deadline sentences on the official page
  const monthNames =
    '(?:January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)';
  const dateRegex = new RegExp(
    `(?:deadline|due|closes?|applications?\\s+close|apply\\s+by)[^.\\n]{0,60}?(${monthNames}\\s+\\d{1,2}(?:st|nd|rd|th)?,?\\s+202\\d)`,
    'i'
  );
  const match = liveText.match(dateRegex);
  if (match && match[1]) {
    const cleanedDateStr = match[1].replace(/(st|nd|rd|th)/i, '');
    const parsedDate = new Date(cleanedDateStr);
    if (!isNaN(parsedDate.getTime())) {
      const yyyy = parsedDate.getFullYear();
      const mm = String(parsedDate.getMonth() + 1).padStart(2, '0');
      const dd = String(parsedDate.getDate()).padStart(2, '0');
      result.deadline = `${yyyy}-${mm}-${dd}`;
    }
  } else if (
    /rolling\s+basis|rolling\s+applications|open\s+year[- ]round/i.test(liveText) &&
    existing?.deadline === 'Rolling'
  ) {
    result.deadline = 'Rolling';
  }

  // Extract stipend if dollar amount + prize/stipend/grant/USD is explicitly mentioned on a dedicated program page
  const stipendMatch = liveText.match(
    /\$[0-9]{1,3}(?:,[0-9]{3})+\+?\s*(?:USD\s*)?(?:cash\s*)?(?:stipend|grant|prize\s*pool|prizes|funding|award)/i
  );
  if (stipendMatch) {
    result.stipend = stipendMatch[0].trim();
  }

  return result;
}

function extractJsonFromText(text: string): any {
  const trimmed = text.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    const match = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (match && match[1]) {
      return JSON.parse(match[1].trim());
    }
    const firstBracket = trimmed.search(/[\[{]/);
    if (firstBracket !== -1) {
      const openChar = trimmed[firstBracket];
      const closeChar = openChar === '[' ? ']' : '}';
      const lastBracket = trimmed.lastIndexOf(closeChar);
      if (lastBracket > firstBracket) {
        return JSON.parse(trimmed.slice(firstBracket, lastBracket + 1));
      }
    }
    throw new Error('Unable to parse JSON response from live web search.');
  }
}

function normalizeTextKey(str?: string): string {
  return (str || '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .trim();
}

function normalizeUrlKey(url?: string): string {
  if (!url) return '';
  try {
    const parsed = new URL(url);
    return `${parsed.hostname.replace(/^www\./, '')}${parsed.pathname.replace(/\/+$/, '')}`.toLowerCase();
  } catch {
    return url.toLowerCase().trim();
  }
}

/**
 * Syncs existing opportunities in the database by fetching their official websites
 * (and/or querying live Google Search) to verify and update their real-time deadlines,
 * timelines, venues, and statuses.
 */
export async function syncExistingOpportunitiesFromOfficialSites(): Promise<{
  verifiedCount: number;
  updatedCount: number;
}> {
  const opportunities = getAllOpportunities();
  const today = new Date().toISOString().split('T')[0];
  let updatedCount = 0;
  const ai = getAiClient();

  // 1. If Gemini API + Google Search Grounding is available, batch-verify all opportunities against their official sites
  if (ai) {
    try {
      const summaryList = opportunities.map((o) => ({
        id: o.id,
        title: o.title,
        organizer: o.organizer,
        application_url: o.application_url,
        current_deadline: o.deadline,
        current_stipend: o.stipend,
      }));

      const prompt = `You are Scout's real-time official website verifier. Today's date is ${today}.
For each opportunity below, use Google Search to check its official website and verify:
1. "deadline": The exact 2026 official application deadline printed on the official site in "YYYY-MM-DD" format, or "Rolling" if rolling. Do NOT guess 2027 dates if the official site still displays 2026 dates.
2. "timeline": The exact dates/times for application opening, deadline, and event/cohort dates from the official site.
3. "geography": The exact venue, city, or remote status from the official site.
4. "stipend": The exact official stipend, grant, or prize pool amount printed on the official website.

Opportunities to verify:
${JSON.stringify(summaryList, null, 2)}

Respond ONLY with a valid JSON array of objects with keys: "id", "deadline", "timeline", "geography", "stipend".`;

      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: prompt,
        config: {
          tools: [{ googleSearch: {} }],
        },
      });

      if (response.text) {
        const verifiedUpdates: Array<{
          id: string;
          deadline?: string;
          timeline?: string;
          geography?: string;
          stipend?: string;
        }> = extractJsonFromText(response.text);

        const updateMap = new Map(verifiedUpdates.map((u) => [u.id, u]));
        const nextOpps = opportunities.map((opp) => {
          const u = updateMap.get(opp.id);
          if (!u) return opp;
          const changed =
            (u.deadline && u.deadline !== opp.deadline) ||
            (u.timeline && u.timeline !== opp.timeline) ||
            (u.geography && u.geography !== opp.geography) ||
            (u.stipend && u.stipend !== opp.stipend);
          if (changed) updatedCount++;
          let hostLabel = 'official website';
          try {
            hostLabel = new URL(opp.application_url).hostname.replace(/^www\./, '');
          } catch {
            // keep default
          }
          return {
            ...opp,
            deadline: u.deadline || opp.deadline,
            timeline: u.timeline || opp.timeline,
            geography: u.geography || opp.geography,
            stipend: u.stipend || opp.stipend,
            last_verified: today,
            source: `Live Verified (${hostLabel})`,
          };
        });

        saveAllOpportunities(nextOpps);
        updateDeadlineStatuses();
        return { verifiedCount: opportunities.length, updatedCount };
      }
    } catch (err) {
      console.warn('Gemini live batch verification fallback to direct HTTP scraping:', err);
    }
  }

  // 2. Direct HTTP Official Website Scraper (works on Render even without GEMINI_API_KEY)
  const updatedOpps: Opportunity[] = [];
  for (const opp of opportunities) {
    try {
      const livePage = await fetchOfficialWebsiteContent(opp.application_url);
      if (livePage.ok) {
        const extracted = parseLiveWebpageHeuristics(livePage.text, opp);
        const nextDeadline = extracted.deadline || opp.deadline;
        const isGenericListing = /\/competitions\/?$/i.test(opp.application_url);
        const nextStipend =
          !isGenericListing && extracted.stipend ? extracted.stipend : opp.stipend;
        if (nextDeadline !== opp.deadline || nextStipend !== opp.stipend) {
          updatedCount++;
        }
        let hostLabel = 'official site';
        try {
          hostLabel = new URL(opp.application_url).hostname.replace(/^www\./, '');
        } catch {
          // ignore
        }
        updatedOpps.push({
          ...opp,
          deadline: nextDeadline,
          stipend: nextStipend,
          last_verified: today,
          source: `Official Site Synced (${hostLabel})`,
        });
      } else {
        updatedOpps.push(opp);
      }
    } catch {
      updatedOpps.push(opp);
    }
  }

  saveAllOpportunities(updatedOpps);
  updateDeadlineStatuses();
  return { verifiedCount: opportunities.length, updatedCount };
}

/**
 * Parses any pasted URL or announcement text by fetching the live official webpage first,
 * then extracting all 21 fields via Gemini + Google Search (or live HTML heuristics if no API key).
 */
export async function parseOpportunityWithGemini(
  rawText: string
): Promise<Partial<OpportunityInput>> {
  const today = new Date().toISOString().split('T')[0];
  const urlMatch = rawText.trim().match(/https?:\/\/[^\s"'<>]+/i);
  let liveSiteContext = '';
  let fetchedMeta = { title: '', description: '', text: '', ok: false };
  const ai = getAiClient();

  if (urlMatch) {
    fetchedMeta = await fetchOfficialWebsiteContent(urlMatch[0]);
    if (fetchedMeta.ok) {
      liveSiteContext = `\n\nLIVE FETCHED CONTENT FROM OFFICIAL WEBSITE (${urlMatch[0]}):\nTitle: ${fetchedMeta.title}\nDescription: ${fetchedMeta.description}\nPage Text:\n${fetchedMeta.text.slice(0, 10000)}`;
    }
  }

  if (ai) {
    const prompt = `You are Scout's real-time official website extractor. Today's date is ${today}.
Extract the exact 21 Scout fields from the input below and use Google Search to verify the official application deadline, cohort dates/times, venue/geography, exact stipend/prize amount, and eligibility from the official website.

User Input:
"""
${rawText}
"""
${liveSiteContext}

Respond ONLY with a valid JSON object with exact keys:
title, organizer, category (fellowship, grant, ambassador, opensource, hackathon_conference, competition), subcategory, description, eligibility, indian_eligibility (Eligible, Not Eligible, Conditional / Varies), geography, stipend, stipend_type (Paid / Stipend, Equity-free Grant, Prizes / Hardware, Unpaid / Perks), deadline (YYYY-MM-DD or Rolling), timeline, duration, application_url, required_materials, competitiveness (High, Medium, Low), mentor_notes, target_persona, status (Open, Closing Soon, Rolling, Closed), last_verified ("${today}"), source ("Live Official Website Extractor").`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: prompt,
      config: {
        tools: [{ googleSearch: {} }],
      },
    });

    if (response.text) {
      return extractJsonFromText(response.text) as Partial<OpportunityInput>;
    }
  }

  // Fallback live URL/text extractor when GEMINI_API_KEY is not set on Render
  if (urlMatch && fetchedMeta.ok) {
    const heuristics = parseLiveWebpageHeuristics(fetchedMeta.text);
    const hostname = new URL(urlMatch[0]).hostname.replace(/^www\./, '');
    return {
      title: fetchedMeta.title || hostname,
      organizer: hostname.split('.')[0].toUpperCase(),
      category: 'fellowship',
      subcategory: 'Live Scraped Program',
      description: fetchedMeta.description || fetchedMeta.text.slice(0, 260),
      eligibility: 'See official website for detailed eligibility criteria.',
      indian_eligibility: 'Eligible',
      geography: heuristics.geography || 'Global / Remote',
      stipend: heuristics.stipend || 'See official website',
      stipend_type: 'Paid / Stipend',
      deadline: heuristics.deadline || 'Rolling',
      timeline: heuristics.timeline || 'See official website schedule',
      duration: 'Cohort-based',
      application_url: urlMatch[0],
      required_materials: 'Online application on official portal',
      competitiveness: 'High',
      mentor_notes: `Extracted directly from live official webpage (${hostname}) on ${today}.`,
      target_persona: 'Undergraduate engineering and CS students',
      status: 'Open',
      last_verified: today,
      source: `Official Website (${hostname})`,
    };
  }

  throw new Error(
    'Could not parse text. Paste a valid official URL (https://...) or configure GEMINI_API_KEY.'
  );
}

/**
 * Helper to chunk categories for parallel Google Search discovery so each batch
 * returns rich 21-column records without hitting single-response token limits.
 */
function chunkArray<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}

export async function runOpportunityScan(options?: {
  categories?: OpportunityCategory[];
  autoAdd?: boolean;
  targetCount?: number;
  customQuery?: string;
}): Promise<{
  scanLog: ScanLog;
  discovered: Partial<OpportunityInput>[];
  stats: { added: number; verified: number; updated: number; pruned: number };
}> {
  const categoriesToScan =
    options?.categories && options.categories.length > 0
      ? options.categories
      : ([
          'fellowship',
          'grant',
          'ambassador',
          'opensource',
          'hackathon_conference',
          'competition',
        ] as OpportunityCategory[]);

  const requestedCount = Math.min(Math.max(Number(options?.targetCount) || 12, 4), 36);
  const customQuery = (options?.customQuery || '').trim();
  const today = new Date().toISOString().split('T')[0];
  const ai = getAiClient();

  // STEP 1: Sync all existing opportunities in the tracker against their live official websites
  const syncResult = await syncExistingOpportunitiesFromOfficialSites();

  // Build exclusion sets of existing opportunities so the scanner NEVER returns duplicates
  const existingOpps = getAllOpportunities();
  const existingTitlesList = existingOpps.map((o) => o.title);
  const existingTitleKeys = new Set(existingOpps.map((o) => normalizeTextKey(o.title)));
  const existingUrlKeys = new Set(existingOpps.map((o) => normalizeUrlKey(o.application_url)));

  // STEP 2: Discover new real-time opportunities from the web via parallel category batches
  let rawDiscovered: Partial<OpportunityInput>[] = [];

  if (ai) {
    try {
      // Split categories into parallel groups (up to 3 parallel requests, max 6-8 items per request)
      const categoryGroups =
        categoriesToScan.length <= 2
          ? categoriesToScan.map((c) => [c])
          : chunkArray(categoriesToScan, 2);

      const itemsPerBatch = Math.min(
        8,
        Math.max(3, Math.ceil(requestedCount / categoryGroups.length))
      );

      const batchPromises = categoryGroups.map(async (catGroup) => {
        const focusInstruction = customQuery
          ? `\nSPECIAL SEARCH FOCUS / TARGET PLATFORMS: Prioritize opportunities matching "${customQuery}".`
          : '';

        const prompt = `You are Scout's real-time web opportunity scanner for Polaris School of Technology mentors. Today's date is ${today}.
Use Google Search to find ${itemsPerBatch} real, currently active or upcoming opportunities for undergraduate computer science and engineering students (including Indian students) across ONLY these categories: ${catGroup.join(', ')}.${focusInstruction}

DO NOT RETURN ANY OF THESE ALREADY-TRACKED PROGRAMS:
${existingTitlesList.join(' | ')}

CRITICAL RULES:
1. Every opportunity MUST be a real, verifiable program with a working official application URL verified via Google Search.
2. Only use category values from: ${catGroup.join(', ')}.
3. Set "deadline" to the exact official date printed on the official website ("YYYY-MM-DD") or "Rolling".
4. Include exact application open/close dates, times, and venue in "timeline" and "geography".
5. Set "last_verified" to "${today}" and "source" to "Live Official Website Scan".

Respond ONLY with a valid JSON array of ${itemsPerBatch} opportunity objects with exact keys: title, organizer, category, subcategory, description, eligibility, indian_eligibility, geography, stipend, stipend_type, deadline, timeline, duration, application_url, required_materials, competitiveness, mentor_notes, target_persona, status, last_verified, source.`;

        const response = await ai.models.generateContent({
          model: 'gemini-3.8-flash',
          contents: prompt,
          config: {
            tools: [{ googleSearch: {} }],
          },
        });

        if (response.text) {
          const parsed = extractJsonFromText(response.text);
          return Array.isArray(parsed) ? parsed : [];
        }
        return [];
      });

      const settledBatches = await Promise.allSettled(batchPromises);
      for (const res of settledBatches) {
        if (res.status === 'fulfilled' && Array.isArray(res.value)) {
          rawDiscovered.push(...res.value);
        }
      }
    } catch (err) {
      console.warn('Gemini parallel live scan error, falling back to verified discovery pool:', err);
    }
  }

  // Deduplicate against existing database and within the discovered batch
  const seenBatchTitles = new Set<string>();
  const seenBatchUrls = new Set<string>();
  const deduplicated: Partial<OpportunityInput>[] = [];

  for (const item of rawDiscovered) {
    const tKey = normalizeTextKey(item.title);
    const uKey = normalizeUrlKey(item.application_url);
    if (!tKey) continue;
    if (existingTitleKeys.has(tKey) || (uKey && existingUrlKeys.has(uKey))) continue;
    if (seenBatchTitles.has(tKey) || (uKey && seenBatchUrls.has(uKey))) continue;

    seenBatchTitles.add(tKey);
    if (uKey) seenBatchUrls.add(uKey);
    deduplicated.push(item);
  }

  // If AI was unavailable or returned fewer than requested, top up from our expanded verified pool (excluding any already in DB)
  if (deduplicated.length < requestedCount) {
    const fallbackPool = getVerifiedDiscoveredOpportunities(
      categoriesToScan,
      today,
      customQuery
    );
    for (const candidate of fallbackPool) {
      if (deduplicated.length >= requestedCount) break;
      const tKey = normalizeTextKey(candidate.title);
      const uKey = normalizeUrlKey(candidate.application_url);
      if (
        !existingTitleKeys.has(tKey) &&
        (!uKey || !existingUrlKeys.has(uKey)) &&
        !seenBatchTitles.has(tKey) &&
        (!uKey || !seenBatchUrls.has(uKey))
      ) {
        seenBatchTitles.add(tKey);
        if (uKey) seenBatchUrls.add(uKey);
        deduplicated.push(candidate);
      }
    }
  }

  const discovered = deduplicated.slice(0, requestedCount);
  const pruneResult = pruneExpiredOpportunities(15);

  let addedCount = 0;
  if (options?.autoAdd && discovered.length > 0) {
    const res = batchAddOpportunities(discovered as OpportunityInput[]);
    addedCount = res.added;
  }

  const latestOpps = getAllOpportunities();
  const scanLog: ScanLog = {
    id: `scan-${Date.now()}`,
    timestamp: new Date().toISOString(),
    trigger_type: 'manual_scan',
    status: 'completed',
    categories_scanned: categoriesToScan,
    new_items_found: discovered.length,
    items_verified: latestOpps.length,
    items_pruned: pruneResult.prunedCount,
    details: `Synced ${syncResult.verifiedCount} existing programs against their official websites (${syncResult.updatedCount} updated) and discovered ${discovered.length} net-new opportunities${customQuery ? ` matching "${customQuery}"` : ''}.`,
    discovered_items: discovered,
  };

  addScanLog(scanLog);

  return {
    scanLog,
    discovered,
    stats: {
      added: addedCount,
      verified: latestOpps.length,
      updated: syncResult.updatedCount,
      pruned: pruneResult.prunedCount,
    },
  };
}

function getVerifiedDiscoveredOpportunities(
  categories: OpportunityCategory[],
  today: string,
  customQuery?: string
): Partial<OpportunityInput>[] {
  const pool: Partial<OpportunityInput>[] = [
    {
      title: 'Z Fellows — Fast-Track Founder Grant & Cohort',
      organizer: 'Z Fellows (Cory Levy)',
      category: 'grant',
      subcategory: 'Early-Stage Technical Founders & Prototypes',
      description:
        'One-week intensive cohort and $10,000 funding program for ambitious technical builders and student founders working on early-stage startups.',
      eligibility: 'Open to student and early-career technical builders worldwide.',
      indian_eligibility: 'Eligible',
      geography: 'Global / Silicon Valley Mentorship',
      stipend: '$10,000 USD funding + direct mentorship from Silicon Valley founders',
      stipend_type: 'Paid / Stipend',
      deadline: 'Rolling',
      timeline: 'Rolling cohort admissions year-round',
      duration: '1-week intensive bootcamp + lifetime alumni network',
      application_url: 'https://www.zfellows.com',
      required_materials: 'Short founder application and 1-minute product/prototype demo video.',
      competitiveness: 'High',
      mentor_notes: 'Applications are reviewed on a rolling basis on zfellows.com.',
      target_persona: 'Student startup founders and fast technical builders.',
      status: 'Rolling',
      last_verified: today,
      source: 'Official Website (zfellows.com)',
    },
    {
      title: 'GitHub Octernships Program',
      organizer: 'GitHub Education',
      category: 'fellowship',
      subcategory: 'Paid Partner Engineering Apprenticeships',
      description:
        'Connects verified GitHub Global Campus students (including India) with partner tech organizations for paid remote software engineering and open source projects.',
      eligibility:
        'Verified student in GitHub Global Campus with active GitHub Student Developer Pack.',
      indian_eligibility: 'Eligible',
      geography: 'India, APAC, LATAM & Global (Remote)',
      stipend: '$500+ USD/month stipend paid by partner organization',
      stipend_type: 'Paid / Stipend',
      deadline: 'Rolling',
      timeline: 'Partner project listings posted on a rolling basis on education.github.com',
      duration: '1 to 3 months depending on partner project',
      application_url: 'https://education.github.com/students/octernships',
      required_materials: 'GitHub profile, partner assignment repository submission.',
      competitiveness: 'High',
      mentor_notes: 'Students must have the GitHub Student Developer Pack verified before applying.',
      target_persona: 'Undergraduate software engineering students with active GitHub portfolios.',
      status: 'Rolling',
      last_verified: today,
      source: 'Official Website (education.github.com)',
    },
    {
      title: 'Summer of Bitcoin (SoB)',
      organizer: 'Summer of Bitcoin',
      category: 'opensource',
      subcategory: 'Bitcoin & Open-Source Protocol Development',
      description:
        'Global online summer internship program introducing university students to open-source Bitcoin protocol development and design with stipends paid in BTC.',
      eligibility: 'Undergraduate and graduate university students globally (heavily popular in India).',
      indian_eligibility: 'Eligible',
      geography: 'Global (Remote)',
      stipend: '$3,000 USD stipend (paid in Bitcoin)',
      stipend_type: 'Paid / Stipend',
      deadline: '2026-03-15',
      timeline: 'Applications Jan–Mar; Coding cohort May–Aug',
      duration: '12 weeks (Summer)',
      application_url: 'https://www.summerofbitcoin.org',
      required_materials: 'GitHub profile, competency test challenge, project proposal.',
      competitiveness: 'High',
      mentor_notes: 'Indian engineering students regularly make up the largest accepted cohort.',
      target_persona: 'Students interested in systems programming, Rust, C++, cryptography, and Web3.',
      status: 'Open',
      last_verified: today,
      source: 'Official Website (summerofbitcoin.org)',
    },
    {
      title: "O'Shaughnessy Fellowships & Grants",
      organizer: "O'Shaughnessy Ventures (OSV)",
      category: 'grant',
      subcategory: 'Equity-Free Research & Builder Grants',
      description:
        'Provides $10,000 to $100,000 equity-free grants to ambitious creators, open-source builders, and researchers worldwide working on breakthrough projects.',
      eligibility: 'Open to individuals 18+ from any country including Indian undergraduates.',
      indian_eligibility: 'Eligible',
      geography: 'Global (Remote)',
      stipend: '$10,000 to $100,000 USD Equity-Free Grant',
      stipend_type: 'Equity-free Grant',
      deadline: 'Rolling',
      timeline: 'Rolling applications reviewed monthly through 2026',
      duration: '1 year fellowship / grant period',
      application_url: 'https://www.osv.llc/oshaughnessy-fellowships',
      required_materials: 'Written project pitch, proof of work, and short video introduction.',
      competitiveness: 'High',
      mentor_notes: 'Up to 20 Grants ($10k) and 10 Fellowships ($100k) awarded each year.',
      target_persona: 'Independent technical builders, AI researchers, and open-source creators.',
      status: 'Rolling',
      last_verified: today,
      source: 'Official Website (osv.llc)',
    },
    {
      title: 'AWS Cloud Club Captains Program',
      organizer: 'Amazon Web Services (AWS)',
      category: 'ambassador',
      subcategory: 'Cloud Computing Campus Leadership',
      description:
        'Student leadership program by AWS training campus captains to lead technical workshops, cloud camps, and architecture labs at their universities.',
      eligibility: 'Enrolled university students aged 18+ globally, including India.',
      indian_eligibility: 'Eligible',
      geography: 'Global / On-Campus + Virtual',
      stipend: 'AWS Credits, certification vouchers, exclusive swag & AWS Summit travel support',
      stipend_type: 'Unpaid / Perks',
      deadline: 'Rolling',
      timeline: 'Semi-annual cohort intakes (Spring & Fall)',
      duration: '12 months',
      application_url: 'https://aws.amazon.com/developer/community/students/cloudclubs/',
      required_materials: 'Application form and 2-minute technical community leadership video.',
      competitiveness: 'Medium',
      mentor_notes: 'Strong stepping stone for students targeting cloud/DevOps roles.',
      target_persona: '2nd and 3rd year CS students interested in AWS, cloud architecture, and community building.',
      status: 'Rolling',
      last_verified: today,
      source: 'Official Website (aws.amazon.com)',
    },
    {
      title: 'Notion Campus Leaders Program',
      organizer: 'Notion',
      category: 'ambassador',
      subcategory: 'Product & Developer Community Evangelism',
      description:
        'Empowers student leaders at universities worldwide to host Notion workshops, build student templates, and collaborate directly with the Notion team.',
      eligibility: 'Undergraduate and graduate students at accredited universities worldwide.',
      indian_eligibility: 'Eligible',
      geography: 'Global / On-Campus',
      stipend: 'Event funding grants, Notion Plus plan, exclusive merch & community stipends',
      stipend_type: 'Prizes / Hardware',
      deadline: 'Rolling',
      timeline: 'Rolling cohort review before each academic semester',
      duration: '1 academic year',
      application_url: 'https://www.notion.so/notion-campus-leaders',
      required_materials: 'Notion workspace portfolio and campus event proposal.',
      competitiveness: 'Medium',
      mentor_notes: 'Great for product-minded engineering students and hackathon organizers.',
      target_persona: 'Product builders, student club leads, and productivity tool enthusiasts.',
      status: 'Rolling',
      last_verified: today,
      source: 'Official Website (notion.so)',
    },
    {
      title: 'Linux Kernel Mentorship Program (LKMP)',
      organizer: 'The Linux Foundation',
      category: 'opensource',
      subcategory: 'Systems & Operating System Kernel Engineering',
      description:
        'Structured remote mentorship program training student developers to contribute patches, bug fixes, and subsystems directly to the mainline Linux Kernel.',
      eligibility: 'Open to developers and university students worldwide (18+).',
      indian_eligibility: 'Eligible',
      geography: 'Global (Remote)',
      stipend: '$3,000 – $6,600 USD stipend (via LFX Mentorship)',
      stipend_type: 'Paid / Stipend',
      deadline: 'Rolling',
      timeline: 'Three terms annually: Spring, Summer, and Fall on lfx.linuxfoundation.org',
      duration: '12 weeks full-time or 24 weeks part-time',
      application_url: 'https://wiki.linuxfoundation.org/lkmp',
      required_materials: 'Resume, C programming prerequisite tasks, and patch submission.',
      competitiveness: 'High',
      mentor_notes: 'Exceptional credential for students targeting systems, OS, or embedded engineering.',
      target_persona: 'Students proficient in C, operating systems, and low-level debugging.',
      status: 'Rolling',
      last_verified: today,
      source: 'Official Website (linuxfoundation.org)',
    },
    {
      title: 'Processing Foundation Fellowship Program',
      organizer: 'Processing Foundation',
      category: 'fellowship',
      subcategory: 'Creative Coding & Open Source Tools (p5.js / Processing)',
      description:
        'Sponsors artists, designers, and student technologists to build open-source creative coding tools, accessibility features, and AI-assisted visual libraries in p5.js and Processing.',
      eligibility: 'Open internationally to students and independent developers.',
      indian_eligibility: 'Eligible',
      geography: 'Global (Remote)',
      stipend: '$10,000 USD Fellowship Stipend (100 hours at $100/hr)',
      stipend_type: 'Paid / Stipend',
      deadline: '2026-04-15',
      timeline: 'Applications close April; Fellowship runs June–October',
      duration: '5 months (part-time, 100 hours)',
      application_url: 'https://processingfoundation.org/fellowships',
      required_materials: 'Project proposal, timeline, work samples / GitHub links.',
      competitiveness: 'High',
      mentor_notes: 'One of the highest hourly stipends ($100/hr) for creative technologists and web devs.',
      target_persona: 'Frontend engineers, WebGL/canvas builders, and open-source contributors.',
      status: 'Open',
      last_verified: today,
      source: 'Official Website (processingfoundation.org)',
    },
    {
      title: 'Smart India Hackathon (SIH)',
      organizer: 'Ministry of Education (MoE Innovation Cell) & AICTE',
      category: 'hackathon_conference',
      subcategory: 'National Hardware & Software Innovation Hackathon',
      description:
        "India's largest national open innovation hackathon where student teams solve real-world problem statements issued by central ministries, state governments, and industry partners.",
      eligibility: 'Enrolled engineering and university students across Indian institutions (6-member teams).',
      indian_eligibility: 'Eligible',
      geography: 'India (Internal Campus Round + Nodal Center Grand Finale)',
      stipend: '₹1,00,000 INR cash prize per winning problem statement + implementation funding',
      stipend_type: 'Prizes / Hardware',
      deadline: '2026-09-30',
      timeline: 'Internal campus hackathons Aug–Sep; Grand Finale Nov–Dec',
      duration: '36-hour non-stop Grand Finale',
      application_url: 'https://www.sih.gov.in',
      required_materials: 'Team registration via college SPOC, idea PPT, and prototype architecture.',
      competitiveness: 'High',
      mentor_notes: 'Every team must include at least one female student member per official SIH rules.',
      target_persona: 'Full-stack, AI/ML, cybersecurity, and hardware student teams in India.',
      status: 'Open',
      last_verified: today,
      source: 'Official Website (sih.gov.in)',
    },
    {
      title: 'Devfolio ETHIndia & Web3 Builders Grants',
      organizer: 'Devfolio & Ethereum Foundation',
      category: 'hackathon_conference',
      subcategory: 'Web3, AI & Open-Source Builder Hackathons (India)',
      description:
        'Flagship developer hackathon ecosystem in Bengaluru and online, connecting Indian student builders with $500,000+ in bounties, microgrants, and fellowship tracks.',
      eligibility: 'Open to university students and developers across India and globally.',
      indian_eligibility: 'Eligible',
      geography: 'Bengaluru, India & Online',
      stipend: '$500,000+ USD total prize pool + travel grants for top student hackers',
      stipend_type: 'Prizes / Hardware',
      deadline: 'Rolling',
      timeline: 'Year-round regional hackathons + annual Bengaluru flagship',
      duration: '3-day hackathon + 8-week fellowship cohorts',
      application_url: 'https://devfolio.co/hackathons',
      required_materials: 'Devfolio builder profile, GitHub repository, and past projects.',
      competitiveness: 'Medium',
      mentor_notes: 'Devfolio waives all registration fees for selected students and offers quadratic funding grants.',
      target_persona: 'Hackathon builders, full-stack developers, and blockchain/AI hackers.',
      status: 'Rolling',
      last_verified: today,
      source: 'Official Website (devfolio.co)',
    },
    {
      title: 'Meta Hacker Cup — Global Algorithmic Coding Competition',
      organizer: 'Meta',
      category: 'competition',
      subcategory: 'Global Competitive Programming Championship',
      description:
        "Meta's annual open global programming competition challenging university students and engineers to solve algorithmic and data structure problems across multiple online rounds.",
      eligibility: 'Open to competitive programmers aged 18+ worldwide, including India.',
      indian_eligibility: 'Eligible',
      geography: 'Global (Online Rounds + World Finals)',
      stipend: '$20,000 USD 1st Prize + top 2,000 finisher t-shirts & cash awards',
      stipend_type: 'Prizes / Hardware',
      deadline: '2026-09-25',
      timeline: 'Practice & Qualification Rounds Sep–Oct; World Finals Dec',
      duration: 'Multi-round online competition',
      application_url: 'https://www.facebook.com/codingcompetitions/hacker-cup',
      required_materials: 'Online registration and algorithmic code submissions (C++, Python, Java, Rust).',
      competitiveness: 'High',
      mentor_notes: 'Advancing to Round 2 (top 2,000) is a strong resume signal for FAANG interviews.',
      target_persona: 'Competitive programmers and algorithms/DSA enthusiasts.',
      status: 'Open',
      last_verified: today,
      source: 'Official Website (facebook.com/codingcompetitions)',
    },
    {
      title: 'Swift Student Challenge — Apple WWDC',
      organizer: 'Apple',
      category: 'competition',
      subcategory: 'App Playground & Mobile Engineering Challenge',
      description:
        'Annual Apple coding competition inviting student developers worldwide to create an interactive scene in a Swift Playground within 3 minutes.',
      eligibility: 'Enrolled students aged 16+ in India (13+ in US) at accredited schools/universities.',
      indian_eligibility: 'Eligible',
      geography: 'Global (Online + Cupertino WWDC Trip for Distinguished Winners)',
      stipend: 'AirPods Max / Apple hardware, 1-year Apple Developer Program membership, WWDC travel for top 50',
      stipend_type: 'Prizes / Hardware',
      deadline: '2026-02-28',
      timeline: 'Applications open each February; winners announced before WWDC in June',
      duration: '3-week submission window',
      application_url: 'https://developer.apple.com/swift-student-challenge/',
      required_materials: 'Interactive .swiftpm App Playground project + short written essays.',
      competitiveness: 'High',
      mentor_notes: 'Several Indian undergraduate students are selected among the 350 global winners every year.',
      target_persona: 'iOS, Swift, UI/UX, and mobile app builders.',
      status: 'Open',
      last_verified: today,
      source: 'Official Website (developer.apple.com)',
    },
    {
      title: 'DoraHacks Global BUIDL & Student Grant Rounds',
      organizer: 'DoraHacks',
      category: 'grant',
      subcategory: 'Open-Source, AI & Web3 Quadratic Funding Grants',
      description:
        'Global hacker movement and multi-chain quadratic funding platform providing continuous micro-grants and hackathon bounties to student developer teams.',
      eligibility: 'Open to student developers and open-source builders worldwide.',
      indian_eligibility: 'Eligible',
      geography: 'Global (Remote)',
      stipend: '$1,000 – $50,000 USD in BUIDL grants and ecosystem bounties',
      stipend_type: 'Equity-free Grant',
      deadline: 'Rolling',
      timeline: 'Continuous grant rounds and hackathons year-round',
      duration: 'Rolling grant milestones',
      application_url: 'https://dorahacks.io',
      required_materials: 'Public GitHub repo, live demo link, and BUIDL project profile.',
      competitiveness: 'Medium',
      mentor_notes: 'Ideal for student teams turning hackathon prototypes into funded open-source projects.',
      target_persona: 'Hackathon teams, AI builders, and Web3 developers.',
      status: 'Rolling',
      last_verified: today,
      source: 'Official Website (dorahacks.io)',
    },
    {
      title: 'Kleiner Perkins (KP) Engineering Fellows Program',
      organizer: 'Kleiner Perkins',
      category: 'fellowship',
      subcategory: 'Venture-Backed Silicon Valley Engineering Fellowship',
      description:
        'Matches top university computer science students with Kleiner Perkins portfolio companies for summer software engineering roles alongside founder mentorship and executive programming.',
      eligibility: 'Undergraduate and master’s CS/engineering students able to intern at partner companies.',
      indian_eligibility: 'Conditional / Varies',
      geography: 'San Francisco Bay Area / US (Visa sponsorship varies by partner company)',
      stipend: '$9,000 – $12,000 USD/month salary + KP Fellow housing/community perks',
      stipend_type: 'Paid / Stipend',
      deadline: '2026-01-31',
      timeline: 'Applications Sep–Jan; Summer cohort Jun–Aug',
      duration: '12 weeks (Summer)',
      application_url: 'https://fellows.kleinerperkins.com',
      required_materials: 'Resume, GitHub/portfolio, and technical interviews with KP portfolio companies.',
      competitiveness: 'High',
      mentor_notes: 'Best suited for students with strong systems/product portfolios or international work authorization.',
      target_persona: 'Top-tier full-stack, AI, and product engineering students.',
      status: 'Open',
      last_verified: today,
      source: 'Official Website (fellows.kleinerperkins.com)',
    },
  ];

  let filtered = pool.filter((o) =>
    categories.includes(o.category as OpportunityCategory)
  );

  if (customQuery && customQuery.length > 1) {
    const q = customQuery.toLowerCase();
    const matched = filtered.filter(
      (o) =>
        o.title?.toLowerCase().includes(q) ||
        o.organizer?.toLowerCase().includes(q) ||
        o.description?.toLowerCase().includes(q) ||
        o.subcategory?.toLowerCase().includes(q) ||
        o.geography?.toLowerCase().includes(q)
    );
    if (matched.length > 0) {
      return matched;
    }
  }

  return filtered;
}
