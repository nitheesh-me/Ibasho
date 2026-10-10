# @ibasho/tools-agent-install

`pnpm agent:install [--mode plugin|direct] [--scope user|project] [--dry-run] [--uninstall]` (ARCH 14).

- **Owner:** WP-12 (Agent link).
- **Layer:** Tool.

## Use

```bash
node tools/agent-install/src/cli.ts --dry-run                  # the plan; writes nothing, runs nothing
node tools/agent-install/src/cli.ts                            # plugin mode, user scope
node tools/agent-install/src/cli.ts --mode direct --scope project
node tools/agent-install/src/cli.ts --uninstall
pnpm --filter @ibasho/tools-agent-install agent:install -- --dry-run
```

- **plugin**: `claude plugin marketplace add <repo>/integrations/claude-code`, `claude plugin install ibasho@ibasho`.
- **direct**: copies the skill to `.claude/skills/ibasho/`, the subagent to `.claude/agents/ibasho-explorer.md`, runs `claude mcp add ibasho -- node <repo>/apps/mcp/src/main.ts`, and merges a SubagentStart hook into `.claude/settings.json` after a timestamped backup next to it.
- Both copy `iq.mjs` (and in direct mode the hook script) to `~/.config/ibasho/bin/` and record everything in `~/.config/ibasho/install.json`.

Safety: every file written carries `installed-by:ibasho`; an existing file without the marker is never overwritten; the hook command ends with `# installed-by:ibasho` so uninstall removes only that entry; a failure mid-install rolls back. Uninstall restores the settings file from its backup bytes when nothing else changed in it, so install then uninstall leaves HOME byte-identical.

## Public API

`planInstall`, `install`, `uninstall`, `stripHook`, `parseArgs`, `main`, `describe`, `MARKER`. `ClaudeRunner` is injectable (tests use a recording fake).

## Status

Real. Tests: 18 (L7 dry run, byte-identical install and uninstall in both modes and both scopes, settings edits kept, unmarked files refused, rollback, CLI; plugin files carry the marker; `claude plugin validate` when the CLI exists; the hook, `iq` and MCP launcher run as real processes).

Not done here: the root `agent:install` script (root `package.json`, WP-00, requested on the blackboard). The real `claude` CLI was not run against the user's `~/.claude` in this wave.

Commands: `pnpm --filter @ibasho/tools-agent-install typecheck`, `pnpm --filter @ibasho/tools-agent-install test`.
