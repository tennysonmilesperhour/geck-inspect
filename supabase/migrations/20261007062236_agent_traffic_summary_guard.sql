-- Fix the access check on agent_traffic_summary(): use the request role
-- (service_role for the weekly GitHub Action) and the connection login
-- (postgres for the SQL editor) instead of current_user.

create or replace function public.agent_traffic_summary(p_days int default 7)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_days int := greatest(1, least(coalesce(p_days, 7), 180));
  v_from timestamptz := now() - make_interval(days => v_days);
  v_prev timestamptz := now() - make_interval(days => 2 * v_days);
begin
  -- Only the weekly GitHub Action (service role key) and the SQL editor.
  -- current_user is the owner inside a security definer function, so the
  -- check uses the request's role and the connection's login instead.
  if coalesce(auth.role(), '') <> 'service_role' and session_user not in ('postgres', 'supabase_admin') then
    raise exception 'agent_traffic_summary is for the weekly report only';
  end if;
  return jsonb_build_object(
    'days', v_days,
    'from', v_from,
    'to', now(),
    'total', (select count(*) from agent_hits where at >= v_from),
    'previous_total', (select count(*) from agent_hits where at >= v_prev and at < v_from),
    'by_kind', coalesce((select jsonb_object_agg(kind, n) from (
      select kind, count(*) n from agent_hits where at >= v_from group by kind) k), '{}'::jsonb),
    'by_agent', coalesce((select jsonb_agg(jsonb_build_object('agent', agent, 'kind', kind, 'hits', n, 'previous', prev) order by n desc) from (
      select a.agent, a.kind, count(*) filter (where a.at >= v_from) n, count(*) filter (where a.at < v_from) prev
      from agent_hits a where a.at >= v_prev group by a.agent, a.kind
      having count(*) filter (where a.at >= v_from) > 0 limit 40) b), '[]'::jsonb),
    'top_paths', coalesce((select jsonb_agg(jsonb_build_object('path', path, 'hits', n, 'agents', agents) order by n desc) from (
      select path, count(*) n, count(distinct agent) agents from agent_hits where at >= v_from
      group by path order by count(*) desc limit 50) p), '[]'::jsonb),
    'agent_files', coalesce((select jsonb_agg(jsonb_build_object('path', path, 'agent', agent, 'hits', n) order by n desc) from (
      select path, agent, count(*) n from agent_hits where at >= v_from
        and (path like '%.md' or path like '/llms%' or path like '/data%' or path like '/mcp%' or path like '/.well-known/%')
      group by path, agent order by count(*) desc limit 60) f), '[]'::jsonb),
    'unknown_user_agents', coalesce((select jsonb_agg(jsonb_build_object('ua', ua, 'hits', n) order by n desc) from (
      select ua, count(*) n from agent_hits where at >= v_from and agent in ('other-bot', 'empty-ua')
      group by ua order by count(*) desc limit 25) u), '[]'::jsonb),
    'daily', coalesce((select jsonb_agg(jsonb_build_object('day', d, 'hits', n) order by d) from (
      select at::date d, count(*) n from agent_hits where at >= v_from group by 1) dd), '[]'::jsonb)
  );
end;
$$;
