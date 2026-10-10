/** Entry point of `pnpm verify` (see run.ts). Owner: WP-04. */
import { main } from './run.ts';

process.exitCode = main(process.argv.slice(2));
