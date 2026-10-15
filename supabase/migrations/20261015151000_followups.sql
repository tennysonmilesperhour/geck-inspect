-- Follow-ups from the final review of round 1 (16 Oct 2026).
--
-- 20261015120000_ownership_checks.sql and 20261015130000_comms_and_exposure.sql
-- closed the holes the comprehensive review found. Their final review left
-- eight smaller points. The six that need the database are fixed here;
-- the other two (the hatch alert retry and the collection invite resend)
-- are app changes in the same commit. Every function redefined here
-- starts from the round 1 definition with only the lines named in its
-- section changed.
--
-- Safe to run more than once: functions are create-or-replace, policies
-- are dropped before they are created, and the column grants only change
-- what still needs changing.
--
-- Tests: supabase/tests/followups_regressions.sql
--
--  1. The breeder page trust panel for signed-out visitors.
--  2. Display names with "&", "," or "." in notifications.
--  3. Team words spelled with digits or joined to other words.
--  4. A plain message insert could reach any address.
--  5. " system" and "system\n" message types.
--  6. Member emails readable by signed-out visitors on seven more tables.

-- =====================================================================
-- 1. The breeder page trust panel for signed-out visitors
-- =====================================================================
--
-- Before: the Track record panel on /Breeder/<slug> worked from the
-- owner's email (breeder_profiles.created_by), then looked up their
-- profile, geckos, weigh-ins, ownership records and reviews. Round 1 took
-- that email away from signed-out visitors (rightly), so the panel
-- vanished for exactly the people it is for: buyers who have not signed
-- up yet.
-- After: one function answers the panel from the page's slug and returns
-- only the numbers the panel shows, never an email or a profile row. It
-- answers only for a visible breeder page whose owner has a public,
-- visible profile (the same rule as breeder_page_owner), and it counts
-- only records a visitor could already see one by one:
--   * geckos: the owner's public geckos that are not hidden by moderation;
--   * weigh-ins and ownership records: the owner's records on animals
--     whose passport is public;
--   * reviews: verified reviews only (from a claimed transfer), the same
--     ones the page lists under the panel;
--   * account age in whole months, not the sign-up date itself.
create or replace function public.breeder_page_trust(p_slug text)
returns table (
  account_age_months integer,
  animals_tracked integer,
  weight_logs_count integer,
  ownership_transfers integer,
  review_count integer,
  avg_rating numeric,
  is_verified_breeder boolean,
  is_featured_breeder boolean
)
language sql
stable
security definer
set search_path to ''
as $function$
  with owner as (
    select p.email,
           p.created_date,
           coalesce(p.is_featured_breeder, false) as featured,
           coalesce(b.is_verified, false) as verified,
           coalesce(b.user_id,
                    case when p.id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
                         then p.id::uuid end) as review_user_id
      from public.breeder_profiles b
      join public.profiles p on p.email = b.created_by
     where b.custom_slug = p_slug
       and coalesce(b.moderation_hidden, false) = false
       and p.is_public_profile = true
       and p.moderation_hidden = false
     limit 1
  ),
  shown as (
    -- Animals with a public passport, the ones whose records anyone can read.
    select g.id
      from public.geckos g, owner o
     where g.created_by = o.email
       and g.is_public = true
       and g.moderation_hidden = false
       and g.passport_code is not null
  ),
  ratings as (
    select r.rating
      from public.breeder_reviews r, owner o
     where o.review_user_id is not null
       and r.reviewed_user_id = o.review_user_id
       and r.is_verified = true
       and r.rating is not null
  )
  select greatest(0, floor(extract(epoch from (now() - o.created_date)) / (86400 * 30.44)))::integer,
         (select count(*) from public.geckos g
           where g.created_by = o.email and g.is_public = true and g.moderation_hidden = false)::integer,
         (select count(*) from public.weight_records w
           where w.created_by = o.email and w.gecko_id in (select id from shown))::integer,
         (select count(*) from public.ownership_records r
           where r.created_by = o.email and r.animal_id in (select id from shown))::integer,
         (select count(*) from ratings)::integer,
         (select round(avg(rating)::numeric, 1) from ratings),
         o.verified,
         o.featured
    from owner o;
$function$;

comment on function public.breeder_page_trust(text) is
  'The Track record numbers for a visible breeder page, by slug: account age in months, public animals, weigh-ins and ownership records on public passports, verified review count and average, verified and featured flags. Never returns an email. For signed-out visitors, who cannot read the owner''s email.';

revoke all on function public.breeder_page_trust(text) from public;
grant execute on function public.breeder_page_trust(text) to anon, authenticated, service_role;

-- =====================================================================
-- 2 and 3. Display names in member-to-member notifications
-- =====================================================================
--
-- Before (round 1): a name reached another member's email and push only
-- when it held letters, digits, spaces, apostrophes and hyphens. Ordinary
-- business names with "&", "," or "." (7 of the 128 named profiles in
-- production, for example "Pangea & Co. Geckos") showed as "A Geck
-- Inspect member". And the team-word check looked at whole words only, so
-- "Supp0rt Team", "Adm1n", "0fficial Notice" and "GeckSupport" all went
-- out unchanged from the official sender.
-- After:
--   * "&" and "," are allowed anywhere. "." is allowed only before a space
--     or at the end of the name ("Co.", "Jr."), so a web address
--     ("bit.ly", "evil.com") still cannot form. Everything the round 1
--     review proved blocked (slashes, brackets, "@", fullwidth and
--     Cyrillic look-alikes, dotless i, Greek) is still outside the
--     allowed characters.
--   * Before the team-word check, digits that stand in for letters are
--     folded (0 to o, 1 to i, 3 to e, 4 to a, 5 to s, 7 to t), and i and l
--     count as the same letter, so "Adm1n" and "Officia1" both read as the
--     word. A word that ends in one of the team words ("GeckSupport"), or
--     starts with one followed by a team-like word ("Securityteam",
--     "SupportDesk"), is caught too. Words that merely start with one
--     ("Supportive", "Staffordshire") are still fine. Letters split only
--     by punctuation or a digit ("Su&pport", "Supp-ort", "Ad'min") count
--     as one word, so the newly allowed "&" and "," cannot split a team
--     word apart.
--   * Names with seven or more digits (a phone number) fall back too.
create or replace function public._member_notification(
  p_sender_email text,
  p_recipient_email text,
  p_type text,
  p_post_id text default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path to ''
as $function$
declare
  v_profile_id text;
  v_name text;
  v_letters text;
  v_words text;
  v_encoded text;
  v_post_id text;
  -- The words that read as the team, with i and l folded together (see
  -- v_words below), so "official" is written "officiai" and "billing"
  -- "biiiing".
  v_team constant text := 'support|admin|administrator|administration|security|biiiing|officiai|staff|moderator|moderation';
  v_suffix constant text := 'team|desk|crew|center|centre|office|dept|heip|squad|group|notice|aiert|service|services|account|repiy|maii|info';
begin
  -- The sender's public name. It is the one piece of member text that
  -- reaches another member's email and push from the official sender, so
  -- it is used only when it is plainly a name (an allowlist, not a list
  -- of bad patterns):
  --   * only ASCII or Latin-1 letters, digits, spaces, apostrophes
  --     (straight or curly), hyphens, "&" and ","; and "." only before a
  --     space or at the end. So no slashes, brackets, "@", fullwidth
  --     punctuation or Cyrillic look-alikes, and no web address in any
  --     spelling;
  --   * at most 40 characters, and fewer than seven digits;
  --   * not reading as the team: with every non-letter removed (and the
  --     usual digit and accent look-alikes folded), it does not contain
  --     "geckinspect", and no word in it is, ends with, or starts a
  --     team-like compound with the words support, admin, security,
  --     billing, official, staff or moderator.
  -- Anything else becomes "A Geck Inspect member".
  select p.id,
         coalesce(nullif(btrim(p.business_name), ''), nullif(btrim(p.full_name), ''), nullif(btrim(p.breeder_name), ''))
    into v_profile_id, v_name
    from public.profiles p
   where p.email = p_sender_email
   limit 1;
  v_name := regexp_replace(btrim(coalesce(v_name, '')), ' {2,}', ' ', 'g');
  -- Accents and digit look-alikes folded; 1 and l both become i.
  v_letters := translate(lower(v_name),
                 'àáâãäåèéêëìíîïòóôõöøùúûüýÿñç013457l',
                 'aaaaaaeeeeiiiioooooouuuuyyncoieasti');
  -- The same, split into words for the team-word check. Only a space
  -- separates words. Letters split by anything else ("&", ",", ".", a
  -- hyphen, an apostrophe or a leftover digit) are joined first, because
  -- "Su&pport", "Supp-ort", "Ad'min" and "Supp2ort" all read as the word
  -- to the person getting the email. Real names keep their spaces
  -- ("Pangea & Co. Geckos" stays three words; "O'Brien" becomes "obrien").
  v_words := regexp_replace(v_letters, '([a-z])[^a-z ]+(?=[a-z])', '\1', 'g');
  v_words := btrim(regexp_replace(v_words, '[^a-z]+', ' ', 'g'));
  v_letters := regexp_replace(v_letters, '[^a-z]', '', 'g');
  if v_name !~ '^[A-Za-z0-9À-ÖØ-öø-ÿ ''’&,.-]{1,40}$'
     or v_name ~ '\.[^ ]'
     or v_name !~ '[A-Za-z0-9À-ÖØ-öø-ÿ]'
     or length(regexp_replace(v_name, '[^0-9]', '', 'g')) >= 7
     or v_letters like '%geckinspect%'
     or regexp_replace(lower(v_name), '[^a-z]', '', 'g') like '%geckinspect%'
     or v_name ~* '\m(support|admin|administrator|security|billing|official|staff|moderator)s?\M'
     or v_words ~ ('(^| )[a-z]*(' || v_team || ')s?( |$)')
     or v_words ~ ('(^| )(' || v_team || ')s?(' || v_suffix || ')s?( |$)') then
    v_name := 'A Geck Inspect member';
  end if;

  -- Ids in a link must be plain ids. forum_posts.id and profiles.id are
  -- chosen by the client, so anything else (quotes, angle brackets, "&")
  -- links to Notifications instead.
  if v_profile_id !~ '^[A-Za-z0-9_-]{1,64}$' then
    v_profile_id := null;
  end if;
  v_post_id := case when p_post_id ~ '^[A-Za-z0-9_-]{1,64}$' then p_post_id end;

  -- Messages opens a conversation from ?recipient=<email>. The recipient
  -- already sees the sender's address on the message itself.
  v_encoded := replace(replace(replace(replace(replace(replace(replace(replace(
                 p_sender_email, '%', '%25'), '+', '%2B'), '&', '%26'), '#', '%23'),
                 '?', '%3F'), '=', '%3D'), ' ', '%20'), '@', '%40');

  return jsonb_build_object(
    'content', case p_type
      when 'new_message'       then v_name || ' sent you a message.'
      when 'new_comment'       then v_name || ' commented on your forum post.'
      when 'new_reply'         then v_name || ' replied to your comment.'
      when 'new_follower'      then v_name || ' started following you.'
      when 'new_gecko_listing' then v_name || ' listed a new gecko.'
      when 'new_breeding_plan' then v_name || ' started a new breeding project.'
      else v_name || ' sent you a notification.'
    end,
    'link', case
      when p_type = 'new_message' then '/Messages?recipient=' || v_encoded
      when p_type in ('new_comment', 'new_reply') and v_post_id is not null then '/ForumPost?id=' || v_post_id
      when p_type in ('new_comment', 'new_reply') then '/Notifications'
      when v_profile_id is not null then '/PublicProfile?userId=' || v_profile_id
      else '/Notifications'
    end,
    -- post_id stays as given (data only, never part of a link): the
    -- 10-minute repeat check in member_notification_template matches on it.
    'metadata', jsonb_strip_nulls(jsonb_build_object('from_profile_id', v_profile_id, 'post_id', p_post_id))
  );
end;
$function$;

-- create or replace keeps round 1's grants; stated again so this file
-- alone says who may run it (nobody through the API).
revoke all on function public._member_notification(text, text, text, text) from public, anon, authenticated;

-- =====================================================================
-- 4 and 5. Who a member's plain message insert may reach
-- =====================================================================
--
-- Before: send_direct_message_to_profile only messages public profiles and
-- allows 20 new conversations an hour, but a plain insert into
-- direct_messages (the table is reachable through the API) only checked
-- that the sender was the caller. Any member could message any address,
-- private members included, as often as they liked, and each message
-- unlocks a "sent you a message" notification. The guard also compared
-- message_type exactly, so " system", "system " and "system\n" got past
-- the "only Geck Inspect sends system messages" rule.
-- After: a member's own insert reaches someone only when
--   * the recipient has a public, visible profile (the people the
--     Messages directory lists), or
--   * the recipient has messaged the sender before (replies keep working
--     with private members, the team and the support inbox), or
--   * the recipient has a public gecko on view (the Message button on a
--     gecko page, a marketplace card and a passport's "Message the
--     seller" all write to the gecko's owner, who chose to show that
--     animal; 16 private members have one today);
-- and admins can still message anyone. A new conversation counts toward
-- the same 20 an hour as send_direct_message_to_profile. message_type is
-- trimmed of spaces and control characters and lower-cased before the
-- system check, and stored that way, so the app's exact "system" test
-- and the guard always agree.

-- Whether the signed-in caller may write a message to this address. The
-- insert policy calls it as the member, so the member needs EXECUTE. It
-- says no more than is_followable_email already does.
create or replace function public.can_message_email(p_email text)
returns boolean
language sql
stable
security definer
set search_path to ''
as $function$
  select auth.email() is not null
     and nullif(btrim(coalesce(p_email, '')), '') is not null
     and (
       public.is_admin()
       or exists (select 1 from public.profiles p
                   where p.email = lower(btrim(p_email))
                     and p.is_public_profile = true
                     and p.moderation_hidden = false)
       or exists (select 1 from public.direct_messages d
                   where lower(d.sender_email) = lower(btrim(p_email))
                     and lower(d.recipient_email) = lower(auth.email()))
       or exists (select 1 from public.geckos g
                   where g.created_by = lower(btrim(p_email))
                     and g.is_public = true
                     and g.moderation_hidden = false
                     and coalesce(g.archived, false) = false)
     );
$function$;

comment on function public.can_message_email(text) is
  'True when the signed-in caller may start or continue a conversation with this address: a public profile, someone who has messaged the caller, the owner of a public gecko, or any address for an admin. Used by the direct_messages insert policy.';

revoke all on function public.can_message_email(text) from public, anon;
grant execute on function public.can_message_email(text) to authenticated, service_role;

drop policy if exists direct_messages_insert on public.direct_messages;
create policy direct_messages_insert on public.direct_messages
  for insert to authenticated
  with check (
    public.is_admin()
    or ((select auth.email()) = sender_email and public.can_message_email(recipient_email))
  );

create or replace function public.guard_direct_message_insert()
returns trigger
language plpgsql
security invoker
set search_path to ''
as $function$
declare
  v_started integer;
  -- Spaces, tabs, line breaks, other control characters, and the Unicode
  -- spaces and invisible marks [:space:] does not cover: no-break space,
  -- the U+2000 to U+200F spaces and zero-width marks, the line and
  -- paragraph separators to U+202F, U+205F to U+2069 (the word joiner,
  -- invisible operators and the bidi isolates), the ideographic space
  -- and the byte order mark.
  v_blank constant text := '[[:space:][:cntrl:]' || chr(160) || chr(5760)
                           || chr(8192) || '-' || chr(8207) || chr(8232) || '-' || chr(8239)
                           || chr(8287) || '-' || chr(8297) || chr(12288) || chr(65279) || ']';
begin
  if current_user not in ('anon', 'authenticated') then
    return new;
  end if;
  -- From the October 2026 release: trimmed of blank characters at either end and
  -- lower-cased, before the check below.
  new.message_type := nullif(lower(regexp_replace(coalesce(new.message_type, ''),
                        '^' || v_blank || '+|' || v_blank || '+$', '', 'g')), '');
  -- Letters only, so "s ystem" or a zero-width space inside the word is
  -- caught too.
  if regexp_replace(coalesce(new.message_type, ''), '[^a-z]', '', 'g') = 'system' and not public.is_admin() then
    raise exception 'Only Geck Inspect sends system messages' using errcode = '42501';
  end if;
  -- The recipient address is stored trimmed and lower-cased, so a message
  -- to "A@X.COM" lands in a@x.com's inbox (where they can see and block
  -- the sender) instead of sitting unseen while it unlocks notifications.
  new.recipient_email := lower(btrim(new.recipient_email));
  -- From the October 2026 release: the same limit as send_direct_message_to_profile. A
  -- first message to someone is how a member learns that an address is
  -- real, so new conversations are capped at 20 an hour.
  if not public.is_admin()
     and not exists (select 1 from public.direct_messages d
                      where (d.sender_email = new.sender_email and d.recipient_email = new.recipient_email)
                         or (d.sender_email = new.recipient_email and d.recipient_email = new.sender_email)) then
    select count(distinct d.recipient_email) into v_started
      from public.direct_messages d
     where d.sender_email = new.sender_email
       and d.created_date > now() - interval '1 hour';
    if v_started >= 20 then
      raise exception 'Too many new conversations in the last hour. Try again later.' using errcode = '54000';
    end if;
  end if;
  return new;
end;
$function$;

revoke all on function public.guard_direct_message_insert() from public, anon, authenticated;

-- =====================================================================
-- 6. Member emails on seven more tables
-- =====================================================================
--
-- Before: breeding_projects, clutches, genetic_outcome_predictions and
-- question_votes have a "read all" policy and a full grant to anon, so a
-- signed-out visitor could read the author's email in created_by. The blog
-- tables (blog_categories, blog_posts, blog_tags) let signed-out visitors
-- read created_by on published rows. Production has no such rows today,
-- so nothing has leaked; this closes it before any exist.
-- After: the same treatment as round 1 section 7. The table grant becomes
-- a grant of every other column. No signed-out page reads the first four
-- tables at all. The blog pages read the blog tables with the column
-- lists in src/lib/publicColumns.js, which leave created_by out (the blog
-- itself stays switched off). Signed-in members are unchanged.
-- A column added to one of these tables later is not readable by
-- signed-out visitors until it is granted.
do $$
declare
  r record;
  v_cols text;
begin
  for r in
    select * from (values
      ('breeding_projects',           array['created_by']),
      ('clutches',                    array['created_by']),
      ('genetic_outcome_predictions', array['created_by']),
      ('question_votes',              array['created_by']),
      ('blog_categories',             array['created_by']),
      ('blog_posts',                  array['created_by']),
      ('blog_tags',                   array['created_by'])
    ) t(tbl, hidden)
  loop
    if to_regclass('public.' || r.tbl) is null then
      continue;
    end if;
    select string_agg(quote_ident(a.attname), ', ' order by a.attnum) into v_cols
      from pg_attribute a
     where a.attrelid = ('public.' || r.tbl)::regclass
       and a.attnum > 0 and not a.attisdropped
       and a.attname <> all (r.hidden);
    -- Only the first time: once the table grant is gone, a second run
    -- must not hand back a column added and deliberately left out since.
    if has_table_privilege('anon', 'public.' || r.tbl, 'select') then
      execute format('revoke select on public.%I from anon', r.tbl);
      execute format('grant select (%s) on public.%I to anon', v_cols, r.tbl);
    end if;
    execute format('revoke select (%s) on public.%I from anon',
                   (select string_agg(quote_ident(h), ', ') from unnest(r.hidden) h), r.tbl);
  end loop;
end
$$;
