/**
 * Discovery file `~/.config/ibasho/server.json` (ARCH 14). Owner: WP-12.
 *
 * The companion writes it on start (mode 0600, atomic rename) and removes it on clean exit.
 * The MCP server, the SubagentStart hook and `iq` read it on every call. A file whose `pid` is
 * not alive is stale (the companion quit uncleanly).
 */
import { chmodSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { type ServerJson, ServerJsonSchema } from '../protocol.ts';
import { randomToken } from './hub.ts';

type Env = Record<string, string | undefined>;

/**
 * `$IBASHO_CONFIG_DIR`, else `$XDG_CONFIG_HOME/ibasho`, else `~/.config/ibasho`.
 * `HOME` from `env` wins over `os.homedir()` so tests can point at a temp home.
 */
export function ibashoConfigDir(env: Env = process.env): string {
  if (env.IBASHO_CONFIG_DIR) return env.IBASHO_CONFIG_DIR;
  if (env.XDG_CONFIG_HOME) return join(env.XDG_CONFIG_HOME, 'ibasho');
  return join(env.HOME ?? homedir(), '.config', 'ibasho');
}

export function serverJsonPath(env: Env = process.env): string {
  return join(ibashoConfigDir(env), 'server.json');
}

/** A fresh per-launch token (256 bits, hex). */
export function createServerToken(): string {
  return randomToken(32);
}

export function writeServerJson(info: ServerJson, env: Env = process.env): string {
  const parsed = ServerJsonSchema.parse(info);
  const dir = ibashoConfigDir(env);
  mkdirSync(dir, { recursive: true, mode: 0o700 });
  // `mode` applies only on creation: tighten a directory or a leftover temp file that exists.
  try {
    chmodSync(dir, 0o700);
  } catch {
    // Not our directory to change; the file itself is still 0600.
  }
  const path = serverJsonPath(env);
  const tmp = `${path}.${process.pid}.tmp`;
  rmSync(tmp, { force: true });
  writeFileSync(tmp, `${JSON.stringify(parsed, null, 2)}\n`, { mode: 0o600, flag: 'wx' });
  chmodSync(tmp, 0o600);
  renameSync(tmp, path);
  return path;
}

export function removeServerJson(env: Env = process.env): void {
  rmSync(serverJsonPath(env), { force: true });
}

export type ServerJsonRead =
  | { ok: true; server: ServerJson }
  | { ok: false; reason: 'missing' | 'invalid' | 'stale'; path: string };

function pidAlive(pid: number): boolean {
  if (pid === process.pid) return true;
  try {
    process.kill(pid, 0);
    return true;
  } catch (e) {
    // EPERM means the process exists but belongs to someone else.
    return (e as NodeJS.ErrnoException).code === 'EPERM';
  }
}

export function readServerJson(env: Env = process.env, checkPid = true): ServerJsonRead {
  const path = serverJsonPath(env);
  let raw: string;
  try {
    raw = readFileSync(path, 'utf8');
  } catch {
    return { ok: false, reason: 'missing', path };
  }
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return { ok: false, reason: 'invalid', path };
  }
  const r = ServerJsonSchema.safeParse(json);
  if (!r.success) return { ok: false, reason: 'invalid', path };
  if (checkPid && !pidAlive(r.data.pid)) return { ok: false, reason: 'stale', path };
  return { ok: true, server: r.data };
}
