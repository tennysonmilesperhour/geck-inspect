-- Relabel stored bot visits that were logged as 'other-bot' before the bots
-- they came from were named in api/_lib/bots.js (28 Oct 2026). About 4,600
-- of the last 28 days' hits, 42% of bot traffic, sat under 'other-bot':
-- mostly ExaSearchBot, ShapBot, Reflectionbot, LinkupBot and Robauto's
-- scanners. The rules below are the ones bots.js now applies, in the same
-- order (the first match wins, case-insensitive). Data only. Safe to run
-- more than once: it only touches rows still labelled 'other-bot'.

update public.agent_hits h
   set agent = r.agent,
       kind = r.kind
  from (
    select h2.id,
           (array_agg(m.agent order by m.ord))[1] as agent,
           (array_agg(m.kind order by m.ord))[1] as kind
      from public.agent_hits h2
      join (values
             (1, 'exauser', 'ExaUser', 'assistant'),
             (2, 'exasearchbot', 'ExaSearchBot', 'search'),
             (3, 'linkupbot', 'LinkupBot', 'search'),
             (4, 'meta-webindexer', 'meta-webindexer', 'search'),
             (5, 'qwantbot', 'Qwantbot', 'search'),
             (6, 'sogou', 'Sogou', 'search'),
             (7, 'petalbot', 'PetalBot', 'search'),
             (8, 'kagi-fetcher', 'kagi-fetcher', 'assistant'),
             (9, 'reflectionbot', 'Reflectionbot', 'training'),
             (10, 'shapbot', 'ShapBot', 'unknown'),
             (11, 'serpstatbot', 'serpstatbot', 'seo'),
             (12, 'jauntbrandbot', 'JauntBrandBot', 'seo'),
             (13, 'robauto', 'Robauto', 'seo')
           ) as m(ord, needle, agent, kind)
        on strpos(lower(coalesce(h2.ua, '')), m.needle) > 0
     where h2.agent = 'other-bot'
     group by h2.id
  ) r
 where h.id = r.id
   and h.agent = 'other-bot';
