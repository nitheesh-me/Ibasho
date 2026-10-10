# integrations/claude-code

Claude Code plugin for the Ibasho agent link (ARCH 14), modelled on the tldraw offline skill: a local server with a per-launch token file, a skill, a subagent, a SubagentStart hook, a small helper and an installer.

- **Owner:** WP-12 (Agent link).
- Not a workspace package (no `package.json`).

## Contents

| Path | What |
|---|---|
| `.claude-plugin/plugin.json` | Plugin manifest (`ibasho` 0.1.0) |
| `.claude-plugin/marketplace.json` | Local marketplace `ibasho` listing this folder |
| `.mcp.json` | MCP server `ibasho`: `node ${CLAUDE_PLUGIN_ROOT}/bin/ibasho-mcp.mjs` |
| `bin/ibasho-mcp.mjs` | Launcher: finds the checkout (`$IBASHO_REPO`, `~/.config/ibasho/install.json`, or walking up) and starts `apps/mcp/src/main.ts` |
| `bin/iq.mjs` | Bridge helper: `node iq.mjs GET /agent/sessions`; re-reads port and token from `server.json` on every call |
| `hooks/hooks.json`, `hooks/inject-context.mjs` | SubagentStart for `ibasho-explorer`: injects base URL, token, open tabs, pairing code and the `iq` path; never blocks a launch |
| `skills/ibasho/SKILL.md` | The skill: ground rules, headless workflow, ops, live app, `iq`, errors and recovery |
| `agents/ibasho-explorer.md` | Subagent for multi-step home exploration |
| `evals/` | Three `claude plugin eval` cases (L8) |

## Install

From the repo root:

```bash
node tools/agent-install/src/cli.ts                 # plugin mode, user scope
node tools/agent-install/src/cli.ts --mode direct   # skill + subagent + claude mcp add + hook
node tools/agent-install/src/cli.ts --dry-run       # print the plan only
node tools/agent-install/src/cli.ts --uninstall     # remove only what was installed
```

Or by hand, inside Claude Code: `/plugin marketplace add <repo>/integrations/claude-code`, then `/plugin install ibasho@ibasho`, with `IBASHO_REPO` set to the checkout.

Try it in place without installing: `claude --plugin-dir integrations/claude-code`.

## Status

Real and validated: `claude plugin validate` passes on the manifest, the marketplace, `skills/` and `agents/` (strict); `claude --plugin-dir . plugin details ibasho` lists 1 skill, 1 agent, 1 hook and 1 MCP server. The hook, `iq` and the launcher are tested as real processes in `tools/agent-install/test/scripts.test.ts`.

Waiting on others: live tools need the companion mount (WP-05) and Settings > Agent link (WP-08); evals need the engine (WP-02).
