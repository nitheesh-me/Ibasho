/**
 * `pnpm agent:install [--mode plugin|direct] [--scope user|project] [--dry-run] [--uninstall]`
 * (ARCH 14). Owner: WP-12. Run from the repo: `node tools/agent-install/src/cli.ts --dry-run`.
 */
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { install, readRecord, recordPath, uninstall } from './apply.ts';
import { describe, type InstallOptions, type Layout, type Mode, type Scope } from './plan.ts';

export interface CliArgs {
  mode: Mode;
  scope: Scope;
  dryRun: boolean;
  uninstall: boolean;
  help: boolean;
}

export const USAGE = `Usage: pnpm agent:install [--mode plugin|direct] [--scope user|project] [--dry-run] [--uninstall]

  --mode plugin   (default) add integrations/claude-code as a local marketplace and install ibasho@ibasho
  --mode direct   copy the skill and subagent into .claude/, claude mcp add ibasho, merge the SubagentStart hook
  --scope user    (default) ~/.claude;  --scope project: ./.claude and project MCP config
  --dry-run       print the plan; write nothing, run nothing
  --uninstall     remove only what the installer recorded (files marked installed-by:ibasho)`;

export function parseArgs(argv: string[]): CliArgs {
  const a: CliArgs = { mode: 'plugin', scope: 'user', dryRun: false, uninstall: false, help: false };
  for (let i = 0; i < argv.length; i++) {
    const t = argv[i];
    const val = () => {
      const v = argv[++i];
      if (v === undefined) throw new Error(`${t} needs a value`);
      return v;
    };
    switch (t) {
      case '--mode': {
        const v = val();
        if (v !== 'plugin' && v !== 'direct') throw new Error(`--mode must be plugin or direct, got ${v}`);
        a.mode = v;
        break;
      }
      case '--scope': {
        const v = val();
        if (v !== 'user' && v !== 'project') throw new Error(`--scope must be user or project, got ${v}`);
        a.scope = v;
        break;
      }
      case '--dry-run':
        a.dryRun = true;
        break;
      case '--uninstall':
        a.uninstall = true;
        break;
      case '-h':
      case '--help':
        a.help = true;
        break;
      case '--':
        break;
      default:
        throw new Error(`unknown argument ${t}\n\n${USAGE}`);
    }
  }
  return a;
}

export function defaultLayout(env: Record<string, string | undefined> = process.env): Layout {
  const home = env.HOME ?? homedir();
  const here = dirname(fileURLToPath(import.meta.url));
  return {
    repo: resolve(here, '..', '..', '..'),
    home,
    project: env.INIT_CWD ?? process.cwd(),
    config:
      env.IBASHO_CONFIG_DIR ??
      (env.XDG_CONFIG_HOME ? join(env.XDG_CONFIG_HOME, 'ibasho') : join(home, '.config', 'ibasho')),
  };
}

export function main(
  argv: string[],
  out: (s: string) => void = (s) => process.stdout.write(`${s}\n`),
): number {
  let args: CliArgs;
  try {
    args = parseArgs(argv);
  } catch (e) {
    out(e instanceof Error ? e.message : String(e));
    return 2;
  }
  if (args.help) {
    out(USAGE);
    return 0;
  }
  const opts: InstallOptions = { mode: args.mode, scope: args.scope, layout: defaultLayout() };
  try {
    if (args.uninstall) {
      const rec = readRecord(recordPath(opts));
      if (args.dryRun) {
        out(rec ? `Would uninstall (${rec.mode}, ${rec.scope}):` : 'Nothing installed by ibasho.');
        if (rec) {
          for (const f of rec.createdFiles) out(`  remove  ${f}`);
          for (const c of rec.claude) out(`  run     claude ${c.undo.join(' ')}`);
          if (rec.settings) out(`  restore ${rec.settings.path}`);
          for (const d of [...rec.createdDirs].reverse()) out(`  rmdir   ${d} (if empty)`);
        }
        return 0;
      }
      const r = uninstall(opts, { log: out });
      out(r.removed ? 'Uninstalled the Ibasho agent link.' : 'Nothing installed by ibasho.');
      return 0;
    }
    const { actions } = install(opts, { dryRun: args.dryRun, log: out });
    if (args.dryRun) {
      out(`Plan (${args.mode}, ${args.scope}); dry run, nothing written:`);
      for (const a of actions) out(`  ${describe(a)}`);
      return 0;
    }
    out(
      `Installed the Ibasho agent link (${args.mode}, ${args.scope}). Start a new Claude Code session; try "explore the Ibasho home gh1".`,
    );
    return 0;
  } catch (e) {
    out(`agent:install: ${e instanceof Error ? e.message : String(e)}`);
    return 1;
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = main(process.argv.slice(2));
}
