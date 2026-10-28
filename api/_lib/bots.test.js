import { describe, expect, it } from 'vitest';
import { classifyAgent } from './bots.js';

// Real user agents from agent_hits rows logged as 'other-bot' before
// 28 Oct 2026, and the name and kind each now gets.
const SEEN = [
  ['Mozilla/5.0 (compatible; ExaSearchBot/1.0; +https://crawler.exa.ai/)', 'ExaSearchBot', 'search'],
  ['Mozilla/5.0 (compatible; ExaUser/1.0; +https://crawler.exa.ai/exauser)', 'ExaUser', 'assistant'],
  ['Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko); compatible; ShapBot/0.1.0', 'ShapBot', 'unknown'],
  ['Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; Reflectionbot/1.0; +https://reflection.ai/bot) Chrome/151.0.0.0 Safari/537.36', 'Reflectionbot', 'training'],
  ['LinkupBot/1.0 (LinkupBot for web indexing; https://linkup.so/bot; bot@linkup.so)', 'LinkupBot', 'search'],
  ['serpstatbot/2.1 (advanced backlink tracking bot; https://serpstatbot.com/; abuse@serpstatbot.com)', 'serpstatbot', 'seo'],
  ['RobautoAgentReadiness/1.0 (+https://robauto.ai/scan) (variant; SupabaseEdgeRuntime/1.77.0)', 'Robauto', 'seo'],
  ['Mozilla/5.0 (compatible; RobautoGrowthAgent/1.0; +https://robauto.ai)', 'Robauto', 'seo'],
  ['JauntBrandBot/1.0 (+https://robauto-buddy-bot.lovable.app; brand resolution index)', 'JauntBrandBot', 'seo'],
  ['Sogou web spider/4.0', 'Sogou', 'search'],
  ['Mozilla/5.0 (compatible; Qwantbot/1.0; +https://help.qwant.com/bot/)', 'Qwantbot', 'search'],
  ['Mozilla/5.0 (compatible;PetalBot;+https://webmaster.petalsearch.com/site/petalbot)', 'PetalBot', 'search'],
  ['meta-webindexer/1.1 (+https://developers.facebook.com/docs/sharing/webmasters/crawler)', 'meta-webindexer', 'search'],
];

describe('classifyAgent', () => {
  it.each(SEEN)('names %s', (ua, agent, kind) => {
    expect(classifyAgent(ua)).toEqual({ agent, kind });
  });

  it('keeps the earlier names and the fallbacks', () => {
    expect(classifyAgent('Mozilla/5.0 (compatible; GPTBot/1.2; +https://openai.com/gptbot)')).toEqual({ agent: 'GPTBot', kind: 'training' });
    expect(classifyAgent('Mozilla/5.0 (compatible; SomeNewBot/1.0)')).toEqual({ agent: 'other-bot', kind: 'unknown' });
    expect(classifyAgent('')).toEqual({ agent: 'empty-ua', kind: 'tool' });
    expect(classifyAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Safari/604.1')).toBeNull();
  });

  it('keeps every name within the 40 characters log_agent_hit stores', async () => {
    const src = (await import('node:fs')).readFileSync(new URL('./bots.js', import.meta.url), 'utf8');
    for (const [, name] of src.matchAll(/^\s*\['([^']+)', '[a-z]+'\],?$/gm)) expect(name.length, name).toBeLessThanOrEqual(40);
  });
});
