import * as http from 'http';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { Snippet } from '@snippet-engine-control/core';
import { readSnippetsFromEspanso, preview } from '@snippet-engine-control/adapter-espanso';
import { ValidationService, PreviewService, SnippetStore, DraftService } from '@snippet-engine-control/app';
import { buildExportPlan } from './plan';

const store = new SnippetStore();

// Generate a cryptographically secure random token on startup
const SEC_TOKEN = crypto.randomBytes(32).toString('hex');

export function startDaemon(port = 4000, options: { dir?: string, host?: string, allowLan?: boolean } = {}) {
  let host = options.host || '127.0.0.1'; // strictly bind to loopback by default
  const isLoopback = ['127.0.0.1', 'localhost', '::1'].includes(host);

  if (!isLoopback && !options.allowLan) {
    console.warn(`WARNING: Host ${host} is not a loopback address. Refusing to bind without --allow-lan flag for security. Falling back to 127.0.0.1.`);
    host = '127.0.0.1';
  }

  // Initialize store from Espanso files
  console.log('Loading snippets from Espanso...');
  const snippets = readSnippetsFromEspanso(options.dir);
  store.load(snippets);
  console.log(`Loaded ${snippets.length} snippets.`);

  const uiDir = path.resolve(__dirname, '../../../ui');

  const server = http.createServer((req, res) => {
    // Origin Enforcement
    const origin = req.headers.origin;
    if (origin) {
      const allowedOrigins = [
        `http://127.0.0.1:${port}`,
        `http://localhost:${port}`,
        `http://${host}:${port}`
      ];
      // Special case for IPv6 loopback
      if (host === '::1') {
         allowedOrigins.push(`http://[::1]:${port}`);
      }
      if (!allowedOrigins.includes(origin)) {
        res.writeHead(403);
        res.end('Forbidden: Invalid Origin');
        return;
      }
    }

    if (req.url && req.url.startsWith('/api/')) {
      handleApiRequest(req, res, options);
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

      if (ext === '.html') {
        // Inject token into HTML
        fs.readFile(filePath, 'utf8', (readErr, content) => {
          if (readErr) {
            res.writeHead(500);
            res.end('Internal Server Error');
            return;
          }
          const injected = content.replace(
            '</head>',
            `<script>window.__SEC_TOKEN__ = "${SEC_TOKEN}";</script>\n</head>`
          );
          res.end(injected);
        });
      } else {
        fs.createReadStream(filePath).pipe(res);
      }
    });
  });

  server.listen(port, host, () => {
    console.log(`SEC Snippet Studio UI running securely at http://${host}:${port}`);
    if (isLoopback) {
      console.log(`Bound to loopback. Token authentication enabled.`);
    } else {
      console.warn(`\n!!! DANGER: LAN EXPOSURE !!!\nDaemon is bound to ${host}. Ensure you trust this network.\nToken authentication is enabled and REQUIRED.\n`);
    }
  });

  return { server, token: SEC_TOKEN, host, port };
}

function handleApiRequest(req: http.IncomingMessage, res: http.ServerResponse, options: { dir?: string } = {}) {
  const url = new URL(req.url!, `http://${req.headers.host}`);
  const pathname = url.pathname;
  res.setHeader('Content-Type', 'application/json');

  // Validate Token for ALL API methods (prevents XS-Leaks for GET)
  const providedToken = req.headers['x-sec-token'];
  if (!providedToken || providedToken !== SEC_TOKEN) {
    res.writeHead(401);
    res.end(JSON.stringify({ error: 'Unauthorized: Missing or invalid X-SEC-Token' }));
    return;
  }

  let body = '';
  req.on('data', chunk => {
    body += chunk.toString();
  });

  req.on('end', () => {
    try {
      if (req.method === 'GET' && pathname === '/api/snippets') {
        // The UI currently expects a flat array of Snippet IRs
        res.end(JSON.stringify(store.getAll().map(doc => doc.ir)));
      }
      else if (req.method === 'PUT' && pathname.startsWith('/api/snippets/')) {
        const parts = pathname.split('/');
        const legacyId = parts[parts.length - 1];
        const draft = JSON.parse(body) as Snippet;

        // The UI still operates on IR ids, so we need to translate that to a stableId
        const existingDoc = store.getAll().find(doc => doc.ir.id === legacyId);

        if (!existingDoc && !legacyId.startsWith('new-')) {
          res.writeHead(404);
          res.end(JSON.stringify({ error: `Not Found: Cannot update non-existent snippet '${legacyId}'` }));
          return;
        }

        // Update existing document if found, else insert new (since UI hasn't adopted stableId yet)
        const draftService = new DraftService(store);
        const savedDoc = draftService.saveDraft(draft, existingDoc?.stableId);

        // Return flat Snippet IR to the UI for backward compatibility
        res.end(JSON.stringify(savedDoc.ir));
      }
      else if (req.method === 'DELETE' && pathname.startsWith('/api/snippets/')) {
        const parts = pathname.split('/');
        const legacyId = parts[parts.length - 1];

        // Find by legacy IR id
        const existingDoc = store.getAll().find(doc => doc.ir.id === legacyId);
        let deleted = false;
        if (existingDoc) {
          deleted = store.delete(existingDoc.stableId);
        }

        res.end(JSON.stringify({ success: deleted }));
      }
      else if (req.method === 'POST' && pathname === '/api/diagnostics/validate') {
        const draft = JSON.parse(body) as Snippet;

        // Provide the draft as part of the total snippets to validate
        // but replace its old version if it exists
        const all = store.getAll().map(doc => doc.ir).filter(s => s.id !== draft.id);
        all.push(draft);

        const validationService = new ValidationService();
        const diag = validationService.validateSnippets(all);

        // Filter diagnostics to only show warnings/errors related to the draft
        // (For conflicts, we simply check if its triggers are involved)
        const relevantConflicts = diag.collisions.filter((c: string) =>
          c.includes(draft.id) || draft.triggers.some((t: string) => c.includes(`'${t}'`))
        );

        res.end(JSON.stringify({
          conflicts: relevantConflicts,
          boundaries: diag.ambiguous.filter((b: string) => b.includes(draft.id) || b.includes('new snippet')),
          encodings: diag.encoding.filter((e: string) => e.includes(draft.id) || e.includes('new snippet'))
        }));
      }
      else if (req.method === 'POST' && pathname === '/api/preview') {
        const draft = JSON.parse(body) as Snippet;
        const previewService = new PreviewService({ preview });
        const prevResult = previewService.previewDocument(draft);
        res.writeHead(200);
        res.end(JSON.stringify({ preview: prevResult }));
      }
      else if (req.method === 'POST' && pathname === '/api/export/dry-run') {
        try {
          const snippets = store.getAll().map(doc => doc.ir);
          const plan = buildExportPlan(
            { engine: 'espanso', dir: options.dir || path.join(process.cwd(), '.espanso') },
            snippets
          );

          res.end(JSON.stringify(plan));
        } catch (e: any) {
          res.writeHead(500);
          res.end(JSON.stringify({ error: e.message }));
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
