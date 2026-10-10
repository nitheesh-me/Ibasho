/**
 * `@ibasho/tools-agent-install`: installer for the Ibasho agent link (ARCH 14). Owner: WP-12.
 * CLI: `node tools/agent-install/src/cli.ts [--mode plugin|direct] [--scope user|project] [--dry-run] [--uninstall]`.
 */
export {
  type ClaudeResult,
  type ClaudeRunner,
  type InstallRecord,
  install,
  readRecord,
  realClaude,
  recordPath,
  stripHook,
  uninstall,
} from './apply.ts';
export { type CliArgs, defaultLayout, main, parseArgs, USAGE } from './cli.ts';
export {
  type Action,
  claudeDir,
  describe,
  hookCommand,
  type InstallOptions,
  type Layout,
  MARKER,
  type Mode,
  planInstall,
  type Scope,
} from './plan.ts';
