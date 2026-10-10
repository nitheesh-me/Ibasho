#!/usr/bin/env node
// <!-- installed-by:ibasho -->
// Launcher for the Ibasho MCP server from the Claude Code plugin. The server runs from a checkout
// of the Ibasho repo (Node 26 runs its TypeScript directly). The checkout is found, in order, from
// $IBASHO_REPO, from ~/.config/ibasho/install.json (written by `pnpm agent:install`), or by walking
// up from this file (when the plugin is used in place with --plugin-dir).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const MAIN = path.join('apps', 'mcp', 'src', 'main.ts');

function configDir(env = process.env) {
  if (env.IBASHO_CONFIG_DIR) return env.IBASHO_CONFIG_DIR;
  if (env.XDG_CONFIG_HOME) return path.join(env.XDG_CONFIG_HOME, 'ibasho');
  return path.join(env.HOME || os.homedir(), '.config', 'ibasho');
}

function candidates(env = process.env) {
  const out = [];
  if (env.IBASHO_REPO) out.push(env.IBASHO_REPO);
  try {
    const install = JSON.parse(fs.readFileSync(path.join(configDir(), 'install.json'), 'utf8'));
    if (typeof install.repo === 'string') out.push(install.repo);
  } catch {}
  let dir = path.dirname(fileURLToPath(import.meta.url));
  for (let i = 0; i < 6; i++) {
    out.push(dir);
    dir = path.dirname(dir);
  }
  return out;
}

const repo = candidates().find((d) => fs.existsSync(path.join(d, MAIN)));
if (!repo) {
  process.stderr.write(
    'ibasho-mcp: cannot find the Ibasho checkout. Run `pnpm agent:install` from the repo, or set IBASHO_REPO.\n',
  );
  process.exit(1);
}
Object.assign(process.env, { IBASHO_REPO: repo });
await import(pathToFileURL(path.join(repo, MAIN)).href);
