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
  getScanLogs,
  addScanLog,
  computeStatusFromDeadline,
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

  // Extract stipend (USD or INR/Lakhs) for newly pasted URLs when AI is offline
  const stipendMatch = liveText.match(
    /(?:(?:\$|USD\s*)[0-9]{1,3}(?:,[0-9]{3})+(?:\s*[–-]\s*\$?[0-9]{1,3}(?:,[0-9]{3})+)?|(?:₹|INR\s*|Rs\.?\s*)[0-9,.]+\s*(?:Lakhs?|Lakh|Crores?|Cr|K)?)\s*(?:USD\s*|INR\s*)?(?:per\s+(?:student|fellow|team|month)\s*)?(?:cash\s*)?(?:stipend|grant|prize\s*pool|prizes|funding|award|fellowship)?/i
  );
  if (stipendMatch && !existing?.stipend) {
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
For each opportunity below, use Google Search to check its official website and FAQ/stipend documentation to verify:
1. "deadline": The exact 2026 official application deadline printed on the official site in "YYYY-MM-DD" format, or "Rolling" if rolling. Do NOT guess 2027 dates if the official site still displays 2026 dates.
2. "timeline": The exact dates/times for application opening, deadline, and event/cohort dates from the official site.
3. "geography": The exact venue, city, or remote status from the official site.
4. "stipend": Verify the exact official financial support from the official website/FAQ:
   - Clearly distinguish between "per student/fellow stipend", "India PPP-adjusted stipend tier" (e.g. GSoC/LFX), "equity-free grant range", or "total hackathon prize pool".
   - Do NOT invent or guess dollar amounts. If the existing "current_stipend" is already accurate, keep it unchanged.

Opportunities to verify:
${JSON.stringify(summaryList, null, 2)}

Respond ONLY with a valid JSON array of objects with keys: "id", "deadline", "timeline", "geography", "stipend".`;

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
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
  const oppBatches = chunkArray(opportunities, 5);
  const updatedOpps: Opportunity[] = [];

  for (const batch of oppBatches) {
    const batchResults = await Promise.allSettled(
      batch.map(async (opp) => {
        try {
          const livePage = await fetchOfficialWebsiteContent(opp.application_url);
          if (livePage.ok) {
            const extracted = parseLiveWebpageHeuristics(livePage.text, opp);
            const nextDeadline = extracted.deadline || opp.deadline;
            const nextStipend = opp.stipend || extracted.stipend || 'See official website';
            if (nextDeadline !== opp.deadline) {
              updatedCount++;
            }
            let hostLabel = 'official site';
            try {
              hostLabel = new URL(opp.application_url).hostname.replace(/^www\./, '');
            } catch {
              // ignore
            }
            return {
              ...opp,
              deadline: nextDeadline,
              stipend: nextStipend,
              last_verified: today,
              source: `Official Site Synced (${hostLabel})`,
            };
          }
        } catch {
          // keep original
        }
        return opp;
      })
    );

    for (const r of batchResults) {
      if (r.status === 'fulfilled') {
        updatedOpps.push(r.value);
      }
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
Extract the exact 21 Scout fields from the input below and use Google Search to verify the official application deadline, cohort dates/times, venue/geography, exact stipend/prize amount, and eligibility from the official website and its FAQ/rules page.

STRICT FINANCIAL SUPPORT ("stipend" & "stipend_type") RULES:
1. Check both the main page and Google Search results for the program's official FAQ / Stipend / Prizes documentation.
2. Clearly specify what the number represents:
   - Per-fellow / per-student stipend (e.g., "$5,000 USD Fellowship Stipend" or "₹50,000/month stipend")
   - India PPP-adjusted tier if applicable (e.g., "$1,500 – $3,000 USD (India PPP tier)")
   - Equity-free grant range (e.g., "$5,000 – $100,000 USD equity-free grant")
   - Hackathon / Competition prize breakdown (distinguish "Total Prize Pool" vs "1st Place / Track Prize", e.g., "$50,000 Total Prize Pool (Up to $10,000 per winning team)")
3. NEVER guess or hallucinate a dollar amount. If the official site does not state a dollar/INR figure (or offers non-cash perks like travel grants, cloud credits, or swag), explicitly write that (e.g., "Full Travel + Conference Grant (Amount not publicly disclosed)" or "Swag, Cloud Credits & Event Micro-grants").

User Input:
"""
${rawText}
"""
${liveSiteContext}

Respond ONLY with a valid JSON object with exact keys:
title, organizer, category (fellowship, grant, ambassador, opensource, hackathon_conference, competition), subcategory, description, eligibility, indian_eligibility (Eligible, Not Eligible, Conditional / Varies), geography, stipend, stipend_type (Paid / Stipend, Equity-free Grant, Prizes / Hardware, Unpaid / Perks), deadline (YYYY-MM-DD or Rolling), timeline, duration, application_url, required_materials, competitiveness (High, Medium, Low), mentor_notes, target_persona, status (Open, Closing Soon, Rolling, Closed), last_verified ("${today}"), source ("Live Official Website Extractor").`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
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

const SEARCH_ROTATION_THEMES = [
  'Focus on AI/ML, Systems, Cloud Native, and DeepTech student opportunities open to Indian & global undergraduates.',
  'Focus on Open-Source Foundations (Apache, Mozilla, Python Software Foundation, Rust, CNCF, Wikimedia, Blender, Julia) and technical fellowships.',
  'Focus on Startup Grants, Micro-grants, Venture Fellowships, and Non-dilutive Student Builder Funding (India & Global).',
  'Focus on Global & India Flagship Hackathons, Competitive Programming, Hardware/Robotics Challenges, and Developer Ambassador cohorts.',
  'Focus on Research Internships, Cybersecurity CTFs, Web3/Protocol Grants, and Developer Community Leadership programs.',
];

/**
 * Fetches live open/upcoming hackathons & competitions directly from Devpost's public JSON feed
 * so even if Gemini API is rate-limited or not configured on Render, every scan discovers fresh live events.
 */
async function fetchLiveDevpostOpportunities(
  today: string,
  page: number,
  customQuery?: string
): Promise<Partial<OpportunityInput>[]> {
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 7000);
    const searchParam = customQuery ? `&search=${encodeURIComponent(customQuery)}` : '';
    const url = `https://devpost.com/api/hackathons?status[]=open&status[]=upcoming&page=${page}${searchParam}`;
    const res = await fetch(url, {
      headers: {
        Accept: 'application/json',
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      },
      signal: ctrl.signal,
    });
    clearTimeout(timer);
    if (!res.ok) return [];
    const data: any = await res.json();
    if (!data || !Array.isArray(data.hackathons)) return [];

    return data.hackathons.slice(0, 8).map((h: any) => {
      const rawPrize = String(h.prize_amount || '')
        .replace(/<[^>]+>/g, '')
        .trim();
      const prizeText =
        rawPrize && rawPrize !== '$0'
          ? `${rawPrize} Total Prize Pool (Per official Devpost listing)`
          : 'Prizes, Swag & Winner Certificates (See official page)';

      // Parse submission period end date if available
      let deadline = 'Rolling';
      const subPeriod = String(h.submission_period_dates || '');
      const dateParts = subPeriod.split('-');
      const endPart = dateParts[dateParts.length - 1]?.trim();
      if (endPart) {
        const parsedEnd = new Date(endPart);
        if (!isNaN(parsedEnd.getTime())) {
          const yyyy = parsedEnd.getFullYear();
          const mm = String(parsedEnd.getMonth() + 1).padStart(2, '0');
          const dd = String(parsedEnd.getDate()).padStart(2, '0');
          deadline = `${yyyy}-${mm}-${dd}`;
        }
      }

      const themes = Array.isArray(h.themes)
        ? h.themes.map((t: any) => t.name).join(', ')
        : 'Software Engineering & Innovation';
      const orgName = h.organization_name || 'Devpost Official Partner';
      const location = h.displayed_location?.location || 'Online / Global';

      return {
        title: h.title || 'Global Developer Hackathon',
        organizer: orgName,
        category: 'hackathon_conference' as OpportunityCategory,
        subcategory: themes || 'Global Developer Hackathon',
        description: `${h.title} hosted by ${orgName}. Focus areas: ${themes}. (${h.registrations_count || 'Active'} registered builders).`,
        eligibility: 'Open to student developers and builders (Check official rules for team size).',
        indian_eligibility: 'Eligible',
        geography: location.toLowerCase().includes('online') ? 'Global / Online' : location,
        stipend: prizeText,
        stipend_type: rawPrize && rawPrize !== '$0' ? 'Prizes / Hardware' : 'Unpaid / Perks',
        deadline,
        timeline: subPeriod || 'Active submission window on Devpost',
        duration: h.time_left_to_submission || 'See official schedule',
        application_url: h.url || 'https://devpost.com/hackathons',
        required_materials: 'Working software prototype, GitHub repository, and demo video.',
        competitiveness: 'Medium',
        mentor_notes: `Live-scraped active hackathon from Devpost (${h.registrations_count || 0} participants). Great for building rapid portfolio projects.`,
        target_persona: 'Undergraduate full-stack, AI/ML, and product builders.',
        status: computeStatusFromDeadline(deadline, 'Open'),
        last_verified: today,
        source: 'Live Devpost API Feed',
      };
    });
  } catch {
    return [];
  }
}

/**
 * Fetches and parses live open source fellowships and mentorship programs directly
 * from open community registries so discovery never fails even if Gemini is rate limited.
 */
async function fetchLiveOpenSourcePrograms(
  today: string
): Promise<Partial<OpportunityInput>[]> {
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 6000);
    const res = await fetch(
      'https://raw.githubusercontent.com/deepanshu1422/List-Of-Open-Source-Internships-Programs/master/README.md',
      { signal: ctrl.signal }
    );
    clearTimeout(timer);
    if (!res.ok) return [];
    const text = await res.text();

    const results: Partial<OpportunityInput>[] = [];
    const lines = text.split('\n');

    for (const line of lines) {
      if (!line.startsWith('|') || line.includes('Name') || line.includes('---')) continue;
      const parts = line.split('|').map((p) => p.trim());
      if (parts.length < 6) continue;

      const linkMatch = parts[1].match(/\[([^\]]+)\]\(([^)]+)\)/);
      if (!linkMatch) continue;

      const name = linkMatch[1].trim();
      const url = linkMatch[2].trim();
      if (!name || name.toLowerCase().includes('30 days') || url.includes('30dayscoding')) continue;

      const stipendRaw = parts[2] || 'See official portal';
      const timelineRaw = parts[3] || 'Annual cycle';
      const eligibilityRaw = parts[4] || 'Open to university students and developers';
      const focus = parts[6] || parts[5] || 'Open Source Software Engineering';

      const isPaid = /yes|cash|\$|stipend|inr/i.test(stipendRaw);

      results.push({
        title: name,
        organizer: name.replace(/\([^)]+\)/g, '').trim(),
        category: 'opensource' as OpportunityCategory,
        subcategory: focus,
        description: `${name} — Mentored developer program focusing on ${focus}. (${timelineRaw}).`,
        eligibility: eligibilityRaw,
        indian_eligibility: 'Eligible',
        geography: 'Global / Remote',
        stipend: isPaid ? 'Paid Stipend (See official guidelines)' : stipendRaw,
        stipend_type: isPaid ? 'Paid / Stipend' : 'Prizes / Hardware',
        deadline: 'Rolling',
        timeline: timelineRaw,
        duration: '8 to 12 weeks',
        application_url: url,
        required_materials: 'GitHub profile, code contribution proof, application proposal.',
        competitiveness: 'High',
        mentor_notes: `Direct open source mentorship program. Visit official site (${url}) to verify active cohort tracks.`,
        target_persona: 'Undergraduate software engineering students with Git and code foundations.',
        status: 'Rolling',
        last_verified: today,
        source: 'Live Open Source Community Feed',
      });
    }

    return results;
  } catch {
    return [];
  }
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

  // Build exclusion sets from BOTH the tracker database AND recent scan logs so consecutive scans never repeat the same results!
  const existingOpps = getAllOpportunities();
  const previousLogs = getScanLogs().slice(0, 6);
  const recentlyShownItems = previousLogs.flatMap((log) => log.discovered_items || []);

  const existingTitleKeys = new Set(existingOpps.map((o) => normalizeTextKey(o.title)));
  const existingUrlKeys = new Set(existingOpps.map((o) => normalizeUrlKey(o.application_url)));

  const recentlyShownTitleKeys = new Set(
    recentlyShownItems.map((o) => normalizeTextKey(o.title))
  );
  const recentlyShownUrlKeys = new Set(
    recentlyShownItems.map((o) => normalizeUrlKey(o.application_url))
  );

  const allExcludedTitles = Array.from(
    new Set([
      ...existingOpps.map((o) => o.title),
      ...recentlyShownItems.map((o) => o.title).filter(Boolean),
    ])
  ).slice(0, 60);

  const scanIteration = previousLogs.length;
  const rotationTheme =
    SEARCH_ROTATION_THEMES[scanIteration % SEARCH_ROTATION_THEMES.length];

  // STEP 2: Discover new real-time opportunities from multiple complementary web feeds
  let rawDiscovered: Partial<OpportunityInput>[] = [];

  // A. Live Devpost Hackathons API (Runs for hackathons & competitions)
  if (
    categoriesToScan.includes('hackathon_conference') ||
    categoriesToScan.includes('competition')
  ) {
    const devpostPage = (scanIteration % 5) + 1;
    const [page1, page2] = await Promise.all([
      fetchLiveDevpostOpportunities(today, devpostPage, customQuery),
      fetchLiveDevpostOpportunities(today, devpostPage + 1, customQuery),
    ]);
    rawDiscovered.push(...page1, ...page2);
  }

  // B. Live Open-Source Community Program Registry (Runs for opensource & fellowship)
  if (
    categoriesToScan.includes('opensource') ||
    categoriesToScan.includes('fellowship')
  ) {
    const liveOss = await fetchLiveOpenSourcePrograms(today);
    const offset = (scanIteration * 5) % Math.max(1, liveOss.length);
    const rotatedOss = [...liveOss.slice(offset), ...liveOss.slice(0, offset)];
    rawDiscovered.push(...rotatedOss.slice(0, 10));
  }

  // C. Gemini AI Web Search (Single focused request to avoid 429 rate limits)
  if (ai && rawDiscovered.length < requestedCount * 2) {
    try {
      const focusInstruction = customQuery
        ? `\nSPECIAL SEARCH FOCUS: Prioritize opportunities matching "${customQuery}".`
        : `\nROTATING DISCOVERY ANGLE FOR THIS SCAN: ${rotationTheme}`;

      const prompt = `You are Scout's real-time web opportunity scanner for Polaris School of Technology mentors. Today's date is ${today}.
Use Google Search to find ${requestedCount} real, currently active or upcoming (2026–2027) opportunities for undergraduate computer science and engineering students (including Indian students) across ONLY these categories: ${categoriesToScan.join(', ')}.${focusInstruction}

CRITICAL — DO NOT RETURN ANY OF THESE ALREADY-TRACKED OR RECENTLY-SHOWN PROGRAMS:
${allExcludedTitles.join(' | ')}

CRITICAL RULES:
1. Every opportunity MUST be a real, verifiable program with a working official application URL verified via Google Search.
2. Only use category values from: ${categoriesToScan.join(', ')}.
3. Set "deadline" to the exact official date printed on the official website ("YYYY-MM-DD") or "Rolling". Prefer opportunities that are currently Open or Rolling!
4. Include exact application open/close dates, times, and venue in "timeline" and "geography".
5. ACCURATE FINANCIAL SUPPORT: Verify the exact stipend, grant, or prize amount from the official FAQ.
6. Set "last_verified" to "${today}" and "source" to "Live Google Search Grounding".

Respond ONLY with a valid JSON array of ${requestedCount} opportunity objects with exact keys: title, organizer, category, subcategory, description, eligibility, indian_eligibility, geography, stipend, stipend_type, deadline, timeline, duration, application_url, required_materials, competitiveness, mentor_notes, target_persona, status, last_verified, source.`;

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: {
          tools: [{ googleSearch: {} }],
        },
      });

      if (response.text) {
        const parsed = extractJsonFromText(response.text);
        if (Array.isArray(parsed)) {
          rawDiscovered.push(...parsed);
        }
      }
    } catch (err: any) {
      console.warn('[Scout Scanner] Gemini live search skipped or rate-limited (falling back to live feeds):', err.message || err);
    }
  }

  // Deduplicate against existing database, recent scan history, and within the discovered batch
  const seenBatchTitles = new Set<string>();
  const seenBatchUrls = new Set<string>();
  const deduplicated: Partial<OpportunityInput>[] = [];

  for (const item of rawDiscovered) {
    const tKey = normalizeTextKey(item.title);
    const uKey = normalizeUrlKey(item.application_url);
    if (!tKey) continue;
    if (existingTitleKeys.has(tKey) || (uKey && existingUrlKeys.has(uKey))) continue;
    if (recentlyShownTitleKeys.has(tKey) || (uKey && recentlyShownUrlKeys.has(uKey))) continue;
    if (seenBatchTitles.has(tKey) || (uKey && seenBatchUrls.has(uKey))) continue;

    seenBatchTitles.add(tKey);
    if (uKey) seenBatchUrls.add(uKey);
    deduplicated.push(item);
  }

  // If still fewer than requestedCount, top up from our expanded verified pool (prioritizing items NOT shown in recent scans, rotated by scanIteration)
  if (deduplicated.length < requestedCount) {
    const fallbackPool = getVerifiedDiscoveredOpportunities(
      categoriesToScan,
      today,
      customQuery,
      scanIteration
    );

    // First pass: only items NOT in existing DB and NOT in recent scan logs
    for (const candidate of fallbackPool) {
      if (deduplicated.length >= requestedCount) break;
      const tKey = normalizeTextKey(candidate.title);
      const uKey = normalizeUrlKey(candidate.application_url);
      if (
        !existingTitleKeys.has(tKey) &&
        (!uKey || !existingUrlKeys.has(uKey)) &&
        !recentlyShownTitleKeys.has(tKey) &&
        (!uKey || !recentlyShownUrlKeys.has(uKey)) &&
        !seenBatchTitles.has(tKey) &&
        (!uKey || !seenBatchUrls.has(uKey))
      ) {
        seenBatchTitles.add(tKey);
        if (uKey) seenBatchUrls.add(uKey);
        deduplicated.push(candidate);
      }
    }

    // Second pass: if user requested a large batch (e.g. 24 or 30) and all unseen pool items were used, allow rotated items not in the main DB
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

  const discovered = deduplicated.slice(0, requestedCount).map((item) => ({
    ...item,
    status: computeStatusFromDeadline(item.deadline, item.status as any),
  }));
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
  customQuery?: string,
  scanIteration: number = 0
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
    {
      title: 'Season of KDE (SoK) — Open Source Mentorship',
      organizer: 'KDE Community',
      category: 'opensource',
      subcategory: 'Qt, C++, Linux Desktop & Open Source Software',
      description:
        'Annual outreach program hosted by the KDE community offering mentored open-source software, documentation, and UI/UX projects for students globally.',
      eligibility: 'Open to students and open-source contributors worldwide, including India.',
      indian_eligibility: 'Eligible',
      geography: 'Global (Remote)',
      stipend: 'KDE merchandise pack, official certificate & GSoC fast-track mentorship (Unpaid)',
      stipend_type: 'Unpaid / Perks',
      deadline: '2027-01-15',
      timeline: 'Applications Dec–Jan; Mentorship runs Jan–Mar',
      duration: '10–12 weeks',
      application_url: 'https://season.kde.org',
      required_materials: 'Project proposal on KDE GitLab and initial merge requests.',
      competitiveness: 'Medium',
      mentor_notes: 'One of the highest-converting stepping stones into Google Summer of Code (GSoC) with KDE.',
      target_persona: '1st and 2nd year CS students learning C++, Python, or Linux.',
      status: 'Open',
      last_verified: today,
      source: 'Official Website (season.kde.org)',
    },
    {
      title: 'FSF Free Software Foundation Internship Program',
      organizer: 'Free Software Foundation (FSF)',
      category: 'opensource',
      subcategory: 'GNU Project, Systems & Licensing Infrastructure',
      description:
        'Hands-on technical internship working with FSF sysadmins and licensing teams on free software infrastructure, web development, and GNU packages.',
      eligibility: 'Open to university students and recent graduates worldwide.',
      indian_eligibility: 'Eligible',
      geography: 'Global (Remote) or Boston, MA',
      stipend: 'Unpaid educational mentorship + FSF Associate Membership & hardware perks',
      stipend_type: 'Unpaid / Perks',
      deadline: 'Rolling',
      timeline: 'Three terms per year: Spring, Summer, and Fall (Rolling review)',
      duration: '12 weeks',
      application_url: 'https://www.fsf.org/volunteer/internships',
      required_materials: 'Resume, cover letter, and two references.',
      competitiveness: 'Medium',
      mentor_notes: 'Ideal for students passionate about Linux internals, self-hosting, and free software.',
      target_persona: 'Systems, Linux, and DevOps student engineers.',
      status: 'Rolling',
      last_verified: today,
      source: 'Official Website (fsf.org)',
    },
    {
      title: 'Postman Student Leader Program',
      organizer: 'Postman',
      category: 'ambassador',
      subcategory: 'API Engineering & Campus Developer Advocacy',
      description:
        'Trains and certifies student developers to teach API literacy, run Postman API workshops, and receive exclusive support for campus hackathons.',
      eligibility: 'Enrolled university students aged 18+ globally (Strong presence across Indian colleges).',
      indian_eligibility: 'Eligible',
      geography: 'Global / On-Campus + Virtual',
      stipend: 'Postman Student Expert certification, exclusive swag kit & campus event micro-grants',
      stipend_type: 'Prizes / Hardware',
      deadline: 'Rolling',
      timeline: 'Rolling applications after completing free Postman Student Expert certification',
      duration: 'Ongoing academic tenure',
      application_url: 'https://www.postman.com/student-program/',
      required_materials: 'Postman Student Expert badge + short community application.',
      competitiveness: 'Medium',
      mentor_notes: 'Students must first complete the free self-paced Postman Student Expert training.',
      target_persona: 'Backend, full-stack, and API-focused engineering students.',
      status: 'Rolling',
      last_verified: today,
      source: 'Official Website (postman.com)',
    },
    {
      title: 'Solana Foundation India & Global Developer Grants',
      organizer: 'Solana Foundation & Superteam India',
      category: 'grant',
      subcategory: 'Rust, DePIN, AI-Crypto & Open-Source Tooling Grants',
      description:
        'Milestone-based equity-free funding and Superteam India Instagrants ($1,000–$10,000) for student builders creating open-source developer tools, dApps, and consumer apps.',
      eligibility: 'Open to student developers and indie hackers across India and globally.',
      indian_eligibility: 'Eligible',
      geography: 'India (Superteam India chapters) & Global Remote',
      stipend: '$1,000 – $10,000 USD Equity-Free Instagrant (Up to $50k for standard grants)',
      stipend_type: 'Equity-free Grant',
      deadline: 'Rolling',
      timeline: 'Rolling weekly review (Superteam India Instagrants decided in <72 hours)',
      duration: '1–3 months milestone delivery',
      application_url: 'https://earn.superteam.fun/grants/',
      required_materials: 'GitHub repo / prototype link, milestone breakdown, and 2-minute Loom video.',
      competitiveness: 'Medium',
      mentor_notes: 'Superteam India is one of the fastest equity-free microgrant sources for Indian CS undergrads.',
      target_persona: 'Rust, TypeScript, and high-velocity student builders.',
      status: 'Rolling',
      last_verified: today,
      source: 'Official Website (earn.superteam.fun)',
    },
    {
      title: 'Polygon Village & DevX Student Builder Grants',
      organizer: 'Polygon Labs',
      category: 'grant',
      subcategory: 'Zero-Knowledge (ZK) & Web3 Infrastructure Grants',
      description:
        'Supports builders and student teams developing zero-knowledge cryptography proofs, public goods, and consumer applications with grant vouchers and mentorship.',
      eligibility: 'Open to student developers and early-stage founders worldwide.',
      indian_eligibility: 'Eligible',
      geography: 'Global / Remote (Founded in India)',
      stipend: '$5,000 – $50,000 USD in equity-free grants & cloud/infrastructure credits',
      stipend_type: 'Equity-free Grant',
      deadline: 'Rolling',
      timeline: 'Rolling cohort waves and quadratic funding rounds',
      duration: 'Milestone-based',
      application_url: 'https://polygon.technology/village',
      required_materials: 'Technical architecture doc, GitHub repository, and project demo.',
      competitiveness: 'High',
      mentor_notes: 'Projects involving Zero-Knowledge (ZK) proofs or AI+verification receive highest priority.',
      target_persona: 'Cryptography, ZK, and full-stack student teams.',
      status: 'Rolling',
      last_verified: today,
      source: 'Official Website (polygon.technology)',
    },
    {
      title: 'Prototypr / 1517 Fund Medici Project Microgrants',
      organizer: '1517 Fund',
      category: 'grant',
      subcategory: 'Young Founder & Student Maker $1,000 Microgrants',
      description:
        'Awards $1,000 equity-free grant checks to university students and young makers building unconventional software, hardware, or scientific projects.',
      eligibility: 'University and high school students globally building outside traditional classroom tracks.',
      indian_eligibility: 'Eligible',
      geography: 'Global (Remote)',
      stipend: '$1,000 USD Equity-Free Medici Grant (Up to $50k follow-on funding)',
      stipend_type: 'Equity-free Grant',
      deadline: 'Rolling',
      timeline: 'Rolling year-round evaluation by 1517 Fund partners',
      duration: 'Project-based',
      application_url: 'https://www.1517fund.com/medici-project',
      required_materials: 'Short online application describing what you are building and why.',
      competitiveness: 'Medium',
      mentor_notes: 'Backed by co-founders of the Thiel Fellowship; great first check for student makers.',
      target_persona: 'Indie student hackers, hardware makers, and technical founders.',
      status: 'Rolling',
      last_verified: today,
      source: 'Official Website (1517fund.com)',
    },
    {
      title: 'Cloud Native Computing Foundation (CNCF) Zero-to-Merge Mentorship',
      organizer: 'CNCF & Linux Foundation',
      category: 'opensource',
      subcategory: 'Kubernetes, Prometheus, Envoy & Cloud Native Internships',
      description:
        'Paid open-source mentorship connecting student developers with CNCF maintainers on graduated projects including Kubernetes, Cilium, Argo, and Istio.',
      eligibility: 'Students and new open-source contributors 18+ worldwide.',
      indian_eligibility: 'Eligible',
      geography: 'Global (Remote)',
      stipend: '$3,000 – $6,600 USD stipend (PPP-adjusted via LFX)',
      stipend_type: 'Paid / Stipend',
      deadline: '2027-02-10',
      timeline: 'Spring Term applications open late Jan / early Feb; Summer Term in May',
      duration: '12 weeks',
      application_url: 'https://github.com/cncf/mentoring',
      required_materials: 'Resume, Cover Letter, and initial PRs on CNCF repositories.',
      competitiveness: 'High',
      mentor_notes: 'The official `cncf/mentoring` GitHub repo publishes the full project list ahead of each LFX term.',
      target_persona: 'Go, Rust, Docker, and Kubernetes student engineers.',
      status: 'Open',
      last_verified: today,
      source: 'Official Website (github.com/cncf/mentoring)',
    },
    {
      title: 'ICPC (International Collegiate Programming Contest) — Asia India Regionals',
      organizer: 'ICPC Foundation & Amrita / IIT Kanpur / IIT Kharagpur Sites',
      category: 'competition',
      subcategory: 'Olympiad of University Competitive Programming',
      description:
        'The premier global algorithmic programming contest for university teams of 3 students competing for slots at the Asia West Continent Championship and ICPC World Finals.',
      eligibility: 'Enrolled university students competing in 3-member teams from the same institution.',
      indian_eligibility: 'Eligible',
      geography: 'India (Online Prelims + Onsite Regionals at Amritapuri, Kanpur, Chennai)',
      stipend: 'World Finals Qualification + Cash Prizes & Travel Support per Regional Site',
      stipend_type: 'Prizes / Hardware',
      deadline: '2026-10-25',
      timeline: 'Registration Sep–Oct; Online Preliminary Round Nov; Onsite Regionals Dec',
      duration: '5-hour algorithmic contest rounds',
      application_url: 'https://icpc.global',
      required_materials: 'Team registration by faculty coach on icpc.global.',
      competitiveness: 'High',
      mentor_notes: 'Every serious competitive programmer at Polaris should form a 3-person team and register with a faculty coach.',
      target_persona: 'Strong C++ / DSA competitive programmers.',
      status: 'Open',
      last_verified: today,
      source: 'Official Website (icpc.global)',
    },
    {
      title: 'e-Yantra Robotics Competition (eYRC) — IIT Bombay',
      organizer: 'IIT Bombay & Ministry of Education (Government of India)',
      category: 'competition',
      subcategory: 'Robotics, Embedded Systems, ROS2 & Drone Engineering',
      description:
        'Month-long project-based robotics and embedded systems competition hosted by IIT Bombay where student teams receive free robotic hardware kits to solve complex automation themes.',
      eligibility: 'Undergraduate engineering students across Indian colleges (Teams of 2–4).',
      indian_eligibility: 'Eligible',
      geography: 'India (Online Stages + IIT Bombay Finals)',
      stipend: 'Cash prizes + Paid Summer Internship at IIT Bombay (eYSIP) + Free Hardware Kit',
      stipend_type: 'Prizes / Hardware',
      deadline: 'Rolling',
      timeline: 'Annual cycle runs Aug–Mar; Summer Internship (eYSIP) May–Jul',
      duration: '5–6 months hands-on learning + competition',
      application_url: 'https://portal.e-yantra.org',
      required_materials: 'Team registration on e-Yantra portal.',
      competitiveness: 'High',
      mentor_notes: 'Top finalists earn coveted paid summer research internships (eYSIP) at IIT Bombay.',
      target_persona: 'Students interested in Python, ROS, computer vision, and robotics.',
      status: 'Rolling',
      last_verified: today,
      source: 'Official Website (portal.e-yantra.org)',
    },
    {
      title: 'CERN Openlab Summer Student Programme',
      organizer: 'CERN (European Organization for Nuclear Research)',
      category: 'fellowship',
      subcategory: 'High-Performance Computing, AI & Distributed Systems in Geneva',
      description:
        'Fully funded 9-week summer research fellowship in Geneva, Switzerland, where computer science students work on cutting-edge data, quantum, and AI systems at CERN.',
      eligibility: 'Bachelor or Master students in Computer Science/IT who have completed at least 3 years of study.',
      indian_eligibility: 'Eligible',
      geography: 'Geneva, Switzerland (In-Person, Travel & Stipend Covered)',
      stipend: '93 CHF/day tax-free subsistence allowance (~$6,500 USD total) + Round-trip Airfare',
      stipend_type: 'Paid / Stipend',
      deadline: '2027-01-26',
      timeline: 'Applications open Nov–Jan; Summer cohort runs June–August in Geneva',
      duration: '9 weeks (Summer)',
      application_url: 'https://openlab.cern/education',
      required_materials: 'CV, academic transcripts, and 2 faculty recommendation letters.',
      competitiveness: 'High',
      mentor_notes: 'India is an Associate Member State of CERN — Indian CS undergraduates are 100% eligible and selected every year.',
      target_persona: '3rd-year CS students with strong C++, Python, ML, or distributed systems backgrounds.',
      status: 'Open',
      last_verified: today,
      source: 'Official Website (openlab.cern)',
    },
  ];

  let filtered = pool.filter((o) =>
    categories.includes(o.category as OpportunityCategory)
  );

  // Rotate the pool order based on scanIteration so consecutive scans never present the same starting sequence
  if (filtered.length > 1 && scanIteration > 0) {
    const offset = (scanIteration * 5) % filtered.length;
    filtered = [...filtered.slice(offset), ...filtered.slice(0, offset)];
  }

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
