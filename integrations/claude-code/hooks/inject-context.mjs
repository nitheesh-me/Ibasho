#!/usr/bin/env node
// <!-- installed-by:ibasho -->
// SubagentStart hook for ibasho-explorer: injects the Ibasho agent link base URL, bearer token,
// open tabs and pairing code as additionalContext, plus the path of the iq helper. When the
// companion is not running it injects one line saying so (headless MCP tools still work).
// Never blocks or fails the launch: every error path prints a short context and exits 0.
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const event = process.argv[2] || 'SubagentStart';
const here = path.dirname(fileURLToPath(import.meta.url));
const iqCandidates = [path.join(here, '..', 'bin', 'iq.mjs'), path.join(configDir(), 'bin', 'iq.mjs')];
const iq = iqCandidates.find((p) => fs.existsSync(p)) ?? iqCandidates[1];

function configDir(env = process.env) {
  if (env.IBASHO_CONFIG_DIR) return env.IBASHO_CONFIG_DIR;
  if (env.XDG_CONFIG_HOME) return path.join(env.XDG_CONFIG_HOME, 'ibasho');
  return path.join(env.HOME || os.homedir(), '.config', 'ibasho');
}

function emit(context) {
  process.stdout.write(
    JSON.stringify({ hookSpecificOutput: { hookEventName: event, additionalContext: context } }),
  );
}

function readServer() {
  try {
    const s = JSON.parse(fs.readFileSync(path.join(configDir(), 'server.json'), 'utf8'));
    if (!Number.isInteger(s?.port) || typeof s?.token !== 'string') return null;
    try {
      process.kill(s.pid, 0);
    } catch (e) {
      if (e.code !== 'EPERM') return null;
    }
    return s;
  } catch {
    return null;
  }
}

function getSessions(server) {
  const bridge = server.bridge || '/agent-link';
  return new Promise((resolve) => {
    try {
      const req = http.request(
        {
          host: '127.0.0.1',
          port: server.port,
          path: `${bridge}/agent/sessions`,
          method: 'GET',
          headers: { authorization: `Bearer ${server.token}` },
        },
        (res) => {
          let body = '';
          res.setEncoding('utf8');
          res.on('data', (c) => {
            body += c;
          });
          res.on('end', () => {
            try {
              resolve(res.statusCode === 200 ? JSON.parse(body) : null);
            } catch {
              resolve(null);
            }
          });
        },
      );
      req.setTimeout(2000, () => {
        req.destroy();
        resolve(null);
      });
      req.on('error', () => resolve(null));
      req.end();
    } catch {
      resolve(null);
    }
  });
}

const server = readServer();
if (!server) {
  emit(
    `The Ibasho app is not running with the agent link (no live ~/.config/ibasho/server.json). Use the headless ibasho_* MCP tools; live tools will report app-not-running. The iq helper is at ${iq}.`,
  );
  process.exit(0);
}

const base = `http://127.0.0.1:${server.port}${server.bridge || '/agent-link'}`;
let context = `The Ibasho agent link bridge is running at ${base}. Send 'Authorization: Bearer ${server.token}' on every /agent/* request. Or call the helper, which needs neither: node "${iq}" GET /agent/sessions`;
const s = await getSessions(server);
if (s) {
  const live = (s.sessions || []).filter((x) => x.connected);
  if (live.length > 0) {
    context += `\n\nOpen app tabs with Agent link on: ${JSON.stringify(
      live.map((x) => ({ sessionId: x.id, homeId: x.state?.homeId ?? null, route: x.state?.route ?? null })),
    )}`;
  } else if (s.pairing?.code) {
    context += `\n\nNo tab is paired. If the person wants the live app, ask them to open Settings > Agent link and type the pairing code ${s.pairing.code} (valid until ${s.pairing.expiresAt}).`;
  }
}
emit(context);
