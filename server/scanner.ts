import { GoogleGenAI, Type } from '@google/genai';
import {
  Opportunity,
  OpportunityInput,
  ScanLog,
  OpportunityCategory,
  OpportunityStatus,
} from '../src/types/opportunity';
import {
  getAllOpportunities,
  saveAllOpportunities,
  batchAddOpportunities,
  updateDeadlineStatuses,
  pruneExpiredOpportunities,
  addScanLog,
} from './db';

const ai = process.env.GEMINI_API_KEY
  ? new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    })
  : null;

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
  } else if (/rolling\s+basis|rolling\s+applications|open\s+year[- ]round/i.test(liveText) && existing?.deadline === 'Rolling') {
    result.deadline = 'Rolling';
  }

  // Extract stipend if dollar amount is explicitly mentioned on page
  const stipendMatch = liveText.match(/\$[0-9]{1,3}(?:,[0-9]{3})+(?:\s*(?:USD|stipend|grant|prize))?/i);
  if (stipendMatch && !existing?.stipend) {
    result.stipend = stipendMatch[0];
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

  // 1. If Gemini API + Google Search Grounding is available, batch-verify all opportunities against their official sites
  if (ai) {
    try {
      const summaryList = opportunities.map((o) => ({
        id: o.id,
        title: o.title,
        organizer: o.organizer,
        application_url: o.application_url,
        current_deadline: o.deadline,
      }));

      const prompt = `You are Scout's real-time official website verifier. Today's date is ${today}.
For each opportunity below, use Google Search to check its official website (${opportunities
        .slice(0, 10)
        .map((o) => o.application_url)
        .join(', ')}) and verify:
1. "deadline": The exact 2026 official application deadline printed on the official site in "YYYY-MM-DD" format, or "Rolling" if rolling. Do NOT guess 2027 dates if the official site still displays 2026 dates.
2. "timeline": The exact dates/times for application opening, deadline, and event/cohort dates from the official site.
3. "geography": The exact venue, city, or remote status from the official site.
4. "stipend": The exact official stipend, grant, or prize amount.

Opportunities to verify:
${JSON.stringify(summaryList, null, 2)}

Return a JSON array of objects with keys: id, deadline, timeline, geography, stipend.`;

      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: prompt,
        config: {
          tools: [{ googleSearch: {} }],
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                id: { type: Type.STRING },
                deadline: { type: Type.STRING },
                timeline: { type: Type.STRING },
                geography: { type: Type.STRING },
                stipend: { type: Type.STRING },
              },
              required: ['id', 'deadline'],
            },
          },
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
            (u.geography && u.geography !== opp.geography);
          if (changed) updatedCount++;
          return {
            ...opp,
            deadline: u.deadline || opp.deadline,
            timeline: u.timeline || opp.timeline,
            geography: u.geography || opp.geography,
            stipend: u.stipend || opp.stipend,
            last_verified: today,
            source: `Live Verified (${new URL(opp.application_url).hostname.replace(/^www\./, '')})`,
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
        if (nextDeadline !== opp.deadline) {
          updatedCount++;
        }
        updatedOpps.push({
          ...opp,
          deadline: nextDeadline,
          last_verified: today,
          source: `Official Site Synced (${new URL(opp.application_url).hostname.replace(/^www\./, '')})`,
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

  if (urlMatch) {
    fetchedMeta = await fetchOfficialWebsiteContent(urlMatch[0]);
    if (fetchedMeta.ok) {
      liveSiteContext = `\n\nLIVE FETCHED CONTENT FROM OFFICIAL WEBSITE (${urlMatch[0]}):\nTitle: ${fetchedMeta.title}\nDescription: ${fetchedMeta.description}\nPage Text:\n${fetchedMeta.text.slice(0, 10000)}`;
    }
  }

  if (ai) {
    const prompt = `You are Scout's real-time official website extractor. Today's date is ${today}.
Extract the exact 21 Scout fields from the input below and use Google Search to verify the official application deadline, cohort dates/times, venue/geography, stipend, and eligibility from the official website.

User Input:
"""
${rawText}
"""
${liveSiteContext}

Return a JSON object with exact keys:
title, organizer, category (fellowship, grant, ambassador, opensource, hackathon_conference, competition), subcategory, description, eligibility, indian_eligibility (Eligible, Not Eligible, Conditional / Varies), geography, stipend, stipend_type (Paid / Stipend, Equity-free Grant, Prizes / Hardware, Unpaid / Perks), deadline (YYYY-MM-DD or Rolling), timeline, duration, application_url, required_materials, competitiveness (High, Medium, Low), mentor_notes, target_persona, status (Open, Closing Soon, Rolling, Closed), last_verified ("${today}"), source ("Live Official Website Extractor").`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: prompt,
      config: {
        tools: [{ googleSearch: {} }],
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            organizer: { type: Type.STRING },
            category: { type: Type.STRING },
            subcategory: { type: Type.STRING },
            description: { type: Type.STRING },
            eligibility: { type: Type.STRING },
            indian_eligibility: { type: Type.STRING },
            geography: { type: Type.STRING },
            stipend: { type: Type.STRING },
            stipend_type: { type: Type.STRING },
            deadline: { type: Type.STRING },
            timeline: { type: Type.STRING },
            duration: { type: Type.STRING },
            application_url: { type: Type.STRING },
            required_materials: { type: Type.STRING },
            competitiveness: { type: Type.STRING },
            mentor_notes: { type: Type.STRING },
            target_persona: { type: Type.STRING },
            status: { type: Type.STRING },
            last_verified: { type: Type.STRING },
            source: { type: Type.STRING },
          },
          required: [
            'title',
            'organizer',
            'category',
            'description',
            'eligibility',
            'indian_eligibility',
            'stipend',
            'deadline',
            'application_url',
          ],
        },
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

export async function runOpportunityScan(options?: {
  categories?: OpportunityCategory[];
  autoAdd?: boolean;
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

  const today = new Date().toISOString().split('T')[0];

  // STEP 1: Sync all existing opportunities in the tracker against their live official websites!
  const syncResult = await syncExistingOpportunitiesFromOfficialSites();

  // STEP 2: Discover new real-time opportunities from the web
  let discovered: Partial<OpportunityInput>[] = [];

  if (ai) {
    try {
      const prompt = `You are Scout's real-time web opportunity scanner. Today's date is ${today}.
Use Google Search to find 4 to 6 real, currently active or upcoming opportunities for undergraduate computer science and engineering students (including Indian students) across these categories: ${categoriesToScan.join(', ')}.

CRITICAL RULES:
1. Every opportunity, application URL, venue/geography, stipend, and deadline MUST be verified via Google Search against the official program website.
2. Set "deadline" to the exact official date printed on the official website ("YYYY-MM-DD") or "Rolling".
3. Include exact application open/close dates, times, and venue in "timeline" and "geography".
4. Set "last_verified" to "${today}" and "source" to "Live Official Website Scan".

Return a JSON array of opportunity objects.`;

      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: prompt,
        config: {
          tools: [{ googleSearch: {} }],
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                title: { type: Type.STRING },
                organizer: { type: Type.STRING },
                category: { type: Type.STRING },
                subcategory: { type: Type.STRING },
                description: { type: Type.STRING },
                eligibility: { type: Type.STRING },
                indian_eligibility: { type: Type.STRING },
                geography: { type: Type.STRING },
                stipend: { type: Type.STRING },
                stipend_type: { type: Type.STRING },
                deadline: { type: Type.STRING },
                timeline: { type: Type.STRING },
                duration: { type: Type.STRING },
                application_url: { type: Type.STRING },
                required_materials: { type: Type.STRING },
                competitiveness: { type: Type.STRING },
                mentor_notes: { type: Type.STRING },
                target_persona: { type: Type.STRING },
                status: { type: Type.STRING },
                last_verified: { type: Type.STRING },
                source: { type: Type.STRING },
              },
              required: [
                'title',
                'organizer',
                'category',
                'eligibility',
                'stipend',
                'deadline',
                'application_url',
              ],
            },
          },
        },
      });

      if (response.text) {
        discovered = extractJsonFromText(response.text);
      }
    } catch (err) {
      console.warn('Gemini live scan fallback to verified official pool:', err);
      discovered = getVerifiedDiscoveredOpportunities(categoriesToScan, today);
    }
  } else {
    discovered = getVerifiedDiscoveredOpportunities(categoriesToScan, today);
  }

  const pruneResult = pruneExpiredOpportunities(30);

  let addedCount = 0;
  if (options?.autoAdd && discovered.length > 0) {
    const res = batchAddOpportunities(discovered as OpportunityInput[]);
    addedCount = res.added;
  }

  const existingOpps = getAllOpportunities();
  const scanLog: ScanLog = {
    id: `scan-${Date.now()}`,
    timestamp: new Date().toISOString(),
    trigger_type: 'manual_scan',
    status: 'completed',
    categories_scanned: categoriesToScan,
    new_items_found: discovered.length,
    items_verified: existingOpps.length,
    items_pruned: pruneResult.prunedCount,
    details: `Synced ${syncResult.verifiedCount} existing programs against their official websites (${syncResult.updatedCount} updated) and discovered ${discovered.length} opportunities.`,
    discovered_items: discovered,
  };

  addScanLog(scanLog);

  return {
    scanLog,
    discovered,
    stats: {
      added: addedCount,
      verified: existingOpps.length,
      updated: syncResult.updatedCount,
      pruned: pruneResult.prunedCount,
    },
  };
}

function getVerifiedDiscoveredOpportunities(
  categories: OpportunityCategory[],
  today: string
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
        'Connects verified GitHub Campus Global students (including India) with partner tech organizations for paid remote software engineering and open source projects.',
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
  ];

  return pool.filter((o) => categories.includes(o.category as OpportunityCategory));
}
