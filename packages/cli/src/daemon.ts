import * as http from 'http';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { Snippet } from '@snippet-engine-control/core';
import { readSnippetsFromEspanso, preview, writeSnippets, createSnapshot, restoreSnapshot, rollbackLatestSnapshot, verify, health, restartEspanso } from '@snippet-engine-control/adapter-espanso';
import { ValidationService, PreviewService, WorkspaceService, Workspace, SnippetDocument, ApplyService } from '@snippet-engine-control/app';
import { buildExportPlan } from './plan';

// Generate a cryptographically secure random token on startup
const SEC_TOKEN = crypto.randomBytes(32).toString('hex');

export function startDaemon(port = 4000, options: { dir?: string, host?: string, allowLan?: boolean } = {}) {
  let host = options.host || '127.0.0.1'; // strictly bind to loopback by default
  const isLoopback = ['127.0.0.1', 'localhost', '::1'].includes(host);

  if (!isLoopback && !options.allowLan) {
    console.warn(`WARNING: Host ${host} is not a loopback address. Refusing to bind without --allow-lan flag for security. Falling back to 127.0.0.1.`);
    host = '127.0.0.1';
  }

  console.log('Initializing workspace from Espanso...');
  const workspaceService = new WorkspaceService({
    readSnippets: () => [], // not needed for espanso
    readSnippetsFromEngine: (dir) => readSnippetsFromEspanso(dir)
  });

  const workspace = workspaceService.openWorkspace({ engine: 'espanso', dir: options.dir });
  const snippetCount = workspace.snippetSets.reduce((acc, set) => acc + set.snippets.length, 0);
  console.log(`Loaded ${snippetCount} snippets into workspace.`);

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
      handleApiRequest(req, res, options, workspace, workspaceService);
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

function findDocByLegacyId(workspace: Workspace, legacyId: string): SnippetDocument | undefined {
  for (const set of workspace.snippetSets) {
    const doc = set.snippets.find(d => d.ir.id === legacyId);
    if (doc) {
      return doc;
    }
  }
  return undefined;
}

function handleApiRequest(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  options: { dir?: string } = {},
  workspace: Workspace,
  workspaceService: WorkspaceService
) {
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
        res.writeHead(200);
        // The UI currently expects a flat array of Snippet IRs
        const allSnippets = workspace.snippetSets.flatMap(set => set.snippets.map(doc => doc.ir));
        res.end(JSON.stringify(allSnippets));
      }
      else if (req.method === 'PUT' && pathname.startsWith('/api/snippets/')) {
        const parts = pathname.split('/');
        const legacyId = parts[parts.length - 1];
        const draft = JSON.parse(body) as Snippet;

        // The UI still operates on IR ids, so we need to translate that to a stableId
        const existingDoc = findDocByLegacyId(workspace, legacyId);

        if (!existingDoc && !legacyId.startsWith('new-')) {
          res.writeHead(404);
          res.end(JSON.stringify({ error: `Not Found: Cannot update non-existent snippet '${legacyId}'` }));
          return;
        }

        let savedDocIr: Snippet | undefined;
        if (existingDoc) {
          workspaceService.updateDocument(workspace, existingDoc.stableId, draft);
          // Find the updated doc to get the new IR
          for (const set of workspace.snippetSets) {
            const updated = set.snippets.find(d => d.stableId === existingDoc.stableId);
            if (updated) {
              savedDocIr = updated.ir;
              break;
            }
          }
        } else {
          // Insert new (since UI hasn't adopted stableId yet)
          const newDoc = workspaceService.addDocument(workspace, draft);
          savedDocIr = newDoc.ir;
        }

        if (!savedDocIr) {
          console.error(`Failed to retrieve Snippet IR after updating or inserting legacy id: ${legacyId}`);
          res.writeHead(500);
          res.end(JSON.stringify({ error: `Failed to persist snippet '${legacyId}'` }));
          return;
        }

        res.writeHead(200);
        // Return flat Snippet IR to the UI for backward compatibility
        res.end(JSON.stringify(savedDocIr));
      }
      else if (req.method === 'DELETE' && pathname.startsWith('/api/snippets/')) {
        const parts = pathname.split('/');
        const legacyId = parts[parts.length - 1];

        // Find by legacy IR id
        const existingDoc = findDocByLegacyId(workspace, legacyId);

        let deleted = false;
        if (existingDoc) {
          deleted = workspaceService.deleteDocument(workspace, existingDoc.stableId);
        }

        res.writeHead(200);
        res.end(JSON.stringify({ success: deleted }));
      }
      else if (req.method === 'POST' && pathname === '/api/diagnostics/validate') {
        const draft = JSON.parse(body) as Snippet;

        // Provide the draft as part of the total snippets to validate
        // but replace its old version if it exists
        const all = workspace.snippetSets.flatMap(set => set.snippets.map(doc => doc.ir)).filter(s => s.id !== draft.id);
        all.push(draft);

        const validationService = new ValidationService();
        const diag = validationService.validateSnippets(all);

        // Filter diagnostics to only show warnings/errors related to the draft
        // (For conflicts, we simply check if its triggers are involved)
        const relevantConflicts = diag.collisions.filter((c: string) =>
          c.includes(draft.id) || draft.triggers.some((t: string) => c.includes(`'${t}'`))
        );

        res.writeHead(200);
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
          const snippets = workspace.snippetSets.flatMap(set => set.snippets.map(doc => doc.ir));
          const plan = buildExportPlan(
            { engine: 'espanso', dir: options.dir || path.join(process.cwd(), '.espanso') },
            snippets
          );

          res.writeHead(200);
          res.end(JSON.stringify(plan));
        } catch (e: any) {
          res.writeHead(500);
          res.end(JSON.stringify({ error: e.message }));
        }
      }
      else if (req.method === 'POST' && pathname === '/api/export/apply') {
        try {
          const snippets = workspace.snippetSets.flatMap(set => set.snippets.map(doc => doc.ir));
          const espansoDir = options.dir || path.join(process.cwd(), '.espanso');
          const plan = buildExportPlan(
            { engine: 'espanso', dir: espansoDir },
            snippets
          );

          const applyService = new ApplyService({
            writePort: { writeSnippets },
            snapshotPort: {
              createSnapshot: () => createSnapshot(espansoDir),
              restoreSnapshot: (id: string) => restoreSnapshot(id, espansoDir),
              rollbackLatestSnapshot: () => rollbackLatestSnapshot(espansoDir)
            },
            runtimePort: {
              verify: (p) => verify(p),
              health: () => health(espansoDir)
            }
          });

          const didWrite = applyService.applyPlan(plan, false);

          let restarted = false;
          if (didWrite) {
            restarted = restartEspanso();
          }

          res.writeHead(200);
          res.end(JSON.stringify({
            success: didWrite,
            writtenFiles: plan.changes.map(c => c.file),
            restarted
          }));
        } catch (e: any) {
          console.error(e);
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
