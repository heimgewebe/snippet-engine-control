import * as http from 'http';
import * as fs from 'fs';
import * as path from 'path';
import {
  SnippetStore,
  Snippet,
  analyzeConflicts,
  analyzeBoundaries,
  analyzeEncoding,
  simulateExpansion
} from '@snippet-engine-control/core';
import { readSnippetsFromEspanso } from '@snippet-engine-control/adapter-espanso';
import { buildExportPlan } from './plan';

const store = new SnippetStore();

export function startDaemon(port = 4000, options: { dir?: string } = {}) {
  // Initialize store from Espanso files
  console.log('Loading snippets from Espanso...');
  const snippets = readSnippetsFromEspanso(options.dir);
  store.load(snippets);
  console.log(`Loaded ${snippets.length} snippets.`);

  const uiDir = path.resolve(__dirname, '../../../ui');

  const server = http.createServer((req, res) => {
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    if (req.url && req.url.startsWith('/api/')) {
      handleApiRequest(req, res);
      return;
    }

    // Static file serving for UI
    let filePath = path.join(uiDir, req.url === '/' ? 'index.html' : req.url || 'index.html');

    // basic security check
    if (!filePath.startsWith(uiDir)) {
      res.writeHead(403);
      res.end('Forbidden');
      return;
    }

    fs.stat(filePath, (err, stats) => {
      if (err || !stats.isFile()) {
        res.writeHead(404);
        res.end('Not Found');
        return;
      }

      const ext = path.extname(filePath);
      const mimeTypes: Record<string, string> = {
        '.html': 'text/html',
        '.js': 'text/javascript',
        '.css': 'text/css',
        '.json': 'application/json',
      };

      const contentType = mimeTypes[ext] || 'text/plain';
      res.setHeader('Content-Type', contentType);
      fs.createReadStream(filePath).pipe(res);
    });
  });

  server.listen(port, () => {
    console.log(`SEC Snippet Studio UI running at http://localhost:${port}`);
  });
}

function handleApiRequest(req: http.IncomingMessage, res: http.ServerResponse, options: { dir?: string } = {}) {
  const url = new URL(req.url!, `http://${req.headers.host}`);
  const pathname = url.pathname;
  res.setHeader('Content-Type', 'application/json');

  let body = '';
  req.on('data', chunk => {
    body += chunk.toString();
  });

  req.on('end', () => {
    try {
      if (req.method === 'GET' && pathname === '/api/snippets') {
        res.writeHead(200);
        res.end(JSON.stringify(store.getAll()));
      }
      else if (req.method === 'PUT' && pathname.startsWith('/api/snippets/')) {
        const parts = pathname.split('/');
        const id = parts[parts.length - 1];
        const draft = JSON.parse(body) as Snippet;

        // Ensure no missing IDs internally
        const saved = store.put(draft, id);
        res.writeHead(200);
        res.end(JSON.stringify(saved));
      }
      else if (req.method === 'POST' && pathname === '/api/diagnostics/validate') {
        const draft = JSON.parse(body) as Snippet;

        // Provide the draft as part of the total snippets to validate
        // but replace its old version if it exists
        const all = store.getAll().filter(s => s.id !== draft.id);
        all.push(draft);

        const conflictsDiag = analyzeConflicts(all);
        const boundariesDiag = analyzeBoundaries(all);
        const encodingDiag = analyzeEncoding(all);

        // Filter diagnostics to only show warnings/errors related to the draft
        // (For conflicts, we simply check if its triggers are involved)
        const relevantConflicts = conflictsDiag.triggerCollisions.filter((c: string) =>
          c.includes(draft.id) || draft.triggers.some((t: string) => c.includes(`'${t}'`))
        );

        res.writeHead(200);
        res.end(JSON.stringify({
          conflicts: relevantConflicts,
          boundaries: boundariesDiag.ambiguousBoundaries.filter((b: string) => b.includes(draft.id) || b.includes('new snippet')),
          encodings: encodingDiag.encodingIssues.filter((e: string) => e.includes(draft.id) || e.includes('new snippet'))
        }));
      }
      else if (req.method === 'POST' && pathname === '/api/preview') {
        const draft = JSON.parse(body) as Snippet;
        const preview = simulateExpansion(draft);
        res.writeHead(200);
        res.end(JSON.stringify({ preview }));
      }
      else if (req.method === 'POST' && pathname === '/api/export/dry-run') {
        // Build export plan using current store instead of reading from disk again
        // For the plan to work natively, we can mock the readSnippets call or
        // implement a small hack since buildExportPlan calls `readSnippets(options.inputPath)` natively.
        // For our MVP, we can bypass buildExportPlan entirely, or write the store to a temp file.
        // But the easiest way is just implementing the diff inline or modifying `buildExportPlan` to accept snippets.

        // Wait, for this vertical slice, we can just write current store to a temp file,
        // and tell buildExportPlan to read from it.
        const tmpPath = path.join(process.cwd(), '.sec.daemon.tmp.json');
        try {
          fs.writeFileSync(tmpPath, JSON.stringify(store.getAll()));

          // Pass the explicit dir to buildExportPlan to prevent failure if auto-discovery fails
          const plan = buildExportPlan({ engine: 'espanso', inputPath: tmpPath, dir: options.dir || path.join(process.cwd(), '.espanso') });

          res.writeHead(200);
          res.end(JSON.stringify(plan));
        } finally {
          if (fs.existsSync(tmpPath)) {
            fs.unlinkSync(tmpPath); // cleanup
          }
        }
      }
      else {
        res.writeHead(404);
        res.end(JSON.stringify({ error: 'Not Found' }));
      }
    } catch (e: any) {
      console.error(e);
      res.writeHead(500);
      res.end(JSON.stringify({ error: e.message }));
    }
  });
}
