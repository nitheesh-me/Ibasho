/**
 * L7: dry run writes nothing; install then uninstall against a temp HOME leaves it byte-identical;
 * unmarked files are never overwritten; a failed install rolls back. `claude` is a recording fake
 * here (the real CLI rewrites its own config files, which no byte-identity test can own).
 */
import { spawnSync } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative, resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  type ClaudeRunner,
  hookCommand,
  type InstallOptions,
  install,
  type Layout,
  MARKER,
  main,
  parseArgs,
  planInstall,
  stripHook,
  uninstall,
} from '../src/index.ts';

const REPO = resolve(import.meta.dirname, '..', '..', '..');
let root: string;
let layout: Layout;

/** Every file (bytes, base64) and directory under a root. */
function snapshot(dir: string): Record<string, string> {
  const out: Record<string, string> = {};
  const walk = (d: string) => {
    for (const f of readdirSync(d).sort()) {
      const p = join(d, f);
      const rel = relative(dir, p);
      if (statSync(p).isDirectory()) {
        out[`${rel}/`] = 'dir';
        walk(p);
      } else out[rel] = readFileSync(p).toString('base64');
    }
  };
  walk(dir);
  return out;
}

function fakeClaude(fail?: (args: string[]) => boolean) {
  const calls: string[][] = [];
  const run: ClaudeRunner = (args) => {
    calls.push(args);
    if (fail?.(args)) return { code: 1, stdout: '', stderr: 'boom' };
    return { code: 0, stdout: 'ok', stderr: '' };
  };
  return { calls, run };
}

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'ibasho-install-'));
  const home = join(root, 'home');
  mkdirSync(join(home, '.claude', 'skills', 'someone-else'), { recursive: true });
  writeFileSync(join(home, '.claude', 'skills', 'someone-else', 'SKILL.md'), '# not ours\n');
  // Odd formatting on purpose: byte identity must not depend on our JSON style.
  writeFileSync(
    join(home, '.claude', 'settings.json'),
    '{\n\t"theme": "dark",\n\t"hooks": {"SubagentStart": [{"matcher": "tldraw-offline", "hooks": [{"type": "command", "command": "node x.mjs"}]}]}\n}\n',
  );
  mkdirSync(join(root, 'project'));
  layout = { repo: REPO, home, project: join(root, 'project'), config: join(home, '.config', 'ibasho') };
});
afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

const opts = (mode: InstallOptions['mode'], scope: InstallOptions['scope'] = 'user'): InstallOptions => ({
  mode,
  scope,
  layout,
});

describe('L7 installer', () => {
  it('--dry-run prints the plan and writes nothing', () => {
    const before = snapshot(root);
    for (const mode of ['plugin', 'direct'] as const) {
      const c = fakeClaude();
      const r = install(opts(mode), { dryRun: true, claude: c.run });
      expect(r.actions.length).toBeGreaterThan(3);
      expect(c.calls).toEqual([]);
    }
    expect(snapshot(root)).toEqual(before);
  });

  it('direct mode installs marked files, the MCP server and the hook, and uninstalls byte-identically', () => {
    const before = snapshot(root);
    const c = fakeClaude();
    install(opts('direct'), { claude: c.run, now: () => new Date('2026-10-11T12:00:00Z') });
    const skill = join(layout.home, '.claude', 'skills', 'ibasho', 'SKILL.md');
    const agent = join(layout.home, '.claude', 'agents', 'ibasho-explorer.md');
    for (const f of [
      skill,
      agent,
      join(layout.config, 'bin', 'iq.mjs'),
      join(layout.config, 'bin', 'inject-context.mjs'),
    ]) {
      expect(readFileSync(f, 'utf8')).toContain(MARKER);
    }
    expect(c.calls).toEqual([
      ['mcp', 'add', 'ibasho', '--scope', 'user', '--', 'node', join(REPO, 'apps', 'mcp', 'src', 'main.ts')],
    ]);
    const settings = JSON.parse(readFileSync(join(layout.home, '.claude', 'settings.json'), 'utf8'));
    expect(settings.theme).toBe('dark');
    expect(settings.hooks.SubagentStart).toHaveLength(2);
    expect(settings.hooks.SubagentStart[1]).toEqual({
      matcher: '^ibasho-explorer$',
      hooks: [{ type: 'command', command: hookCommand(layout) }],
    });
    expect(
      readdirSync(join(layout.home, '.claude')).some((f) => f.startsWith('settings.json.ibasho-backup-')),
    ).toBe(true);
    expect(JSON.parse(readFileSync(join(layout.config, 'install.json'), 'utf8')).repo).toBe(REPO);

    const u = fakeClaude();
    expect(uninstall(opts('direct'), { claude: u.run }).removed).toBe(true);
    expect(u.calls).toEqual([['mcp', 'remove', 'ibasho', '--scope', 'user']]);
    expect(snapshot(root)).toEqual(before);
  });

  it('plugin mode registers the local marketplace and uninstalls byte-identically', () => {
    const before = snapshot(root);
    const c = fakeClaude();
    install(opts('plugin'), { claude: c.run });
    expect(c.calls).toEqual([
      ['plugin', 'marketplace', 'add', join(REPO, 'integrations', 'claude-code'), '--scope', 'user'],
      ['plugin', 'install', 'ibasho@ibasho', '--scope', 'user'],
    ]);
    expect(existsSync(join(layout.config, 'bin', 'iq.mjs'))).toBe(true);
    const u = fakeClaude();
    uninstall(opts('plugin'), { claude: u.run });
    expect(u.calls).toEqual([
      ['plugin', 'uninstall', 'ibasho@ibasho', '--scope', 'user'],
      ['plugin', 'marketplace', 'remove', 'ibasho', '--scope', 'user'],
    ]);
    expect(snapshot(root)).toEqual(before);
  });

  it('project scope writes under the project and creates settings.json only if needed', () => {
    const before = snapshot(root);
    install(opts('direct', 'project'), { claude: fakeClaude().run });
    expect(existsSync(join(layout.project, '.claude', 'skills', 'ibasho', 'SKILL.md'))).toBe(true);
    expect(existsSync(join(layout.project, '.claude', 'settings.json'))).toBe(true);
    uninstall(opts('direct', 'project'), { claude: fakeClaude().run });
    expect(snapshot(root)).toEqual(before);
  });

  it('keeps settings edits made after install, and removes only our hook', () => {
    install(opts('direct'), { claude: fakeClaude().run });
    const path = join(layout.home, '.claude', 'settings.json');
    const s = JSON.parse(readFileSync(path, 'utf8'));
    s.model = 'opus';
    writeFileSync(path, JSON.stringify(s));
    uninstall(opts('direct'), { claude: fakeClaude().run });
    const after = JSON.parse(readFileSync(path, 'utf8'));
    expect(after.model).toBe('opus');
    expect(after.hooks.SubagentStart).toEqual([
      { matcher: 'tldraw-offline', hooks: [{ type: 'command', command: 'node x.mjs' }] },
    ]);
    expect(readdirSync(join(layout.home, '.claude')).filter((f) => f.includes('ibasho-backup'))).toEqual([]);
  });

  it('never overwrites an unmarked file, and rolls back on failure', () => {
    const before = snapshot(root);
    mkdirSync(join(layout.home, '.claude', 'agents'), { recursive: true });
    writeFileSync(join(layout.home, '.claude', 'agents', 'ibasho-explorer.md'), 'mine\n');
    const mid = snapshot(root);
    expect(() => install(opts('direct'), { claude: fakeClaude().run })).toThrow(/not installed by ibasho/);
    expect(snapshot(root)).toEqual(mid);
    rmSync(join(layout.home, '.claude', 'agents'), { recursive: true });
    expect(snapshot(root)).toEqual(before);

    const c = fakeClaude((args) => args[0] === 'mcp');
    expect(() => install(opts('direct'), { claude: c.run })).toThrow(/boom/);
    expect(snapshot(root)).toEqual(before);
  });

  it('refuses a second install and says so when nothing is installed', () => {
    install(opts('plugin'), { claude: fakeClaude().run });
    expect(() => install(opts('plugin'), { claude: fakeClaude().run })).toThrow(/already installed/);
    uninstall(opts('plugin'), { claude: fakeClaude().run });
    expect(uninstall(opts('plugin'), { claude: fakeClaude().run }).removed).toBe(false);
  });

  it('plans every action the docs promise', () => {
    const direct = planInstall(opts('direct')).map((a) => a.kind);
    expect(direct).toContain('settings-hook');
    expect(direct.filter((k) => k === 'claude')).toHaveLength(1);
    expect(planInstall(opts('plugin')).some((a) => a.kind === 'settings-hook')).toBe(false);
  });

  it('stripHook removes only marked commands', () => {
    const s = {
      hooks: {
        SubagentStart: [
          { matcher: 'a', hooks: [{ type: 'command', command: `x # ${MARKER}` }] },
          { matcher: 'b', hooks: [{ type: 'command', command: 'y' }] },
        ],
      },
    };
    expect(stripHook(s)).toEqual({ hooks: { SubagentStart: [s.hooks.SubagentStart[1]] } });
    expect(stripHook({ hooks: { SubagentStart: [s.hooks.SubagentStart[0] as never] } })).toEqual({});
  });

  it('project-scope plugin uninstall targets the project scope', () => {
    const u = fakeClaude();
    install(opts('plugin', 'project'), { claude: fakeClaude().run });
    uninstall(opts('plugin', 'project'), { claude: u.run });
    expect(u.calls).toEqual([
      ['plugin', 'uninstall', 'ibasho@ibasho', '--scope', 'project'],
      ['plugin', 'marketplace', 'remove', 'ibasho', '--scope', 'project'],
    ]);
  });

  it('the hook command keeps a config path with spaces and quotes as one argument', () => {
    const odd = { ...layout, config: join(root, "it's my config") };
    const cmd = hookCommand(odd).replace(/^node /, 'printf %s ');
    const r = spawnSync('sh', ['-c', cmd], { encoding: 'utf8' });
    expect(r.stdout).toBe(`${join(odd.config, 'bin', 'inject-context.mjs')}SubagentStart`);
    expect(hookCommand(odd)).toContain(MARKER);
  });

  it('parses the CLI and prints a dry-run plan', () => {
    expect(parseArgs(['--mode', 'direct', '--scope', 'project', '--dry-run'])).toMatchObject({
      mode: 'direct',
      scope: 'project',
      dryRun: true,
    });
    expect(() => parseArgs(['--mode', 'web'])).toThrow();
    const lines: string[] = [];
    const prev = process.env.HOME;
    process.env.HOME = layout.home;
    try {
      expect(main(['--dry-run', '--mode', 'direct'], (s) => lines.push(s))).toBe(0);
    } finally {
      process.env.HOME = prev;
    }
    expect(lines.join('\n')).toMatch(/dry run, nothing written/);
    expect(lines.join('\n')).toContain('claude mcp add ibasho');
  });
});

describe('plugin files', () => {
  const plugin = join(REPO, 'integrations', 'claude-code');

  it('every shipped file carries the marker and the manifests parse', () => {
    for (const f of [
      'skills/ibasho/SKILL.md',
      'agents/ibasho-explorer.md',
      'bin/iq.mjs',
      'bin/ibasho-mcp.mjs',
      'hooks/inject-context.mjs',
    ]) {
      expect(readFileSync(join(plugin, f), 'utf8'), f).toContain(MARKER);
    }
    for (const f of [
      '.claude-plugin/plugin.json',
      '.claude-plugin/marketplace.json',
      '.mcp.json',
      'hooks/hooks.json',
    ]) {
      expect(() => JSON.parse(readFileSync(join(plugin, f), 'utf8')), f).not.toThrow();
    }
    const skill = readFileSync(join(plugin, 'skills/ibasho/SKILL.md'), 'utf8');
    expect(skill).toMatch(/^---\nname: ibasho\ndescription: /);
  });

  it('claude plugin validate passes (when the CLI is installed)', () => {
    const probe = spawnSync('claude', ['--version'], { encoding: 'utf8' });
    if (probe.error || probe.status !== 0) return;
    for (const target of ['.claude-plugin/plugin.json', '.', 'skills', 'agents']) {
      const r = spawnSync('claude', ['plugin', 'validate', join(plugin, target)], { encoding: 'utf8' });
      expect(r.status, `${target}: ${r.stdout}${r.stderr}`).toBe(0);
    }
  }, 60_000);
});
