-- Fold Geck Answers into the Forum (P7, 29 Sep 2026).
--
-- Geck Answers held 10 questions and 11 answers, all written by Geck Inspect
-- itself as starter content in April (created_by system@geckinspect.com);
-- no member ever asked or answered. The questions were written as if keepers
-- had asked them ("My adult female barely touches her food"), so they move
-- as plain question-and-answer posts from Geck Inspect instead: the question
-- is the title and the accepted answer is the post, reworded where it spoke
-- in the first person, without em dashes, and in plain text (the Forum does
-- not render markdown). The two anecdote answers ("My slowest grower was...")
-- and the one unanswered question are left out rather than presented as
-- members. The questions and answers tables are left as they were.

insert into public.forum_categories (name, description, order_position, is_active)
select 'Questions and Answers',
       'Common crested gecko questions, answered. Ask your own with New post.',
       -80, true
where not exists (select 1 from public.forum_categories where name = 'Questions and Answers');

with cat as (
  select id from public.forum_categories where name = 'Questions and Answers' limit 1
),
src(qid, title, content) as (values
  ('7a79a618-bff6-4b5b-af5c-3dd8034288a8',
   'What are the ideal incubation temperatures for crested gecko eggs?',
   'The sweet spot is 72 to 76°F (22 to 24°C), and room temperature incubation works well for most breeders. Higher temperatures (78°F and up) speed development but raise the risk of problems. Cooler temperatures (68 to 70°F) slow things down and tend to produce strong hatchlings. Avoid temperature swings: consistency matters more than hitting an exact number. Expect 60 to 90 days to hatch, depending on temperature.'),
  ('b37de2d7-e639-4ab5-a0d7-31316657eb0f',
   'Retained shed on the toes: what should I do?',
   'Soak the gecko''s feet in lukewarm water for 10 to 15 minutes to soften the stuck shed, then gently work it off with a damp cotton swab. Never pull hard. To prevent it, mist heavily while the gecko is shedding (the skin looks dull or whitish) and keep humidity at 70 to 80% at night. A humid hide with damp sphagnum moss helps a lot.'),
  ('9d686e6a-0575-46db-9ff7-e254af89b784',
   'What weight should my crested gecko be at 6 months?',
   'At 6 months, 5 to 10 grams is normal, so 8 grams is healthy. Growth varies a lot between individuals, and some slow starters catch up later. As long as the gecko eats regularly and is not losing weight, there is no need to worry. Weigh weekly and watch the trend; the weight chart on each gecko in Geck Inspect shades the typical range for its age. Be concerned if the weight is dropping, or has not moved at all for six weeks or more.'),
  ('e15b31c8-2206-4166-892a-3d7c206bf459',
   'Lilly White genetics: can two Lilly Whites produce a lethal combo?',
   'Yes. Lilly White is an incomplete dominant trait. Pairing two Lilly Whites (LW x LW) can produce "super" Lilly Whites, which are believed to be lethal or severely compromised; most super Lilly White embryos die in the egg. The safe approach is to always pair a Lilly White to a non-Lilly White. That gives about 50% Lilly White and 50% normal offspring, with no risk of the lethal combo. This is well documented, and responsible breeders avoid LW x LW pairings.'),
  ('f417c6b9-113a-4492-ab50-61554923a015',
   'How do I tell if my crested gecko is male or female?',
   'Look at the base of the tail, just above the vent. Males develop a visible hemipenal bulge and preanal pores (small dots in a V shape above the vent). Most can be sexed reliably around 15 to 20 grams, usually 8 to 12 months old. A jeweler''s loupe helps with smaller animals. Below 10 grams it is very difficult and not worth trying, because the handling stresses the animal.'),
  ('a307f8f0-71f6-4d5f-ac45-a621bbd3dbad',
   'What humidity levels should I maintain for crested geckos?',
   'Aim for 60 to 80% humidity on a cycle: mist heavily at night (80% or more), then let it dry down to 50 to 60% during the day. The wet and dry cycle matters, because constant high humidity can cause respiratory problems. A common routine is to mist twice: once in the evening when the lights go off, and once before bed. A good digital hygrometer (not a stick-on dial) is essential; Govee and Inkbird both work well.'),
  ('65bb3eda-47ab-4678-9817-4ba7444e8836',
   'How often should I feed my juvenile crested gecko?',
   'For juveniles under 6 months, offer fresh CGD every evening and remove it the next morning. At 3 months, every day is ideal: their metabolism is high and they need consistent nutrition to grow. Add small crickets (1/4 inch) dusted with calcium and D3 once or twice a week. Pangea and Repashy are both good CGD brands. Consistency is what counts. Some babies take a while to eat visibly, but they will grow if food is always available.'),
  ('99f5e389-3740-4672-b170-e5a925b3ddfb',
   'How do I set up a bioactive enclosure for a crested gecko?',
   'Start with a drainage layer (LECA or hydroballs), then a mesh screen, then a bioactive substrate mix. ABG mix works well: tree fern fiber, peat moss, charcoal, orchid bark and sphagnum. Add springtails and isopods as the clean-up crew. Pothos, bromeliads and ferns do well as plants. Avoid fertilized soil. Josh''s Frogs and BioDude sell ready-made kits if you would rather not build your own. Give the enclosure 4 to 6 weeks to establish before adding the gecko.'),
  ('f5a19e15-122b-4393-ac41-2dc751b88245',
   'When is a crested gecko old enough to breed?',
   'Females should be at least 18 months old and at least 40 grams before breeding. A female at 14 months and 38 grams is close, but wait about four more months and a few more grams. Breeding too young or too light can lead to egg-binding, calcium crashes and stunted growth. Males can breed younger (around 12 months and 25 grams or more), but the female''s readiness is what matters most.')
)
insert into public.forum_posts (title, content, category_id, author_name, created_by, created_date, updated_date)
select s.title, s.content, cat.id, 'Geck Inspect', 'system@geckinspect.com',
       coalesce(q.created_date, now()), now()
from src s
cross join cat
left join public.questions q on q.id::text = s.qid
where not exists (
  select 1 from public.forum_posts p where p.category_id = cat.id and p.title = s.title
);
