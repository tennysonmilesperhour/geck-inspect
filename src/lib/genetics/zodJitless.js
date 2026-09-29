// The genetics engine builds zod schemas as soon as it is imported. zod's
// first schema runs a one-time `new Function("")` probe to see whether the
// page allows eval; the probe is caught, but under the Content Security
// Policy it files a "script-src blocked eval" report on every calculator
// load. jitless mode skips the probe and uses the same non-eval parser the
// app already falls back to. Import this before the engine.
import { config } from 'zod';

config({ jitless: true });
