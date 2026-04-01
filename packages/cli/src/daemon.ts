import * as http from 'http';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { Snippet } from '@snippet-engine-control/core';
import { readSnippetsFromEspanso, preview, writeSnippets, createSnapshot, restoreSnapshot, rollbackLatestSnapshot, verify, health, restartEspanso, discoverDirs } from '@snippet-engine-control/adapter-espanso';
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

  // Centralize effective Espanso directory resolution once on startup
  let effectiveEspansoDir = options.dir;
  if (!effectiveEspansoDir) {
    const dirs = discoverDirs();
    if (dirs.length > 0) {
      effectiveEspansoDir = dirs[0];
    }
  }

  console.log('Initializing workspace from Espanso...');
  const workspaceService = new WorkspaceService({
    readSnippets: () => [], // not needed for espanso
    readSnippetsFromEngine: (dir) => readSnippetsFromEspanso(dir)
  });

  const workspace = workspaceService.openWorkspace({ engine: 'espanso', dir: effectiveEspansoDir });
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
      handleApiRequest(req, res, { ...options, dir: effectiveEspansoDir }, workspace, workspaceService);
      return;
    }

    // Static file serving for UI
    const parsedUrl = new URL(req.url || '/', `http://${req.headers.host}`);
    let decodedPath: string;
    try {
      decodedPath = decodeURIComponent(parsedUrl.pathname);
    } catch {
      res.writeHead(400);
      res.end('Bad Request: Invalid URL encoding');
      return;
    }
    let filePath = path.resolve(uiDir, decodedPath === '/' ? 'index.html' : '.' + decodedPath);

    // security check: ensure resolved path is within uiDir
    const relativePath = path.relative(uiDir, filePath);
    if (relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
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

  const effectiveEspansoDir = options.dir;

  // Validate Token for ALL API methods (prevents XS-Leaks for GET)
  const providedToken = req.headers['x-sec-token'];
  if (!providedToken || providedToken !== SEC_TOKEN) {
    res.writeHead(401);
    res.end(JSON.stringify({ error: 'Unauthorized: Missing or invalid X-SEC-Token' }));
    return;
  }

  const MAX_BODY_SIZE = 1024 * 1024; // 1 MB
  const bodyChunks: Buffer[] = [];
  let bodyLength = 0;
  let bodyLimitExceeded = false;
  req.on('data', (chunk: Buffer) => {
    if (bodyLimitExceeded) return;
    bodyLength += chunk.length;
    if (bodyLength > MAX_BODY_SIZE) {
      bodyLimitExceeded = true;
      res.writeHead(413, { 'Connection': 'close' });
      res.end(JSON.stringify({ error: 'Request body too large' }));
      return;
    }
    bodyChunks.push(chunk);
  });

  req.on('end', () => {
    if (bodyLimitExceeded) return;
    const body = Buffer.concat(bodyChunks).toString('utf8');
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
          if (!effectiveEspansoDir) {
            res.writeHead(500);
            res.end(JSON.stringify({ error: 'Cannot dry-run: Espanso configuration directory not found.' }));
            return;
          }

          const snippets = workspace.snippetSets.flatMap(set => set.snippets.map(doc => doc.ir));
          const plan = buildExportPlan(
            { engine: 'espanso', dir: effectiveEspansoDir },
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
          if (!effectiveEspansoDir) {
            res.writeHead(500);
            res.end(JSON.stringify({ error: 'Cannot apply: Espanso configuration directory not found.' }));
            return;
          }

          const snippets = workspace.snippetSets.flatMap(set => set.snippets.map(doc => doc.ir));

          const plan = buildExportPlan(
            { engine: 'espanso', dir: effectiveEspansoDir },
            snippets
          );

          // If no changes, short-circuit
          if (!plan.changes || plan.changes.length === 0) {
            res.writeHead(200);
            res.end(JSON.stringify({
              success: true,
              changed: false,
              writtenFiles: [],
              restarted: false,
              message: 'No changes required.'
            }));
            return;
          }

          const applyService = new ApplyService({
            writePort: { writeSnippets },
            snapshotPort: {
              createSnapshot: () => createSnapshot(effectiveEspansoDir as string),
              restoreSnapshot: (id: string) => restoreSnapshot(id, effectiveEspansoDir as string),
              rollbackLatestSnapshot: () => rollbackLatestSnapshot(effectiveEspansoDir as string)
            },
            runtimePort: {
              verify: (p) => verify(p),
              health: () => health(effectiveEspansoDir as string)
            }
          });

          const didWrite = applyService.applyPlan(plan, false);

          let restarted = false;
          let message = 'Plan applied successfully.';
          if (didWrite) {
            restarted = restartEspanso();
            if (!restarted) {
              message = 'Applied, but Espanso restart failed.';
            } else {
              message = 'Applied successfully.';
            }
          }

          res.writeHead(200);
          res.end(JSON.stringify({
            success: true,
            changed: didWrite,
            writtenFiles: plan.changes.filter(c => c.action === 'create' || c.action === 'update' || c.action === 'delete').map(c => c.file),
            restarted,
            message
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
