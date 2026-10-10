/**
 * Timer globals shared by browsers, workers and Node. `@ibasho/ai` compiles without DOM or Node
 * types (it runs in all three), so only these two are declared.
 */
declare function setTimeout(callback: () => void, ms: number): unknown;
declare function clearTimeout(handle: unknown): void;
