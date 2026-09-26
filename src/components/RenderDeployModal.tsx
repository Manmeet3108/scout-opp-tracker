import React, { useState } from 'react';
import { 
  X, 
  Server, 
  Copy, 
  Check, 
  ExternalLink, 
  Terminal, 
  Database, 
  Github, 
  Download, 
  ArrowRight,
  FolderGit2
} from 'lucide-react';

interface RenderDeployModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const RenderDeployModal: React.FC<RenderDeployModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  if (!isOpen) return null;

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const renderYamlContent = `services:
  - type: web
    name: scout-opportunity-tracker
    runtime: node
    plan: free
    buildCommand: npm install && npm run build
    startCommand: npm start
    envVars:
      - key: NODE_ENV
        value: production
      - key: PORT
        value: 10000
      - key: GEMINI_API_KEY
        sync: false
    healthCheckPath: /api/health`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm overflow-y-auto">
      <div className="relative w-full max-w-3xl rounded-xl border border-slate-800 bg-slate-900 shadow-2xl overflow-hidden my-8">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 px-6 py-4 bg-slate-950/80">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-600/20 text-emerald-400">
              <Server className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-white">
                How to Put Scout on GitHub & Deploy to Render
              </h3>
              <p className="text-xs text-slate-400">
                Step-by-step instructions to create your repository and connect it to Render.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-800 hover:text-white transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto text-xs">
          {/* Direct ZIP Download inside the app */}
          <div className="rounded-lg border border-slate-700 bg-slate-950 p-4 space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="font-semibold text-white flex items-center gap-2">
                <Download className="h-4 w-4 text-indigo-400" />
                <span>1-Click Project Download</span>
              </div>
              <a
                href="/api/download-zip"
                download="scout-opportunity-tracker.zip"
                className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-indigo-500 shadow transition"
              >
                <Download className="h-3.5 w-3.5" />
                <span>Download .ZIP for VS Code</span>
              </a>
            </div>
            <p className="text-slate-400 text-[11px] leading-relaxed">
              Downloads a standard <strong>.zip file</strong> containing all source code, <code>.gitignore</code>, <code>render.yaml</code>, and configuration ready to unzip and open in VS Code.
            </p>
          </div>

          {/* Overview Banner */}
          <div className="rounded-lg border border-indigo-900/50 bg-indigo-950/20 p-4 space-y-2">
            <div className="font-semibold text-indigo-300 flex items-center gap-2 text-sm">
              <Github className="h-4 w-4" />
              <span>Step 1 of 2: Create your GitHub Repository</span>
            </div>
            <p className="text-slate-300 text-xs leading-relaxed">
              Because this app is currently inside AI Studio Build, you need to push these files to your own GitHub account first. Once pushed, Render can connect to it directly with automated continuous deployment!
            </p>
          </div>

          {/* Path A: Export to GitHub from AI Studio */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-slate-200 font-semibold text-sm">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-indigo-600 text-[10px] text-white font-mono">
                A
              </span>
              <span>Fastest Method: AI Studio "Export to GitHub"</span>
            </div>
            <div className="pl-7 space-y-2 text-slate-300">
              <p>
                1. Look at the <strong>top-right corner</strong> of your AI Studio interface.
              </p>
              <p>
                2. Click the <strong>Download / Export</strong> button (or three dots menu) &rarr; select <strong>"Export to GitHub"</strong>.
              </p>
              <p>
                3. Choose or name your repository (e.g. <code className="text-indigo-300 bg-slate-950 px-1.5 py-0.5 rounded font-mono">scout-tracker</code>). AI Studio will automatically push all project files and commits to your GitHub!
              </p>
            </div>
          </div>

          {/* Path B: Manual Git Push */}
          <div className="space-y-3 border-t border-slate-800 pt-4">
            <div className="flex items-center gap-2 text-slate-200 font-semibold text-sm">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-slate-800 text-[10px] text-indigo-400 font-mono">
                B
              </span>
              <span>Alternative Method: Download ZIP & Push via Terminal</span>
            </div>
            <div className="pl-7 space-y-2 text-slate-300">
              <p>
                If you download the project code as a ZIP file, extract it to a folder, open your terminal inside it, and run:
              </p>
              <div className="rounded-lg border border-slate-800 bg-slate-950 p-3 font-mono text-[11px] space-y-1 relative">
                <button
                  onClick={() => copyToClipboard(`git init
git add .
git commit -m "feat: initial commit for Scout tracker"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/scout-tracker.git
git push -u origin main`, 'git-commands')}
                  className="absolute right-2.5 top-2.5 flex items-center gap-1 rounded bg-slate-800 px-2 py-1 text-[10px] text-slate-300 hover:text-white"
                >
                  {copiedKey === 'git-commands' ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                  <span>Copy</span>
                </button>
                <div className="text-slate-400"># 1. Initialize and commit</div>
                <div className="text-slate-200">git init</div>
                <div className="text-slate-200">git add .</div>
                <div className="text-slate-200">git commit -m "feat: initial Scout tracker"</div>
                <div className="text-slate-200">git branch -M main</div>
                <div className="text-slate-400 pt-1"># 2. Link your new GitHub repository & push</div>
                <div className="text-indigo-300">git remote add origin https://github.com/&lt;your-username&gt;/scout-tracker.git</div>
                <div className="text-emerald-400">git push -u origin main</div>
              </div>
            </div>
          </div>

          {/* Connecting to Render */}
          <div className="border-t border-slate-800 pt-4 space-y-3">
            <div className="font-semibold text-emerald-300 flex items-center gap-2 text-sm">
              <Server className="h-4 w-4" />
              <span>Step 2 of 2: Connect the Repo to Render</span>
            </div>
            <div className="pl-6 space-y-3 text-slate-300">
              <p>
                Now that your repo exists on GitHub:
              </p>
              <ol className="list-decimal list-inside space-y-1.5 pl-1">
                <li>Log in to <a href="https://dashboard.render.com" target="_blank" rel="noreferrer" className="text-indigo-400 underline font-medium inline-flex items-center gap-0.5">dashboard.render.com <ExternalLink className="h-3 w-3" /></a>.</li>
                <li>Click <strong>New +</strong> &rarr; <strong>Web Service</strong>.</li>
                <li>Render will prompt you to connect your GitHub account. Click <strong>Connect GitHub</strong> and select your <code className="text-indigo-300">scout-tracker</code> repo.</li>
                <li>Render will automatically fill the settings using the included <code className="text-indigo-300">render.yaml</code>, or you can verify:</li>
              </ol>

              {/* Setting details */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] font-mono bg-slate-950 p-3 rounded-lg border border-slate-800 mt-2">
                <div>
                  <span className="text-slate-500 block">Runtime:</span>
                  <span className="text-slate-200">Node</span>
                </div>
                <div>
                  <span className="text-slate-500 block">Build Command:</span>
                  <span className="text-indigo-300">npm install && npm run build</span>
                </div>
                <div>
                  <span className="text-slate-500 block">Start Command:</span>
                  <span className="text-indigo-300">npm start</span>
                </div>
                <div>
                  <span className="text-slate-500 block">Health Check Path:</span>
                  <span className="text-emerald-300">/api/health</span>
                </div>
              </div>

              {/* Environment Variables */}
              <div className="pt-2">
                <span className="block font-medium text-slate-200 mb-1">Under "Environment Variables", add:</span>
                <div className="grid grid-cols-2 gap-2 font-mono text-[11px] bg-slate-950 p-3 rounded-lg border border-slate-800">
                  <div>
                    <span className="text-slate-500">NODE_ENV:</span>
                    <span className="text-indigo-300 ml-1">production</span>
                  </div>
                  <div>
                    <span className="text-slate-500">PORT:</span>
                    <span className="text-indigo-300 ml-1">10000</span>
                  </div>
                  <div className="col-span-2">
                    <span className="text-slate-500">GEMINI_API_KEY:</span>
                    <span className="text-amber-300 ml-1">your_gemini_key (for web scanner)</span>
                  </div>
                </div>
              </div>

              <p className="text-slate-300 text-xs">
                Click <strong>"Create Web Service"</strong>. Render will build and deploy Scout at a free custom domain (e.g., <code className="text-emerald-400">scout-opportunity-tracker.onrender.com</code>)!
              </p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-slate-800 px-6 py-3 bg-slate-950/80">
          <span className="text-[11px] text-slate-400">
            All files (<code className="text-indigo-300">render.yaml</code>, <code className="text-indigo-300">Dockerfile</code>, <code className="text-indigo-300">package.json</code>) are already prepared.
          </span>
          <button
            onClick={onClose}
            className="rounded-lg bg-indigo-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-indigo-500 transition"
          >
            Got it, thanks!
          </button>
        </div>
      </div>
    </div>
  );
};
