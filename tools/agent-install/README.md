# @ibasho/tools-agent-install

`pnpm agent:install [--mode plugin|direct] [--scope user|project] [--dry-run] [--uninstall]` (ARCH 14).

- **Owner:** WP-12 (Agent link). Skeleton created by WP-00 at G0.
- **Layer:** Tool. See ARCHITECTURE 3 and `.dependency-cruiser.cjs`.

## Public API

CLI only.

## Status

Everything. No root `agent:install` script yet; WP-12 requests it through INTERFACES when the installer exists.

Commands: `pnpm --filter @ibasho/tools-agent-install typecheck`, `pnpm --filter @ibasho/tools-agent-install test`.
