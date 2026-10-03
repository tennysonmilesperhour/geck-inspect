import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/supabaseClient', () => ({ supabase: { from: vi.fn() } }));

import { conversationTitle, serializeMessages, MAX_SAVED_MESSAGES } from '../consultantConversations';

describe('serializeMessages', () => {
  it('keeps text turns and turns action cards into text with their outcome', () => {
    const out = serializeMessages([
      { id: 1, role: 'user', content: 'Log 14.5g for Luna' },
      { id: 2, role: 'action', say: 'Here is what I will record.', describe: 'Weight 14.5 g for Luna', status: 'done', normalized: {} },
      { id: 3, role: 'assistant', content: '  ' },
    ]);
    expect(out).toEqual([
      { role: 'user', content: 'Log 14.5g for Luna' },
      { role: 'assistant', content: 'Here is what I will record.\n\n_Weight 14.5 g for Luna (saved)_' },
    ]);
  });

  it('keeps only the most recent messages', () => {
    const many = Array.from({ length: MAX_SAVED_MESSAGES + 5 }, (_, i) => ({ role: 'user', content: `m${i}` }));
    const out = serializeMessages(many);
    expect(out).toHaveLength(MAX_SAVED_MESSAGES);
    expect(out[0].content).toBe('m5');
  });
});

describe('conversationTitle', () => {
  it('uses the first question, shortened', () => {
    expect(conversationTitle([{ role: 'user', content: 'Lilly White x Axanthic odds?' }])).toBe('Lilly White x Axanthic odds?');
    expect(conversationTitle([])).toBe('New chat');
    const long = conversationTitle([{ role: 'user', content: 'Harlequin '.repeat(20) }]);
    expect(long.length).toBeLessThanOrEqual(80);
    expect(long.endsWith('…')).toBe(true);
  });
});
