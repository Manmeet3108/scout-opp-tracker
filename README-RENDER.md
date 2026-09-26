# Deploying Scout to Render

Scout is built to run effortlessly as a 24/7 standalone Web Service on [Render](https://render.com).

## 🚀 3-Minute Quick Deploy

### Method 1: Render Web Service (Recommended)
1. **Push your code to GitHub / GitLab**.
2. Go to [dashboard.render.com](https://dashboard.render.com) and click **New +** → **Web Service**.
3. Connect your repository.
4. Render will auto-detect the configuration, or enter:
   - **Name**: `scout-tracker`
   - **Region**: Any (e.g. Frankfurt, Oregon, Singapore)
   - **Branch**: `main`
   - **Runtime**: `Node`
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `npm start` (or `npx tsx server.ts`)
5. Under **Environment Variables**:
   - `NODE_ENV` = `production`
   - `GEMINI_API_KEY` = *Your Gemini API key* (for live web scanning & parsing)
   - `PORT` = `10000` (Render defaults to 10000)
   - *(Optional)* `DATABASE_URL` = *Your Supabase or Render Postgres URL* (if using external DB)
6. Click **Deploy Web Service**! Render will build and deploy Scout.

### Method 2: Render Blueprint (Infrastructure-as-Code)
1. Push this repo with the included `render.yaml`.
2. In the Render Dashboard, click **New +** → **Blueprint**.
3. Select your repository. Render will automatically configure the Web Service and optional PostgreSQL instance!

### Health Check Endpoint
- Health check URL: `/api/health`
- Render will automatically verify your service is healthy before completing zero-downtime deploys.

## 💾 Database Options on Render
- **Out-of-the-Box**: Scout automatically persists to `/data/opportunities.json` on disk.
- **Render PostgreSQL**: Create a free Render PostgreSQL database and paste the connection string as `DATABASE_URL`.
- **Supabase**: If you connect Supabase, run the included `scripts/init-supabase.sql` in the Supabase SQL editor to create the exact 21-column schema.
