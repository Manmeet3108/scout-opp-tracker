import express, { Request, Response } from 'express';
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';
import { 
  initDatabase, 
  getAllOpportunities, 
  getOpportunityById, 
  createOpportunity, 
  updateOpportunity, 
  deleteOpportunity, 
  batchAddOpportunities, 
  pruneExpiredOpportunities, 
  updateDeadlineStatuses, 
  getScanLogs 
} from './server/db';
import { runOpportunityScan, parseOpportunityWithGemini, syncExistingOpportunitiesFromOfficialSites } from './server/scanner';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;
const isProduction = process.env.NODE_ENV === 'production';

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Initialize persistent DB storage
initDatabase();

// -------------------------------------------------------------
// REST API ROUTES
// -------------------------------------------------------------

// Health check endpoint (for Render health check & monitoring)
app.get('/api/health', (req: Request, res: Response) => {
  const opps = getAllOpportunities();
  res.json({
    status: 'healthy',
    app: 'Scout Opportunity Tracker & Scanner',
    opportunities_count: opps.length,
    environment: isProduction ? 'production' : 'development',
    render_ready: true,
    timestamp: new Date().toISOString(),
  });
});

// Download full project source archive (.zip or .tar.gz) directly in 1 click
app.get('/api/download-zip', (req: Request, res: Response) => {
  const zipPath = path.resolve(process.cwd(), 'dist', 'scout-opportunity-tracker.zip');
  if (fs.existsSync(zipPath)) {
    res.download(zipPath, 'scout-opportunity-tracker.zip');
  } else {
    res.status(404).json({ error: 'ZIP archive not found. Please try again.' });
  }
});

app.get('/api/download-source', (req: Request, res: Response) => {
  const zipPath = path.resolve(process.cwd(), 'dist', 'scout-opportunity-tracker.zip');
  const tarPath = path.resolve(process.cwd(), 'dist', 'scout-tracker-source.tar.gz');
  if (fs.existsSync(zipPath)) {
    res.download(zipPath, 'scout-opportunity-tracker.zip');
  } else if (fs.existsSync(tarPath)) {
    res.download(tarPath, 'scout-opportunity-tracker.tar.gz');
  } else {
    res.status(404).json({ error: 'Archive not found. Please try again.' });
  }
});

// Render & Cloud Configuration info
app.get('/api/render-config', (req: Request, res: Response) => {
  const hasGemini = Boolean(process.env.GEMINI_API_KEY);
  const hasDatabaseUrl = Boolean(process.env.DATABASE_URL || process.env.SUPABASE_URL);
  res.json({
    service_name: 'scout-opportunity-tracker',
    runtime: 'Node.js (LTS) / Render Web Service',
    port: PORT,
    database_mode: hasDatabaseUrl ? 'Cloud Postgres / Supabase' : 'Persistent File-Backed JSON Store',
    ai_scanner_status: hasGemini ? 'Enabled (Gemini API Connected)' : 'Fallback Discovery Engine Active',
    build_command: 'npm install && npm run build',
    start_command: 'npm start',
    health_check_path: '/api/health',
  });
});

// Get all opportunities
app.get('/api/opportunities', (req: Request, res: Response) => {
  try {
    const opps = getAllOpportunities();
    res.json(opps);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to fetch opportunities' });
  }
});

// Get single opportunity
app.get('/api/opportunities/:id', (req: Request, res: Response) => {
  try {
    const opp = getOpportunityById(req.params.id);
    if (!opp) {
      return res.status(404).json({ error: 'Opportunity not found' });
    }
    res.json(opp);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to fetch opportunity' });
  }
});

// Create new opportunity
app.post('/api/opportunities', (req: Request, res: Response) => {
  try {
    const body = req.body;
    if (!body.title || !body.organizer || !body.category) {
      return res.status(400).json({ error: 'Title, organizer, and category are required' });
    }
    const created = createOpportunity(body);
    res.status(201).json(created);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to create opportunity' });
  }
});

// Update opportunity
app.put('/api/opportunities/:id', (req: Request, res: Response) => {
  try {
    const updated = updateOpportunity(req.params.id, req.body);
    if (!updated) {
      return res.status(404).json({ error: 'Opportunity not found' });
    }
    res.json(updated);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to update opportunity' });
  }
});

// Delete opportunity
app.delete('/api/opportunities/:id', (req: Request, res: Response) => {
  try {
    const success = deleteOpportunity(req.params.id);
    if (!success) {
      return res.status(404).json({ error: 'Opportunity not found' });
    }
    res.json({ success: true, message: 'Opportunity deleted successfully' });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to delete opportunity' });
  }
});

// Batch import opportunities
app.post('/api/opportunities/batch', (req: Request, res: Response) => {
  try {
    const items = req.body.items;
    if (!Array.isArray(items)) {
      return res.status(400).json({ error: 'Expected items array in body' });
    }
    const result = batchAddOpportunities(items);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to batch add opportunities' });
  }
});

// AI Quick-Parse announcement text or URL
app.post('/api/opportunities/parse-text', async (req: Request, res: Response) => {
  try {
    const { text } = req.body;
    if (!text || typeof text !== 'string') {
      return res.status(400).json({ error: 'Announcement text is required' });
    }
    const parsed = await parseOpportunityWithGemini(text);
    res.json(parsed);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to parse text' });
  }
});

// Trigger Opportunity Scan (also syncs existing opportunities from official websites)
app.post('/api/scan', async (req: Request, res: Response) => {
  try {
    const { categories, autoAdd, targetCount, customQuery } = req.body || {};
    const result = await runOpportunityScan({
      categories,
      autoAdd,
      targetCount,
      customQuery,
    });
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Scan execution failed' });
  }
});

// Sync all existing opportunities directly from their official websites
app.post('/api/opportunities/sync-official', async (req: Request, res: Response) => {
  try {
    const result = await syncExistingOpportunitiesFromOfficialSites();
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Official site sync failed' });
  }
});

// Get scan logs
app.get('/api/scan/logs', (req: Request, res: Response) => {
  try {
    const logs = getScanLogs();
    res.json(logs);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to fetch scan logs' });
  }
});

// Prune expired opportunities
app.post('/api/opportunities/prune', (req: Request, res: Response) => {
  try {
    const days = parseInt(req.body.daysThreshold) || 15;
    const result = pruneExpiredOpportunities(days);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to prune expired opportunities' });
  }
});

// -------------------------------------------------------------
// NIGHTLY SCAN, DISCOVERY & OFFICIAL WEBSITE SYNC SCHEDULER
// -------------------------------------------------------------
// Run every 24 hours (86,400,000 ms) in background
const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;
setInterval(async () => {
  console.log('[Scout Scheduler] Running nightly discovery scan & official website sync...');
  try {
    const scanResult = await runOpportunityScan({ autoAdd: true });
    console.log(
      `[Scout Scheduler] Nightly complete. Verified: ${scanResult.stats.verified} (${scanResult.stats.updated} updated), New Added: ${scanResult.stats.added}, Pruned: ${scanResult.stats.pruned}`
    );
  } catch (err) {
    console.error('[Scout Scheduler] Error in nightly maintenance:', err);
  }
}, TWENTY_FOUR_HOURS);

// -------------------------------------------------------------
// FRONTEND SERVING (DEV vs PRODUCTION)
// -------------------------------------------------------------
async function setupFrontend() {
  if (!isProduction) {
    // In development: mount Vite dev server as middleware
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: process.env.DISABLE_HMR !== 'true',
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
    console.log('[Scout Server] Vite dev server mounted in middleware mode');
  } else {
    // In production (Render or container): serve built static files
    const distPath = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
    console.log('[Scout Server] Serving static build from dist/');
  }

  app.listen(Number(PORT), '0.0.0.0', () => {
    console.log(`[Scout Server] Listening on http://0.0.0.0:${PORT}`);
  });
}

setupFrontend().catch((err) => {
  console.error('[Scout Server] Fatal startup error:', err);
  process.exit(1);
});
