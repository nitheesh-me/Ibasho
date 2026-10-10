/**
 * Execute an install plan, and undo it from the record. Owner: WP-12.
 *
 * Guarantees (BUILD_PLAN WP-12 L7):
 * - `--dry-run` never touches the disk or runs `claude`.
 * - Install never overwrites a file that lacks the `installed-by:ibasho` marker.
 * - Install then uninstall leaves HOME byte-identical: created files and directories are removed,
 *   the settings file is restored from its backup bytes when nothing else changed in it, and the
 *   backup and the record are removed. A failure during install rolls back what was done.
 */
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, rmdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { type Action, type InstallOptions, MARKER, planInstall } from './plan.ts';

export interface ClaudeResult {
  code: number;
  stdout: string;
  stderr: string;
}
export type ClaudeRunner = (args: string[]) => ClaudeResult;

export const realClaude: ClaudeRunner = (args) => {
  const r = spawnSync('claude', args, { encoding: 'utf8' });
  if (r.error) return { code: 127, stdout: '', stderr: r.error.message };
  return { code: r.status ?? 1, stdout: r.stdout ?? '', stderr: r.stderr ?? '' };
};

export interface InstallRecord {
  installedBy: typeof MARKER;
  version: 1;
  mode: InstallOptions['mode'];
  scope: InstallOptions['scope'];
  repo: string;
  at: string;
  createdDirs: string[];
  createdFiles: string[];
  claude: { args: string[]; undo: string[] }[];
  settings: { path: string; createdFile: boolean; backup: string | null; command: string } | null;
}

type Log = (line: string) => void;

function sortKeys(x: unknown): unknown {
  if (Array.isArray(x)) return x.map(sortKeys);
  if (x && typeof x === 'object') {
    return Object.fromEntries(
      Object.keys(x)
        .sort()
        .map((k) => [k, sortKeys((x as Record<string, unknown>)[k])]),
    );
  }
  return x;
}
const sameJson = (a: unknown, b: unknown) => JSON.stringify(sortKeys(a)) === JSON.stringify(sortKeys(b));

interface HookEntry {
  matcher?: string;
  hooks?: { type?: string; command?: string }[];
}
type Settings = Record<string, unknown> & { hooks?: Record<string, HookEntry[]> };

function readSettings(path: string): Settings {
  const raw = readFileSync(path, 'utf8');
  try {
    const v = JSON.parse(raw) as unknown;
    if (!v || typeof v !== 'object' || Array.isArray(v)) throw new Error('not an object');
    return v as Settings;
  } catch (e) {
    throw new Error(
      `${path} is not valid JSON (${e instanceof Error ? e.message : e}); fix it or install with --mode plugin`,
    );
  }
}

function writeJson(path: string, v: unknown): void {
  writeFileSync(path, `${JSON.stringify(v, null, 2)}\n`);
}

/** Remove every SubagentStart entry whose command carries the marker; prune empty containers. */
export function stripHook(s: Settings): Settings {
  const out = structuredClone(s);
  const list = out.hooks?.SubagentStart;
  if (!out.hooks || !list) return out;
  const kept = list
    .map((e) => ({ ...e, hooks: (e.hooks ?? []).filter((h) => !(h.command ?? '').includes(MARKER)) }))
    .filter((e) => e.hooks.length > 0);
  if (kept.length > 0) out.hooks.SubagentStart = kept;
  else delete out.hooks.SubagentStart;
  if (Object.keys(out.hooks).length === 0) delete out.hooks;
  return out;
}

export interface RunOptions {
  dryRun?: boolean;
  claude?: ClaudeRunner;
  log?: Log;
  now?: () => Date;
}

export function readRecord(path: string): InstallRecord | null {
  if (!existsSync(path)) return null;
  const r = JSON.parse(readFileSync(path, 'utf8')) as InstallRecord;
  if (r.installedBy !== MARKER) throw new Error(`${path} was not written by the ibasho installer`);
  return r;
}

export function recordPath(o: InstallOptions): string {
  const rec = planInstall(o).find((a): a is Extract<Action, { kind: 'record' }> => a.kind === 'record');
  return rec?.path ?? '';
}

export function install(
  o: InstallOptions,
  run: RunOptions = {},
): { actions: Action[]; record: InstallRecord | null } {
  const log = run.log ?? (() => {});
  const claude = run.claude ?? realClaude;
  const actions = planInstall(o);
  const recPath = recordPath(o);
  if (run.dryRun) return { actions, record: null };
  if (existsSync(recPath)) {
    throw new Error(`already installed (${recPath}); run with --uninstall first`);
  }

  const rec: InstallRecord = {
    installedBy: MARKER,
    version: 1,
    mode: o.mode,
    scope: o.scope,
    repo: o.layout.repo,
    at: (run.now?.() ?? new Date()).toISOString(),
    createdDirs: [],
    createdFiles: [],
    claude: [],
    settings: null,
  };
  try {
    for (const a of actions) {
      switch (a.kind) {
        case 'mkdir': {
          // Create missing ancestors one by one so uninstall can remove exactly those.
          const missing: string[] = [];
          for (let d = a.path; !existsSync(d); d = dirname(d)) missing.unshift(d);
          for (const d of missing) {
            mkdirSync(d);
            rec.createdDirs.push(d);
          }
          break;
        }
        case 'copy': {
          const content = readFileSync(a.from, 'utf8');
          if (!content.includes(MARKER)) throw new Error(`${a.from} lacks the ${MARKER} marker`);
          if (existsSync(a.to) && !readFileSync(a.to, 'utf8').includes(MARKER)) {
            throw new Error(`${a.to} exists and was not installed by ibasho; move it away first`);
          }
          writeFileSync(a.to, content, { mode: a.to.endsWith('.mjs') ? 0o755 : 0o644 });
          rec.createdFiles.push(a.to);
          break;
        }
        case 'claude': {
          const r = claude(a.args);
          if (r.code !== 0)
            throw new Error(`claude ${a.args.join(' ')} failed: ${(r.stderr || r.stdout).trim()}`);
          rec.claude.push({ args: a.args, undo: a.undo });
          break;
        }
        case 'settings-hook': {
          const existed = existsSync(a.settings);
          const s: Settings = existed ? readSettings(a.settings) : {};
          let backup: string | null = null;
          if (existed) {
            const stamp = (run.now?.() ?? new Date()).toISOString().replace(/[:.]/g, '');
            backup = `${a.settings}.ibasho-backup-${stamp}`;
            writeFileSync(backup, readFileSync(a.settings));
          }
          rec.settings = { path: a.settings, createdFile: !existed, backup, command: a.command };
          const merged = stripHook(s);
          merged.hooks ??= {};
          merged.hooks.SubagentStart = [
            ...(merged.hooks.SubagentStart ?? []),
            { matcher: a.matcher, hooks: [{ type: 'command', command: a.command }] },
          ];
          writeJson(a.settings, merged);
          break;
        }
        case 'record':
          writeJson(a.path, rec);
          break;
      }
      log(`done  ${a.kind}`);
    }
  } catch (e) {
    log(`failed, rolling back: ${e instanceof Error ? e.message : e}`);
    undo(rec, claude, log);
    rmSync(recPath, { force: true });
    removeDirs(rec.createdDirs);
    throw e;
  }
  return { actions, record: rec };
}

function undo(rec: InstallRecord, claude: ClaudeRunner, log: Log): void {
  if (rec.settings && existsSync(rec.settings.path)) {
    const { path, createdFile, backup } = rec.settings;
    const stripped = stripHook(readSettings(path));
    if (createdFile && Object.keys(stripped).length === 0) {
      rmSync(path);
    } else if (backup && existsSync(backup) && sameJson(stripped, JSON.parse(readFileSync(backup, 'utf8')))) {
      writeFileSync(path, readFileSync(backup));
    } else {
      writeJson(path, stripped);
    }
    if (backup) rmSync(backup, { force: true });
  }
  for (const c of [...rec.claude].reverse()) {
    const r = claude(c.undo);
    log(
      r.code === 0
        ? `undone claude ${c.args.slice(0, 3).join(' ')}`
        : `warning: claude ${c.undo.join(' ')}: ${r.stderr.trim()}`,
    );
  }
  for (const f of rec.createdFiles) {
    if (existsSync(f) && readFileSync(f, 'utf8').includes(MARKER)) rmSync(f);
  }
}

function removeDirs(dirs: string[]): void {
  for (const d of [...dirs].reverse()) {
    if (existsSync(d) && readdirSync(d).length === 0) rmdirSync(d);
  }
}

export function uninstall(
  o: InstallOptions,
  run: RunOptions = {},
): { removed: boolean; record: InstallRecord | null } {
  const log = run.log ?? (() => {});
  const recPath = recordPath(o);
  const rec = readRecord(recPath);
  if (!rec) {
    log(`nothing to uninstall: ${recPath} not found`);
    return { removed: false, record: null };
  }
  if (run.dryRun) return { removed: false, record: rec };
  undo(rec, run.claude ?? realClaude, log);
  rmSync(recPath, { force: true });
  removeDirs(rec.createdDirs);
  return { removed: true, record: rec };
}
