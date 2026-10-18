// The Anthropic request Morph ID sends must not change while its speed is
// worked on (17 Oct 2026). The model reads the instructions, the tool schema
// and the content blocks before it answers, so any change there can move a
// prediction, and only a paid graded run could show it did not.
//
// __fixtures__/morphRequestSnapshot.json was captured from index.ts as it
// stood before any of that work, by running its own callClaude on the inputs
// in morphRequestInputs.js. This test builds the same requests from
// request.ts and compares them byte for byte. Only max_tokens may differ: the
// model never sees it (it is the most the answer may cost), and it was
// raised on purpose (morph-upstream.ts, requestShape).
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { buildClaudeRequest } from '../../../supabase/functions/recognize-gecko-morph/request.ts';
import { SNAPSHOT_CASES } from './morphRequestInputs.js';

const SNAPSHOT = JSON.parse(readFileSync(new URL('./__fixtures__/morphRequestSnapshot.json', import.meta.url), 'utf8'));

// Everything the model reads, in the order it was sent.
const withoutMaxTokens = (body) => {
  const { max_tokens: _maxTokens, ...rest } = body;
  return JSON.stringify(rest);
};

describe('Morph ID request snapshot', () => {
  it.each(SNAPSHOT_CASES.map((c) => [c.name, c]))('%s: model, tools, tool_choice and messages are unchanged', (name, input) => {
    const before = JSON.parse(SNAPSHOT[name]);
    const { body } = buildClaudeRequest({ bank: [], ...input });
    expect(withoutMaxTokens(body)).toBe(withoutMaxTokens(before));
    // Same keys in the same order, so the JSON sent differs only in max_tokens.
    expect(Object.keys(body)).toEqual(Object.keys(before));
  });

  it('raises only the ceiling for answers: 4096 on Sonnet 4.6, 12000 on the newer models', () => {
    const [twoPhotos, , newer] = SNAPSHOT_CASES;
    expect(JSON.parse(SNAPSHOT[twoPhotos.name]).max_tokens).toBe(3000);
    expect(buildClaudeRequest({ bank: [], ...twoPhotos }).body.max_tokens).toBe(4096);
    expect(buildClaudeRequest({ bank: [], ...newer }).body.max_tokens).toBe(12000);
  });

  it('builds the request without the few-shot bank, as production does', () => {
    const { body } = buildClaudeRequest({ bank: [], ...SNAPSHOT_CASES[1] });
    const blocks = body.messages[0].content;
    expect(blocks[0].type).toBe('text');
    expect(blocks[0].cache_control).toEqual({ type: 'ephemeral' });
    expect(blocks.filter((b) => b.type === 'image')).toHaveLength(1);
  });
});
