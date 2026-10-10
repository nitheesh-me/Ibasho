/**
 * Install plan for the Ibasho agent link (ARCH 14). Owner: WP-12.
 *
 * A plan is a list of plain actions, printed by `--dry-run` and executed by `apply.ts`. Two
 * modes, like the tldraw offline skill:
 *
 * - `plugin`: register `integrations/claude-code` as a local marketplace and install the plugin.
 * - `direct`: copy the skill and the subagent into `.claude/`, register the MCP server with
 *   `claude mcp add`, and merge the SubagentStart hook into `settings.json` (with a backup).
 *
 * Both modes copy the `iq` helper (and, direct mode, the hook script) to `~/.config/ibasho/bin/`
 * and record what they did in `~/.config/ibasho/install.json`, which `--uninstall` reads.
 * Every file written carries the `installed-by:ibasho` marker; uninstall removes only marked
 * files and the settings entries whose command carries the marker.
 */
import { join } from 'node:path';

export const MARKER = 'installed-by:ibasho';
export const MCP_NAME = 'ibasho';
export const PLUGIN_ID = 'ibasho@ibasho';
export const MARKETPLACE = 'ibasho';
export const AGENT_NAME = 'ibasho-explorer';

export type Mode = 'plugin' | 'direct';
export type Scope = 'user' | 'project';

export interface Layout {
  /** Repository root (holds `integrations/claude-code` and `apps/mcp`). */
  repo: string;
  /** HOME used for every user-scope path. */
  home: string;
  /** Project root for project scope. */
  project: string;
  /** `~/.config/ibasho` (or `$IBASHO_CONFIG_DIR`). */
  config: string;
}

export type Action =
  | { kind: 'mkdir'; path: string }
  | { kind: 'copy'; from: string; to: string }
  | { kind: 'claude'; args: string[]; undo: string[] }
  | { kind: 'settings-hook'; settings: string; matcher: string; command: string }
  | { kind: 'record'; path: string };

export interface InstallOptions {
  mode: Mode;
  scope: Scope;
  layout: Layout;
}

export function pluginDir(l: Layout): string {
  return join(l.repo, 'integrations', 'claude-code');
}

export function mcpEntry(l: Layout): string {
  return join(l.repo, 'apps', 'mcp', 'src', 'main.ts');
}

/** `.claude` directory for a scope. */
export function claudeDir(scope: Scope, l: Layout): string {
  return scope === 'user' ? join(l.home, '.claude') : join(l.project, '.claude');
}

/** POSIX single-quote a word, so a config path with spaces or quotes stays one argument. */
export function shellQuote(s: string): string {
  return `'${s.replace(/'/g, `'\\''`)}'`;
}

export function hookCommand(l: Layout): string {
  // The trailing shell comment is the marker uninstall looks for.
  return `node ${shellQuote(join(l.config, 'bin', 'inject-context.mjs'))} SubagentStart # ${MARKER}`;
}

export function planInstall(o: InstallOptions): Action[] {
  const l = o.layout;
  const src = pluginDir(l);
  const bin = join(l.config, 'bin');
  const actions: Action[] = [
    { kind: 'mkdir', path: l.config },
    { kind: 'mkdir', path: bin },
    { kind: 'copy', from: join(src, 'bin', 'iq.mjs'), to: join(bin, 'iq.mjs') },
  ];
  if (o.mode === 'plugin') {
    actions.push(
      {
        kind: 'claude',
        args: ['plugin', 'marketplace', 'add', src, '--scope', o.scope],
        undo: ['plugin', 'marketplace', 'remove', MARKETPLACE, '--scope', o.scope],
      },
      {
        kind: 'claude',
        args: ['plugin', 'install', PLUGIN_ID, '--scope', o.scope],
        undo: ['plugin', 'uninstall', PLUGIN_ID, '--scope', o.scope],
      },
    );
  } else {
    const cd = claudeDir(o.scope, l);
    actions.push(
      { kind: 'copy', from: join(src, 'hooks', 'inject-context.mjs'), to: join(bin, 'inject-context.mjs') },
      { kind: 'mkdir', path: cd },
      { kind: 'mkdir', path: join(cd, 'skills') },
      { kind: 'mkdir', path: join(cd, 'skills', 'ibasho') },
      {
        kind: 'copy',
        from: join(src, 'skills', 'ibasho', 'SKILL.md'),
        to: join(cd, 'skills', 'ibasho', 'SKILL.md'),
      },
      { kind: 'mkdir', path: join(cd, 'agents') },
      {
        kind: 'copy',
        from: join(src, 'agents', `${AGENT_NAME}.md`),
        to: join(cd, 'agents', `${AGENT_NAME}.md`),
      },
      {
        kind: 'claude',
        args: ['mcp', 'add', MCP_NAME, '--scope', o.scope, '--', 'node', mcpEntry(l)],
        undo: ['mcp', 'remove', MCP_NAME, '--scope', o.scope],
      },
      {
        kind: 'settings-hook',
        settings: join(cd, 'settings.json'),
        matcher: `^${AGENT_NAME}$`,
        command: hookCommand(l),
      },
    );
  }
  actions.push({ kind: 'record', path: join(l.config, 'install.json') });
  return actions;
}

export function describe(a: Action): string {
  switch (a.kind) {
    case 'mkdir':
      return `mkdir   ${a.path} (if missing)`;
    case 'copy':
      return `copy    ${a.from}\n     to ${a.to}`;
    case 'claude':
      return `run     claude ${a.args.join(' ')}`;
    case 'settings-hook':
      return `merge   SubagentStart hook (matcher ${a.matcher}) into ${a.settings} (backup first)`;
    case 'record':
      return `write   ${a.path} (what was installed, for --uninstall)`;
  }
}
