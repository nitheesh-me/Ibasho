/**
 * Repository file listing shared by the lints. Owner: WP-00 until G0, then WP-10.
 * Uses git (tracked plus untracked, honouring .gitignore) so generated and ignored files are
 * skipped; falls back to a directory walk outside a git checkout.
 */
import { execFileSync } from 'node:child_process';
import { readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

const SKIP_DIRS = new Set(['node_modules', '.git', 'dist', 'coverage', '.turbo', '.lake', 'test-results']);

export function repoRoot(): string {
  try {
    return execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim();
  } catch {
    return process.cwd();
  }
}

/** Repo-relative POSIX paths of every file that is tracked or untracked but not ignored. */
export function listRepoFiles(root: string = repoRoot()): string[] {
  try {
    const out = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard', '-z'], {
      cwd: root,
      encoding: 'utf8',
      maxBuffer: 64 * 1024 * 1024,
    });
    return out
      .split('\0')
      .filter((p) => p.length > 0)
      .filter((p) => {
        try {
          return statSync(join(root, p)).isFile();
        } catch {
          return false; // deleted in the work tree
        }
      })
      .sort();
  } catch {
    const files: string[] = [];
    const walk = (dir: string) => {
      for (const e of readdirSync(dir, { withFileTypes: true })) {
        if (e.isDirectory()) {
          if (!SKIP_DIRS.has(e.name)) walk(join(dir, e.name));
        } else if (e.isFile()) {
          files.push(relative(root, join(dir, e.name)).split(sep).join('/'));
        }
      }
    };
    walk(root);
    return files.sort();
  }
}

/** Minimal glob to RegExp: `**` (any depth), `*` (one segment), `?`, and `{a,b}` alternatives. */
export function globToRegExp(glob: string): RegExp {
  let re = '';
  for (let i = 0; i < glob.length; i++) {
    const c = glob[i]!;
    if (c === '*') {
      if (glob[i + 1] === '*') {
        const slash = glob[i + 2] === '/';
        re += slash ? '(?:.*/)?' : '.*';
        i += slash ? 2 : 1;
      } else {
        re += '[^/]*';
      }
    } else if (c === '?') {
      re += '[^/]';
    } else if (c === '{') {
      const end = glob.indexOf('}', i);
      if (end < 0) throw new Error(`unclosed brace in ${glob}`);
      const alts = glob.slice(i + 1, end).split(',');
      re += `(?:${alts.map((a) => globToRegExp(a).source.slice(1, -1)).join('|')})`;
      i = end;
    } else {
      re += c.replace(/[.+^$()|[\]\\]/g, '\\$&');
    }
  }
  return new RegExp(`^${re}$`);
}

export interface Finding {
  rule: string;
  file: string;
  line: number;
  col: number;
  message: string;
}

export function formatFinding(f: Finding): string {
  return `${f.file}:${f.line}:${f.col} [${f.rule}] ${f.message}`;
}
