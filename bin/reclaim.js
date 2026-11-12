#!/usr/bin/env node
// reclaim — entry point. Keep this file tiny; all logic lives in src/.
import { run } from '../src/cli.js';

run(process.argv.slice(2)).catch((err) => {
  // Last-resort guard so the CLI never dumps a raw stack on users.
  console.error('\n  Unexpected error: ' + (err?.message || err));
  process.exit(1);
});
