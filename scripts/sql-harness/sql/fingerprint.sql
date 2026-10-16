with pol as (
  select 'pol' kind, schemaname||'.'||tablename||'.'||policyname name,
    left(md5(concat_ws('|', permissive, roles::text, cmd, regexp_replace(coalesce(qual,''),'\s+','','g'), regexp_replace(coalesce(with_check,''),'\s+','','g'))),8) h
  from pg_policies where schemaname in ('public','geck_data','storage')
), rel as (
  select 'rel', n.nspname||'.'||c.relname,
    left(md5(concat_ws('|', c.relkind::text, c.relrowsecurity::text, c.relforcerowsecurity::text, regexp_replace(coalesce(c.relacl::text,'-'),'m(\*?)/','\1/','g'),
      (select string_agg(a.attname||':'||format_type(a.atttypid,a.atttypmod)||':'||a.attnotnull::text||':'||coalesce(a.attacl::text,''), ',' order by a.attname) from pg_attribute a where a.attrelid=c.oid and a.attnum>0 and not a.attisdropped))),8)
  from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname in ('public','geck_data') and c.relkind in ('r','v','m','p')
), trg as (
  select 'trg', t.tgrelid::regclass::text||'.'||t.tgname, left(md5(pg_get_triggerdef(t.oid)||t.tgenabled::text),8)
  from pg_trigger t join pg_class c on c.oid=t.tgrelid join pg_namespace n on n.oid=c.relnamespace
  where not t.tgisinternal and n.nspname in ('public','geck_data','auth')
)
select kind||' '||name||' '||h from (select * from pol union all select * from rel union all select * from trg) x order by 1
