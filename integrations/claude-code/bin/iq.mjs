#!/usr/bin/env node
// <!-- installed-by:ibasho -->
// iq: Ibasho agent link helper. Re-reads ~/.config/ibasho/server.json on every call, so the
// port and per-launch token never have to survive between shells. Paths are relative to the
// bridge mount (/agent-link). Usage:
//   node iq.mjs GET  /agent/sessions
//   node iq.mjs POST /agent/call '{"method":"state","params":{}}'
//   node iq.mjs POST /agent/call '{"method":"apply","params":{"ops":[{"op":"addMeasure","measureId":"loft","params":{"option":"loft-300"}}]}}'
//   node iq.mjs POST /agent/pairing/rotate
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';

function configDir(env = process.env) {
  if (env.IBASHO_CONFIG_DIR) return env.IBASHO_CONFIG_DIR;
  if (env.XDG_CONFIG_HOME) return path.join(env.XDG_CONFIG_HOME, 'ibasho');
  return path.join(env.HOME || os.homedir(), '.config', 'ibasho');
}

function readServer(env = process.env) {
  const file = path.join(configDir(env), 'server.json');
  let s;
  try {
    s = JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return { ok: false, file, reason: 'missing' };
  }
  if (!Number.isInteger(s?.port) || typeof s?.token !== 'string')
    return { ok: false, file, reason: 'invalid' };
  try {
    process.kill(s.pid, 0);
  } catch (e) {
    if (e.code !== 'EPERM') return { ok: false, file, reason: 'stale' };
  }
  return { ok: true, file, server: s };
}

function main() {
  const [method, requestPath, body] = process.argv.slice(2);
  if (!method || !requestPath) {
    console.error('usage: node iq.mjs <GET|POST|DELETE> </agent/...> [json body]');
    process.exit(2);
  }
  const r = readServer();
  if (!r.ok) {
    console.error(
      `iq: ${r.file} is ${r.reason}: the Ibasho companion is not running. Start it, open the app, and turn on Settings > Agent link. Headless MCP tools still work.`,
    );
    process.exit(1);
  }
  const { port, token, bridge = '/agent-link' } = r.server;
  const headers = { authorization: `Bearer ${token}` };
  if (body) headers['content-type'] = 'application/json';
  // 127.0.0.1, not localhost: the bridge binds IPv4 loopback only.
  const req = http.request(
    { host: '127.0.0.1', port, path: `${bridge}${requestPath}`, method: method.toUpperCase(), headers },
    (res) => {
      res.pipe(process.stdout);
      res.on('end', () => {
        if ((res.statusCode ?? 500) >= 400) process.exitCode = 1;
      });
    },
  );
  req.on('error', (err) => {
    console.error(`iq: ${err.message}`);
    process.exitCode = 1;
  });
  req.end(body || undefined);
}

main();
